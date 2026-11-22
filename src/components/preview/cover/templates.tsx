import type { CSSProperties, ReactNode } from 'react'
import type { CoverTemplateId } from '@/types/document'
import {
  K, G,
  Books, ClassicOrnateArt, DiagonalArt, DiamondRule, Fleur, Flourish, FramedPlaqueArt, GeometricArt,
  GradCap, GreekKeyArt, Inkwell, Laurel, LaurelTempleArt, ModernSlantArt, OpenBook, Pendant, Quill,
  QuillArt, RibbonCapArt, RibbonDiamondArt, RoyalArt, Temple, WavesArt,
} from './art'

export interface TitleProps {
  researchType: string
  title: string
  subtitle?: string
}

export interface CoverTemplate {
  id: CoverTemplateId
  name: string
  /** Full-page decoration layer, rendered behind the content. */
  art: ReactNode
  /** Content-box padding (mm values keep A4 proportions). */
  padding?: CSSProperties
  Title: (p: TitleProps) => ReactNode
  /** Extra decoration placed above the content (e.g. corner icons). */
  overlay?: ReactNode
}

/* ---------------- Title treatments ---------------- */

const Kicker = ({ children }: { children: ReactNode }) => (
  <p className="text-[17pt] font-extrabold">{children}</p>
)

const Heading = ({ title, size = 'text-[36pt]' }: { title: string; size?: string }) => (
  <h1 className={`${size} leading-[1.3] font-black text-balance`}>{title || 'عنوان البحث'}</h1>
)

const Sub = ({ subtitle }: { subtitle?: string }) =>
  subtitle ? <p className="mt-1 text-[12pt] font-semibold text-gray-600">{subtitle}</p> : null

function plainTitle(extra?: ReactNode) {
  return function PlainTitle({ researchType, title, subtitle }: TitleProps) {
    return (
      <>
        <Kicker>{researchType}</Kicker>
        <div className="mt-3">
          <Heading title={title} />
          <Sub subtitle={subtitle} />
        </div>
        <DiamondRule className="mt-5 w-[70mm]" />
        {extra && <div className="mt-8">{extra}</div>}
      </>
    )
  }
}

/** SVG frame that stretches to its content while keeping stroke widths constant. */
function StretchFrame({ viewBox, children, className }: { viewBox: string; children: ReactNode; className?: string }) {
  return (
    <svg viewBox={viewBox} preserveAspectRatio="none" className={`absolute inset-0 size-full overflow-visible ${className ?? ''}`} aria-hidden>
      {children}
    </svg>
  )
}

const ns = { vectorEffect: 'non-scaling-stroke' as const }

function SlantTitle({ researchType, title, subtitle }: TitleProps) {
  return (
    <>
      <Kicker>{researchType}</Kicker>
      <div className="relative mx-auto mt-5 w-[150mm] px-16 py-6">
        <StretchFrame viewBox="0 0 400 100">
          <polygon points="50,16 398,16 368,100 20,100" fill={G} />
          <polygon points="40,6 388,6 358,90 10,90" fill="white" stroke={K} strokeWidth="2.6" {...ns} />
          <polygon points="0,30 18,30 4,70 -14,70" fill={K} />
          <polygon points="404,26 418,26 404,66 390,66" fill={K} />
          <line x1="-30" y1="96" x2="80" y2="96" stroke={K} strokeWidth="1" {...ns} />
          <line x1="320" y1="0" x2="430" y2="0" stroke={K} strokeWidth="1" {...ns} />
        </StretchFrame>
        <div className="relative -translate-y-1">
          <Heading title={title} />
          <Sub subtitle={subtitle} />
        </div>
      </div>
      <DiamondRule className="mt-6 w-[60mm]" />
    </>
  )
}

function OrnatePlaqueTitle({ researchType, title, subtitle }: TitleProps) {
  return (
    <>
      <Kicker>{researchType}</Kicker>
      <Fleur className="mt-3 h-9 w-36" flip />
      <div className="relative mx-auto w-[140mm] px-16 py-6">
        <StretchFrame viewBox="0 0 400 120">
          <path d="M44 6 H356 C362 22 372 40 394 60 C372 80 362 98 356 114 H44 C38 98 28 80 6 60 C28 40 38 22 44 6Z" fill="white" stroke={K} strokeWidth="2.6" {...ns} />
          <path d="M52 16 H348 C354 30 362 46 378 60 C362 74 354 90 348 104 H52 C46 90 38 74 22 60 C38 46 46 30 52 16Z" fill="none" stroke={K} strokeWidth="1" {...ns} />
        </StretchFrame>
        <span className="absolute top-1/2 -right-2 size-3.5 -translate-y-1/2 rounded-full border-2 border-gray-900 bg-white" />
        <span className="absolute top-1/2 -left-2 size-3.5 -translate-y-1/2 rounded-full border-2 border-gray-900 bg-white" />
        <div className="relative">
          <Heading title={title} />
          <Sub subtitle={subtitle} />
        </div>
      </div>
      <Fleur className="h-12 w-44" />
    </>
  )
}

function SwooshTitle({ researchType, title, subtitle }: TitleProps) {
  return (
    <>
      <Kicker>{researchType}</Kicker>
      <div className="relative mx-auto mt-2 w-[150mm] px-14 py-10">
        <StretchFrame viewBox="0 0 400 160">
          <path d="M386 46 C300 -8 70 0 30 70 C4 118 130 160 290 144 C130 154 22 118 52 70 C84 22 290 6 386 46Z" fill={K} />
          <path d="M300 150 C350 142 390 120 396 90" fill="none" stroke={K} strokeWidth="2" {...ns} />
        </StretchFrame>
        <div className="absolute bottom-0 -left-4 flex items-end">
          <Quill className="w-11 -rotate-6" />
          <Inkwell className="-mr-5 w-12" />
        </div>
        <div className="relative -rotate-2">
          <Heading title={title} size="text-[40pt]" />
          <Sub subtitle={subtitle} />
        </div>
      </div>
    </>
  )
}

function LaurelTitle({ researchType, title, subtitle }: TitleProps) {
  return (
    <>
      <Temple className="mx-auto w-[34mm]" />
      <div className="mt-1 flex items-center justify-center gap-2">
        <Laurel className="h-[58mm] shrink-0" flip />
        <div className="min-w-0 flex-1 pt-4">
          <Kicker>{researchType}</Kicker>
          <div className="mt-2">
            <Heading title={title} />
            <Sub subtitle={subtitle} />
          </div>
          <OpenBook className="mx-auto mt-4 w-[34mm]" />
        </div>
        <Laurel className="h-[58mm] shrink-0" />
      </div>
      <DiamondRule className="mt-4 w-[110mm]" />
    </>
  )
}

function RoundedTitle({ researchType, title, subtitle }: TitleProps) {
  return (
    <>
      <Kicker>{researchType}</Kicker>
      <div className="mx-auto mt-5 w-[130mm] rounded-[16px] border-[2.5px] border-gray-900 p-[5px]">
        <div className="rounded-[11px] border border-gray-900 px-8 py-5">
          <Heading title={title} />
          <Sub subtitle={subtitle} />
        </div>
      </div>
      <div className="mt-3 flex flex-col items-center gap-1" aria-hidden>
        <span className="size-2.5 rotate-45 border-2 border-gray-900" />
        <DiamondRule className="w-[110mm]" />
      </div>
    </>
  )
}

function DiamondFrameTitle({ researchType, title, subtitle }: TitleProps) {
  return (
    <>
      <Pendant />
      <Fleur className="mt-1 h-8 w-32" flip />
      <div className="relative mx-auto w-[150mm] px-20 py-10">
        <StretchFrame viewBox="0 0 400 160">
          <polygon points="70,4 330,4 398,80 330,156 70,156 2,80" fill="white" stroke={K} strokeWidth="2.4" {...ns} />
          <polygon points="80,14 320,14 382,80 320,146 80,146 18,80" fill="none" stroke={K} strokeWidth="1" {...ns} />
          <line x1="-30" y1="80" x2="2" y2="80" stroke={K} strokeWidth="1.2" {...ns} />
          <line x1="398" y1="80" x2="430" y2="80" stroke={K} strokeWidth="1.2" {...ns} />
        </StretchFrame>
        <div className="relative">
          <p className="mb-1 text-[13pt] font-extrabold text-gray-700">{researchType}</p>
          <Heading title={title} />
          <Sub subtitle={subtitle} />
        </div>
      </div>
      <Fleur className="h-8 w-32" />
      <Pendant flip />
    </>
  )
}

/* ---------------- Registry ---------------- */

const base = { paddingTop: '20mm', paddingBottom: '16mm', paddingInline: '20mm' }

export const COVER_TEMPLATES: CoverTemplate[] = [
  { id: 'diagonal', name: 'أشرطة مائلة', art: <DiagonalArt />, padding: base, Title: plainTitle() },
  { id: 'classic-ornate', name: 'كلاسيكي مزخرف', art: <ClassicOrnateArt />, padding: base, Title: plainTitle(<Flourish className="h-8 w-[80mm]" />) },
  { id: 'ribbon-diamond', name: 'شريط ومعيّن', art: <RibbonDiamondArt />, padding: { ...base, paddingLeft: '36mm', paddingRight: '16mm' }, Title: plainTitle() },
  {
    id: 'greek-key', name: 'إطار هندسي', art: <GreekKeyArt />, padding: base,
    Title: plainTitle(
      <div className="flex items-end justify-center gap-3">
        <Laurel className="h-[30mm]" flip />
        <OpenBook className="mb-2 w-[42mm]" />
        <Laurel className="h-[30mm]" />
      </div>,
    ),
  },
  { id: 'waves', name: 'أمواج', art: <WavesArt />, padding: { ...base, paddingTop: '30mm', paddingBottom: '30mm' }, Title: plainTitle() },
  { id: 'royal', name: 'ملكي', art: <RoyalArt />, padding: base, Title: plainTitle(<Fleur className="h-14 w-[60mm]" />) },
  { id: 'modern-slant', name: 'عصري مائل', art: <ModernSlantArt />, padding: base, Title: SlantTitle },
  { id: 'framed-plaque', name: 'لوحة مزخرفة', art: <FramedPlaqueArt />, padding: base, Title: OrnatePlaqueTitle },
  {
    id: 'quill', name: 'الريشة والمحبرة', art: <QuillArt />, padding: { ...base, paddingTop: '26mm', paddingBottom: '30mm' }, Title: SwooshTitle,
    overlay: <GradCap className="absolute top-[8mm] right-[14mm] w-[22mm] rotate-6" />,
  },
  { id: 'laurel-temple', name: 'غار ومعبد', art: <LaurelTempleArt />, padding: { ...base, paddingBottom: '30mm' }, Title: LaurelTitle },
  {
    id: 'ribbon-cap', name: 'وسام التخرج', art: <RibbonCapArt />, padding: { ...base, paddingLeft: '40mm', paddingRight: '16mm' }, Title: RoundedTitle,
    overlay: <Books className="absolute right-[7mm] bottom-[6mm] w-[28mm]" />,
  },
  { id: 'geometric', name: 'هندسي', art: <GeometricArt />, padding: base, Title: DiamondFrameTitle },
]

export function getCoverTemplate(id?: CoverTemplateId) {
  return COVER_TEMPLATES.find((t) => t.id === id) ?? COVER_TEMPLATES[1]
}
