/**
 * Regenerate public/flowers/manifest.json + provenance.json from the
 * variety_assets registry (M2). The database is the source of truth; the
 * manifest is a build artifact whose shape is IDENTICAL to what the runtime
 * (src/render/textures.ts) already consumes, so the app needs no changes.
 * See docs/ASSET-CLOUD.md and supabase/migrations/0002_asset_registry.sql.
 *
 * Run this after changing assets in the DB, then scripts/upload-assets.mjs to
 * push the refreshed files + manifest to the CDN.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node scripts/generate-manifest.mjs   (or: npm run assets:manifest)
 *
 * A read-only anon key would also work (RLS allows public read), but we reuse
 * the same env vars as the other asset scripts for consistency.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'public/flowers')

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

// supabase-js's realtime client needs a global WebSocket. Node 22+ has one;
// on older Node we borrow `ws` (already present — Vite uses it), so this runs
// without the --experimental-websocket flag on any Node version.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = (await import('ws')).default
}

const db = createClient(url, key, { auth: { persistSession: false } })

const { data: assets, error } = await db
  .from('variety_assets')
  .select('variety_id, colorway_id, angle, src, thumb, recolorable, dark_core, source, license, note')
  .eq('active', true)
  .eq('kind', 'photo')
  .order('variety_id', { ascending: true })
  .order('angle', { ascending: true })

if (error) {
  console.error(`✗ query failed: ${error.message}`)
  process.exit(1)
}

const manifest = {
  version: 1,
  assets: assets.map((a) => ({
    varietyId: a.variety_id,
    colorwayId: a.colorway_id,
    variant: a.angle,
    src: `/flowers/${a.src}`,
    thumb: `/flowers/${a.thumb}`,
    // Emit the flags only when set, matching the hand-written manifest.
    ...(a.recolorable ? { recolorable: true } : {}),
    ...(a.dark_core ? { darkCore: true } : {}),
  })),
}

const provenance = assets.map((a) => ({
  file: a.src,
  source: a.source,
  license: a.license,
  note: a.note,
}))

await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
await writeFile(path.join(OUT_DIR, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n')
console.log(`✓ ${manifest.assets.length} assets → public/flowers/manifest.json (+ provenance.json)`)
