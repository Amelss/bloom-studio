# Bloom Studio — Development Roadmap (Education-First)

Pivot from the original spec: same professional design software, built **primarily as an
educational platform** for college/university floristry students — the spec's own §13
"better idea worth considering", made the plan. Every milestone ships working,
production-quality software and stops for review before the next begins.

## Milestone 1 — The Teaching Canvas ✅ (this repo)

Design canvas + auto-recipe + first learning layer, local-only.

**Why first:** the canvas is the product's riskiest bet ("canvas feel" and "arranged, not
collaged"), and the learning layer's core claim — that design feedback can be *computed*
from structured design data — needed proving before anything else is worth building.

**Acceptance checklist (manual):**
- [ ] First run lands in the starter bouquet, not an empty canvas
- [ ] Add each library flower; foliage slots in behind existing stems
- [ ] Drag, rotate, scale, flip, recess/advance, recolour, duplicate, delete a stem
- [ ] Undo/redo works across all of the above; a full drag is one undo step
- [ ] Recipe counts match the canvas; price edit and markup change update retail
- [ ] CSV downloads and opens in a spreadsheet
- [ ] Learn tab feedback changes as you unbalance / rebalance the design
- [ ] Learning mode off = clean professional UI (no Learn tab, no tips)
- [ ] Design survives a browser reload (autosave)
- [ ] Export PNG + .bloom.json; import the JSON back
- [ ] Keyboard-only session is possible; panels readable at 1280×800

## Milestone 1.5 — Canvas Excellence (see CANVAS.md)

Full canvas overhaul before any new product surface, in three phases:

- **Phase A — the engine ✅**: PixiJS v8/WebGL renderer, real-millimetre coordinates
  (document v2 + migration), infinite workspace + cm-true white artboard, adaptive grid +
  snap, alpha-accurate picking, camera pan/zoom.
- **Phase B — the hands ✅**: marquee + multi-select + clusters (batch undo), on-canvas
  transform handles with bounded scaling, smart alignment guides + magnetic form-guide
  snapping, Depth panel (hide/solo/lock per band), numeric precision fields, select-same
  context menu, drag-from-library, searchable `?` shortcuts overlay, SR announcements.
- **Phase C — the eyes ✅**: generative high-fidelity illustration library (layered petal
  geometry, gradients, occlusion shading, 3 seeded variants per variety — no two stems
  identical) packed into shared 2048² texture atlases (measured: **1.96 ms/frame at
  1,500 stems**, was 27 ms unatlased); AI-bridge photographic pipeline (manifest loader +
  Sketch/Photo mode + docs/ASSET-PIPELINE.md — asset production is Ameley's workstream);
  paper options per artboard; filler brush (one-batch-undo strokes); parallax tilt;
  on-canvas insight overlays (live balance marker, hold-X depth x-ray); in-app perf
  benchmark (`?perf=N` + `runBenchmark`).
  *Deferred out of 1.5: multi-frame + per-frame recipes (product design, needs its own
  slot — schema ready); true multi-angle head variants (photographic pipeline's job);
  CI-automated perf runs (benchmark exists in-app; CI needs headless-browser infra).*

## Milestone 2 — Assets & Arrangement Fidelity

The asset pipeline treated as infrastructure: photographic cutout workflow (shoot → cut →
colour-calibrate → tag), asset CMS, LOD tiers on CDN; canvas renderer swap to WebGL (PixiJS)
behind the existing seam; pixel-accurate selection; depth-band placement assists and more
form guides (crescent, cascade, compote dome); 40–60 varieties at photo quality.
**Gate:** prove the pipeline on ~20 varieties before committing to 200 (spec §12).

## Milestone 3 — Accounts, Projects & Sharing

Supabase auth + Postgres (schema in ARCHITECTURE.md); project gallery with thumbnails;
autosave to cloud with local-first cache; versioned snapshots; read-only share links with
the client-facing view and approve/request-changes — the feature that turns the tool into
a business asset, and for students, the hand-in mechanism.

## Milestone 4 — Guided Learning

Exercises engine: briefs with machine-checkable constraints ("asymmetric compote, analogous
palette, ≤£45 cost, ≥3 textures") scored by the insights engine; interactive tutorials
(60-second first-run tour → technique walkthroughs); progress tracking; flower-knowledge
quizzes drawing on the catalog metadata (natural bridge to your existing floristry-app
flashcards/quiz content).

## Milestone 5 — The Classroom

Courses, rosters, join codes; assignment creation/submission/feedback loop; educator
dashboard (cohort progress, common weaknesses surfaced by aggregated insights); rubric
tools; build-order playback from the command log ("watch how this student built it").
This is the site-licence product colleges buy.

## Milestone 6 — Professional Outputs

Proposal builder (design + recipe + terms in one client document), PDF exports with
branding, budget variants per project, event-level grouping (ceremony + reception),
substitution suggestions (rules over catalog metadata first, embeddings later).
Students graduate carrying a professional portfolio out of the same tool.

## Milestone 7 — AI Layer & Scale

Photorealistic render conditioned on the canvas layout (the structured-data moat),
inspiration-photo import → editable draft canvas, palette assistant, template marketplace,
multiplayer co-editing on the CRDT substrate the command log was designed for.

---

**Sequencing logic:** 1 proves the product thesis · 2 makes it beautiful · 3 makes it
persistent and shareable · 4 makes it a teacher · 5 makes it a classroom product colleges
pay for · 6 makes graduates keep it · 7 widens the moat.
