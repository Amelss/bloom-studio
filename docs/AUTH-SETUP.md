# Auth & Accounts Setup (Supabase)

One-time setup to turn on accounts + cloud designs. ~10 minutes. You do the account/secret steps
(the app code can't create accounts or hold secret keys); everything else is already in the repo.

## 1. Create the Supabase project

1. Sign up / log in at <https://supabase.com> and **New project** (free tier is fine).
2. Pick a name + database password (save the password somewhere).
3. Wait for it to provision (~1–2 min).

## 2. Add the schema

1. Open **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
3. **Run**. This creates `profiles` + `designs`, row-level security, and the sign-up trigger.

## 3. Wire the app to your project

1. **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
2. In the repo, copy `.env.example` to `.env` and fill both in:
   ```
   VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...your-anon-public-key
   ```
   `.env` is git-ignored — never commit it. (The anon key is safe in the browser; row-level
   security is what protects data.)
3. Restart `npm run dev` so Vite picks up the new env vars.

## 4. Email sign-in

Enabled by default. For local testing you may want **Authentication → Providers → Email → disable
"Confirm email"** so you can log in immediately without the confirmation click. Re-enable it before
going live.

## 5. Google sign-in

1. In **Authentication → Providers → Google**, toggle it on — Supabase shows you a **callback URL**
   (looks like `https://YOUR-REF.supabase.co/auth/v1/callback`).
2. In the [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services →
   Credentials → Create OAuth client ID → Web application**:
   - **Authorized redirect URI** = the Supabase callback URL from the previous step.
3. Copy the **Client ID** + **Client secret** back into Supabase's Google provider and save.
4. In **Authentication → URL Configuration**, add your app origins to **Redirect URLs**:
   `http://localhost:5173`, `http://localhost:5174`, and your production URL. The app sends users
   back to `/auth/callback`.

## 6. (Deployment) Vercel

Deploying on **Vercel** (auto-detects Vite → build `npm run build`, output `dist`):

1. **SPA routing** — already handled: `vercel.json` in the repo rewrites every path to
   `/index.html`, so refreshes and deep links (`/design/:id`) resolve to the app instead of a 404.
   Nothing more to do.
2. **Environment variables** — `.env` is git-ignored, so it is NOT deployed. In the Vercel project:
   **Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (the publishable key) for the Production (and Preview) environments, then redeploy.
3. **Auth redirect URLs** — add your Vercel domain(s) to Supabase → **Authentication → URL
   Configuration → Redirect URLs** (e.g. `https://your-app.vercel.app`, plus preview URLs if you
   want auth on previews). The app returns users to `/auth/callback` on whatever origin they used.

(On a different host: Netlify uses a `public/_redirects` file with `/*  /index.html  200`; most
static hosts have an equivalent SPA-fallback setting.)

---

Once `.env` is filled and the SQL has run, sign-up / login / the "My designs" dashboard all work.
Without `.env`, the app still builds and runs but shows a "connect Supabase" notice on the auth
screens.
