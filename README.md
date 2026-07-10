# Bloom Studio — Student Edition

**A floral design canvas that teaches while you design.**

Bloom Studio lets floristry students compose arrangements stem by stem on a browser canvas,
with the recipe (stem counts, costing, suggested retail) generated automatically — and a live
learning layer that explains the design principles behind what they're doing: balance, focal
dominance, colour harmony, proportion, and depth, all computed from the actual design.

This is **Milestone 1** of the roadmap in [docs/ROADMAP.md](docs/ROADMAP.md): the core design
canvas, the auto-recipe, and the first learning layer, running entirely locally (no accounts
yet — the design autosaves to your browser and can be exported/imported as a `.bloom.json` file).

## Requirements

- Node.js 18+ (20+ recommended)
- npm 9+

## Setup

```bash
cd bloom-studio
npm install
npm run dev
```

Open http://localhost:5174 — you land in a pre-populated starter bouquet, never an empty canvas.

## Scripts

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Start the dev server on port 5174                 |
| `npm test`          | Run the unit/integration test suite (Vitest)      |
| `npm run test:watch`| Tests in watch mode                               |
| `npm run lint`      | ESLint over the whole project                     |
| `npm run build`     | Type-check then produce a production build        |
| `npm run preview`   | Serve the production build locally                |

## Using the studio

The canvas is a WebGL workspace measured in **real millimetres**: designs live on a
cm-true white artboard (600 × 450 mm by default) inside an infinite pannable workspace.
Stems store their **binding point** (where the hand holds the bunch) and rotate around it,
like a real spiral; depth is organised in florist **bands** (background → body → focal →
accents) rather than raw layers.

- **Camera**: space+drag (or middle-mouse / empty-space drag) pans · scroll pans ·
  `⌘`+scroll or trackpad pinch zooms to the cursor · `⌘0` fit artboard · `⌘1` 100% ·
  `⌘2` fit selection · `+`/`−` step zoom.
- **Grid**: toggle in the canvas footer (or `Shift+'`); adaptive 1–2–5 spacing; optional
  snap at 5/10/25/50 mm (hold `⌘` mid-drag to suspend snapping).
- **Add flowers** by clicking a card (or a colour dot) in the library. New stems drop into
  the bouquet's binding zone with natural outward lean; foliage and line material slot into
  the background band automatically — the professional build order.
- **Select** with a click (pixel-accurate — clicking between petals selects the flower
  behind them). The context toolbar offers rotate, size (±15% botanical variation — flowers
  never stretch), flip, depth within band, band moves, recolour, duplicate, delete.
- **Keyboard**: arrows nudge 1mm (Shift = 10mm) · `R`/`Shift+R` rotate · `[` `]` depth
  within band · `⌘[` `⌘]` move across bands · `D`/`⌘D` duplicate · `F` flip · `⌫` delete ·
  `⌘Z`/`⇧⌘Z` undo/redo · `Esc` deselect.
- **Recipe tab**: live stem counts and costing; edit wholesale prices, change the markup,
  download the recipe/shopping list as CSV.
- **Learn tab** (Learning mode on): live design feedback computed from the design's real
  geometry, notes on the selected flower, and the principles reference library.
- **Learning mode toggle**: off = the clean professional tool; on = the teaching layer.
- **Export**: artboard PNG (rendered by the engine at 2 px/mm), or the design file itself
  (`.bloom.json`, versioned — v1 files migrate automatically).

## Testing

```bash
npm test
```

Covers: command apply/invert round-trips, undo/redo (including drag gestures committing as a
single command), recipe counting/costing/CSV, every insight rule in the feedback engine, and
an app smoke test. Manual test checklist lives in [docs/ROADMAP.md](docs/ROADMAP.md) under
Milestone 1 acceptance.

## Project structure

```
bloom-studio/
├── index.html                      # App entry; fonts, meta
├── package.json / tsconfig.json / vite.config.ts
├── tailwind.config.js / postcss.config.js / eslint.config.js
├── public/favicon.svg
├── docs/
│   ├── ARCHITECTURE.md             # Layers, design-file format, future DB schema
│   └── ROADMAP.md                  # Milestones and acceptance criteria
└── src/
    ├── main.tsx                    # Bootstrap + error boundary
    ├── App.tsx                     # Layout + global keyboard shortcuts
    ├── index.css                   # Tailwind + design tokens
    ├── domain/                     # Pure, renderer-agnostic core (fully unit-tested)
    │   ├── types.ts                # Design document v2: mm units, artboards, depth bands
    │   ├── geometry.ts             # Physical geometry shared by renderer/insights/hit-test
    │   ├── commands.ts             # Invertible command pattern (undo/redo substrate)
    │   ├── migrate.ts              # Format migrations (v1 px → v2 mm)
    │   ├── store.ts                # Zustand store, history, autosave, grid prefs
    │   ├── templates.ts            # Blank + starter spiral-bouquet documents
    │   └── recipe.ts               # Recipe/costing derivation + CSV export
    ├── render/                     # The WebGL canvas engine (PixiJS v8)
    │   ├── camera.ts               # World↔screen maths, zoom-to-cursor, animated fits
    │   ├── grid.ts                 # Adaptive 1–2–5 grid maths + snapping
    │   ├── scene.ts                # Scene graph, render-on-demand, alpha hit-test, export
    │   ├── textures.ts             # SVG → GPU texture pipeline with alpha hit-maps
    │   ├── interactions.ts         # Pointer/wheel/pinch gestures
    │   └── registry.ts             # React ↔ renderer bridge
    ├── education/                  # The learning layer
    │   ├── insights.ts             # Live feedback computed from real design geometry
    │   └── principles.ts           # Principles & studio-practice content library
    ├── data/catalog.ts             # 12 varieties + vessels with real mm sizes
    ├── assets/sketchSvg.ts         # Sketch artwork as SVG strings (Phase C: hi-fi set)
    ├── components/
    │   ├── TopBar.tsx              # Name, undo/redo, modes, new/export/import
    │   ├── LibraryPanel.tsx        # Searchable, role-filtered flower library
    │   ├── SelectionToolbar.tsx    # Context controls incl. depth-band moves
    │   ├── SidePanel.tsx           # Recipe / Learn tabs
    │   ├── ErrorBoundary.tsx
    │   ├── canvas/PixiStage.tsx    # React host for the WebGL canvas
    │   ├── canvas/CanvasFooter.tsx # Zoom, grid, snap, form-guide controls
    │   └── panels/{RecipePanel,LearnPanel}.tsx
    ├── utils/download.ts
    └── test/setup.ts
```
