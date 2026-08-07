/**
 * Regenerate src/data/catalog.data.json from the `varieties` + `variety_colorways`
 * registry tables (M2). The database is the source of truth; catalog.data.json is
 * a build artifact consumed by src/data/catalog.ts. Generating at build time (not
 * fetching at runtime) keeps the catalog bundled and instant for offline
 * classrooms. See supabase/migrations/0002_asset_registry.sql.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node scripts/generate-catalog.mjs        (or: npm run assets:catalog)
 *
 * Vessels are NOT in the DB yet, so VESSEL_CATALOG stays hand-written in catalog.ts.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}
// Node < 22 lacks a global WebSocket that supabase-js needs; borrow `ws`.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = (await import('ws')).default
}
const db = createClient(url, key, { auth: { persistSession: false } })

const [{ data: varieties, error: vErr }, { data: colorways, error: cErr }] = await Promise.all([
  db.from('varieties').select('*').order('sort', { ascending: true }),
  db.from('variety_colorways').select('*').order('variety_id').order('sort', { ascending: true }),
])
if (vErr || cErr) {
  console.error(`✗ query failed: ${(vErr || cErr).message}`)
  process.exit(1)
}

const byVariety = new Map()
for (const c of colorways) {
  const list = byVariety.get(c.variety_id) ?? []
  list.push({
    id: c.colorway_id,
    name: c.name,
    petal: c.petal,
    accent: c.accent,
    hue: c.hue,
    // Emit `neutral` only when true, matching the original hand-written shape.
    ...(c.neutral ? { neutral: true } : {}),
  })
  byVariety.set(c.variety_id, list)
}

const out = {
  varieties: varieties.map((v) => ({
    id: v.id,
    commonName: v.common_name,
    botanicalName: v.botanical_name,
    category: v.category,
    guidePriceGBP: Number(v.guide_price_gbp), // Postgres numeric arrives as string
    seasons: v.seasons,
    stemLengthCm: v.stem_length_cm,
    fragility: v.fragility,
    widthMm: v.width_mm,
    colorways: byVariety.get(v.id) ?? [],
    education: v.education,
  })),
}

await writeFile(path.join(ROOT, 'src/data/catalog.data.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`✓ ${out.varieties.length} varieties → src/data/catalog.data.json`)
