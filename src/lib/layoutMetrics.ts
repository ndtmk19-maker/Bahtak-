// قياسات صفحة A4 الفعلية وأداة قياس الأسطر المستعملة في توزيع النص على الصفحات.
// كل الأرقام هنا مشتقة من styles/paper.css؛ عند تعديل الحشوات أو الإطارات هناك يجب تحديثها هنا.

export type MajorSectionBreak = 'smart' | 'always';

export interface LayoutOptions {
  /** حجم خط المتن بالنقطة (doc.fontSize) */
  fontSizePt?: number;
  /** تباعد الأسطر (doc.lineHeight) */
  lineHeight?: number;
  /** عائلة الخط كما في CSS (doc.fontFamily) */
  fontFamily?: string;
  /** شريط معلومات الطالب أعلى كل صفحة */
  showStudentInfo?: boolean;
  /** 'card' = بطاقة قراءة بعمودين */
  layoutMode?: string;
  /**
   * سياسة بدء المباحث والخاتمة:
   * - smart: صفحة جديدة إلا إذا كانت الصفحة الحالية شبه فارغة (تفادي صفحات بثلاثة أسطر)
   * - always: صفحة جديدة دائماً (السلوك القديم)
   */
  majorSectionBreak?: MajorSectionBreak;
}

export interface PageMetrics {
  fontSizePt: number;
  lineHeight: number;
  fontFamily: string;
  majorSectionBreak: MajorSectionBreak;
  /** عرض عمود المتن بالمليمتر */
  columnWidthMm: number;
  /** عرض منطقة الهوامش السفلية (تمتد على كامل عرض الإطار حتى في وضع العمودين) */
  footerWidthMm: number;
  /** المساحة الرأسية المتاحة للمتن والهوامش معاً (دون رقم الصفحة) */
  bodyCapacityMm: number;
  columns: number;
}

// ===== الهندسة المستخرجة من paper.css =====
const PX_MM = 25.4 / 96; // 1px CSS بالمليمتر
const PT_MM = 25.4 / 72; // 1pt بالمليمتر
const A4_PAGE_H = 296; // .a4-page { height: 296mm }
const A4_PAGE_W = 210;
const PAGE_PADDING = 8; // .a4-page { padding: 8mm }
const OUTER_FRAME = (1 + 2) * 2 * PX_MM; // .page-border: border 1px + padding 2px
const INNER_BORDER = 2 * 2 * PX_MM; // .page-inner-border: border 2px
const INNER_PAD_V = 6.5 + 4; // .page-inner-border padding-top/bottom
const INNER_PAD_H = 10 * 2; // .page-inner-border padding-inline
const PAGE_NUMBER_BLOCK = 1.5 + 1.5 + 10 * PT_MM * 1.9; // .doc-footer padding-top + margin + سطر Cairo 10pt
const STUDENT_INFO_BLOCK = 10 * PT_MM * 1.9 + 1.2 + 2.5 + PX_MM; // سطر Cairo + padding + margin + border
const COLUMN_GAP = 8; // .two-columns-mode column-gap

/** هامش أمان ضد اختلافات تقريب المتصفح وتوافر الخطوط (3%) */
const SAFETY = 0.97;

export const DEFAULT_LAYOUT = {
  fontSizePt: 12.3,
  lineHeight: 1.62,
  fontFamily: "'Amiri', serif",
} as const;

export function resolvePageMetrics(opts: LayoutOptions = {}): PageMetrics {
  const fontSizePt = clamp(opts.fontSizePt ?? DEFAULT_LAYOUT.fontSizePt, 8, 20);
  const lineHeight = clamp(opts.lineHeight ?? DEFAULT_LAYOUT.lineHeight, 1, 3);
  const frameW = A4_PAGE_W - PAGE_PADDING * 2 - OUTER_FRAME - INNER_BORDER - INNER_PAD_H;
  const frameH = A4_PAGE_H - PAGE_PADDING * 2 - OUTER_FRAME - INNER_BORDER - INNER_PAD_V;
  const twoColumns = opts.layoutMode === 'card';
  const usableH = frameH - PAGE_NUMBER_BLOCK - (opts.showStudentInfo ? STUDENT_INFO_BLOCK : 0);
  return {
    fontSizePt,
    lineHeight,
    fontFamily: opts.fontFamily || DEFAULT_LAYOUT.fontFamily,
    majorSectionBreak: opts.majorSectionBreak ?? 'always',
    columnWidthMm: twoColumns ? (frameW - COLUMN_GAP) / 2 : frameW,
    footerWidthMm: frameW,
    // في وضع العمودين تتضاعف السعة تقريباً مع فاقد بسيط لموازنة الأعمدة
    bodyCapacityMm: usableH * SAFETY * (twoColumns ? 1.9 : 1),
    columns: twoColumns ? 2 : 1,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
}

/** ارتفاع سطر واحد بالمليمتر لحجم خط وتباعد محددين */
export function lineMm(sizePt: number, lineHeight: number): number {
  return sizePt * lineHeight * PT_MM;
}

// ===== قياس الأسطر =====

export interface TextMeasurer {
  /** عدد الأسطر التي يشغلها النص عند عرض محدد (مع إزاحة السطر الأول text-indent) */
  countLines(text: string, widthMm: number, sizePt: number, opts?: { bold?: boolean; indentMm?: number }): number;
  /** أكبر عدد من الكلمات (من البداية) يتسع في عدد أسطر محدد */
  wordsFitting(words: string[], maxLines: number, widthMm: number, sizePt: number, opts?: { bold?: boolean; indentMm?: number }): number;
}

type WidthFn = (text: string, sizePt: number, bold: boolean) => number;

/** نص مرئي للقياس: إزالة الوسوم مع الإبقاء على أرقام الإحالات الصغيرة */
export function visibleText(html: string): string {
  return html
    .replace(/<sup>(\d+)<\/sup>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, 'x')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function createCanvasWidthFn(fontFamily: string): WidthFn | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const cache = new Map<string, number>();
    return (text, sizePt, bold) => {
      const key = `${bold ? 'b' : 'n'}|${sizePt}|${text}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      ctx.font = `${bold ? 700 : 400} ${sizePt}pt ${fontFamily}`;
      const mm = ctx.measureText(text).width * PX_MM;
      if (cache.size > 20000) cache.clear();
      cache.set(key, mm);
      return mm;
    };
  } catch {
    return null;
  }
}

/** تقدير احتياطي متحفظ (بيئات بلا Canvas): متوسط عرض الحرف العربي بخط نسخي ≈ 0.45em */
function heuristicWidthFn(): WidthFn {
  return (text, sizePt, bold) => text.length * sizePt * PT_MM * (bold ? 0.49 : 0.45);
}

export function createTextMeasurer(fontFamily: string = DEFAULT_LAYOUT.fontFamily): TextMeasurer {
  const width: WidthFn = createCanvasWidthFn(fontFamily) ?? heuristicWidthFn();

  /** محاكاة التفاف الأسطر كلمة بكلمة كما يفعل المتصفح (المحاذاة justify لا تغيّر نقاط الالتفاف) */
  const simulate = (words: string[], widthMm: number, sizePt: number, bold: boolean, indentMm: number, stopAtLines: number) => {
    const space = width(' ', sizePt, bold);
    let lines = 1;
    let cur = indentMm;
    let lineHasWord = false;
    for (let i = 0; i < words.length; i++) {
      const w = width(words[i], sizePt, bold);
      if (!lineHasWord) {
        cur += w;
        lineHasWord = true;
      } else if (cur + space + w <= widthMm) {
        cur += space + w;
      } else {
        lines++;
        if (lines > stopAtLines) return { lines, fitted: i };
        cur = w;
      }
      // كلمة أطول من السطر تلتف على عدة أسطر
      while (cur > widthMm && widthMm > 0) {
        lines++;
        if (lines > stopAtLines) return { lines, fitted: i };
        cur -= widthMm;
      }
    }
    return { lines, fitted: words.length };
  };

  return {
    countLines(text, widthMm, sizePt, opts = {}) {
      const words = visibleText(text).split(' ').filter(Boolean);
      if (words.length === 0) return 0;
      return simulate(words, widthMm, sizePt, Boolean(opts.bold), opts.indentMm ?? 0, Number.POSITIVE_INFINITY).lines;
    },
    wordsFitting(words, maxLines, widthMm, sizePt, opts = {}) {
      if (maxLines <= 0) return 0;
      const visible = words.map((w) => visibleText(w));
      return simulate(visible, widthMm, sizePt, Boolean(opts.bold), opts.indentMm ?? 0, maxLines).fitted;
    },
  };
}
