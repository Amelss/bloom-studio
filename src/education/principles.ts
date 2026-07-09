/**
 * The teaching content library: the classic principles of floral design plus
 * studio-practice topics. Live canvas feedback (insights.ts) links here so a
 * student can always go from "what the software noticed" to "why it matters".
 */

export interface Principle {
  id: string
  group: 'principle' | 'practice'
  name: string
  summary: string
  body: string
  tryIt: string
}

export const PRINCIPLES: Principle[] = [
  {
    id: 'balance',
    group: 'principle',
    name: 'Balance',
    summary: 'A design should feel stable — physically and visually.',
    body:
      'Balance is both physical (a hand-tied bouquet must literally not tip) and visual (the "weight" of colour, size, and density should feel resolved around a central axis). Symmetrical balance mirrors both sides and reads as formal; asymmetrical balance offsets one large element with several smaller ones and reads as natural and modern. Dark colours, large blooms, and dense clusters all carry more visual weight than pale, small, or airy material.',
    tryIt:
      'Place one large focal bloom slightly off-centre, then counterweight it on the opposite side with a cluster of smaller flowers placed a little lower.',
  },
  {
    id: 'proportion',
    group: 'principle',
    name: 'Proportion & Scale',
    summary: 'The size relationship between flowers, container, and setting.',
    body:
      'The classical guideline is that an arrangement stands about 1.5 to 2 times the height (or width) of its container. Scale also operates between flowers: a design needs a graded range of bloom sizes — large focal, medium secondary, fine filler — so the eye can step between them. When everything is the same size, a design reads as flat and busy at once.',
    tryIt:
      'Check your tallest stem against the vessel: is it between 1.5× and 2× the container height? Then check you have at least three distinct bloom sizes.',
  },
  {
    id: 'dominance',
    group: 'principle',
    name: 'Dominance & Focal Point',
    summary: 'One area should lead; everything else supports it.',
    body:
      'A focal area gives the eye somewhere to land first — usually the largest, most open, or most saturated blooms, placed low and slightly off-centre near the "heart" of the design. Odd numbers of focal blooms (1, 3, 5) are easier to compose than even numbers, which tend to pair off into static rows. Without dominance a design feels scattered; with too many stars it feels crowded.',
    tryIt:
      'Squint at your design. Where does your eye land first? If the answer is "nowhere" add or enlarge a focal moment; if "everywhere", recess some competing blooms.',
  },
  {
    id: 'rhythm',
    group: 'principle',
    name: 'Rhythm & Movement',
    summary: 'Repetition and line lead the eye through the design.',
    body:
      'Rhythm is created by repeating colours, forms, or textures at intervals so the eye travels: a ribbon of blush repeated three times, foliage that arcs out and returns. Line material (delphinium, arching ruscus) sets the paths the eye follows. Designs without rhythm feel static; the fix is usually repetition with variation — same flower, different depths and angles.',
    tryIt:
      'Pick your focal colour and make sure it appears at least three times, at different heights and depths, tracing a gentle zig-zag rather than a straight line.',
  },
  {
    id: 'contrast',
    group: 'principle',
    name: 'Contrast',
    summary: 'Difference — in colour, form, or texture — creates interest.',
    body:
      'Contrast stops a harmonious design from becoming wallpaper. It can come from colour (complementary hues), form (spike against sphere), or texture (feathery astilbe against a waxy rose). The craft is dosage: one clear contrast, kept subordinate to the overall harmony, energises a design; several competing contrasts fragment it.',
    tryIt:
      'Add one deliberately different element — a texture or a deeper tone — and keep it to under a quarter of the design.',
  },
  {
    id: 'harmony',
    group: 'principle',
    name: 'Harmony & Unity',
    summary: 'All parts should feel like they belong to one idea.',
    body:
      'Harmony is the sense that materials, colours, container, and style agree with each other — garden roses in a footed compote, not in a lab beaker. Unity is the stronger claim: the design reads as one composition rather than a collection of nice stems. Repetition, a limited palette, and transitional material (spray roses bridging big and small blooms) are the main tools.',
    tryIt:
      'Remove one element mentally: if nothing gets worse, the design may be a collection rather than a composition — simplify toward one idea.',
  },
  {
    id: 'colour',
    group: 'principle',
    name: 'Colour Theory',
    summary: 'Schemes: monochromatic, analogous, complementary, triadic.',
    body:
      'Florists work the colour wheel constantly. Monochromatic (one hue, varied tints) is elegant and safe. Analogous (neighbouring hues — blush, coral, peach) is the workhorse of wedding work. Complementary (opposite hues — blue against orange) is bold and needs one side to dominate. Whites, creams, and foliage greens act as neutrals that give saturated colours room to breathe. Remember colours shift under venue lighting and in photographs.',
    tryIt:
      'Name your scheme out loud before you design ("analogous: blush through terracotta"). If you can\'t name it, the palette will probably read as accidental.',
  },
  {
    id: 'depth',
    group: 'principle',
    name: 'Depth & Recession',
    summary: 'Three-dimensionality: some blooms recede, some advance.',
    body:
      'The most common difference between student and professional work is depth. Professionals recess some material deep into the design (hydrangea as a low "pillow", darker tones tucked in) and let other blooms advance beyond the outline. This creates shadow, dimension, and the sense that the design could be walked around — even in a front-facing piece.',
    tryIt:
      'Choose two blooms and push them visibly deeper behind their neighbours; let one bloom and one foliage stem break clearly out of the silhouette.',
  },
  {
    id: 'process',
    group: 'practice',
    name: 'Build Order',
    summary: 'Foliage skeleton → mass → focal → filler → detail.',
    body:
      'Professional designs are built in layers: foliage first to set silhouette and mechanics, then mass flowers to establish the body, then focal blooms placed into the strongest positions, then filler and fine texture to knit it together. Building focal-first almost always ends with crushed or buried hero flowers — and wasted money.',
    tryIt:
      'Start your canvas with 5–7 foliage stems that define the outline you want, before placing a single flower.',
  },
  {
    id: 'conditioning',
    group: 'practice',
    name: 'Conditioning & Care',
    summary: 'Preparation determines how long the design lives.',
    body:
      'Conditioning is the unglamorous half of floristry: clean buckets, stripped lower foliage, stems re-cut at a sharp angle, several hours of deep drinking in a cool space before design work. Each variety has quirks — hydrangea drinks through its petals, delphinium has hollow stems, roses carry guard petals that should be removed late. Select any flower on the canvas to see its specific conditioning note.',
    tryIt:
      'Before a design session, write a one-line conditioning plan for each variety in your recipe — it becomes automatic within weeks.',
  },
  {
    id: 'pricing',
    group: 'practice',
    name: 'Recipes & Pricing',
    summary: 'Count every stem; price with a deliberate markup.',
    body:
      'Profitable floristry is recipe discipline: every stem counted, every material listed, then a markup applied — commonly 2× to 4× on wholesale cost depending on market and complexity, with many studios adding labour on top. Under-counting stems is invisible on the invoice and fatal to margin. Bloom Studio counts your canvas automatically, but the habit of sanity-checking the recipe against the design is a professional skill in itself.',
    tryIt:
      'Change the markup on this design from 3× to 2.5× and back — watch what it does to retail price, and consider what your local market would bear.',
  },
]

export const PRINCIPLE_INDEX: Record<string, Principle> = Object.fromEntries(
  PRINCIPLES.map((p) => [p.id, p]),
)
