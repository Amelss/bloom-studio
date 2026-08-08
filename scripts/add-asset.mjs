/**
 * One-command flower asset add (M2) — replaces the hand-written SQL INSERT.
 * Normalises the image, registers it in the `variety_assets` table, and
 * regenerates the manifest (and catalog, if a new colourway is created).
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node scripts/add-asset.mjs <image.png> <variety> <colorway> [options]
 *   # or:  npm run assets:add -- <image.png> <variety> <colorway> [options]
 *
 * Options:
 *   --variant <n>     variant / camera angle index (default 0)
 *   --recolorable     mark as the variety's recolourable base (colours derived at runtime)
 *   --dark-core       protect a near-black centre (e.g. gerbera eye) through recolour
 *   --name <Name>     create the colourway if it's new (needs --petal too)
 *   --petal <#hex>    colourway swatch / recolour target
 *   --accent <#hex>   colourway accent (defaults to --petal)
 *   --hue <deg>       colourway hue, 0–360 (default 0)
 *   --neutral         colourway is a white/cream/green (never recoloured)
 *   --no-manifest     don't regenerate manifest.json afterwards
 *   --dry-run         validate + print the plan; no image or DB writes
 *
 * Afterwards: upload with `node scripts/upload-assets.mjs`, then commit.
 * Requires the 0002 migration applied and the registry seeded (docs/ASSET-CLOUD.md).
 */
import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    variant: { type: 'string', default: '0' },
    recolorable: { type: 'boolean', default: false },
    'dark-core': { type: 'boolean', default: false },
    name: { type: 'string' },
    petal: { type: 'string' },
    accent: { type: 'string' },
    hue: { type: 'string' },
    neutral: { type: 'boolean', default: false },
    'no-manifest': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
})

const [image, variety, colorway] = positionals
if (!image || !variety || !colorway) {
  console.error('usage: node scripts/add-asset.mjs <image.png> <variety> <colorway> [options]')
  process.exit(1)
}
const variant = Number(values.variant)
const src = `${variety}-${colorway}-${variant}.png`
const thumb = `${variety}-${colorway}-${variant}-thumb.png`

const assetRow = {
  variety_id: variety,
  colorway_id: colorway,
  angle: variant,
  kind: 'photo',
  src,
  thumb,
  recolorable: values.recolorable,
  dark_core: values['dark-core'],
  source: 'added via add-asset.mjs',
  active: true,
}
const colourwayRow =
  values.name && values.petal
    ? {
        variety_id: variety,
        colorway_id: colorway,
        name: values.name,
        petal: values.petal,
        accent: values.accent ?? values.petal,
        hue: values.hue != null ? Number(values.hue) : 0,
        neutral: values.neutral,
        sort: 99,
      }
    : null

if (values['dry-run']) {
  console.log('DRY RUN — no image or DB writes\n')
  console.log(`normalise → public/flowers/${src} (+ ${thumb})`)
  if (colourwayRow) console.log('create colourway →', JSON.stringify(colourwayRow))
  console.log('upsert variety_assets →', JSON.stringify(assetRow))
  console.log(`\nregenerate: ${colourwayRow ? 'catalog + ' : ''}manifest${values['no-manifest'] ? ' (skipped)' : ''}`)
  process.exit(0)
}

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
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(url, key, { auth: { persistSession: false } })

// 1. The variety must already exist (a whole new variety needs richer metadata).
const { data: varietyRow, error: vErr } = await db
  .from('varieties')
  .select('id')
  .eq('id', variety)
  .maybeSingle()
if (vErr) fail(vErr.message)
if (!varietyRow) fail(`variety "${variety}" not found — add it to the DB first.`)

// 2. Normalise the image FIRST, so a bad image fails before any DB writes.
const cut = spawnSync('node', ['scripts/import-cutout.mjs', image, variety, colorway, String(variant)], {
  cwd: ROOT,
  stdio: 'inherit',
})
if (cut.status !== 0) fail('image normalisation failed (see output above).')
if (!existsSync(path.join(ROOT, 'public/flowers', src))) fail(`expected ${src} was not produced.`)

// 3. Create the colourway if it's new; otherwise it must already exist (FK).
const { data: cwRow } = await db
  .from('variety_colorways')
  .select('colorway_id')
  .eq('variety_id', variety)
  .eq('colorway_id', colorway)
  .maybeSingle()
let createdColourway = false
if (!cwRow) {
  if (!colourwayRow) {
    fail(
      `colourway "${variety}:${colorway}" doesn't exist. Pass --name and --petal ` +
        '(plus optional --accent/--hue/--neutral) to create it.',
    )
  }
  const { error } = await db.from('variety_colorways').insert(colourwayRow)
  if (error) fail(`colourway insert: ${error.message}`)
  createdColourway = true
  console.log(`✓ created colourway ${variety}:${colorway}`)
}

// 4. Register (upsert) the asset row.
const { error: aErr } = await db
  .from('variety_assets')
  .upsert(assetRow, { onConflict: 'variety_id,colorway_id,angle,kind' })
if (aErr) fail(`asset upsert: ${aErr.message}`)
console.log(`✓ registered ${src}${values.recolorable ? ' [recolorable base]' : ''}`)

// 5. Regenerate the generated artifacts from the DB.
if (!values['no-manifest']) {
  if (createdColourway) run('scripts/generate-catalog.mjs')
  run('scripts/generate-manifest.mjs')
}

console.log('\n✓ done. Next: `node scripts/upload-assets.mjs` to push to the CDN, then commit.')

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, stdio: 'inherit', env: process.env })
  if (r.status !== 0) fail(`${script} failed.`)
}
function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}
