/**
 * One-off bridge: seed the M2 asset registry (varieties, variety_colorways,
 * variety_assets) from the CURRENT in-code catalog + manifest, so the database
 * starts already reflecting today's shipped flowers. After this runs, the DB is
 * the source of truth and scripts/generate-manifest.mjs regenerates the
 * manifest. See docs/ASSET-CLOUD.md and supabase/migrations/0002_asset_registry.sql.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   npm run registry:seed          (or: npx vite-node scripts/seed-registry.ts)
 *
 *   # Validate row-building without a DB or credentials:
 *   npx vite-node scripts/seed-registry.ts --dry-run
 *
 * The service-role key is a SECRET — never commit it, never expose it to the
 * browser. Idempotent: upserts on natural keys, safe to re-run.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FLOWER_CATALOG } from '../src/data/catalog'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DRY_RUN = process.argv.includes('--dry-run')

// ── Build the rows from catalog.ts + manifest.json ────────────────────────
const varieties = FLOWER_CATALOG.map((f, i) => ({
  id: f.id,
  common_name: f.commonName,
  botanical_name: f.botanicalName,
  category: f.category,
  guide_price_gbp: f.guidePriceGBP,
  seasons: f.seasons,
  stem_length_cm: f.stemLengthCm ?? null,
  width_mm: f.widthMm ?? null,
  fragility: f.fragility ?? null,
  education: f.education,
  aliases: [],
  sort: i,
}))

const colorways = FLOWER_CATALOG.flatMap((f) =>
  f.colorways.map((c, i) => ({
    variety_id: f.id,
    colorway_id: c.id,
    name: c.name,
    petal: c.petal,
    accent: c.accent,
    hue: c.hue,
    neutral: Boolean((c as { neutral?: boolean }).neutral),
    sort: i,
  })),
)

interface ManifestAsset {
  varietyId: string
  colorwayId: string
  variant?: number
  src: string
  thumb?: string
  recolorable?: boolean
  darkCore?: boolean
}
const manifest = JSON.parse(
  readFileSync(path.join(ROOT, 'public/flowers/manifest.json'), 'utf8'),
) as { assets?: ManifestAsset[] }

const strip = (p = '') => p.replace(/^\/flowers\//, '')
const assets = (manifest.assets ?? []).map((a) => ({
  variety_id: a.varietyId,
  colorway_id: a.colorwayId,
  angle: a.variant ?? 0,
  kind: 'photo',
  src: strip(a.src),
  thumb: strip(a.thumb),
  recolorable: Boolean(a.recolorable),
  dark_core: Boolean(a.darkCore),
  source: 'externally created production asset',
  active: true,
}))

// ── Sanity checks: every asset's colourway must exist in the swatch list ──
const colorwayKeys = new Set(colorways.map((c) => `${c.variety_id}:${c.colorway_id}`))
const orphans = assets.filter((a) => !colorwayKeys.has(`${a.variety_id}:${a.colorway_id}`))
if (orphans.length) {
  console.error('✗ assets reference colourways missing from the catalog:')
  for (const o of orphans) console.error(`  ${o.variety_id}:${o.colorway_id}`)
  process.exit(1)
}

console.log(
  `built ${varieties.length} varieties, ${colorways.length} colourways, ${assets.length} assets`,
)

if (DRY_RUN) {
  console.log('\n--- dry run: sample rows ---')
  console.log('variety[0]  :', JSON.stringify(varieties[0]))
  console.log('colorway[0] :', JSON.stringify(colorways[0]))
  console.log('asset[0]    :', JSON.stringify(assets[0]))
  console.log('\nno DB write (--dry-run).')
  process.exit(0)
}

// ── Upsert into Supabase (service role bypasses RLS) ──────────────────────
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}
// supabase-js's realtime client needs a global WebSocket. Node 22+ has one; on
// older Node we borrow `ws` (already present — Vite uses it), so this runs
// without the --experimental-websocket flag on any Node version.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = (await import('ws')).default as unknown as typeof WebSocket
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(url, key, { auth: { persistSession: false } })

async function upsert(table: string, rows: unknown[], onConflict: string) {
  const { error } = await db.from(table).upsert(rows as never[], { onConflict })
  if (error) {
    console.error(`✗ ${table}: ${error.message}`)
    process.exit(1)
  }
  console.log(`✓ ${table}: ${rows.length} rows`)
}

// Order matters: varieties → colourways → assets (FK dependencies).
await upsert('varieties', varieties, 'id')
await upsert('variety_colorways', colorways, 'variety_id,colorway_id')
await upsert('variety_assets', assets, 'variety_id,colorway_id,angle,kind')
console.log('seed complete.')
