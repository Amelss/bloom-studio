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

- **Add flowers** by clicking a card (or a specific colour dot) in the library. Foliage and
  line material automatically slot in *behind* existing stems — the professional build order.
- **Move** stems by dragging. **Select** a stem to get the context toolbar: rotate, resize,
  flip, recess/advance (depth), recolour, duplicate, delete.
- **Keyboard**: arrows nudge (Shift = ×5) · `R`/`Shift+R` rotate · `[` `]` change depth ·
  `D` duplicate · `F` flip · `⌫` delete · `⌘Z`/`⇧⌘Z` undo/redo · `Esc` deselect.
- **Recipe tab**: live stem counts and costing; edit wholesale prices, change the markup,
  download the recipe/shopping list as CSV.
- **Learn tab** (Learning mode on): live design feedback computed from your canvas, notes on
  the selected flower (role, conditioning, season), and the principles reference library.
- **Learning mode toggle**: switch it off and Bloom Studio becomes the clean professional
  tool — same canvas, same recipe, no tuition. This is the pro/student duality the product
  is built around.
- **Export**: PNG snapshot, or the design file itself (`.bloom.json`) — a versioned document
  you can re-import, share, or hand in.

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
    │   ├── types.ts                # Versioned design document + catalog types
    │   ├── commands.ts             # Invertible command pattern (undo/redo substrate)
    │   ├── store.ts                # Zustand store, history, autosave, migrations
    │   ├── templates.ts            # Blank + starter bouquet documents
    │   └── recipe.ts               # Recipe/costing derivation + CSV export
    ├── education/                  # The learning layer
    │   ├── insights.ts             # Live feedback computed from the design data
    │   └── principles.ts           # Principles & studio-practice content library
    ├── data/catalog.ts             # 12 varieties + vessels, with teaching metadata
    ├── assets/sketches.tsx         # Placeholder botanical artwork (M2: photo pipeline)
    ├── components/
    │   ├── TopBar.tsx              # Name, undo/redo, modes, new/export/import
    │   ├── LibraryPanel.tsx        # Searchable, role-filtered flower library
    │   ├── SelectionToolbar.tsx    # Context controls for the selected stem
    │   ├── SidePanel.tsx           # Recipe / Learn tabs
    │   ├── ErrorBoundary.tsx
    │   ├── canvas/CanvasStage.tsx  # DOM renderer (the seam for WebGL later)
    │   └── panels/{RecipePanel,LearnPanel}.tsx
    ├── utils/download.ts
    └── test/setup.ts
```
