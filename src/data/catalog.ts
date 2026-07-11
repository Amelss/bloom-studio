import type { FlowerVariety, VesselDef } from '../domain/types'

/**
 * Launch catalog: 12 varieties covering every design role (focal, secondary,
 * filler, line, foliage), each with real trade metadata and teaching notes.
 * Prices are typical UK wholesale guide prices per stem and are editable per
 * design. Sketch artwork is a deliberate placeholder style until the
 * photographic asset pipeline (Milestone 2).
 */
export const FLOWER_CATALOG: FlowerVariety[] = [
  {
    id: 'garden-rose',
    commonName: 'Garden Rose',
    botanicalName: 'Rosa × hybrida',
    category: 'focal',
    guidePriceGBP: 2.8,
    seasons: ['year-round'],
    stemLengthCm: 50,
    fragility: 'medium',
    sketch: 'rose',
    widthMm: 105,
    colorways: [
      { id: 'blush', name: 'Blush', petal: '#e8b4bc', accent: '#d18a97', hue: 350 },
      { id: 'cream', name: 'Cream', petal: '#f4ecdb', accent: '#e3d3b3', hue: 45, neutral: true },
      { id: 'burgundy', name: 'Burgundy', petal: '#7c2d3e', accent: '#5c1f2e', hue: 345 },
    ],
    education: {
      role: 'A classic focal flower — large, open head that anchors the eye. Most designs want 3–5 focal blooms placed through the piece, not in a row.',
      conditioning: 'Strip lower foliage, remove guard petals, re-cut at 45° and rest in cool water for at least 2 hours before designing.',
      designTip: 'Vary the depth: recess one rose and lift another so the design reads as three-dimensional rather than flat.',
    },
  },
  {
    id: 'peony',
    commonName: 'Peony',
    botanicalName: 'Paeonia lactiflora',
    category: 'focal',
    guidePriceGBP: 4.5,
    seasons: ['spring', 'summer'],
    stemLengthCm: 45,
    fragility: 'high',
    sketch: 'peony',
    widthMm: 125,
    colorways: [
      { id: 'pink', name: 'Sarah Bernhardt Pink', petal: '#f2b8c6', accent: '#e08aa2', hue: 340 },
      { id: 'coral', name: 'Coral Charm', petal: '#f0937c', accent: '#dd6f55', hue: 15 },
      { id: 'white', name: 'Duchesse White', petal: '#f7f3ea', accent: '#e9e0cc', hue: 45, neutral: true },
    ],
    education: {
      role: 'A statement focal with a short season (May–June in the UK). Its size means one peony can do the work of two roses.',
      conditioning: 'Buy in "marshmallow" stage — soft bud. Opens fast in warm water; hold cold to slow it.',
      designTip: 'Because peonies open dramatically, design with their final open size in mind, not their bud size.',
    },
  },
  {
    id: 'ranunculus',
    commonName: 'Ranunculus',
    botanicalName: 'Ranunculus asiaticus',
    category: 'secondary',
    guidePriceGBP: 1.9,
    seasons: ['winter', 'spring'],
    stemLengthCm: 35,
    fragility: 'high',
    sketch: 'ranunculus',
    widthMm: 90,
    colorways: [
      { id: 'cream', name: 'Cream', petal: '#f5eedd', accent: '#dfd0ac', hue: 45, neutral: true },
      { id: 'pink', name: 'Pink Cloni', petal: '#eeb0bf', accent: '#d987a0', hue: 345 },
      { id: 'burgundy', name: 'Burgundy', petal: '#6f2639', accent: '#521a2a', hue: 345 },
    ],
    education: {
      role: 'A secondary flower: smaller layered heads that support the focal blooms and add petal texture between them.',
      conditioning: 'Hollow, delicate stems — cut cleanly and avoid crushing. Wire the head for bouquet work if the neck is soft.',
      designTip: 'Cluster ranunculus in odd-numbered groups near a focal rose to build a "moment" rather than scattering them evenly.',
    },
  },
  {
    id: 'lisianthus',
    commonName: 'Lisianthus',
    botanicalName: 'Eustoma grandiflorum',
    category: 'secondary',
    guidePriceGBP: 1.6,
    seasons: ['summer', 'autumn', 'year-round'],
    stemLengthCm: 60,
    fragility: 'medium',
    sketch: 'lisianthus',
    widthMm: 105,
    colorways: [
      { id: 'white', name: 'White', petal: '#f6f4ee', accent: '#e2ddcd', hue: 50, neutral: true },
      { id: 'lilac', name: 'Lilac', petal: '#cdb6dd', accent: '#a988c4', hue: 280 },
    ],
    education: {
      role: 'A workhorse secondary flower — ruffled, rose-like blooms plus buds on one branching stem, so it fills and softens at once.',
      conditioning: 'Snap off spent lower blooms; each stem offers multiple usable flower heads.',
      designTip: 'Use the budded tips at the edges of a design to soften the outline — a hard outline is the most common student mistake.',
    },
  },
  {
    id: 'carnation',
    commonName: 'Carnation',
    botanicalName: 'Dianthus caryophyllus',
    category: 'secondary',
    guidePriceGBP: 0.9,
    seasons: ['year-round'],
    stemLengthCm: 55,
    fragility: 'low',
    sketch: 'carnation',
    widthMm: 95,
    colorways: [
      { id: 'dusty-pink', name: 'Dusty Pink', petal: '#dfa4ae', accent: '#c47f8e', hue: 350 },
      { id: 'antique', name: 'Antique Terracotta', petal: '#cf8a70', accent: '#b26a52', hue: 18 },
    ],
    education: {
      role: 'Budget mass flower with a modern comeback. Dense ruffled heads add texture and stretch a budget without reading as cheap when clustered.',
      conditioning: 'Cut between nodes — cutting on a node blocks water uptake.',
      designTip: 'Cluster 3–5 tightly at one depth so they read as one lush textural mass, the contemporary way to use them.',
    },
  },
  {
    id: 'hydrangea',
    commonName: 'Hydrangea',
    botanicalName: 'Hydrangea macrophylla',
    category: 'secondary',
    guidePriceGBP: 3.2,
    seasons: ['summer', 'autumn'],
    stemLengthCm: 50,
    fragility: 'medium',
    sketch: 'hydrangea',
    widthMm: 145,
    colorways: [
      { id: 'dusty-blue', name: 'Dusty Blue', petal: '#aebfd8', accent: '#8ba2c4', hue: 218 },
      { id: 'white', name: 'White', petal: '#f2f3ec', accent: '#dee1d2', hue: 80, neutral: true },
    ],
    education: {
      role: 'A mass flower: one head covers real area fast. Great for establishing the body of a design before placing focals.',
      conditioning: 'Drinks through its petals — mist it, and submerge wilted heads in cool water for 30 minutes to revive.',
      designTip: 'Recess hydrangea deep in the design as a "pillow" that supports and visually lifts the flowers placed above it.',
    },
  },
  {
    id: 'delphinium',
    commonName: 'Delphinium',
    botanicalName: 'Delphinium elatum',
    category: 'line',
    guidePriceGBP: 2.4,
    seasons: ['summer'],
    stemLengthCm: 80,
    fragility: 'medium',
    sketch: 'delphinium',
    widthMm: 115,
    colorways: [
      { id: 'blue', name: 'Volkerfrieden Blue', petal: '#7d95cf', accent: '#5a72b4', hue: 225 },
      { id: 'white', name: 'White', petal: '#f4f4ee', accent: '#dfdfd2', hue: 60, neutral: true },
    ],
    education: {
      role: 'A line flower: tall spires that create the skeleton and movement of a design and lead the eye upward or outward.',
      conditioning: 'Hollow stems — fill with water and plug with cotton wool for large-scale work, or just keep water deep.',
      designTip: 'Place line flowers first to set the height and width of the design; everything else works inside that frame.',
    },
  },
  {
    id: 'gypsophila',
    commonName: 'Gypsophila',
    botanicalName: 'Gypsophila paniculata',
    category: 'filler',
    guidePriceGBP: 1.2,
    seasons: ['year-round'],
    stemLengthCm: 60,
    fragility: 'low',
    sketch: 'gypsophila',
    widthMm: 125,
    colorways: [{ id: 'white', name: 'White', petal: '#f7f6f1', accent: '#e4e2d6', hue: 55, neutral: true }],
    education: {
      role: 'A filler: airy clouds of tiny blooms that occupy space between flowers, soften transitions, and add air to a design.',
      conditioning: 'Ethylene-sensitive — keep away from ripening fruit. A little goes a long way.',
      designTip: 'Let filler float slightly higher than the flowers around it to create a soft, airy halo rather than packing it tight.',
    },
  },
  {
    id: 'spray-rose',
    commonName: 'Spray Rose',
    botanicalName: 'Rosa × hybrida (spray)',
    category: 'filler',
    guidePriceGBP: 1.5,
    seasons: ['year-round'],
    stemLengthCm: 45,
    fragility: 'medium',
    sketch: 'spray-rose',
    widthMm: 115,
    colorways: [
      { id: 'blush', name: 'Blush Bombastic', petal: '#eec3ca', accent: '#d99aa8', hue: 350 },
      { id: 'cream', name: 'Cream', petal: '#f4eddc', accent: '#e0d1ae', hue: 45, neutral: true },
    ],
    education: {
      role: 'Several small heads per stem — bridges the scale gap between large focal roses and fine filler, which is what makes a design read as "full".',
      conditioning: 'As standard roses; remove any bruised heads since one spoiled bloom shows across the whole cluster.',
      designTip: 'Use spray roses to step the eye down from big blooms to small — scale transitions are what make arrangements look professional.',
    },
  },
  {
    id: 'eucalyptus',
    commonName: 'Silver Dollar Eucalyptus',
    botanicalName: 'Eucalyptus cinerea',
    category: 'foliage',
    guidePriceGBP: 1.1,
    seasons: ['year-round'],
    stemLengthCm: 60,
    fragility: 'low',
    sketch: 'eucalyptus',
    widthMm: 140,
    colorways: [{ id: 'silver', name: 'Silver Green', petal: '#9fb39a', accent: '#7e947c', hue: 110, neutral: true }],
    education: {
      role: 'Foundation foliage: rounded silver leaves establish the base, shape, and colour temperature of the design before any flower is placed.',
      conditioning: 'Woody stems — cut at a steep angle. Scent is a signature; some clients love it, some don\'t. Ask.',
      designTip: 'Build your foliage skeleton first: it defines the final silhouette and means you use fewer (expensive) flowers.',
    },
  },
  {
    id: 'ruscus',
    commonName: 'Italian Ruscus',
    botanicalName: 'Ruscus hypoglossum',
    category: 'foliage',
    guidePriceGBP: 0.85,
    seasons: ['year-round'],
    stemLengthCm: 70,
    fragility: 'low',
    sketch: 'ruscus',
    widthMm: 135,
    colorways: [{ id: 'green', name: 'Deep Green', petal: '#5d7a52', accent: '#46603d', hue: 105, neutral: true }],
    education: {
      role: 'Line foliage: long arching stems that extend the silhouette, add movement, and trail beautifully from bouquets and compotes.',
      conditioning: 'Extremely long-lasting — often outlives the flowers twice over.',
      designTip: 'Let one or two stems arc well beyond the outline; controlled "escapes" create rhythm and stop a design feeling like a ball.',
    },
  },
  {
    id: 'astilbe',
    commonName: 'Astilbe',
    botanicalName: 'Astilbe × arendsii',
    category: 'filler',
    guidePriceGBP: 1.7,
    seasons: ['summer'],
    stemLengthCm: 50,
    fragility: 'high',
    sketch: 'astilbe',
    widthMm: 105,
    colorways: [
      { id: 'pink', name: 'Feather Pink', petal: '#e6a9bb', accent: '#cf84a1', hue: 340 },
      { id: 'white', name: 'White', petal: '#f3f0e6', accent: '#ded8c4', hue: 50, neutral: true },
    ],
    education: {
      role: 'A textural filler: feathery plumes that add softness and a sense of movement between firmer flower forms.',
      conditioning: 'Thirsty and quick to droop — condition in deep water and design last.',
      designTip: 'Contrast textures deliberately: feathery astilbe against a smooth rose makes both read more strongly.',
    },
  },
  {
    id: 'leatherleaf',
    commonName: 'Leatherleaf Fern',
    botanicalName: 'Rumohra adiantiformis',
    category: 'foliage',
    guidePriceGBP: 0.6,
    seasons: ['year-round'],
    stemLengthCm: 45,
    fragility: 'low',
    sketch: 'leatherleaf',
    widthMm: 150,
    colorways: [{ id: 'green', name: 'Deep Green', petal: '#4a6847', accent: '#324a30', hue: 120, neutral: true }],
    education: {
      role: 'The classic base foliage: flat, triangular serrated fronds that skirt a design, cover mechanics, and frame the flowers from beneath.',
      conditioning: 'Extremely long-lasting and robust — often the last thing standing. Store cool and dry.',
      designTip: 'Lay leatherleaf flat under the bouquet base with tips pointing outward — it defines the outline and hides every stem end.',
    },
  },
]

export const VESSEL_CATALOG: VesselDef[] = [
  {
    id: 'kraft-wrap',
    name: 'Hand-Tied Wrap',
    priceGBP: 2.5,
    sketch: 'wrap',
    widthMm: 240,
    mechanics: 'Hand-tied spiral, twine bind, kraft wrap',
    renderMode: 'front',
    education:
      'The hand-tied spiral is the foundational bouquet technique: every stem added at the same angle around a central binding point, so the bouquet stands on its own stems.',
  },
  {
    id: 'compote',
    name: 'Footed Compote Bowl',
    priceGBP: 8,
    sketch: 'compote',
    widthMm: 210,
    mechanics: 'Chicken-wire pillow + pot tape (foam-free)',
    renderMode: 'behind',
    education:
      'Compote designs use a low, footed bowl with chicken wire mechanics — the modern, sustainable alternative to floral foam, and the default for garden-style centrepieces.',
  },
]

export const FLOWER_INDEX: Record<string, FlowerVariety> = Object.fromEntries(
  FLOWER_CATALOG.map((f) => [f.id, f]),
)

export const VESSEL_INDEX: Record<string, VesselDef> = Object.fromEntries(
  VESSEL_CATALOG.map((v) => [v.id, v]),
)

export function getColorway(varietyId: string, colorwayId: string) {
  const variety = FLOWER_INDEX[varietyId]
  return variety?.colorways.find((c) => c.id === colorwayId) ?? variety?.colorways[0]
}
