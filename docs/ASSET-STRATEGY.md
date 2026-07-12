# Flower Realism — Asset Strategy

Status: **decided** · July 2026
Question every option is judged against: *"Will this create the most visually authentic
and educational digital floral design experience possible?"*

> **DIRECTION (Ameley, 13 July 2026 — current):** target is **stylised 3D
> botanical illustration in the BloomyPro mould** — dimensional, layered, soft
> studio-lit, immediately recognisable, but lightweight (not photoreal, not raw
> 3D models). Delivered by upgrading the **procedural SVG generators** with a
> gradient-based dimensional-shading toolkit (`createShader`/`shadedPetalRing`
> in `assets/sketchSvg.ts`): per-petal form gradients (lit tip → shaded base),
> soft gradient occlusion in throats and between layers, whole-bloom form light,
> position-based lighting on domes — all rasterised without SVG filters so it is
> identical everywhere and still just sprites at runtime (scales to 1,000+).
> **Pexels photos are REFERENCE ONLY** (botanical accuracy: shape, arrangement,
> proportion) — not shipped assets. Pilot done: rose, hydrangea, eucalyptus
> rebuilt to this standard. Next: roll the same shading toolkit across the
> remaining 10 varieties. The photographic Pexels pipeline (`scripts/`,
> `/asset-normalizer.html`, Photo mode) is retained but parked as an optional
> future "photo mode", not the direction.
>
> **DECISION UPDATE (Ameley, 12 July 2026 — supersedes the block below):** after
> reviewing the flat-botanical rewrite against a BloomyPro reference image, the
> verdict is that flat illustration — even structurally accurate — "still feels
> flat and animated". The BloomyPro bar is photo-grade imagery (3D digitisations
> of real stems). **The production realism path is therefore photographic cutout
> assets via the AI-bridge pipeline (§3 Track 1), exactly as this document
> originally recommended.** The illustration set is retained as **Sketch mode**:
> the structure-teaching view and the universal per-variety fallback while photo
> coverage grows. Tooling now in place: `public/asset-normalizer.html` (anchor
> fitting + manifest generation) and the per-variety prompt kit in
> ASSET-PIPELINE.md. Next gate: pilot 3 varieties end-to-end, then blind-ID.
>
> *(Historical decision, superseded:)*
> **DECISION (Ameley, July 2026): the goal is BOTANICAL ACCURACY, not photorealism.**
> The production art direction is **flat, clean botanical illustration**: accurate
> species silhouettes, natural petal layering and growth structure, organic variation,
> and restrained shading (thin edge definition, subtle base shading) — no baked
> directional lighting, no heavy gradients, no photographic texture. Realism comes
> from *drawing the right shapes*, not rendering effects. The acceptance test is
> unchanged: a florist identifies the variety without a label.
>
> Consequences: the procedural generator stays as the production medium (rewritten
> for structural accuracy per species); the photographic/AI track below is **parked**
> as a possible future "photo mode", not the realism strategy. The reference-sourcing
> sections (§2 D/F/G) remain fully relevant — accurate drawing requires accurate
> references. The pipeline discipline (reference sheets → style bible → QA gate)
> applies to illustration exactly as it would have to photography.
>
> **Quality reference: BloomyPro.** Their library is the visual standard to match —
> natural silhouettes, realistic petal/leaf arrangements, organic variation, one
> consistent style across thousands of varieties. Their look derives from 3D models
> under soft neutral studio light; our flat-illustration equivalent is structural
> drawing + *non-directional* layer separation (faint halo between petal layers,
> base-shade crescents) — never a baked light direction.

---

## 1. The first-principles verdict

**Procedural vector art can never reach florist-grade recognisability. Stop investing
in it for realism.**

What makes a florist recognise Silver Dollar Eucalyptus at a glance is not its
geometry (round leaves on a stem — which our generator already draws) but its
*surface*: the glaucous, powdery blue-grey bloom on the leaf, the subtle red petiole,
the way paired juvenile leaves clasp the stem, the matte light response. An Avalanche
rose is identified by its precise creamy-white with a green heart, the reflexed
guard-petal curl, the density of its petal count. These are **photographic properties
— micro-texture, translucency, specular response, precise cultivar colour** — and no
practical amount of layered gradient geometry reproduces them. Procedural art has a
realism ceiling of roughly "tasteful illustration"; we reached it in Phase C.

The existing generative artwork is not wasted: it remains **Sketch mode** — the
structure-teaching view, the always-available fallback, and the zero-dependency
default. But realism comes from raster assets derived from photographic truth.

**The rendering architecture does not change.** Alpha-cutout raster sprites on the
WebGL atlas renderer is exactly the right engine for photographic assets — it is what
Phase C's manifest/Photo-mode seam was built for, and it is architecturally what the
industry does: [BloomyPro](https://bloomypro.com/) has digitised
[3,877+ flowers](https://thursd.com/articles/go-virtual-with-bloomypro) (as 3D, for
breeders/growers/wholesalers at enterprise cost), and
[Details Flowers](https://info.detailsflowers.com/features) runs on a photographic
stem library fed by suppliers. What changes is the **content strategy**: where assets
come from, how they are normalised, and how a 1,000-variety library is governed.

### Explicitly evaluated and rejected as the backbone

| Approach | Why not |
| --- | --- |
| Full 3D models | BloomyPro's territory: per-variety modelling cost is brutal (×1,000), tablet performance suffers, and florists compose in 2D presentation view anyway. Our depth bands + future AI render deliver the dimensionality that matters. |
| Photogrammetry / Gaussian splats | Beautiful research toys; capture effort per variety is huge, browser delivery is heavy, and cut flowers wilt faster than you can scan a library. Revisit in years, not now. |
| Pure SVG/vector illustration | Realism lives in texture, not paths. Vector is the wrong medium for the goal (fine for Sketch mode). |
| Photos used raw (uncut) | Backgrounds kill composability. Cutouts are non-negotiable. |

---

## 2. Source-by-source comparison

Scored against: realism ceiling · licensing · implementation effort · maintenance ·
render performance · scalability to 1,000+ · style consistency · educational fit.

### A. Own photography (studio cutout pipeline) — **the end-state**
- **Realism 10/10.** True cultivars, true colour — the only source where "Avalanche"
  is actually Avalanche.
- **Licensing: perfect.** We own copyright — this is the *only* source that builds the
  defensible asset moat the original spec (§12, §13) identified as the product.
- **Effort/scale: the constraint.** Shooting rig, consistent lighting, per-variety
  sourcing of fresh stems. Realistic pace: batches of 10–30 varieties. Ameley's
  course (from January) and future wholesaler access make this progressively cheaper.
- **Consistency: excellent** once the rig recipe is fixed.
- Fit: the hero tier — the ~150 varieties that are 95% of real usage.

### B. AI-generated cutouts (reference-conditioned) — **the bridge, already chosen**
- **Realism 8–9/10 achievable** — *if* generation is disciplined: one style recipe
  (lighting, angle, background), reference-image conditioning per variety, and expert
  curation (Ameley is the florist-in-the-loop). Free-prompting produces "generic pink
  rose"; reference-conditioned generation produces recognisable cultivars.
- **Licensing: usable, with two big caveats.** (i) Provider terms generally grant
  commercial use (prefer a commercially-safe provider — e.g. Adobe Firefly or Getty's
  generator, which offer indemnification postures; open-weight models are also viable —
  keep generation records regardless). (ii) **Purely AI-generated images have no
  copyright protection (US Copyright Office position)** → competitors could copy the
  assets. AI assets are speed, not moat. This is why A remains the end-state.
- **Effort: lowest per variety; scales best.** Any variety on demand, including rare
  cultivars no stock library carries.
- **Risk: botanical accuracy.** Mitigation: reference sheets + img2img from licensed
  references + the blind-ID QA gate (§5).

### C. Free stock photography, adapted into cutouts — **supplemental**
- **Realism 9/10** where a suitable photo exists — which is the problem: single stems,
  clean background, right angle, identified *cultivar* (not just "rose") are rare.
- **Licensing: workable but read the clauses.** Unsplash/Pexels-style licenses permit
  modification and commercial use, but prohibit selling unaltered copies and — notably
  (Unsplash) — *compiling photos to replicate a similar or competing service*. Cutouts
  embedded as software assets are transformed use, but a systematically stock-built
  asset library brushes against that clause. Use case-by-case, keep a provenance
  ledger, never as the backbone.
- Lighting/angle inconsistency → heavy normalisation work per asset.

### D. Public-domain botanical collections — **reference gold, cosmetic option, not backbone**
- Sources: Redouté's engravings (PD by age), the
  [Biodiversity Heritage Library](https://about.biodiversitylibrary.org/help/copyright-and-reuse/)
  (PD/CC0 for most works; some in-copyright items are CC-BY-NC-SA — check per work),
  the [USDA Pomological Watercolor Collection](https://en.wikipedia.org/wiki/Pomological_Watercolor_Collection)
  (~7,500 plates, US public domain — but fruit-focused), Rawpixel's CC0 botanical boards,
  NYPL Digital Collections.
- **Realism: wrong kind.** Exquisite and *botanically* accurate, but they depict
  historical species/varieties — modern trade cultivars (Avalanche, Bombastic spray
  roses, Cloni ranunculus) don't exist in 19th-century plates. Style varies by artist
  and era; scan quality varies.
- **Verdict:** primary *reference* material for structure/habit; optionally a curated
  "Heritage print" cosmetic paper-style later. Not production sprites.

### E. Commissioned hand-drawn digital illustration
- Realism 6–7/10 ceiling for recognisability; £30–100+ per variety per angle;
  consistency dies when the artist changes; does not scale to 1,000. Rejected as
  backbone; possible for brand/marketing art.

### F. Supplier / wholesaler imagery partnerships — **medium-term accelerant**
- The industry's own answer: wholesaler catalogues photograph every cultivar they sell,
  on white, labelled correctly. Details Flowers' library is supplier-fed. A licensing
  or co-marketing deal with one wholesaler (or one breeder like David Austin/De Ruiter)
  could legitimately bulk-fill hundreds of *correct* cultivar images. Requires business
  development; pursue once the pilot proves the pipeline.

### G. APIs & datasets — **metadata and reference only**
- iNaturalist (per-photo CC licenses, wild habit not cut-stem), Wikimedia Commons
  (per-file licenses, quality lottery), PlantNet (identification API), Perenual/other
  plant APIs (garden data), Oxford 102 Flowers (research dataset — not production
  assets). **Use for:** taxonomy, naming/aliases (the spec's canonical-ID + alias
  model), seasonality data, and reference imagery. **Not** production art.

---

## 3. Recommended strategy (summary)

1. **Rendering: keep the WebGL cutout-sprite + atlas architecture.** It is correct,
   proven by measurement (1.96ms @ 1,500 stems) and by the industry. No change.
2. **Content: photographic-grade cutouts via a two-track pipeline.**
   - **Track 1 (now): reference-conditioned AI generation** (her standing decision),
     run through a disciplined normalisation + QA pipeline. Fills the library fast.
   - **Track 2 (from ~M2/course access): owned photography** progressively replaces
     AI assets in the hero tier — building the copyright moat and ground-truth colour.
   - Stock and PD sources supplement references; supplier partnership pursued when
     traction justifies it.
3. **Sketch mode stays** as the teaching/structure view and universal fallback.
4. **Recognisability is the acceptance test:** an asset ships only when a florist
   identifies the variety blind (no label). That test, not aesthetics, defines "done".

---

## 4. The asset pipeline (per variety)

```
1. REFERENCE SHEET      canonical cultivar name + aliases · 3–6 reference photos
                        (wholesaler catalogues, breeder pages, BHL/PD plates for
                        structure) · colour swatches · habit notes · size (mm)
2. ACQUISITION          Track 1: style-recipe AI generation conditioned on references
                        Track 2: studio photo  ·  (case-by-case: adapted stock)
3. NORMALISATION        background removal → alpha QA at 200% (no halo/hard clip)
                        → fit to layout contract (head/binding anchors, 100:160)
                        → colour-calibrate to colorway swatch → export WebP/PNG
4. REGISTRY             assets.json entry: variety, colorway, variant, angle, source,
                        LICENSE PROVENANCE (origin, terms, generation record), version
5. DELIVERY             build step packs atlases by usage tier · LOD sizes ·
                        CDN + lazy load (renderer already lazy-loads per design)
6. QA GATE              blind ID test (florist names the variety unlabelled)
                        + automated checks (alpha edges, anchor alignment, ΔE to swatch)
```

The Phase C manifest (`public/flowers/manifest.json`) is step 4's seed; it grows into
a proper registry with per-asset provenance — **a licensing ledger is non-negotiable
at 1,000 assets from mixed sources.**

## 5. Architecture for 1,000+ varieties

- **Tiered library.** Tier 1 "hero" (~150 varieties = the 80/20 of real floristry,
  per the original spec): multi-angle (front/three-quarter/profile), all trade
  colorways, 2–3 natural variants, owned photography over time. Tier 2 (~400):
  single angle, key colorways, AI/stock. Tier 3 long tail: single asset, added
  on-demand via the intake workflow.
- **Taxonomy first.** Canonical variety IDs with alias tables (trade names vs
  botanical names vs regional names — already flagged in the original spec §12);
  cultivar-level entries distinct from species entries. This is also the educational
  backbone (a student learns *Eustoma grandiflorum* ↔ lisianthus ↔ "lizzy").
- **Content ops, not heroics.** A defined intake cadence (e.g. 10–20 varieties/week
  through steps 1–6), a dashboard of coverage vs the wholesale availability lists,
  and per-asset versioning so an improved asset replaces an old one without breaking
  saved designs (assets are keyed by variety+colorway+variant, not by file).
- **Delivery scales linearly:** atlases are sharded by tier/usage; a design loads only
  the textures it uses (already true); 1,000 varieties ≈ metadata in the catalog +
  files on CDN, not memory pressure.

## 6. Risks & trade-offs

| Risk | Impact | Mitigation |
| --- | --- | --- |
| AI botanical inaccuracy | Florists reject the app | Reference-conditioned generation; florist-in-the-loop curation; blind-ID gate |
| AI assets uncopyrightable | No moat in the library | Treat AI as bridge; owned photography for hero tier (Track 2) |
| Style drift across 1,000 assets | Library reads as a collage of sources | Written style bible (lighting/angle/background recipe); calibration step; periodic full-library review |
| Stock license clauses (compilation) | Legal exposure | Provenance ledger; stock as supplement only; prefer AI/owned |
| Cultivar coverage gaps in all free sources | Can't ship specific varieties | AI generation covers on demand; supplier partnership medium-term |
| Cutout labour per asset | Pipeline bottleneck | Automated background-removal + QA tooling in step 3; batch cadence |
| Perf regression as textures grow | Canvas jank | Already solved architecture (atlas/LOD/lazy); perf benchmark guards |

## 7. Phased plan (once approved)

- **R0 — Prove it (the pilot).** Style bible + reference sheets for the current 12
  varieties. Generate photorealistic cutouts (2 variants × colorways) with the agreed
  provider; normalise through the pipeline; install via the existing manifest.
  **Gate: blind-ID test — a florist names ≥90% of varieties unlabelled.** If the gate
  fails, the fallback path is stock+manual-cutout for the pilot set and heavier
  reference conditioning.
- **R1 — Pipeline hardening.** Normalisation tooling (batch background-removal QA,
  anchor-fitting, ΔE colour check), registry schema with provenance ledger, atlas
  build step by tier, intake workflow doc.
- **R2 — Launch library.** Top 150–250 varieties (the original spec's launch target),
  hero tier gets multi-angle; per-stem angle variant support in the document model.
- **R3 — The moat.** Owned-photography programme for the hero tier (course/wholesaler
  access), supplier/breeder partnership outreach, scale content ops toward 1,000+.

**Decisions needed:** (1) approve this strategy; (2) choose the AI provider posture
(commercially-safe hosted vs open-weight — affects cost, indemnity, and workflow);
(3) confirm the blind-ID bar (≥90%) as the shipping gate.
