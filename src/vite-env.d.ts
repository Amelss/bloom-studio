/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /**
   * Base URL flower assets are served from. Defaults to `/flowers` (bundled,
   * local dev). Set to the Supabase Storage public bucket URL to serve from the
   * CDN and drop the assets from the bundle — see docs/ASSET-CLOUD.md.
   */
  readonly VITE_ASSET_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
