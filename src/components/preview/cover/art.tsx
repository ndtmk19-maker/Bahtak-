import type { ReactNode } from 'react'

export const K = '#111827'
export const G = '#9ca3af'
export const L = '#e5e7eb'

/* ================================================================ */
/* Small reusable ornaments                                          */
/* ================================================================ */

export function DiamondRule({ className = 'w-56' }: { className?: string }) {
  return (
    <div className={`mx-auto flex items-center justify-center gap-2 ${className}`} aria-hidden>
      <span className="h-[1.5px] flex-1 bg-gray-900" />
      <span className="size-2.5 rotate-45 bg-gray-900" />
      <span className="h-[1.5px] flex-1 bg-gray-900" />
    </div>
  )
}

const FLOURISH_PATHS = (
  <>
    <path d="M120 14 C108 14 104 4 92 6 C82 8 84 20 94 18 C100 17 98 10 93 11 M92 6 C70 2 40 18 4 12" />
    <path d="M120 14 C132 14 136 4 148 6 C158 8 156 20 146 18 C140 17 142 10 147 11 M148 6 C170 2 200 18 236 12" />
  </>
)

/** Thin horizontal calligraphic flourish. */
export function Flourish({ className = 'h-7 w-64' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 28" className={`mx-auto ${className}`} fill="none" stroke={K} strokeWidth="1.3" strokeLinecap="round" aria-hidden>
      {FLOURISH_PATHS}
      <path d="M120 6 L127 14 L120 22 L113 14 Z" fill={K} stroke="none" />
      <circle cx="4" cy="12" r="1.8" fill={K} stroke="none" />
      <circle cx="236" cy="12" r="1.8" fill={K} stroke="none" />
    </svg>
  )
}

/** Bold baroque scroll ornament (fleuron) — paths drawn in a 120x40 box. */
function FleurPaths() {
  const half = (
    <>
      <path d="M60 20 C52 8 40 6 34 12 C28 18 34 26 40 22 C44 19 41 14 37 16" fill="none" stroke={K} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M34 12 C24 4 14 10 6 18" fill="none" stroke={K} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M40 26 C30 32 18 30 10 24" fill="none" stroke={K} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="6" cy="18" r="1.6" fill={K} />
    </>
  )
  return (
    <>
      {half}
      <g transform="matrix(-1 0 0 1 120 0)">{half}</g>
      <path d="M60 4 L66 14 L60 24 L54 14 Z" fill={K} />
      <path d="M60 24 C56 30 56 34 60 38 C64 34 64 30 60 24Z" fill={K} />
    </>
  )
}

export function Fleur({ className = 'h-10 w-40', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 120 40" className={`mx-auto ${className} ${flip ? 'rotate-180' : ''}`} aria-hidden>
      <FleurPaths />
    </svg>
  )
}

/** Vertical pendant ornament (stem + diamond + scroll) used above/below a title frame. */
export function Pendant({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 60 40" className={`mx-auto h-10 w-16 ${flip ? 'rotate-180' : ''}`} fill="none" stroke={K} strokeLinecap="round" aria-hidden>
      <path d="M30 0 V14 M26 4 H34 M27 9 H33" strokeWidth="1.4" />
      <path d="M30 14 L37 22 L30 30 L23 22 Z" fill="white" strokeWidth="1.6" />
      <path d="M30 18 L33 22 L30 26 L27 22 Z" fill={K} stroke="none" />
      <path d="M23 22 C16 30 6 28 4 22 M37 22 C44 30 54 28 56 22" strokeWidth="1.3" />
      <path d="M30 30 V40" strokeWidth="1.4" />
    </svg>
  )
}

/* ================================================================ */
/* Icons / illustrations                                             */
/* ================================================================ */

export function GradCap({ className = 'w-16', color = K }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden>
      <path d="M14 21 V33 C14 40 50 40 50 33 V21 L32 28Z" fill={color} />
      <path d="M32 4 L62 16 L32 28 L2 16Z" fill={color} />
      <path d="M32 7 L55 16 L32 25" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />
      <path d="M32 16 L56 18 V34" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M54 34 L58 34 L59 42 L53 42Z" fill={color} />
    </svg>
  )
}

export function OpenBook({ className = 'w-40' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 62" className={className} aria-hidden>
      <path d="M60 14 C45 4 20 4 6 10 V50 C20 44 45 44 60 54Z" fill={K} />
      <path d="M60 14 C75 4 100 4 114 10 V50 C100 44 75 44 60 54Z" fill={K} />
      <g fill="none" stroke="white" strokeWidth="0.9" opacity="0.85">
        <path d="M14 18 C28 13 42 14 54 21 M14 26 C28 21 42 22 54 29 M14 34 C28 29 42 30 54 37" />
        <path d="M106 18 C92 13 78 14 66 21 M106 26 C92 21 78 22 66 29 M106 34 C92 29 78 30 66 37" />
      </g>
      <path d="M2 54 C25 47 45 49 60 59 C75 49 95 47 118 54" fill="none" stroke={K} strokeWidth="2.4" />
    </svg>
  )
}

export function Laurel({ className = 'h-40', flip = false }: { className?: string; flip?: boolean }) {
  // Leaves are placed along a quadratic stem curve.
  const p0 = [44, 116], p1 = [-2, 78], p2 = [30, 4]
  const leaves: ReactNode[] = []
  for (let i = 0; i < 11; i++) {
    const t = 0.06 + i * 0.085
    const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
    const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
    const a = (Math.atan2(dy, dx) * 180) / Math.PI
    const s = 1 - i * 0.035
    leaves.push(
      <ellipse key={`a${i}`} cx={x} cy={y} rx={8 * s} ry={3 * s} fill={K} transform={`rotate(${a - 40} ${x} ${y}) translate(${7 * s} 0)`} />,
      <ellipse key={`b${i}`} cx={x} cy={y} rx={8 * s} ry={3 * s} fill={K} transform={`rotate(${a + 40} ${x} ${y}) translate(${7 * s} 0)`} />,
    )
  }
  return (
    <svg viewBox="-6 -6 64 128" className={`${className} ${flip ? '-scale-x-100' : ''}`} aria-hidden>
      <path d={`M${p0} Q${p1} ${p2}`} fill="none" stroke={K} strokeWidth="1.8" />
      {leaves}
      <ellipse cx="30" cy="0" rx="3" ry="7" fill={K} transform="rotate(25 30 0)" />
    </svg>
  )
}

export function Temple({ className = 'w-32' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 72" className={className} aria-hidden>
      <path d="M50 2 L96 22 H4Z" fill="none" stroke={K} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M50 10 L78 19 H22Z" fill={K} />
      <rect x="6" y="24" width="88" height="6" fill={K} />
      {[13, 29, 45, 61, 77].map((x) => (
        <g key={x}>
          <rect x={x} y="32" width="10" height="26" fill="none" stroke={K} strokeWidth="1.8" />
          <path d={`M${x + 5} 34 V56`} stroke={K} strokeWidth="0.8" />
        </g>
      ))}
      <rect x="4" y="60" width="92" height="4" fill={K} />
      <rect x="0" y="66" width="100" height="5" fill={K} />
    </svg>
  )
}

export function Quill({ className = 'w-14' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 120" className={className} aria-hidden>
      <path d="M57 2 C26 8 8 42 10 86 L15 86 C20 52 36 22 57 2Z" fill={K} />
      <path d="M57 2 C40 20 26 46 15 86" fill="none" stroke="white" strokeWidth="1" />
      <g stroke="white" strokeWidth="0.7">
        {[20, 30, 40, 50, 60, 70].map((y, i) => (
          <path key={y} d={`M${38 - i * 4} ${y} l-8 4`} />
        ))}
      </g>
      <path d="M12 86 L5 114" stroke={K} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function Inkwell({ className = 'w-14' }: { className?: string }) {
  return (
    <svg viewBox="0 0 50 42" className={className} aria-hidden>
      <rect x="16" y="2" width="18" height="8" rx="1.5" fill={K} />
      <path d="M10 10 H40 V14 C50 18 50 36 40 40 H10 C0 36 0 18 10 14Z" fill={K} />
      <path d="M10 18 C8 24 8 30 10 34" fill="none" stroke="white" strokeWidth="1.4" opacity="0.6" />
    </svg>
  )
}

export function Books({ className = 'w-28' }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 56" className={className} aria-hidden>
      <g transform="rotate(-4 45 10)">
        <rect x="14" y="4" width="66" height="12" rx="2" fill={K} />
        <path d="M18 8 H76 M18 12 H76" stroke="white" strokeWidth="0.8" />
      </g>
      <rect x="6" y="20" width="74" height="14" rx="2" fill={K} />
      <rect x="10" y="22" width="66" height="10" fill="none" stroke="white" strokeWidth="0.8" />
      <rect x="10" y="38" width="76" height="15" rx="2" fill={K} />
      <path d="M14 42 H82 M14 49 H82" stroke="white" strokeWidth="0.8" />
    </svg>
  )
}

/* ================================================================ */
/* Full-page decorations — drawn in a 210x297 (mm) coordinate space  */
/* ================================================================ */

function Page({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 210 297" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
      {children}
    </svg>
  )
}

/** Renders a top-left corner motif in all four corners. */
function Corners({ children }: { children: ReactNode }) {
  return (
    <>
      <g>{children}</g>
      <g transform="matrix(-1 0 0 1 210 0)">{children}</g>
      <g transform="matrix(1 0 0 -1 0 297)">{children}</g>
      <g transform="matrix(-1 0 0 -1 210 297)">{children}</g>
    </>
  )
}

const Rot180 = ({ children }: { children: ReactNode }) => <g transform="rotate(180 105 148.5)">{children}</g>
const HairFrame = ({ inset = 4 }: { inset?: number }) => (
  <rect x={inset} y={inset} width={210 - inset * 2} height={297 - inset * 2} fill="none" stroke={K} strokeWidth="0.5" />
)

function Dots({ x, y, cols, rows, gap = 4 }: { x: number; y: number; cols: number; rows: number; gap?: number }) {
  const out: ReactNode[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(<circle key={`${r}-${c}`} cx={x + c * gap} cy={y + r * gap} r="0.55" fill={K} />)
  return <>{out}</>
}

export function DiagonalArt() {
  const stripes = (
    <>
      <polygon points="138,0 143,0 210,67 210,72" fill={L} />
      <polygon points="150,0 166,0 210,44 210,60" fill={K} />
      <polygon points="171,0 178,0 210,32 210,39" fill={G} />
      <polygon points="183,0 186,0 210,24 210,27" fill={K} />
    </>
  )
  return (
    <Page>
      <HairFrame />
      {stripes}
      <Rot180>{stripes}</Rot180>
    </Page>
  )
}

function concaveFrame(i: number, r: number) {
  const a = 210 - i, b = 297 - i
  return `M${i + r} ${i} H${a - r} A${r} ${r} 0 0 0 ${a} ${i + r} V${b - r} A${r} ${r} 0 0 0 ${a - r} ${b} H${i + r} A${r} ${r} 0 0 0 ${i} ${b - r} V${i + r} A${r} ${r} 0 0 0 ${i + r} ${i}Z`
}

export function ClassicOrnateArt() {
  return (
    <Page>
      <HairFrame inset={4} />
      <path d={concaveFrame(8, 9)} fill="none" stroke={K} strokeWidth="1.1" />
      <path d={concaveFrame(10.5, 7)} fill="none" stroke={K} strokeWidth="0.45" />
      <Corners>
        <circle cx="8" cy="8" r="2.2" fill={K} />
      </Corners>
      <rect x="84" y="284" width="42" height="10" fill="white" />
      <g transform="translate(75 282) scale(0.25)" fill="none" stroke={K} strokeWidth="5" strokeLinecap="round">
        {FLOURISH_PATHS}
        <path d="M120 2 L130 14 L120 26 L110 14 Z" fill={K} stroke="none" />
      </g>
    </Page>
  )
}

export function RibbonDiamondArt() {
  return (
    <Page>
      <HairFrame />
      <rect x="12" y="0" width="5" height="297" fill={K} />
      <rect x="19" y="0" width="1.6" height="297" fill={G} />
      <rect x="22.5" y="0" width="0.9" height="297" fill={K} />
      <rect x="25.5" y="0" width="0.5" height="297" fill={G} />
      <g transform="translate(19 64) rotate(45)">
        <rect x="-11" y="-11" width="22" height="22" fill="white" stroke={K} strokeWidth="1.2" />
        <rect x="-8" y="-8" width="16" height="16" fill={K} />
        <rect x="-4" y="-4" width="8" height="8" fill={G} />
      </g>
      <path d="M60 297 C115 272 160 245 210 198 V214 C165 252 125 278 92 297Z" fill={G} />
      <path d="M92 297 C135 276 175 252 210 224 V236 C180 262 150 282 122 297Z" fill={K} />
      <path d="M100 268 C145 252 182 228 210 205" fill="none" stroke={K} strokeWidth="0.6" />
    </Page>
  )
}

export function GreekKeyArt() {
  return (
    <Page>
      <rect x="8" y="8" width="194" height="281" fill="none" stroke={K} strokeWidth="1.2" />
      <rect x="11" y="11" width="188" height="275" fill="none" stroke={K} strokeWidth="0.45" />
      <Corners>
        <rect x="5" y="5" width="13" height="13" fill="white" stroke={K} strokeWidth="1.1" />
        <path d="M8 18 V8 H18 M8 15 H15 V11 H11.5 V13" fill="none" stroke={K} strokeWidth="0.8" />
      </Corners>
    </Page>
  )
}

export function WavesArt() {
  const wave = (
    <>
      <path d="M0 0 H210 V30 C165 46 120 16 70 28 C40 35 15 30 0 34Z" fill={L} />
      <path d="M0 0 H210 V22 C165 38 120 8 70 20 C40 27 15 22 0 26Z" fill={G} />
      <path d="M0 0 H210 V12 C165 28 120 0 70 12 C40 19 15 14 0 18Z" fill={K} />
    </>
  )
  return (
    <Page>
      <HairFrame />
      {wave}
      <Rot180>{wave}</Rot180>
    </Page>
  )
}

export function RoyalArt() {
  return (
    <Page>
      <rect x="10" y="10" width="190" height="277" fill="none" stroke={K} strokeWidth="1" />
      <rect x="12.5" y="12.5" width="185" height="272" fill="none" stroke={K} strokeWidth="0.4" />
      <Corners>
        <path d="M5 16 H16 V5" fill="none" stroke={K} strokeWidth="0.8" />
        <rect x="6.5" y="6.5" width="5" height="5" fill={K} />
      </Corners>
      {[
        [105, 10, 0],
        [105, 287, 180],
      ].map(([x, y, r]) => (
        <g key={y} transform={`translate(${x} ${y}) rotate(${r})`}>
          <rect x="-24" y="-3" width="48" height="6" fill="white" />
          <g transform="translate(-22 -7) scale(0.366)">
            <FleurPaths />
          </g>
        </g>
      ))}
      {[10, 200].map((x) => (
        <g key={x} transform={`translate(${x} 148.5)`}>
          <rect x="-3" y="-14" width="6" height="28" fill="white" />
          <path d="M0 -14 L4 -6 L0 2 L-4 -6Z M0 14 L4 6 L0 -2 L-4 6Z" fill="white" stroke={K} strokeWidth="0.8" />
          <path d="M0 -10 L2 -6 L0 -2 L-2 -6Z M0 10 L2 6 L0 2 L-2 6Z" fill={K} />
        </g>
      ))}
    </Page>
  )
}

export function ModernSlantArt() {
  const corner = (
    <>
      <polygon points="0,0 42,0 0,42" fill={K} />
      <polygon points="48,0 55,0 0,55 0,48" fill={G} />
      <line x1="62" y1="0" x2="0" y2="62" stroke={K} strokeWidth="0.5" />
      <polygon points="16,10 30,4 6,30 4,24" fill="white" opacity="0.25" />
    </>
  )
  return (
    <Page>
      <HairFrame />
      {corner}
      <Rot180>{corner}</Rot180>
      <Dots x={170} y={10} cols={7} rows={5} />
      <Dots x={12} y={150} cols={5} rows={6} />
      <Dots x={14} y={256} cols={6} rows={5} />
      <polygon points="180,175 196,165 196,172 180,182" fill={G} />
      <polygon points="186,184 196,178 196,182 186,188" fill={K} />
    </Page>
  )
}

export function FramedPlaqueArt() {
  return (
    <Page>
      <rect x="8" y="8" width="194" height="281" fill="none" stroke={K} strokeWidth="1.1" />
      <rect x="11" y="11" width="188" height="275" fill="none" stroke={K} strokeWidth="0.45" />
      <Corners>
        <rect x="4" y="4" width="12" height="12" fill="white" stroke={K} strokeWidth="1" />
        <rect x="7" y="7" width="6" height="6" fill="none" stroke={K} strokeWidth="0.7" />
      </Corners>
    </Page>
  )
}

export function QuillArt() {
  return (
    <Page>
      <HairFrame />
      <path d="M0 0 H86 C52 10 24 30 0 70Z" fill={G} />
      <path d="M0 0 H70 C42 8 18 26 0 56Z" fill={K} />
      <path d="M0 62 C20 30 50 10 96 0" fill="none" stroke={K} strokeWidth="0.6" />
      <path d="M0 262 C50 248 110 276 160 262 C185 255 200 250 210 246 V297 H0Z" fill={G} />
      <path d="M0 272 C50 260 110 288 160 274 C185 267 200 264 210 262 V297 H0Z" fill={K} />
      <path d="M0 280 C60 270 110 296 210 274" fill="none" stroke="white" strokeWidth="0.8" />
    </Page>
  )
}

export function LaurelTempleArt() {
  return (
    <Page>
      <HairFrame />
      <path d="M120 0 H210 V40 C190 18 160 6 120 0Z" fill={G} />
      <path d="M145 0 H210 V26 C192 12 172 4 145 0Z" fill={K} />
      <path d="M0 250 C40 278 120 284 210 264 V297 H0Z" fill={G} />
      <path d="M0 262 C40 288 120 292 210 276 V297 H0Z" fill={K} />
      <path d="M0 256 C50 284 130 288 210 270" fill="none" stroke={K} strokeWidth="0.5" />
    </Page>
  )
}

function hexPoints(r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`
  }).join(' ')
}

export function RibbonCapArt() {
  return (
    <Page>
      <HairFrame />
      <rect x="10" y="0" width="1.2" height="104" fill={G} />
      <polygon points="13,0 31,0 31,108 22,99 13,108" fill={K} />
      <rect x="32.8" y="0" width="1.2" height="104" fill={G} />
      <g transform="translate(22 52)">
        <polygon points={hexPoints(15)} fill="white" stroke={K} strokeWidth="1.6" />
        <polygon points={hexPoints(12.5)} fill="none" stroke={K} strokeWidth="0.5" />
        <g transform="translate(-9 -7) scale(0.28)">
          <path d="M14 21 V33 C14 40 50 40 50 33 V21 L32 28Z" fill={K} />
          <path d="M32 4 L62 16 L32 28 L2 16Z" fill={K} />
          <path d="M32 16 L56 18 V36" fill="none" stroke={K} strokeWidth="2" />
        </g>
      </g>
    </Page>
  )
}

export function GeometricArt() {
  const shards = (
    <>
      <polygon points="0,0 54,0 0,38" fill={K} />
      <polygon points="54,0 74,0 0,58 0,38" fill={G} />
      <polygon points="0,58 74,0 84,0 0,66" fill={L} />
      <polygon points="210,50 180,82 210,120" fill={L} />
      <polygon points="210,62 192,82 210,104" fill={G} />
    </>
  )
  return (
    <Page>
      <HairFrame />
      {shards}
      <Rot180>{shards}</Rot180>
    </Page>
  )
}
