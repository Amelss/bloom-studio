# Photographic Asset Pipeline (AI-Bridge)

How to produce photographic cutout assets and drop them into Bloom Studio.
No code changes are needed: the renderer treats every bloom as a textured
sprite, and photographs are just a second texture source behind the same
interface (`render/textures.ts`). The **Sketch / Photo** toggle in the canvas
footer switches modes; varieties without photographs fall back to
illustration automatically, so the library can be filled incrementally.

## The layout contract

Every asset must be normalised to the standard sprite layout (the same one
the illustrations use — see `assets/sketchSvg.ts`):

- **Aspect ratio 100 : 160** (e.g. 1280 × 2048 px). Transparent background
  (real alpha, not white).
- **Bloom head centre at 26.25% of the height**, horizontally centred.
- **Binding point (stem base) at 93.75% of the height**, horizontally centred
  — the stem should run to this point; rotation pivots here.
- The flower should FILL the width the way the variety fills its `widthMm`
  (catalog value): the sprite is scaled so its full width = `widthMm` on
  canvas. Include natural leaves if the variety carries them.
- Consistent lighting across the whole set: soft, diffuse, lit from upper
  left (matches the illustration shading and the artboard shadow).

## Producing cutouts with an image generator

Suggested prompt skeleton (tune per variety, keep the wording consistent
across the set so lighting/style match):

> A single fresh-cut [Garden Rose, blush pink] flower with stem and leaves,
> studio product photography, soft diffuse lighting from the upper left,
> isolated on transparent background, entire stem visible, photographed
> straight-on, hyper-detailed petals, no vase, no hands, no text.

Per-variety descriptors to splice into the skeleton (form words a florist would
use — these are what stop the generator producing "generic pink flower"):

| Variety | Descriptors |
| --- | --- |
| garden-rose | fully open quartered garden rose, densely ruffled swirled centre, broad reflexed guard petals |
| peony | Sarah Bernhardt / bomb-form peony, dense ruffled dome of layered petals, broad guard petals |
| ranunculus | Cloni ranunculus, hundreds of tightly packed paper-thin concentric petals, small green button eye |
| lisianthus | double lisianthus, ruffled rose-like open cup, two spiralled pointed buds on branching stem |
| carnation | fringed serrated-edge ruffled petals, prominent tubular green calyx below the bloom |
| hydrangea | mophead hydrangea, dense dome of dozens of four-petalled florets |
| delphinium | tall delphinium raceme, open florets with pale central bee, pointed buds at the tip |
| gypsophila | fine wiry branching stems, cloud of tiny double white blooms |
| spray-rose | branched spray rose, several small open rosettes plus pointed sepalled buds on one stem |
| astilbe | feathery tapering astilbe plumes on fine branching stems |
| eucalyptus | silver dollar eucalyptus, rounded glaucous blue-grey coin leaves on short petioles, reddish stem |
| ruscus | Italian ruscus, arching stem of alternating glossy lance-shaped leaves |
| leatherleaf | leatherleaf fern, flat triangular bipinnate frond, glossy serrated pinnae |

Then per image:

1. **Cut out** (if the generator can't output alpha): any background-removal
   tool; check petal edges at 200% — halos and hard clip edges are what make
   assets read as pasted.
2. **Normalise** with the built-in tool: run the app and open
   **`/asset-normalizer.html`** — drop the cutout, drag/scroll until the bloom
   centre sits on the crosshair and the stem end on the binding dot, fill in
   variety/colorway/variant, and export. It saves the correctly-sized PNG with
   the correct filename AND gives you the manifest entry to paste.
3. **Colour-check** against the colorway swatch in `data/catalog.ts` — the
   recipe promises the client that colour.
4. 2–3 variants per colorway prevent the "stamped" look; variants are picked
   per stem automatically.

## Installing

Put files in `public/flowers/` and list them in
`public/flowers/manifest.json`:

```json
{
  "version": 1,
  "assets": [
    { "varietyId": "garden-rose", "colorwayId": "blush", "variant": 0, "src": "/flowers/garden-rose-blush-0.png" },
    { "varietyId": "garden-rose", "colorwayId": "blush", "variant": 1, "src": "/flowers/garden-rose-blush-1.png" }
  ]
}
```

Reload the app and switch the footer toggle to **Photo**. That's the whole
installation.

## QA checklist per asset

- [ ] Alpha edges clean at 200% zoom (no halo, no hard clip)
- [ ] Head/binding sit on the anchor lines (overlay the template)
- [ ] Colour matches the colorway swatch under neutral screen settings
- [ ] Lighting direction consistent with the rest of the set
- [ ] Reads correctly at thumbnail size (some AI outputs look right large
      and mushy small)
- [ ] You have the rights to use the image commercially (keep the generation
      record — provider, date, prompt — licensing terms vary by provider)

## Later (M2 real-photography pipeline)

When real photography replaces the AI bridge, the same manifest carries it —
plus per-asset anchors and LOD tiers become worth adding (`headAnchor`,
`bindingAnchor`, `lod` fields are reserved in the manifest schema for that).
