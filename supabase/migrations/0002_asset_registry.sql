-- Bloom Studio — Milestone 2: asset registry.
-- Moves the flower catalog + manifest out of code (src/data/catalog.ts,
-- public/flowers/manifest.json) and into the database, so the manifest becomes
-- a generated build artifact (scripts/generate-manifest.mjs) instead of a
-- hand-edited file. See docs/ASSET-CLOUD.md. Run in the Supabase SQL editor.
-- Additive and idempotent-ish; safe to re-run in a fresh project.

-- ─────────────────────────────── varieties ───────────────────────────────
-- One row per flower variety (the top level of catalog.ts).
create table if not exists public.varieties (
  id              text primary key,          -- canonical id, e.g. 'garden-rose'
  common_name     text not null,
  botanical_name  text not null,
  category        text not null check (category in ('focal','secondary','filler','line','foliage')),
  guide_price_gbp numeric(8,2) not null,
  seasons         text[] not null,
  stem_length_cm  int,
  width_mm        int,                        -- true widest width (mm); drives import scale
  fragility       text check (fragility in ('low','medium','high')),
  education        jsonb not null,            -- { role, conditioning, designTip }
  aliases         text[] not null default '{}', -- trade names vary; canonical id + aliases
  sort            int not null default 0
);

-- ──────────────────────────── variety_colorways ──────────────────────────
-- The swatch list shown in the library picker. Always present whether or not a
-- photo exists — a recolourable variety has ONE asset but MANY colourways
-- (blush/coral derived at runtime), so colourways cannot live on the asset row.
create table if not exists public.variety_colorways (
  variety_id  text not null references public.varieties(id) on delete cascade,
  colorway_id text not null,                  -- 'burgundy'
  name        text not null,                  -- 'Burgundy'
  petal       text not null,                  -- '#7c2d3e' — recolour target + swatch
  accent      text not null,
  hue         int  not null,
  neutral     boolean not null default false, -- whites/creams/greens: never recoloured
  sort        int  not null default 0,
  primary key (variety_id, colorway_id)
);

-- ───────────────────────────── variety_assets ────────────────────────────
-- Physical photo files. One row per (variety, colour-shot-in, angle).
create table if not exists public.variety_assets (
  id           uuid primary key default gen_random_uuid(),
  variety_id   text not null references public.varieties(id) on delete cascade,
  colorway_id  text not null,                 -- the colour the photo was SHOT in
  angle        int  not null default 0,       -- = manifest "variant"
  kind         text not null default 'photo' check (kind in ('sketch','photo')),
  -- src/thumb are bucket-relative filenames; generate-manifest prepends
  -- '/flowers/'. Content-address them (…-<hash>.png) so an improved asset swaps
  -- in without breaking saved designs (designs key on variety+colorway+angle).
  src          text not null,
  thumb        text not null,
  recolorable  boolean not null default false, -- base covers all non-neutral colourways at runtime
  dark_core    boolean not null default false, -- protect near-black centre (gerbera eye)
  lod          jsonb,                          -- { thumb, canvas, export } widths (later)
  -- provenance ledger (was public/flowers/provenance.json)
  source       text,
  license      text,
  note         text,
  active       boolean not null default true,  -- soft-retire without losing history
  created_at   timestamptz not null default now(),
  foreign key (variety_id, colorway_id)
    references public.variety_colorways (variety_id, colorway_id) on delete cascade
);

-- One active row per logical slot; also the upsert conflict target for seeding.
create unique index if not exists variety_assets_slot
  on public.variety_assets (variety_id, colorway_id, angle, kind);

-- ─────────────────────────── row-level security ──────────────────────────
-- Assets aren't secret: read is public. Writes go through the service-role key
-- in the generation/seed scripts (which bypass RLS), so no write policy yet —
-- add an admin-write policy when the in-app CMS lands (M5).
alter table public.varieties         enable row level security;
alter table public.variety_colorways enable row level security;
alter table public.variety_assets    enable row level security;

drop policy if exists "varieties_read" on public.varieties;
create policy "varieties_read" on public.varieties for select using (true);

drop policy if exists "colorways_read" on public.variety_colorways;
create policy "colorways_read" on public.variety_colorways for select using (true);

drop policy if exists "assets_read" on public.variety_assets;
create policy "assets_read" on public.variety_assets for select using (true);
