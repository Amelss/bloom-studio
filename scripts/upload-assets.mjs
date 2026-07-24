/**
 * Upload flower assets to Supabase Storage (docs/ASSET-CLOUD.md, step 3).
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node scripts/upload-assets.mjs
 *
 * Uploads every file in public/flowers/ (PNGs + manifest.json + provenance.json)
 * into a PUBLIC bucket, so the app can serve them from the CDN. Point the app at
 * the bucket by setting, in .env:
 *
 *   VITE_ASSET_BASE_URL=https://<ref>.supabase.co/storage/v1/object/public/flower-assets
 *
 * The service-role key is a SECRET — never commit it, never expose it to the
 * browser. This script runs locally/CI only. It is idempotent (upsert), so
 * re-running after regenerating assets just refreshes the changed files.
 */

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'flower-assets'
const SRC_DIR = new URL('../public/flowers/', import.meta.url).pathname

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const CONTENT_TYPE = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET)
  if (data) return
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    cacheControl: '31536000', // 1 year — assets are content-addressed
  })
  if (error) throw error
  console.log(`created public bucket "${BUCKET}"`)
}

async function main() {
  await ensureBucket()
  const files = (await readdir(SRC_DIR)).filter((f) => !f.startsWith('.'))
  let ok = 0
  for (const file of files) {
    const body = await readFile(path.join(SRC_DIR, file))
    const contentType = CONTENT_TYPE[path.extname(file)] ?? 'application/octet-stream'
    const { error } = await supabase.storage.from(BUCKET).upload(file, body, {
      contentType,
      upsert: true,
      cacheControl: '31536000',
    })
    if (error) {
      console.error(`✗ ${file}: ${error.message}`)
    } else {
      ok++
    }
  }
  console.log(`uploaded ${ok}/${files.length} files to ${BUCKET}`)
  console.log(
    `\nSet in .env:\n  VITE_ASSET_BASE_URL=${url}/storage/v1/object/public/${BUCKET}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
