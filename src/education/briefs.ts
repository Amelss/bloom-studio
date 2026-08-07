import type { DesignMetrics } from './metrics'

/**
 * Exercises ("briefs"): a client scenario plus a set of machine-checkable
 * constraints, each a predicate over [DesignMetrics]. Because the same metrics
 * drive the live feedback, an exercise grades itself as the student designs —
 * this is what turns the canvas from a sandbox into guided practice (M4).
 */
export interface Constraint {
  id: string
  /** Imperative goal shown in the checklist, e.g. "Use an analogous palette". */
  label: string
  /** Links to a PRINCIPLES entry for the "why". */
  principleId: string
  /** Nudge shown while the goal is unmet. */
  hint: string
  test: (m: DesignMetrics) => boolean
}

export interface Brief {
  id: string
  title: string
  /** The client-style setup. */
  scenario: string
  /** One line on what the exercise teaches. */
  learn: string
  level: 'foundation' | 'intermediate'
  /** Suggested starting vessel (a constraint may also require it). */
  vesselId?: string
  constraints: Constraint[]
}

const isOdd = (n: number) => n % 2 === 1

export const BRIEFS: Brief[] = [
  {
    id: 'balanced-beginnings',
    title: 'Balanced beginnings',
    scenario: 'A customer wants a simple, well-formed hand-tied to brighten their kitchen table.',
    learn: 'The fundamentals: build in layers, give the eye a hero, resolve the balance.',
    level: 'foundation',
    vesselId: 'kraft-wrap',
    constraints: [
      {
        id: 'foliage-base',
        label: 'Lay a foliage skeleton (3+ foliage stems)',
        principleId: 'process',
        hint: 'Add foliage first — it sets the silhouette and supports the flowers.',
        test: (m) => (m.byCategory.foliage ?? 0) >= 3,
      },
      {
        id: 'has-focal',
        label: 'Give it a hero (at least one focal bloom)',
        principleId: 'dominance',
        hint: 'Add a focal flower (garden rose, peony, dahlia) for the eye to land on.',
        test: (m) => m.focalCount >= 1,
      },
      {
        id: 'odd-focals',
        label: 'Use an odd number of focal blooms',
        principleId: 'dominance',
        hint: 'Odd counts (1, 3, 5) compose into a natural triangle; even numbers pair off.',
        test: (m) => m.focalCount >= 1 && isOdd(m.focalCount),
      },
      {
        id: 'balanced',
        label: 'Resolve the visual balance',
        principleId: 'balance',
        hint: 'The blooms lean to one side — counterweight the lighter side.',
        test: (m) => m.balanceLean != null && Math.abs(m.balanceLean) <= 0.15,
      },
      {
        id: 'enough-stems',
        label: 'Build it up (12+ stems)',
        principleId: 'proportion',
        hint: 'Keep going — a full hand-tied usually needs a dozen stems or more.',
        test: (m) => m.stemCount >= 12,
      },
    ],
  },
  {
    id: 'analogous-blush',
    title: 'Analogous blush bouquet',
    scenario: 'A bride wants a soft, romantic bouquet in blush-to-peach tones — nothing that clashes.',
    learn: 'Colour harmony: keep hues as neighbours, and vary texture so it stays interesting.',
    level: 'intermediate',
    vesselId: 'kraft-wrap',
    constraints: [
      {
        id: 'analogous',
        label: 'Keep an analogous (or monochromatic) palette',
        principleId: 'colour',
        hint: 'Your hues are spread too wide — keep them neighbours on the wheel.',
        test: (m) => m.paletteType === 'analogous' || m.paletteType === 'mono',
      },
      {
        id: 'texture',
        label: 'Bring in texture (3+ different varieties)',
        principleId: 'contrast',
        hint: 'One flower type reads flat — contrast smooth and ruffled forms.',
        test: (m) => m.varietyCount >= 3,
      },
      {
        id: 'clear-focal',
        label: 'Keep a clear focal (not all stars)',
        principleId: 'dominance',
        hint: 'Have 1–3 focal blooms lead, supported by the rest — under ~45% focal.',
        test: (m) => m.focalCount >= 1 && m.focalRatio <= 0.45,
      },
      {
        id: 'foliage',
        label: 'Soften the outline with foliage',
        principleId: 'process',
        hint: 'Add a little foliage to soften the edge and frame the blooms.',
        test: (m) => (m.byCategory.foliage ?? 0) >= 2,
      },
      {
        id: 'balanced',
        label: 'Keep it balanced',
        principleId: 'balance',
        hint: 'Even a hand-tied should sit balanced in the hand.',
        test: (m) => m.balanceLean != null && Math.abs(m.balanceLean) <= 0.2,
      },
    ],
  },
  {
    id: 'budget-compote',
    title: 'Budget compote for £45',
    scenario: 'A venue needs a lush footed-compote centrepiece, but the material budget is capped at £45.',
    learn: 'Costing in practice: stretch a budget with foliage and mass, and cost it live.',
    level: 'intermediate',
    vesselId: 'compote',
    constraints: [
      {
        id: 'use-compote',
        label: 'Use the footed compote',
        principleId: 'process',
        hint: 'Switch the vessel to the footed compote for this brief.',
        test: (m) => m.vesselId === 'compote',
      },
      {
        id: 'under-budget',
        label: 'Keep material cost at or under £45',
        principleId: 'pricing',
        hint: 'Over budget — swap some pricey focals for foliage and mass flowers.',
        test: (m) => m.materialCost <= 45,
      },
      {
        id: 'lush',
        label: 'Make it lush (15+ stems)',
        principleId: 'proportion',
        hint: 'A compote should read full — keep adding until it looks generous.',
        test: (m) => m.stemCount >= 15,
      },
      {
        id: 'foliage-heavy',
        label: 'Use foliage to stretch the budget (30%+ foliage)',
        principleId: 'pricing',
        hint: 'Foliage is cheap and does real work — aim for at least a third of the stems.',
        test: (m) => m.foliageRatio >= 0.3,
      },
    ],
  },
  {
    id: 'textural-contrast',
    title: 'Textural contrast study',
    scenario: 'A styled shoot wants a design that plays smooth focal forms against airy, feathery texture.',
    learn: 'Contrast & rhythm: mix flower forms and let line material move the eye.',
    level: 'intermediate',
    constraints: [
      {
        id: 'variety',
        label: 'Use 4+ different varieties',
        principleId: 'contrast',
        hint: 'Reach for more variety — contrast needs different forms to play against.',
        test: (m) => m.varietyCount >= 4,
      },
      {
        id: 'focal',
        label: 'Anchor with a smooth focal form',
        principleId: 'dominance',
        hint: 'Add a focal bloom (rose, dahlia) as the smooth anchor.',
        test: (m) => m.focalCount >= 1,
      },
      {
        id: 'filler',
        label: 'Add airy texture (a filler)',
        principleId: 'rhythm',
        hint: 'Add a filler (gypsophila, astilbe) for the feathery contrast.',
        test: (m) => (m.byCategory.filler ?? 0) >= 1,
      },
      {
        id: 'line',
        label: 'Move the eye with line material',
        principleId: 'rhythm',
        hint: 'Add a line flower (snapdragon, delphinium) to create movement.',
        test: (m) => (m.byCategory.line ?? 0) >= 1,
      },
      {
        id: 'depth',
        label: 'Layer for depth (foliage behind focals)',
        principleId: 'depth',
        hint: 'Recess the foliage so the focal forms advance — depth sells the contrast.',
        test: (m) => m.depthOk === true,
      },
    ],
  },
]

export const BRIEF_INDEX: Record<string, Brief> = Object.fromEntries(
  BRIEFS.map((b) => [b.id, b]),
)

export interface ConstraintResult {
  constraint: Constraint
  met: boolean
}
export interface BriefEvaluation {
  results: ConstraintResult[]
  met: number
  total: number
  complete: boolean
}

export function evaluateBrief(brief: Brief, metrics: DesignMetrics): BriefEvaluation {
  const results = brief.constraints.map((constraint) => ({
    constraint,
    met: constraint.test(metrics),
  }))
  const met = results.filter((r) => r.met).length
  return { results, met, total: results.length, complete: met === results.length }
}
