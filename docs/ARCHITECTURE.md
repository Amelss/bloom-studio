# Bloom Studio — Architecture

## Principles

1. **The design document is the product.** Everything — canvas, recipe, learning feedback,
   future AI render and instructor review — derives from one versioned, structured document.
   Prompt-based competitors output pixels; we output structure. The same structure is what
   makes *teaching* computable.
2. **Every mutation is an invertible command.** Undo/redo today; op-log for versioning,
   multiplayer (CRDT/Yjs), and instructor playback ("watch how this student built it") later.
3. **The renderer is a seam.** Milestone 1 renders with DOM/CSS transforms (plenty for ≤50
   sketch sprites, and trivially testable). The scene model knows nothing about the DOM;
   when the photographic asset library and 100–300-sprite designs arrive, a PixiJS/WebGL
   renderer replaces `components/canvas/` without touching the domain.
4. **Education is a layer, not a fork.** Learning mode toggles tuition on top of the same
   professional tool — students graduate into the pro workflow, not out of a toy.

## Layers

```
┌─ components/ (React UI) ──────────────────────────────┐
│  TopBar · LibraryPanel · SelectionToolbar · SidePanel │
│  canvas/CanvasStage  ← DOM renderer (swap seam)       │
└──────────────▲────────────────────────────────────────┘
               │ subscribes (zustand selectors)
┌─ domain/ (pure TypeScript, fully tested) ─────────────┐
│  store.ts    – state, history, autosave, migration    │
│  commands.ts – apply/invert                           │
│  recipe.ts   – derived costing                        │
│  templates.ts– starter documents                      │
└──────────────▲────────────────────────────────────────┘
               │ reads
┌─ education/ + data/ ──────────────────────────────────┐
│  insights.ts   – feedback computed from the document  │
│  principles.ts – content library                      │
│  catalog.ts    – varieties, vessels, teaching notes   │
└───────────────────────────────────────────────────────┘
```

## The design file format (`.bloom.json`)

Versioned from v1 (`DESIGN_DOC_VERSION`). Rules:

- Additive changes (new optional fields) do **not** bump the version.
- Breaking changes bump the version and require a migration function in
  `migrateDocument()` (`domain/store.ts`), which is the single entry point for any document
  entering the app (import, cloud load later). Never remove a migration.
- Files from a *newer* version are rejected with a clear message rather than mangled.

## Persistence

Milestone 1: the working design + preferences autosave to `localStorage` via zustand
`persist`. Export/import gives durable files. Milestone 3 replaces this with accounts and
cloud projects (schema below) while keeping local-first caching — florists work in venues
with terrible Wi-Fi, and students in classrooms with worse.

## Target database schema (Milestone 3+, PostgreSQL/Supabase)

Designs stay JSONB documents (the format above) with relational metadata around them —
flexible document evolution with real querying. Education entities land in Milestone 6.

```sql
-- People
create table profiles (
  id          uuid primary key references auth.users,
  display_name text not null,
  role        text not null default 'student'
              check (role in ('student', 'educator', 'professional', 'admin')),
  created_at  timestamptz not null default now()
);

-- Design projects
create table designs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id),
  name        text not null,
  doc         jsonb not null,             -- the versioned design document
  doc_version int  not null,              -- denormalised for migration sweeps
  thumbnail_url text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index designs_owner_idx on designs (owner_id, updated_at desc);

create table design_versions (             -- explicit snapshots ("hand-in", "v2 budget")
  id          uuid primary key default gen_random_uuid(),
  design_id   uuid not null references designs(id) on delete cascade,
  label       text,
  doc         jsonb not null,
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);

-- Asset catalog (replaces the in-code catalog when the CMS lands, M2)
create table varieties (
  id            text primary key,          -- canonical id, e.g. 'garden-rose'
  common_name   text not null,
  botanical_name text not null,
  category      text not null check (category in ('focal','secondary','filler','line','foliage')),
  guide_price_gbp numeric(8,2) not null,
  seasons       text[] not null,
  stem_length_cm int,
  fragility     text check (fragility in ('low','medium','high')),
  education     jsonb not null,            -- role / conditioning / designTip
  aliases       text[] not null default '{}' -- trade names vary; canonical id + aliases
);

create table variety_assets (
  id          uuid primary key default gen_random_uuid(),
  variety_id  text not null references varieties(id),
  colorway_id text not null,
  colorway    jsonb not null,              -- name, petal, accent, hue, neutral
  kind        text not null check (kind in ('sketch','photo')),
  angle       int not null default 0,
  url         text,                        -- CDN path (photo pipeline)
  lod         jsonb                        -- thumbnail / canvas / export resolutions
);

-- Education layer (Milestone 6)
create table courses (
  id          uuid primary key default gen_random_uuid(),
  educator_id uuid not null references profiles(id),
  name        text not null,
  join_code   text unique not null
);

create table enrollments (
  course_id   uuid references courses(id) on delete cascade,
  student_id  uuid references profiles(id) on delete cascade,
  primary key (course_id, student_id)
);

create table assignments (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  title       text not null,
  brief       text not null,               -- e.g. "Asymmetric compote, analogous palette, ≤£45 cost"
  constraints jsonb,                       -- machine-checkable: budget, palette, stem limits
  due_at      timestamptz
);

create table submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id    uuid not null references profiles(id),
  design_version_id uuid not null references design_versions(id),
  submitted_at  timestamptz not null default now(),
  auto_feedback jsonb,                     -- insights engine output at submission time
  educator_feedback text,
  grade         text
);
```

Row-level security: students see their own rows; educators see rows for their courses.

## Canvas engine (Milestone 1.5 Phase A — implemented)

The DOM renderer is retired; the canvas is now **PixiJS v8 (WebGL)** per
[CANVAS.md](CANVAS.md). Key properties as built:

- **Real-millimetre world** (document v2): stems store binding points; artboards are
  cm-true; migration v1→v2 lives in `domain/migrate.ts`.
- **Render-on-demand**: the ticker is stopped; frames render only when the document,
  camera, selection, or a texture arrival makes them necessary.
- **Alpha-accurate picking** from low-res alpha maps kept beside each texture.
- **Camera** (`render/camera.ts`) is Pixi-free pure maths, unit-tested; honours
  `prefers-reduced-motion` by snapping instead of animating.
- **Adaptive 1–2–5 grid** with optional snapping; `⌘` suspends snap mid-drag.
- React chrome talks to the renderer through `render/registry.ts` — camera changes are
  announced on an emitter, never routed through the store at 60Hz.

## Known limitations (deliberate, tracked)

- **Sketch artwork, not photography.** Phase C replaces it with the high-fidelity
  illustration atlases; the photographic (AI-bridge) pipeline follows per the roadmap.
- **Empty-space drag pans** as an interim gesture; Phase B replaces it with marquee
  selection (pan remains on space/middle-drag/scroll).
- **No transform handles yet** — rotate/scale live in the toolbar and keyboard until
  Phase B's on-canvas handles.
- **Single design, local only.** Projects, accounts, and sharing are M3.
- **`window.confirm`/`alert`** for destructive-action guards; replaced by proper dialogs
  when the design system grows.
