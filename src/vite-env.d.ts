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
  /**
   * DEV ONLY. When 'true' (and running the dev server), bypasses the auth gate
   * with a mock user so the canvas is reachable without signing in. Stripped
   * from production builds via import.meta.env.DEV. Never set in deployment.
   */
  readonly VITE_DEV_NO_AUTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
