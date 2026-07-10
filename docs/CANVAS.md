# The Bloom Studio Canvas — Design Specification

Status: **proposal, awaiting approval** · July 2026
Scope: the complete canvas overhaul ("Milestone 1.5") — rendering engine, interaction
model, asset strategy, and the education overlay system. No other product surface changes.

---

## 0. The design thesis

Every decision below follows from three observations about who this canvas serves:

1. **Florists compose in depth and in real size.** Flowers have true dimensions and a
   front-to-back build order. A floral canvas should be measured in millimetres and
   organised in depth bands — not abstract pixels and Photoshop layers.
2. **Students arrive knowing Figma and Canva.** Colleges teach them; muscle memory is
   free adoption. Where a convention exists (space-pan, zoom-to-cursor, marquee, `Cmd+D`),
   we copy it exactly and spend our invention budget on floral-native tools instead.
3. **The canvas is also the teacher.** Owning the renderer means feedback can be drawn
   *on the design* — a balance point you can see, a silhouette you can trace — instead of
   text in a side panel. This is the feature no competitor can copy from a screenshot.

---

## 1. Rendering technology

**Decision: PixiJS v8 (WebGL, WebGPU-capable) behind the existing renderer seam.
React keeps the panels; Pixi owns the canvas element.**

### Why not the alternatives

| Option | Verdict | Reason |
| --- | --- | --- |
| DOM/CSS (current M1) | Replace | No pixel-accurate hit testing; compositing cost grows with node count; CSS-scaled bitmaps blur on zoom; overlays/effects cause reflow jank. It served its purpose: proving the domain model behind a seam. |
| SVG | No | Hundreds of `<image>` nodes + filters = slow; no control over raster LOD; hit testing on alpha impossible without hacks. Right tool for icons, wrong for photographic compositing. |
| Canvas 2D direct | No | Full-scene redraws of large bitmaps on every pan/zoom frame; no GPU mipmaps; we'd hand-build batching, culling, and a scene graph anyway. |
| Konva / Fabric.js | No | Both are Canvas-2D scene graphs built for shapes/text/diagrams. Good libraries, wrong workload: our scene is 100–1000 large alpha-masked *textures* under a moving camera — a GPU sprite-compositing problem. |
| PixiJS v8 | **Yes** | GPU sprite batching, texture atlases with mipmaps (crisp at every zoom), render-to-texture (exports, AI conditioning maps later), alpha-aware picking, culling, WebGPU renderer with WebGL fallback. The industry default for exactly this workload. |
| Custom WebGL (Figma's path) | Not yet | Figma wrote a bespoke engine for text/vector fidelity at extreme scale. Our scene is simpler (sprites); Pixi gets us 95% of that for 5% of the cost. The renderer seam means a bespoke engine remains possible if we ever outgrow Pixi. |

### Integration architecture

- **React renders everything except the canvas**; Pixi owns one `<canvas>` in a host div.
- The Pixi layer **subscribes to the Zustand store imperatively** — no React reconciliation
  in the render path. Store change → targeted sprite mutation → `requestRender()`.
- **Render-on-demand, not a ticker**: frames render only when the document, camera, or an
  animation is dirty. Battery matters on the tablets florists actually use at the bench.
- Scene graph (bottom → top):
  ```
  stage
  ├── workspace          (infinite; grey ground)
  │   └── artboard(s)    (white paper, shadow, cm-true)
  │       ├── band: background   (greenery skeleton)
  │       ├── band: body         (mass/secondary)
  │       ├── band: focal
  │       └── band: accents      (filler floats, trailing material)
  ├── overlays           (grid, form guides, smart guides, insight overlays)
  └── hud                (selection handles, marquee, cursors — zoom-independent size)
  ```
- The seam contract from M1 survives: domain in, draw calls out. The DOM renderer is
  retired, its tests and domain layer carry over untouched (minus coordinate migration).

---

## 2. Coordinate system: real millimetres

**The document's world unit becomes the millimetre.** A garden rose head is ~90mm; a
compote bowl is ~180mm across; stems carry their real `stemLengthCm` already.

Why this matters more than it sounds:

- **Proportion becomes measurable, not vibes.** The 1.5–2× vessel guideline, head-size
  scale steps, silhouette width — the insights engine graduates from heuristic pixels to
  physical truth. Rulers read in cm. A student learns real sizes by osmosis.
- **Recipes stay honest.** A design where roses are drawn at hydrangea scale mis-teaches
  and mis-costs. True relative scale was already in the spec (§5); mm units enforce it.
- **Print/export at physical scale** (1:1 bench sheets, scaled client boards) falls out free.
- Scale on a stem stops being an arbitrary multiplier and becomes **bounded botanical
  variation** (±15% head size per variety) — see §7.

Migration: design document **v2** — positions/sizes in mm, `canvas{}` → `artboards[]`,
`z` → `{band, order}`. One migration function in the existing `migrateDocument()` seam;
v1 files convert losslessly (px→mm at the old implicit scale, z thresholds → bands).

---

## 3. Canvas architecture: infinite workspace + artboards

The request was "make the canvas substantially larger." The stronger version of that idea
is **no fixed size at all** — the Figma model:

- **Infinite, pannable, zoomable workspace** — the designer's desk. Light neutral grey
  (`#F2F2F0`), subtle paper-grain off state, nothing to configure.
- **Artboards ("frames") are the design surface** — cm-true white panels with a soft
  shadow. Default new document: one 600 × 450 mm frame ("Bouquet — presentation size").
  Presets: bouquet, compote centrepiece, funeral spray, arch section (2400mm!), free.
- **Multiple frames on one canvas** (Phase B): a full wedding — bouquet + centrepiece +
  boutonnière — designed side by side at true relative scale, exactly how the event is
  actually planned and quoted. Each frame gets its own recipe roll-up; the project totals.
- Off-frame space is a legitimate **staging area** (florists lay stems on the bench beside
  the vase): stems parked outside a frame are excluded from that frame's recipe but saved.

### Camera

- Zoom range **2%–1600%**, zoom-to-cursor on wheel/pinch, `Cmd+0` fit, `Cmd+1` 100%,
  `Cmd+2` fit-selection. Animated transitions (180ms ease-out) — abrupt camera jumps are
  the #1 "feels cheap" tell.
- **Space-drag pan** (hold space = hand tool), two-finger trackpad pan, middle-mouse pan.
  Touch: pinch zoom + two-finger pan, first-class — the bench device is an iPad.
- Custom camera module (~200 lines) rather than `pixi-viewport`: we need exact zoom-to-
  cursor math, animated fit, and later scripted "camera tours" for tutorials. (If custom
  input handling fights us on trackpad edge cases, `pixi-viewport` is the tested fallback —
  re-verify its maintenance status at implementation time.)

### Background

Workspace grey is fixed; **frame paper is white by default** as requested — with a per-frame
paper option (Pure white / Ivory / Blush studio / Charcoal). Not decoration: white bouquets
are invisible on white, and florists legitimately present against dark grounds. The M1
cream becomes one option, never the default.

---

## 4. Grid, snapping, and guides

Grid (the request) — plus the two snapping systems that will actually get used more:

1. **Adaptive grid** (CAD behaviour): lines at 10mm, majors at 50mm/100mm, subdivisions
   appear/dissolve as you zoom so density stays constant. Toggle `Shift+'`; line or dot
   style; snap-to-grid toggle with step options (5/10/25/50mm). Used for vessel placement,
   frame layout, spacing discipline.
2. **Smart alignment guides** (Figma behaviour): while dragging, live guides light up
   against neighbouring stems' centres/edges and the frame's centre axes, with
   equal-spacing hints. This is the snapping florists will feel as "it just helps" —
   flowers rarely sit on a grid, but they constantly relate to each other and to the axis.
3. **Form-guide snapping — the floral-native invention.** The round/crescent/cascade
   overlays become *magnetic curves*: drag a stem near the silhouette and its head snaps
   onto the form line, auto-rotating tangent to the curve (the way stems actually splay).
   Teaching and assistance in one gesture; no generic design tool has this.

Universal rules: **hold `Cmd` to suspend all snapping mid-drag** (Figma convention);
snapped positions show a subtle tick; angle snap on rotation at 15° with `Shift`.

---

## 5. Selection

- **Pixel-accurate (alpha-aware) picking**: hit = texture alpha > 0.1 at the point, checked
  front-to-back. Clicking between two petals selects the flower behind them — fixes M1's
  bounding-box limitation properly rather than patching it.
- **`Alt+click` digs**: cycles selection to the next stem beneath the cursor (Illustrator's
  click-through). Essential in dense arrangements.
- **Marquee** on empty-space drag (touch: long-press then drag); `Shift+click` add/remove;
  `Cmd+A` select all in frame; `Esc` clear.
- **Select-same**: right-click → "Select all Blush Garden Roses (7)" / "…all Gypsophila".
  Maps exactly to how recipes think; combined with recolour it makes "swap all blush roses
  to burgundy" a two-click operation across the whole design.
- **Clusters (`Cmd+G`)** — groups, named for the real technique of wiring/zip-tying 3–5
  stems into one textural unit. A cluster selects, moves, rotates, and duplicates as one;
  the recipe shows it as a unit with a stem breakdown. `Cmd+Shift+G` ungroups; double-click
  enters the cluster to edit a member (Figma convention).
- Multi-selection transforms around the **combined binding centroid** — rotating a handful
  of stems behaves like rotating a bunch held in your hand.

---

## 6. Layer management: depth bands, not a layers panel

A Photoshop-style flat layer list mismatches how arrangements are built. Florists work in
**depth bands**: greenery skeleton → body → focal placements → floating accents. So:

- Every stem belongs to a **band** (`background / body / focal / accents`) plus a fine
  order within it. Defaults come from the variety's role (foliage → background) but are
  always overridable — a focal rose can be recessed deliberately.
- The **Depth panel** replaces a layers panel: four bands with thumbnails, drag-reorder,
  and per-band **hide / lock / solo**. "Hide everything but greenery" is a structural
  x-ray of the design — a teaching tool that costs nothing extra.
- `[` `]` move within band; `Cmd+[` `Cmd+]` move across bands. The insights engine's depth
  rules get categorically cleaner input (band membership vs. inferred z comparisons).

---

## 7. Transforms

- **On-canvas handles** (M1's biggest gap): rotated bounding box with corner scale handles
  and a rotation handle; cursor changes per affordance; live degree/size readout near the
  cursor while transforming.
- **Rotation pivots at the binding point by default** — stems fan the way a spiralled bunch
  moves in the hand. Toggle to head-centre pivot for fine placement. `Shift` = 15° steps.
- **Scale is always proportional and always bounded.** No free stretch, ever — a distorted
  rose teaches a lie and looks like clip-art. Scale maps to real head size within ±15%
  botanical variation per variety; wanting "a much bigger bloom" means choosing a bigger
  variety, which is itself a lesson. (Educators can unlock bounds in a setting if a lesson
  needs exaggeration.)
- **Numeric precision panel** for the selection: X/Y (cm, from frame origin), rotation (°),
  head size (cm), band. Tab between fields; maths in fields (`+5`, `/2`) like CAD inputs.
- Nudge 1mm, `Shift` 10mm. `Alt+drag` duplicates (Illustrator). All transforms remain
  single invertible commands — gesture = one undo step, as in M1.

---

## 8. Drag-and-drop and placement

- **Drag from library onto canvas** with a live ghost at true drop position (world-space,
  under the cursor, not an OS drag image); smart guides and form-snapping active during the
  drag; drop settles with a 120ms scale/rotation ease — the "placed, not teleported" feel.
- **Click-to-add stays** (Canva speed): places near the last placement with the M1 outward-
  lean jitter, which is what keeps quick building looking arranged rather than collaged.
- Band auto-assignment on placement (foliage behind) with an on-drop override chip.
- **Filler brush (Phase C)** — the floral power tool: select gypsophila/greenery, paint a
  stroke, stems scatter along it with natural density/jitter/rotation variation. Filler is
  placed in dozens, not singles; this converts the most tedious task into the most
  satisfying one. Brush parameters: density, spread, size variation.

---

## 9. Keyboard map (Figma-convention baseline)

`V` select · `H`/space hand · `Cmd+scroll`/pinch zoom · `Cmd+0/1/2` fit/100%/fit-selection ·
`Cmd+Z`/`Shift+Cmd+Z` undo/redo · `Cmd+D` duplicate · `Alt+drag` duplicate ·
`Cmd+G`/`Shift+Cmd+G` cluster/uncluster · `[` `]` depth (+`Cmd` across bands) ·
`R`/`Shift+R` rotate ±15° · `F` flip · arrows nudge (+`Shift` ×10) · `Del` remove ·
`Shift+'` grid · `Cmd+;` smart guides · `Esc` deselect/exit cluster · **`?` opens a
searchable shortcuts overlay**. Every shortcut also exists as a visible control — keyboard
is acceleration, never the only path (accessibility and touch parity).

---

## 10. Flower rendering — the honest strategy

**Photorealism is a content problem, not a rendering problem.** No renderer choice makes
roses look real; assets do. The spec (§12) already names the answer — the photographic
cutout pipeline — and that is physical-world work (shooting rig or licensed cutout
libraries, colour calibration, QA). The canvas's job is to make asset quality *swappable*:

- **Architecture: every bloom is a textured sprite** with metadata — physical size, head
  anchor, binding anchor, angle variant, colorway. The renderer is agnostic about whether
  the texture came from an illustration or a photograph. When photography lands, it drops
  in with zero renderer changes.
- **Now (Phase C): a high-fidelity illustration library** to replace the placeholders —
  layered parametric petal geometry with radial gradient shading, ambient occlusion between
  petal layers, silhouette irregularity, vein/texture detail; **3 head angles per variety**
  (front / three-quarter / profile — real arranging is about head orientation, and angle
  variants fake dimensionality convincingly); natural per-stem variation from a seeded
  parameter set so no two roses are pixel-identical. Built by an offline script →
  **texture atlases at 3 LOD tiers** (256/512/1024px heads), mipmapped. Style target:
  premium botanical illustration — the aesthetic florists already use on their own
  branding — explicitly not flat clip-art.
- **Sketch mode becomes a feature, not an apology.** Illustration mode teaches structure
  and stays fast; photo mode (when the pipeline lands) is client-facing realism. A design
  can toggle between them because both are just texture sets over the same document.
  Educators will genuinely prefer sketch mode for form teaching.
- **Paths to photographic assets — a decision for Ameley, not a code task:**
  (a) license an existing cutout-photography collection (fastest, needs budget + licence
  review); (b) commission/shoot per spec §12, starting 10–20 varieties (the real moat,
  slowest); (c) AI-generated cutouts as a bridge (fast, but consistency + licensing caveats
  and needs curation). Canvas work proceeds regardless; none of Phases A–C block on this.

---

## 11. Performance engineering

Budgets (regression-tested, not aspirational):

| Metric | Target |
| --- | --- |
| Pan/zoom with 500 stems, mid-range iPad | 60fps |
| 1,500 stems, desktop | 60fps pan/zoom, <150MB texture memory |
| Drag latency (input → sprite move) | <16ms |
| Cold load to interactive starter design | <2s on 4G |

Techniques: atlas-based batching (draw calls stay ~1 per band, not per stem); mipmaps +
LOD tier swap by zoom; viewport culling; `devicePixelRatio` capped at 2; render-on-demand;
async texture decode with fade-in; sprite pooling. Dev-only HUD: fps / draw calls / texture
memory. CI perf test: scripted pan-zoom-drag over a synthetic 1,500-stem document, failing
the build on frame-time regression.

---

## 12. 3D and perspective: design the data for it, don't pay for it

Full 3D is BloomyPro's enterprise territory and would multiply asset cost ~10× (spec §12)
while alienating the wedge market. The plan:

- The document model is **already depth-true** (bands ≈ physical recession); a future 3D
  renderer could interpret the same file. We keep that property deliberately.
- **Parallax tilt preview** (Phase C, cheap): subtle camera-driven parallax between depth
  bands on drag/gyro — seconds of compute, disproportionate "it's alive" effect, and it
  makes depth *visible* for teaching.
- **Angle variants** (§10) cover head orientation — most of what florists mean by "3D".
- Photorealism-from-any-angle is the **AI render milestone's** job, and our bands +
  per-stem segmentation are exactly the conditioning maps it will need. Structure is the
  moat; pixels are downstream.

---

## 13. Education extensibility — why owning the renderer matters most

A dedicated **overlay API** (insight overlays draw into the `overlays` container with the
same camera transform) unlocks feedback drawn on the design itself:

- **Balance marker**: computed centre of visual weight vs. frame axis — watch it move as
  you drag a rose. The abstract principle becomes a physical object.
- **Depth x-ray**: bands fan apart on a keyboard hold — the design's cross-section.
- **Silhouette trace**: outline extraction shows whether the form reads round/crescent and
  where the outline has gone hard.
- **Recipe brushing**: hover a recipe line → those stems glow on canvas (and vice versa).
- **Focal heat**: where the eye lands, from size/saturation/position weighting.
- Later: command-log **ghost playback** on canvas (instructor watches the build order).

Every one of these is a small draw routine on data the insights engine already computes —
and every one is impossible in a DOM renderer without jank. This section is the strategic
payoff of the whole overhaul.

---

## 14. Delivery plan — three testable phases

**Phase A — The engine.** Pixi renderer + custom camera (pan/zoom/fit, animated), white
workspace + artboard, mm coordinates + document v2 migration, adaptive grid + grid snap,
alpha-accurate picking, port of all M1 interactions and shortcuts.
*Exit criteria: full M1 feature parity + pan/zoom/grid; 60fps @ 500 stems on iPad; all
domain tests green; v1 designs open correctly.*

**Phase B — The hands.** Transform handles + numeric panel, marquee/multi-select/clusters,
smart guides + angle snap + form-guide snapping, depth bands + Depth panel, select-same,
drag-from-library ghosts, full shortcut overlay, multi-frame support.
*Exit criteria: the interaction checklist below passes on desktop + iPad.*

**Phase C — The eyes.** High-fidelity illustration library (parametric pipeline → LOD
atlases, 3 angles, 12 varieties), paper options, filler brush, parallax tilt, first two
insight overlays (balance marker, depth x-ray).
*Exit criteria: a florist looking at the starter bouquet does not say "clip-art".*

Each phase ends with working software and a review pause. The photographic-asset sourcing
decision (§10) can be made in parallel and does not block any phase.

---

## 15. Acceptance checklist (Phase B+ interaction feel)

- [ ] Wheel-zoom keeps the point under the cursor stationary at all zoom levels
- [ ] Space-pan and pinch never select or move stems
- [ ] Drag never drops frames at 500 stems (iPad); selection ring tracks at 60fps
- [ ] Clicking between petals selects the flower visually behind them
- [ ] `Alt+click` cycles through overlapping stems predictably
- [ ] A full drag with snapping engaged is exactly one undo step
- [ ] Grid density stays visually constant from 10% to 800% zoom
- [ ] Form-guide snap rotates stems tangent to the curve
- [ ] Keyboard-only: place, position, rotate, band-move, and delete a stem
- [ ] Screen reader announces selection, position, and band changes
- [ ] 1,500-stem synthetic doc: pan/zoom stays under frame budget in CI
