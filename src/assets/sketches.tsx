import type { FC } from 'react'

/**
 * Placeholder botanical-sketch artwork, parameterised by colorway. This style
 * is deliberate for Milestone 1: consistent, scalable, and honest about being
 * illustrative. Milestone 2 replaces these with the photographic cutout
 * pipeline (multi-angle, alpha-masked) described in the roadmap — the sketch
 * registry key on each variety is the seam where that swap happens.
 */

export interface SketchProps {
  petal: string
  accent: string
}

const STEM = '#6b7f5e'
const LEAF = '#7d9070'

const svgProps = {
  viewBox: '0 0 100 160',
  width: '100%',
  height: '100%',
  'aria-hidden': true,
} as const

const Stalk: FC<{ from?: number }> = ({ from = 58 }) => (
  <path
    d={`M50 ${from} Q 48 ${from + 40} 50 152`}
    stroke={STEM}
    strokeWidth={3}
    fill="none"
    strokeLinecap="round"
  />
)

const Leaves: FC = () => (
  <g fill={LEAF}>
    <ellipse cx={40} cy={100} rx={10} ry={4.5} transform="rotate(-38 40 100)" />
    <ellipse cx={60} cy={118} rx={9} ry={4} transform="rotate(34 60 118)" />
  </g>
)

const Rose: FC<SketchProps> = ({ petal, accent }) => (
  <svg {...svgProps}>
    <Stalk />
    <Leaves />
    <g>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx={50} cy={42} rx={27} ry={17} transform={`rotate(${a} 50 42)`} fill={petal} opacity={0.5} />
      ))}
      <circle cx={50} cy={42} r={21} fill={petal} />
      {[20, 140, 260].map((a) => (
        <ellipse key={a} cx={50} cy={42} rx={15} ry={9.5} transform={`rotate(${a} 50 42)`} fill={accent} opacity={0.45} />
      ))}
      <circle cx={50} cy={42} r={10.5} fill={petal} />
      <path d="M50 42 m-8 0 a8 8 0 1 1 16 0 a6 6 0 1 1 -12 0 a4 4 0 1 1 8 0" fill="none" stroke={accent} strokeWidth={2} opacity={0.8} />
      <circle cx={50} cy={42} r={2.6} fill={accent} />
    </g>
  </svg>
)

const Peony: FC<SketchProps> = ({ petal, accent }) => (
  <svg {...svgProps}>
    <Stalk from={62} />
    <Leaves />
    <g>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <ellipse key={a} cx={50} cy={42} rx={31} ry={19} transform={`rotate(${a} 50 42)`} fill={petal} opacity={0.45} />
      ))}
      <circle cx={50} cy={42} r={25} fill={petal} opacity={0.9} />
      {[15, 75, 135, 195, 255, 315].map((a) => (
        <ellipse key={a} cx={50} cy={42} rx={17} ry={10} transform={`rotate(${a} 50 42)`} fill={accent} opacity={0.35} />
      ))}
      <circle cx={50} cy={42} r={13} fill={petal} />
      {[40, 160, 280].map((a) => (
        <ellipse key={a} cx={50} cy={42} rx={9} ry={5.5} transform={`rotate(${a} 50 42)`} fill={accent} opacity={0.5} />
      ))}
      <circle cx={50} cy={42} r={3.5} fill={accent} opacity={0.9} />
    </g>
  </svg>
)

const Ranunculus: FC<SketchProps> = ({ petal, accent }) => (
  <svg {...svgProps}>
    <Stalk />
    <Leaves />
    <g>
      <circle cx={50} cy={44} r={23} fill={petal} />
      {[19.5, 16, 12.5, 9, 5.5].map((r) => (
        <circle key={r} cx={50} cy={44} r={r} fill="none" stroke={accent} strokeWidth={1.4} opacity={0.65} />
      ))}
      <circle cx={50} cy={44} r={2.4} fill="#4a4436" />
    </g>
  </svg>
)

const Lisianthus: FC<SketchProps> = ({ petal, accent }) => (
  <svg {...svgProps}>
    <Stalk />
    <Leaves />
    {/* side bud */}
    <path d="M62 66 Q 74 58 78 44" stroke={STEM} strokeWidth={2} fill="none" />
    <ellipse cx={79} cy={40} rx={6} ry={9} fill={petal} opacity={0.9} />
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={50} cy={40} rx={13} ry={22} transform={`rotate(${a} 50 40)`} fill={petal} opacity={0.75} />
      ))}
      <circle cx={50} cy={40} r={9} fill={accent} opacity={0.55} />
      <circle cx={50} cy={40} r={4} fill="#6d6142" />
    </g>
  </svg>
)

const Carnation: FC<SketchProps> = ({ petal, accent }) => (
  <svg {...svgProps}>
    <Stalk />
    <Leaves />
    <g>
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
        <ellipse key={a} cx={50} cy={42} rx={8} ry={20} transform={`rotate(${a} 50 42)`} fill={petal} opacity={0.6} />
      ))}
      <circle cx={50} cy={42} r={14} fill={petal} />
      <path
        d="M38 38 l4 -5 4 5 4 -6 4 6 4 -5 4 5"
        stroke={accent}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M40 48 l4 -4 3 4 4 -5 4 5 3 -4 4 4"
        stroke={accent}
        strokeWidth={1.6}
        fill="none"
        opacity={0.7}
      />
    </g>
  </svg>
)

const Floret: FC<{ x: number; y: number; r: number; petal: string; accent: string }> = ({ x, y, r, petal, accent }) => (
  <g>
    {[45, 135, 225, 315].map((a) => (
      <circle
        key={a}
        cx={x + Math.cos((a * Math.PI) / 180) * r * 0.8}
        cy={y + Math.sin((a * Math.PI) / 180) * r * 0.8}
        r={r}
        fill={petal}
      />
    ))}
    <circle cx={x} cy={y} r={r * 0.45} fill={accent} />
  </g>
)

const Hydrangea: FC<SketchProps> = ({ petal, accent }) => (
  <svg {...svgProps}>
    <Stalk from={66} />
    <Leaves />
    <g opacity={0.97}>
      {[
        [50, 22, 6], [34, 30, 6], [66, 30, 6], [24, 44, 6], [50, 40, 6.5],
        [76, 44, 6], [34, 56, 6], [66, 56, 6], [50, 60, 6],
      ].map(([x, y, r], i) => (
        <Floret key={i} x={x} y={y} r={r} petal={petal} accent={accent} />
      ))}
    </g>
  </svg>
)

const Delphinium: FC<SketchProps> = ({ petal, accent }) => (
  <svg {...svgProps}>
    <path d="M50 20 Q 49 90 50 152" stroke={STEM} strokeWidth={2.6} fill="none" strokeLinecap="round" />
    <g>
      {[
        [50, 12, 3], [43, 22, 4], [57, 26, 4.5], [42, 34, 5], [59, 40, 5.5],
        [41, 48, 6], [60, 55, 6], [42, 63, 6.5], [59, 71, 6.5], [44, 80, 6.5], [57, 88, 6],
      ].map(([x, y, r], i) =>
        i < 2 ? (
          <circle key={i} cx={x} cy={y} r={r} fill={accent} opacity={0.9} />
        ) : (
          <Floret key={i} x={x} y={y} r={r * 0.72} petal={petal} accent={accent} />
        ),
      )}
    </g>
    <ellipse cx={38} cy={112} rx={11} ry={4} transform="rotate(-30 38 112)" fill={LEAF} />
  </svg>
)

const Gypsophila: FC<SketchProps> = ({ petal, accent }) => (
  <svg {...svgProps}>
    <g stroke={STEM} strokeWidth={1.3} fill="none" strokeLinecap="round">
      <path d="M50 152 Q 50 90 50 62" />
      <path d="M50 96 Q 34 76 24 54" />
      <path d="M50 96 Q 66 74 76 50" />
      <path d="M50 74 Q 40 56 38 38" />
      <path d="M50 74 Q 62 58 66 34" />
      <path d="M24 54 Q 20 46 16 40" />
      <path d="M76 50 Q 82 42 86 38" />
    </g>
    <g fill={petal} stroke={accent} strokeWidth={0.6}>
      {[
        [50, 58, 3.4], [24, 50, 3], [76, 46, 3], [38, 34, 3.2], [66, 30, 3.2],
        [16, 36, 2.6], [86, 34, 2.6], [30, 62, 2.6], [58, 44, 2.8], [46, 44, 2.4], [70, 60, 2.6],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} />
      ))}
    </g>
  </svg>
)

const MiniRose: FC<{ x: number; y: number; r: number; petal: string; accent: string }> = ({ x, y, r, petal, accent }) => (
  <g>
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx={x} cy={y} rx={r} ry={r * 0.62} transform={`rotate(${a} ${x} ${y})`} fill={petal} opacity={0.6} />
    ))}
    <circle cx={x} cy={y} r={r * 0.62} fill={petal} />
    <circle cx={x} cy={y} r={r * 0.32} fill={accent} opacity={0.7} />
  </g>
)

const SprayRose: FC<SketchProps> = ({ petal, accent }) => (
  <svg {...svgProps}>
    <Stalk from={70} />
    <Leaves />
    <g stroke={STEM} strokeWidth={2} fill="none">
      <path d="M50 70 Q 40 52 34 34" />
      <path d="M50 70 Q 62 56 68 42" />
      <path d="M50 70 Q 50 62 50 56" />
    </g>
    <MiniRose x={33} y={30} r={13} petal={petal} accent={accent} />
    <MiniRose x={69} y={38} r={12} petal={petal} accent={accent} />
    <MiniRose x={50} y={52} r={11} petal={petal} accent={accent} />
  </svg>
)

const Astilbe: FC<SketchProps> = ({ petal, accent }) => {
  const dots: [number, number, number][] = []
  // Feathered plume: pseudo-random but deterministic spread, narrowing upward.
  for (let i = 0; i < 46; i++) {
    const t = i / 46
    const y = 12 + t * 62
    const halfWidth = 4 + t * 12
    const x = 50 + Math.sin(i * 12.9898) * halfWidth
    dots.push([x, y, 1.6 + ((i * 7) % 3) * 0.5])
  }
  return (
    <svg {...svgProps}>
      <path d="M50 74 Q 49 110 50 152" stroke={STEM} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <ellipse cx={62} cy={116} rx={10} ry={4} transform="rotate(28 62 116)" fill={LEAF} />
      <g fill={petal}>
        {dots.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} opacity={i % 3 === 0 ? 0.7 : 0.95} />
        ))}
      </g>
      <path d="M50 74 Q 48 46 50 14" stroke={accent} strokeWidth={1.2} fill="none" opacity={0.6} />
    </svg>
  )
}

const Eucalyptus: FC<SketchProps> = ({ petal, accent }) => (
  <svg {...svgProps}>
    <path d="M50 152 Q 46 90 52 16" stroke={STEM} strokeWidth={2.6} fill="none" strokeLinecap="round" />
    <g fill={petal} stroke={accent} strokeWidth={1}>
      {[
        [38, 34, 8], [64, 44, 8.5], [36, 58, 9], [66, 70, 9], [36, 84, 9.5],
        [64, 96, 9], [38, 112, 8.5], [62, 122, 8], [52, 22, 6.5],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} />
      ))}
    </g>
  </svg>
)

const Ruscus: FC<SketchProps> = ({ petal, accent }) => (
  <svg {...svgProps}>
    <path d="M50 152 Q 44 92 58 14" stroke={STEM} strokeWidth={2.4} fill="none" strokeLinecap="round" />
    <g fill={petal} stroke={accent} strokeWidth={0.8}>
      {[
        [40, 32, -46], [64, 42, 40], [38, 54, -44], [64, 64, 42], [38, 76, -40],
        [62, 86, 44], [40, 98, -42], [60, 108, 40], [56, 20, 10],
      ].map(([x, y, a], i) => (
        <ellipse key={i} cx={x} cy={y} rx={4} ry={11} transform={`rotate(${a} ${x} ${y})`} />
      ))}
    </g>
  </svg>
)

export const SKETCHES: Record<string, FC<SketchProps>> = {
  rose: Rose,
  peony: Peony,
  ranunculus: Ranunculus,
  lisianthus: Lisianthus,
  carnation: Carnation,
  hydrangea: Hydrangea,
  delphinium: Delphinium,
  gypsophila: Gypsophila,
  'spray-rose': SprayRose,
  astilbe: Astilbe,
  eucalyptus: Eucalyptus,
  ruscus: Ruscus,
}

/* ------------------------------- Vessels ------------------------------- */

const vesselSvgProps = {
  viewBox: '0 0 260 200',
  width: '100%',
  height: '100%',
  'aria-hidden': true,
} as const

const Wrap: FC = () => (
  <svg {...vesselSvgProps}>
    <path d="M56 8 L204 8 L162 186 L98 186 Z" fill="#c9a87c" />
    <path d="M56 8 L130 30 L204 8 L162 186 L98 186 Z" fill="#bd9a6c" />
    <path d="M56 8 L130 30 L98 186 L98 186 Z" fill="#ab885c" opacity={0.6} />
    <path d="M130 30 L204 8 L162 186 Z" fill="#d2b189" opacity={0.5} />
    <rect x={84} y={88} width={94} height={16} rx={3} fill="#a8626e" transform="rotate(-2 130 96)" />
    <circle cx={130} cy={96} r={7} fill="#8f4e5b" />
    <path d="M123 100 l-12 18 M137 100 l13 17" stroke="#8f4e5b" strokeWidth={5} strokeLinecap="round" />
  </svg>
)

const Compote: FC = () => (
  <svg {...vesselSvgProps}>
    <ellipse cx={130} cy={34} rx={92} ry={20} fill="#b9b2a2" />
    <path d="M38 34 Q 42 86 92 100 L168 100 Q 218 86 222 34 Z" fill="#ccc7bb" />
    <path d="M38 34 Q 42 86 92 100 L112 100 Q 66 84 58 34 Z" fill="#b3ad9e" opacity={0.7} />
    <rect x={118} y={100} width={24} height={52} fill="#c4bfb1" />
    <path d="M118 100 h8 v52 h-8 Z" fill="#aaa494" opacity={0.6} />
    <ellipse cx={130} cy={162} rx={52} ry={13} fill="#ccc7bb" />
    <ellipse cx={130} cy={158} rx={52} ry={13} fill="#d8d3c6" />
    <ellipse cx={130} cy={34} rx={80} ry={15} fill="#8d877a" opacity={0.55} />
  </svg>
)

export const VESSEL_SKETCHES: Record<string, FC> = {
  wrap: Wrap,
  compote: Compote,
}
