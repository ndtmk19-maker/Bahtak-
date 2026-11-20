// محرك التخطيط والتصميم: يحوّل الشرائح الدلالية + القالب (+ الصور اختيارياً) إلى عناصر موضعة بالبوصة.
// تستهلك هذه العناصر طبقتان: مُصدِّر PPTX والمعاينة داخل الموقع، فتتطابق الهندسة بينهما.
//
// أسلوب التصميم: تحريري تنفيذي. شرائح الواجهة (غلاف، فواصل، إشكالية، ختام) داكنة وغالباً بصورة كاملة النزف
// مع تدرّج لوني يحمي النص، وشرائح المتن فاتحة بشريط إبراز قصير وعنوان كبير وتذييل رفيع.
// لكل شريحة متن يختار المحرك تركيباً حسب طبيعة المحتوى: أرقام ← مؤشرات، مراحل ← خط زمني،
// عنصران ← مقارنة، ثلاثة ← أعمدة، أربعة ← مربعات، عبارة واحدة ← اقتباس، قائمة قصيرة + صورة ← نص وصورة،
// قائمة معنونة ← صفوف مرقمة، وإلا قائمة تحريرية. كل التخطيطات تُكتب باتجاه القراءة وتُعكس آلياً للعربية.
import { DENSITY_METRICS, LINE_SPACING, SLIDE_H, SLIDE_W, pointText, textHeight, type BodyMetrics } from "./metrics";
import { iconForText, type SlideIconName } from "./icons";
import { heroColors, themeFonts, type SlideTheme } from "./themes";
import type { DeckImages, DeckOptions, Point, Slide, SlideDeck, SlideImage } from "./types";
import { DEFAULT_DECK_OPTIONS } from "./planner";

export interface TRun {
  text: string;
  bold?: boolean;
  color?: string;
}
export interface TPara {
  runs: TRun[];
  size: number;
  color: string;
  align: "right" | "center" | "left";
  rtl: boolean;
  bold?: boolean;
  bullet?: boolean;
  spaceAfter?: number;
}
export type Prim =
  | {
      t: "image";
      x: number;
      y: number;
      w: number;
      h: number;
      src: string;
      /** contain (الافتراضي، للشعارات) أو cover (قص الصورة لملء الإطار، للصور الفوتوغرافية) */
      fit?: "contain" | "cover";
      alt?: string;
    }
  | {
      t: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
      alpha?: number;
      radius?: number;
      line?: string;
      lineW?: number;
    }
  | {
      t: "ellipse";
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
      alpha?: number;
      line?: string;
      lineW?: number;
    }
  | {
      t: "tri";
      x: number;
      y: number;
      w: number;
      h: number;
      fill: string;
      alpha?: number;
      flipH?: boolean;
      flipV?: boolean;
    }
  | {
      t: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      width: number;
      alpha?: number;
    }
  | {
      t: "text";
      x: number;
      y: number;
      w: number;
      h: number;
      paras: TPara[];
      font: string;
      valign: "top" | "middle" | "bottom";
      role: string;
    }
  | { t: "icon"; x: number; y: number; w: number; h: number; name: SlideIconName; color: string };

export interface LaidSlide {
  bg: string;
  prims: Prim[];
  notes?: string;
}

const W = SLIDE_W;
const H = SLIDE_H;
const M = 0.6;
const CW = W - 2 * M;
const FOOT_Y = 6.98;
const BOTTOM = 6.7;
const BULLET_INDENT = 0.32;
/** عرض لوحة الصورة الجانبية في شرائح المتن */
const PHOTO_W = 4.9;

// ---------- أدوات عامة ----------

const isLatinText = (t: string) => {
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  const arabic = (t.match(/[\u0600-\u06FF]/g) || []).length;
  return latin > arabic;
};
const isArabicText = (t: string) => {
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  const arabic = (t.match(/[\u0600-\u06FF]/g) || []).length;
  return arabic > latin;
};

const toLatinDigits = (t: string) =>
  t.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

function rgb(c: string): [number, number, number] {
  const h = c.replace("#", "");
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}
/** مزج لونين: t = وزن اللون الثاني */
function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return x
    .map((v, i) => Math.round(v + (y[i] - v) * t))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
const isDark = (c: string) => {
  const [r, g, b] = rgb(c);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
};

const paraText = (p: TPara) => p.runs.map((r) => r.text).join("");
const isBold = (p: TPara) => !!p.bold || p.runs.every((r) => r.bold);

export function parasHeight(paras: TPara[], w: number): number {
  return paras.reduce(
    (h, p) =>
      h +
      textHeight(paraText(p), w - (p.bullet ? BULLET_INDENT : 0), p.size, LINE_SPACING, isBold(p)) +
      (p.spaceAfter || 0) / 72,
    0,
  );
}

/** يبحث عن أكبر مقياس للخط (بين max و min) يجعل النص يتسع داخل الصندوق */
function fit(
  build: (s: number) => TPara[],
  w: number,
  h: number,
  min = 0.7,
  max = 1,
): { paras: TPara[]; h: number; k: number; ok: boolean } {
  for (let s = max; s >= min - 1e-9; s -= 0.05) {
    const ps = build(s);
    const ph = parasHeight(ps, w);
    if (ph <= h) return { paras: ps, h: ph, k: s, ok: true };
  }
  const ps = build(min);
  return { paras: ps, h: parasHeight(ps, w), k: min, ok: false };
}

const text = (
  x: number,
  y: number,
  w: number,
  h: number,
  paras: TPara[],
  font: string,
  role: string,
  valign: "top" | "middle" | "bottom" = "top",
): Prim => ({ t: "text", x, y, w, h, paras, font, role, valign });

// ---------- سياق الشريحة ----------

interface Ctx {
  th: SlideTheme;
  c: SlideTheme["colors"];
  hero: { bg: string; text: string; accent: string };
  f: { head: string; body: string };
  rtl: boolean;
  n: number;
  total: number;
  deckTitle: string;
  m: BodyMetrics;
  img?: SlideImage;
  /** لون العناوين على الخلفية الفاتحة */
  titleColor: string;
  /** لون النص الثانوي فوق الخلفية الداكنة */
  heroMuted: string;
}

/** عكس الإحداثي الأفقي للعربية: كل التخطيطات تُكتب من بداية القراءة */
const X = (ctx: Ctx, x: number, w: number) => (ctx.rtl ? W - x - w : x);
const startAlign = (ctx: Ctx): "left" | "right" => (ctx.rtl ? "right" : "left");
const endAlign = (ctx: Ctx): "left" | "right" => (ctx.rtl ? "left" : "right");

/** فقرة باتجاه مناسب: في العرض العربي يُكتب النص اللاتيني من اليسار، وفي اللاتيني يُكتب العربي من اليمين */
function P(ctx: Ctx, t: string, size: number, color: string, o: Partial<TPara> = {}): TPara {
  const ltr = ctx.rtl ? isLatinText(t) : !isArabicText(t);
  return {
    runs: [{ text: t, bold: o.bold }],
    size,
    color,
    align: o.align || (ltr ? "left" : "right"),
    rtl: o.rtl ?? !ltr,
    ...o,
  };
}

/** فقرة متعددة المقاطع (عنوان عريض + شرح) */
function PR(ctx: Ctx, runs: TRun[], size: number, color: string, o: Partial<TPara> = {}): TPara {
  const all = runs.map((r) => r.text).join("");
  const ltr = ctx.rtl ? isLatinText(all) : !isArabicText(all);
  return { runs, size, color, align: o.align || (ltr ? "left" : "right"), rtl: o.rtl ?? !ltr, ...o };
}

const num2 = (i: number) => String(i).padStart(2, "0");

// ---------- عناصر بصرية مشتركة ----------

/** صورة فوتوغرافية تملأ الإطار + سطر الإسناد */
function photo(ctx: Ctx, x: number, y: number, w: number, h: number, credit = true): Prim[] {
  if (!ctx.img) return [];
  const px = X(ctx, x, w);
  const out: Prim[] = [{ t: "image", x: px, y, w, h, src: ctx.img.src, fit: "cover", alt: ctx.img.alt || "" }];
  if (credit && ctx.img.credit) {
    const cw = Math.min(w - 0.3, 0.6 + ctx.img.credit.length * 0.055);
    // الصورة كاملة النزف: الإسناد في زاوية البداية (بعيداً عن رقم الشريحة)، وإلا في زاوية النهاية
    const full = w >= W - 0.01;
    const atStart = full ? !ctx.rtl : ctx.rtl;
    const cx = atStart ? px + (full ? 0.8 : 0.15) : px + w - cw - 0.15;
    out.push({ t: "rect", x: cx, y: y + h - 0.36, w: cw, h: 0.22, fill: "000000", alpha: 0.38, radius: 0.04 });
    out.push(
      text(cx, y + h - 0.36, cw, 0.22, [{ runs: [{ text: ctx.img.credit }], size: 7, color: "FFFFFF", align: "center", rtl: false }], ctx.f.body, "credit", "middle"),
    );
  }
  return out;
}

/** تدرّج لوني أفقي (من بداية القراءة a0 إلى نهايتها a1) مبني من طبقات متراكبة بلا فواصل */
function scrim(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, a0: number, a1: number, steps = 32): Prim[] {
  const out: Prim[] = [];
  if (a1 > 0) out.push({ t: "rect", x: X(ctx, x, w), y, w, h, fill: color, alpha: a1 });
  if (a0 <= a1) return out;
  const q = 1 - Math.pow((1 - a0) / (1 - a1), 1 / steps);
  for (let i = 0; i < steps; i++) {
    const ww = w * (1 - i / steps) * 0.92;
    out.push({ t: "rect", x: X(ctx, x, ww), y, w: ww, h, fill: color, alpha: q });
  }
  return out;
}

/** حلقات زخرفية متحدة المركز (بديل الصورة في شرائح الواجهة) */
function rings(ctx: Ctx, cx: number, cy: number, r: number, color: string, accent: string, iconName?: SlideIconName): Prim[] {
  const out: Prim[] = [];
  const x = ctx.rtl ? W - cx : cx;
  [1, 0.74, 0.5].forEach((k, i) => {
    const d = 2 * r * k;
    out.push({ t: "ellipse", x: x - d / 2, y: cy - d / 2, w: d, h: d, line: i === 1 ? accent : color, lineW: i === 1 ? 1.5 : 0.75, alpha: i === 1 ? 0.9 : 0.35 });
  });
  const d = r * 0.62;
  out.push({ t: "ellipse", x: x - d / 2, y: cy - d / 2, w: d, h: d, fill: accent });
  if (iconName) out.push({ t: "icon", x: x - d * 0.28, y: cy - d * 0.28, w: d * 0.56, h: d * 0.56, name: iconName, color: ctx.hero.bg });
  return out;
}

const pickIcon = (ctx: Ctx, t: string, i: number): SlideIconName => iconForText(t) || ctx.th.icons[((i % 4) + 4) % 4];

// ---------- الزخارف الخاصة بكل قالب (هوية القالب على لوحة خطة العرض والغلاف دون صورة) ----------

function motif(th: SlideTheme, r: { x: number; y: number; w: number; h: number }, color: string, accent: string): Prim[] {
  const out: Prim[] = [];
  const { x, y, w, h } = r;
  switch (th.motif) {
    case "bars": {
      const bw = w / 6;
      [0.28, 0.45, 0.66, 0.92].forEach((k, i) => {
        const bh = h * 0.42 * k;
        out.push({ t: "rect", x: x + w * 0.08 + i * bw * 1.35, y: y + h - bh, w: bw, h: bh, fill: i === 3 ? accent : color, alpha: i === 3 ? 0.85 : 0.2 + i * 0.12 });
      });
      out.push({ t: "line", x1: x, y1: y + h, x2: x + w, y2: y + h, color, width: 1.25, alpha: 0.5 });
      break;
    }
    case "grid": {
      const step = 0.3;
      const cols = Math.max(2, Math.floor(w / step));
      const rows = Math.min(8, Math.floor(h / step));
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++)
          out.push({ t: "ellipse", x: x + i * step, y: y + j * step, w: 0.05, h: 0.05, fill: (i + j) % 5 === 0 ? accent : color, alpha: (i + j) % 5 === 0 ? 0.9 : 0.3 });
      break;
    }
    case "pulse": {
      const my = y + h * 0.5;
      const pts: [number, number][] = [[0, 0], [0.3, 0], [0.4, -0.3], [0.52, 0.4], [0.62, -0.12], [0.7, 0], [1, 0]];
      for (let i = 0; i < pts.length - 1; i++)
        out.push({ t: "line", x1: x + pts[i][0] * w, y1: my + pts[i][1], x2: x + pts[i + 1][0] * w, y2: my + pts[i + 1][1], color: accent, width: 2 });
      break;
    }
    case "ledger": {
      for (let yy = y + 0.1; yy < y + h; yy += 0.3) out.push({ t: "line", x1: x, y1: yy, x2: x + w, y2: yy, color, width: 0.75, alpha: 0.3 });
      out.push({ t: "line", x1: x + w - 0.12, y1: y, x2: x + w - 0.12, y2: y + h, color: accent, width: 1, alpha: 0.8 });
      out.push({ t: "line", x1: x + w - 0.04, y1: y, x2: x + w - 0.04, y2: y + h, color: accent, width: 1, alpha: 0.8 });
      break;
    }
    case "diagonal": {
      out.push({ t: "tri", x, y, w, h, fill: color, alpha: 0.18, flipV: true });
      out.push({ t: "tri", x: x + w * 0.35, y: y + h * 0.35, w: w * 0.65, h: h * 0.65, fill: accent, alpha: 0.85 });
      break;
    }
    case "blocks": {
      const s = Math.min(0.36, w / 3.4);
      [[0, 2, accent, 0.95], [1, 2, color, 0.6], [0, 1, color, 0.3], [2, 2, color, 0.18]].forEach(([cx, cy, c, a]) =>
        out.push({ t: "rect", x: x + (cx as number) * (s + 0.06), y: y + h - (3 - (cy as number)) * (s + 0.06), w: s, h: s, fill: c as string, alpha: a as number }),
      );
      break;
    }
    case "columns": {
      const ch = h * 0.8;
      const by = y + h - ch;
      out.push({ t: "rect", x, y: by - 0.1, w, h: 0.07, fill: accent, alpha: 0.9 });
      [0.1, 0.43, 0.76].forEach((k) => out.push({ t: "rect", x: x + w * k, y: by, w: w * 0.14, h: ch - 0.1, fill: color, alpha: 0.25 }));
      out.push({ t: "rect", x, y: y + h - 0.07, w, h: 0.07, fill: accent, alpha: 0.9 });
      break;
    }
    case "arcs": {
      const d0 = Math.min(w, h);
      [1, 0.7, 0.4].forEach((k, i) => {
        const d = d0 * k;
        out.push({ t: "ellipse", x: x + (w - d) / 2, y: y + (h - d) / 2, w: d, h: d, line: i === 1 ? accent : color, lineW: 1.25, alpha: 0.7 });
      });
      break;
    }
    default: {
      out.push({ t: "rect", x, y: y + h - 0.06, w: w * 0.45, h: 0.06, fill: accent });
      out.push({ t: "rect", x, y: y + h - 0.22, w, h: 0.012, fill: color, alpha: 0.4 });
    }
  }
  return out;
}

// ---------- الإطار المشترك لشرائح المتن ----------

interface Chrome {
  prims: Prim[];
  top: number;
}

/** شريط الإبراز + البادئة + العنوان + التذييل (اسم العرض ورقم الشريحة). x0/w: عمود النص بإحداثيات القراءة */
function chrome(ctx: Ctx, kicker: string, title: string, x0 = M, w = CW): Chrome {
  const c = ctx.c;
  const prims: Prim[] = [];
  prims.push({ t: "rect", x: X(ctx, x0, 0.5), y: 0.57, w: 0.5, h: 0.06, fill: c.accent });
  if (kicker)
    prims.push(
      text(X(ctx, x0 + 0.65, w - 0.65), 0.4, w - 0.65, 0.4, [P(ctx, kicker, 12, c.accent, { bold: true, align: startAlign(ctx), rtl: ctx.rtl })], ctx.f.body, "kicker", "middle"),
    );
  const t = fit((s) => [P(ctx, title, Math.round(28 * s), ctx.titleColor, { bold: true, align: startAlign(ctx), rtl: ctx.rtl })], w, 1.08, 0.68);
  const th1 = Math.max(0.55, t.h);
  prims.push(text(X(ctx, x0, w), 0.86, w, th1, t.paras, ctx.f.head, "title", "top"));
  prims.push({ t: "rect", x: X(ctx, x0, w), y: FOOT_Y, w, h: 0.012, fill: c.line });
  const footW = Math.max(1, w - 1.8);
  if (ctx.deckTitle)
    prims.push(
      text(X(ctx, x0, footW), 7.04, footW, 0.28, [P(ctx, ctx.deckTitle, 9, c.muted, { align: startAlign(ctx), rtl: ctx.rtl })], ctx.f.body, "footer", "middle"),
    );
  prims.push(
    text(X(ctx, x0 + w - 1.6, 1.6), 7.04, 1.6, 0.28, [{ runs: [{ text: `${num2(ctx.n)} / ${ctx.total}` }], size: 9, color: c.muted, align: endAlign(ctx), rtl: false }], ctx.f.body, "number", "middle"),
  );
  return { prims, top: Math.max(1.85, 0.86 + th1 + 0.42) };
}

/** فقرات القائمة التحريرية (نفس منطق النسخة السابقة مع ألوان القالب الجديد) */
function pointParas(ctx: Ctx, points: Point[], fontPt: number, subPt: number, gapPt: number, s: number, numberFrom?: number): TPara[] {
  const c = ctx.c;
  let num = numberFrom ?? 0;
  return points.map((p) => {
    const size = Math.round((p.kind === "sub" ? subPt : fontPt) * s);
    const isLat = p.ltr !== undefined ? p.ltr : isLatinText(p.text || p.label || "");
    const ltr = ctx.rtl ? isLat : !isArabicText(p.text || p.label || "");
    const align = ltr ? "left" : "right";
    if (p.kind === "sub") return P(ctx, p.text, size, ctx.titleColor, { bold: true, spaceAfter: gapPt * 0.6, align, rtl: !ltr });
    if (p.kind === "lead") return P(ctx, p.text, size, c.text, { spaceAfter: gapPt * 0.8, align, rtl: !ltr });
    const runs: TRun[] = [];
    if (numberFrom !== undefined) runs.push({ text: `${++num}. `, bold: true, color: c.accent });
    if (p.label) runs.push({ text: `${p.label}: `, bold: true, color: ctx.titleColor });
    runs.push({ text: p.text });
    return { runs, size, color: c.text, align, rtl: !ltr, bullet: numberFrom === undefined, spaceAfter: gapPt };
  });
}

// ---------- تحليل المحتوى لاختيار التركيب ----------

interface Stat {
  value: string;
  pct?: number;
}

const NUM_RE =
  /([+\-−]?\d+(?:[.,]\d+)?)\s?(%|٪|‰|مليارات|مليار|ملايين|مليون|آلاف|ألف|billions?|millions?|milliards?|bn|mds?|m²|km²|km|دج|DA|DZD|USD|EUR|\$|€)?/i;

function extractStat(p: Point): Stat | null {
  const t = toLatinDigits(pointText(p)).replace(/(\d)[\s\u066C](?=\d{3}\b)/g, "$1");
  const re = new RegExp(NUM_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const raw = m[1];
    const unit = m[2] || "";
    const n = parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(n)) continue;
    const before = t.slice(Math.max(0, m.index - 3), m.index);
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 2);
    // أرقام القوانين والمراسيم والمواد (18-05، 15/04، رقم 12، n° 3) ليست مؤشرات
    if (/^\s?[-/]\s?\d/.test(after) || /\d\s?[-/]\s?$/.test(before) || (/^[-−/]/.test(m[0]) && /\d\s?$/.test(before)) || /(?:رقم|n°|no\.?|art\.?|المادة)\s*$/i.test(t.slice(0, m.index))) continue;
    const isYear = !unit && /^(1[89]|20)\d\d$/.test(raw);
    if (isYear || (!unit && raw.length < 2)) continue;
    const value = `${raw}${unit && !/^[%٪‰$€]$/.test(unit) ? " " : ""}${unit}`.trim();
    if (value.length > 14) continue;
    return { value, pct: /%|٪/.test(unit) && n >= 0 && n <= 100 ? n : undefined };
  }
  return null;
}

const PROCESS_RE =
  /مراحل|خطوات|المرحلة|الخطوة|إجراءات|كيفية|سيرورة|آليات تطبيق|étapes|phases|processus|procédure|démarche|steps|stages|process|procedure|roadmap/i;
const ORDER_LABEL_RE = /^(?:ال)?(?:مرحلة|خطوة)|^(?:أولا|ثانيا|ثالثا|رابعا|خامسا)|^(?:étape|phase|step|stage)\b/i;

type Variant = "quote" | "kpi" | "timeline" | "compare" | "pillars" | "tiles" | "split" | "rows" | "plain";

interface Shape {
  lead: Point | null;
  items: Point[];
  hasSub: boolean;
}

function shapeOf(points: Point[]): Shape {
  const lead = points[0]?.kind === "lead" ? points[0] : null;
  const items = points.filter((p) => p.kind === "bullet");
  return { lead, items, hasSub: points.some((p) => p.kind === "sub") };
}

function pickVariant(s: Extract<Slide, { kind: "content" }>, ctx: Ctx): Variant {
  const sh = shapeOf(s.points);
  const n = sh.items.length;
  const clean = !sh.hasSub && s.points.length === n + (sh.lead ? 1 : 0);
  if (s.layout === "statement") return "quote";
  if (clean && n >= 2 && n <= 4) {
    const stats = sh.items.map(extractStat).filter(Boolean).length;
    if (stats >= Math.max(2, n - 1) && sh.items.every((p) => pointText(p).length <= 170)) return "kpi";
  }
  if (clean && n >= 3 && n <= 5 && sh.items.every((p) => pointText(p).length <= 150)) {
    const ordered = sh.items.filter((p) => ORDER_LABEL_RE.test(p.label || p.text)).length >= 2;
    if (ordered || PROCESS_RE.test(`${s.title} ${sh.lead?.text || ""}`)) return "timeline";
  }
  if (ctx.img && !sh.hasSub && (s.layout === "cards" ? n <= 4 : true)) return "split";
  if (s.layout === "cards") return n === 2 ? "compare" : n === 3 ? "pillars" : "tiles";
  if (clean && n >= 2 && n <= 6 && !sh.items.some((p) => p.prose) && sh.items.every((p) => pointText(p).length <= 260)) return "rows";
  return "plain";
}

// ---------- تراكيب متن الشريحة ----------

interface Area {
  x: number;
  w: number;
  top: number;
  bottom: number;
}

/** الجملة التمهيدية فوق التركيب: نص بحجم أكبر قليلاً مع خط إبراز جانبي */
function leadBlock(ctx: Ctx, lead: Point | null, a: Area, maxH = 1.15): { prims: Prim[]; h: number } {
  if (!lead) return { prims: [], h: 0 };
  const w = a.w - 0.3;
  const l = fit((k) => [P(ctx, lead.text, Math.round((ctx.m.fontPt - 1) * k), ctx.c.text)], w, maxH, 0.75);
  return {
    prims: [
      { t: "rect", x: X(ctx, a.x, 0.05), y: a.top + 0.04, w: 0.05, h: Math.max(0.3, l.h - 0.04), fill: ctx.c.accent },
      text(X(ctx, a.x + 0.3, w), a.top, w, l.h, l.paras, ctx.f.body, "lead"),
    ],
    h: l.h + 0.32,
  };
}

/** أعمدة متساوية: رقم كبير + خط + عنوان + شرح (للبطاقات الثلاث) */
function pillarsBody(ctx: Ctx, sh: Shape, a: Area): Prim[] {
  const c = ctx.c;
  const lb = leadBlock(ctx, sh.lead, a);
  const prims = [...lb.prims];
  const top = a.top + lb.h;
  const n = sh.items.length;
  const gap = 0.45;
  const cw = (a.w - gap * (n - 1)) / n;
  const avail = a.bottom - top;
  let best: { k: number; cols: { lab: TPara[]; desc: TPara[]; lh: number; dh: number }[]; need: number } | null = null;
  for (let k = 1.4; k >= 0.7 - 1e-9; k -= 0.05) {
    const cols = sh.items.map((p) => {
      const lab = p.label ? [P(ctx, p.label, Math.round(ctx.m.fontPt * 0.92 * k), ctx.titleColor, { bold: true })] : [];
      const desc = [P(ctx, p.text, Math.round(ctx.m.fontPt * 0.78 * k), c.text)];
      return { lab, desc, lh: lab.length ? parasHeight(lab, cw) : 0, dh: parasHeight(desc, cw) };
    });
    const need = 0.95 + Math.max(...cols.map((x) => (x.lh ? x.lh + 0.12 : 0) + x.dh));
    best = { k, cols, need };
    // لا نكبّر الخط إلى حد يملأ العمود كله: نترك هواءً كافياً
    if (need <= avail * 0.8 || (k <= 1 && need <= avail)) break;
  }
  if (!best) return prims;
  const y0 = top + Math.max(0, (avail - best.need) * 0.42);
  best.cols.forEach((col, i) => {
    const x = a.x + i * (cw + gap);
    prims.push(text(X(ctx, x, cw), y0, cw, 0.62, [{ runs: [{ text: num2(i + 1) }], size: 30, color: c.accent, align: startAlign(ctx), rtl: false }], ctx.f.head, "numeral", "bottom"));
    prims.push({ t: "rect", x: X(ctx, x, cw), y: y0 + 0.74, w: cw, h: 0.014, fill: ctx.titleColor });
    let y = y0 + 0.92;
    if (col.lh) {
      prims.push(text(X(ctx, x, cw), y, cw, col.lh, col.lab, ctx.f.head, "card-label"));
      y += col.lh + 0.12;
    }
    prims.push(text(X(ctx, x, cw), y, cw, Math.min(col.dh, a.bottom - y), col.desc, ctx.f.body, "card-text"));
  });
  return prims;
}

/** مربعات بيضاء بشريط إبراز جانبي (للبطاقات الأربع، أو صف واحد إن كانت قصيرة) */
function tilesBody(ctx: Ctx, sh: Shape, a: Area): Prim[] {
  const c = ctx.c;
  const lb = leadBlock(ctx, sh.lead, a);
  const prims = [...lb.prims];
  const top = a.top + lb.h;
  const n = sh.items.length;
  const short = sh.items.every((p) => pointText(p).length <= 70);
  const cols = n <= 3 || short ? n : 2;
  const rows = Math.ceil(n / cols);
  const gap = 0.28;
  const tw = (a.w - gap * (cols - 1)) / cols;
  const avail = a.bottom - top;
  const th = Math.min(2.45, (avail - gap * (rows - 1)) / rows);
  const pad = 0.3;
  const iw = tw - pad - 0.42;
  let k = 1.35;
  let built: { lab: TPara[]; desc: TPara[]; lh: number; dh: number }[] = [];
  for (; k >= 0.68 - 1e-9; k -= 0.05) {
    built = sh.items.map((p, i) => {
      const lab = [P(ctx, p.label || num2(i + 1), Math.round(ctx.m.fontPt * 0.86 * k), ctx.titleColor, { bold: true })];
      const desc = [P(ctx, p.text, Math.round(ctx.m.fontPt * 0.74 * k), c.text)];
      return { lab, desc, lh: parasHeight(lab, iw), dh: parasHeight(desc, iw) };
    });
    if (Math.max(...built.map((b) => b.lh + 0.12 + b.dh)) <= th - 2 * pad - 0.05) break;
  }
  const y0 = top + Math.max(0, (avail - (th * rows + gap * (rows - 1))) * 0.4);
  built.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = a.x + col * (tw + gap);
    const y = y0 + row * (th + gap);
    const hi = i === 0 && n === 4 && !short;
    prims.push({ t: "rect", x: X(ctx, x, tw), y, w: tw, h: th, fill: hi ? ctx.hero.bg : c.surface, line: hi ? ctx.hero.bg : c.line, lineW: 0.75 });
    prims.push({ t: "rect", x: X(ctx, x, 0.07), y, w: 0.07, h: th, fill: c.accent });
    prims.push({ t: "icon", x: X(ctx, x + tw - 0.62, 0.36), y: y + 0.26, w: 0.36, h: 0.36, name: pickIcon(ctx, pointText(sh.items[i]), i), color: hi ? ctx.hero.accent : c.accent });
    const ix = x + pad;
    const lab = hi ? b.lab.map((p) => ({ ...p, color: ctx.hero.accent })) : b.lab;
    const desc = hi ? b.desc.map((p) => ({ ...p, color: ctx.hero.text })) : b.desc;
    prims.push(text(X(ctx, ix, iw), y + pad, iw, b.lh, lab, ctx.f.head, "card-label"));
    prims.push(text(X(ctx, ix, iw), y + pad + b.lh + 0.12, iw, Math.min(b.dh, th - 2 * pad - b.lh - 0.12 + 0.2), desc, ctx.f.body, "card-text"));
  });
  return prims;
}

/** مقارنة بين عنصرين: لوحة داكنة مقابل لوحة فاتحة */
function compareBody(ctx: Ctx, sh: Shape, a: Area): Prim[] {
  const c = ctx.c;
  const lb = leadBlock(ctx, sh.lead, a);
  const prims = [...lb.prims];
  const top = a.top + lb.h;
  const gap = 0.35;
  const pw = (a.w - gap) / 2;
  const maxPh = a.bottom - top;
  const pad = 0.42;
  const iw = pw - 2 * pad;
  const ph = maxPh;
  const panels = sh.items.slice(0, 2).map((p, i) => {
    const dark = i === 0;
    const r = fit(
      (k) => [
        ...(p.label ? [P(ctx, p.label, Math.round(22 * k), dark ? ctx.hero.accent : ctx.titleColor, { bold: true, spaceAfter: 10 })] : []),
        P(ctx, p.text, Math.round(ctx.m.fontPt * 0.86 * k), dark ? ctx.hero.text : c.text),
      ],
      iw,
      ph - 2 * pad - 0.75,
      0.65,
      1.45,
    );
    return { r, dark };
  });
  const realH = Math.min(maxPh, Math.max(2.8, Math.max(...panels.map((p) => p.r.h)) + 2 * pad + 0.95));
  const ty = top + (maxPh - realH) * 0.42;
  panels.forEach(({ r, dark }, i) => {
    const x = a.x + i * (pw + gap);
    const top = ty;
    const ph = realH;
    prims.push({ t: "rect", x: X(ctx, x, pw), y: top, w: pw, h: ph, fill: dark ? ctx.hero.bg : c.surface, line: dark ? ctx.hero.bg : c.line, lineW: 0.75 });
    prims.push(text(X(ctx, x + pad, iw), top + pad - 0.05, iw, 0.6, [{ runs: [{ text: num2(i + 1) }], size: 26, color: c.accent, align: startAlign(ctx), rtl: false }], ctx.f.head, "numeral", "middle"));
    prims.push({ t: "rect", x: X(ctx, x + pad, 0.9), y: top + pad + 0.62, w: 0.9, h: 0.04, fill: c.accent });
    prims.push(text(X(ctx, x + pad, iw), top + pad + 0.85, iw, r.h, r.paras, ctx.f.body, "card-text"));
  });
  return prims;
}

/** مؤشرات رقمية: رقم كبير + عنوان + شرح، مع شريط نسبة عند وجود نسب مئوية */
function kpiBody(ctx: Ctx, sh: Shape, a: Area): Prim[] {
  const c = ctx.c;
  const lb = leadBlock(ctx, sh.lead, a);
  const prims = [...lb.prims];
  const top = a.top + lb.h;
  const n = sh.items.length;
  const gap = 0.3;
  const tw = (a.w - gap * (n - 1)) / n;
  const avail = a.bottom - top;
  const th = Math.min(3.4, avail);
  const pad = 0.32;
  const iw = tw - 2 * pad;
  const stats = sh.items.map(extractStat);
  const y0 = top + Math.max(0, (avail - th) * 0.4);
  sh.items.forEach((p, i) => {
    const x = a.x + i * (tw + gap);
    const st = stats[i];
    const hi = i === n - 1;
    const fg = hi ? ctx.hero.text : c.text;
    prims.push({ t: "rect", x: X(ctx, x, tw), y: y0, w: tw, h: th, fill: hi ? ctx.hero.bg : c.surface, line: hi ? ctx.hero.bg : c.line, lineW: 0.75 });
    prims.push({ t: "rect", x: X(ctx, x, 0.07), y: y0, w: 0.07, h: th, fill: c.accent });
    const value = st?.value || num2(i + 1);
    const v = fit((k) => [{ runs: [{ text: value }], size: Math.round((value.length > 7 ? 30 : 38) * k), color: hi ? ctx.hero.accent : ctx.titleColor, align: startAlign(ctx), rtl: false }], iw, 0.85, 0.6);
    prims.push(text(X(ctx, x + pad, iw), y0 + 0.3, iw, 0.85, v.paras, ctx.f.head, "kpi-value", "middle"));
    let y = y0 + 1.22;
    if (st?.pct !== undefined) {
      prims.push({ t: "rect", x: X(ctx, x + pad, iw), y, w: iw, h: 0.09, fill: hi ? mix(ctx.hero.bg, ctx.hero.text, 0.25) : c.line });
      prims.push({ t: "rect", x: X(ctx, x + pad, Math.max(0.05, (iw * st.pct) / 100)), y, w: Math.max(0.05, (iw * st.pct) / 100), h: 0.09, fill: c.accent });
      y += 0.28;
    }
    const body = fit(
      (k) => [
        ...(p.label ? [P(ctx, p.label, Math.round(ctx.m.fontPt * 0.8 * k), fg, { bold: true, spaceAfter: 4 })] : []),
        P(ctx, p.text, Math.round(ctx.m.fontPt * 0.68 * k), hi ? ctx.heroMuted : c.muted),
      ],
      iw,
      y0 + th - pad - y,
      0.65,
      1.05,
    );
    prims.push(text(X(ctx, x + pad, iw), y, iw, Math.min(body.h, y0 + th - pad - y + 0.15), body.paras, ctx.f.body, "kpi-text"));
  });
  return prims;
}

/** خط زمني أفقي للمراحل والخطوات */
function timelineBody(ctx: Ctx, sh: Shape, a: Area): Prim[] {
  const c = ctx.c;
  const lb = leadBlock(ctx, sh.lead, a);
  const prims = [...lb.prims];
  const top0 = a.top + lb.h + 0.1;
  const n = sh.items.length;
  const sw = a.w / n;
  const d = 0.86;
  const iw = sw - 0.3;
  const avail = a.bottom - (top0 + d + 0.3);
  let k = 1.4;
  let cols: { paras: TPara[]; h: number }[] = [];
  for (; k >= 0.66 - 1e-9; k -= 0.05) {
    cols = sh.items.map((p) => {
      const paras = [
        ...(p.label ? [P(ctx, p.label, Math.round(ctx.m.fontPt * 0.84 * k), ctx.titleColor, { bold: true, spaceAfter: 6 })] : []),
        P(ctx, p.text, Math.round(ctx.m.fontPt * 0.7 * k), c.text),
      ];
      return { paras, h: parasHeight(paras, iw) };
    });
    const need = Math.max(...cols.map((x) => x.h));
    if (need <= avail * 0.7 || (k <= 1 && need <= avail)) break;
  }
  const need = Math.max(...cols.map((x) => x.h)) + d + 0.3;
  const top = top0 + Math.max(0, (a.bottom - top0 - need) * 0.4);
  const ly = top + d / 2;
  prims.push({ t: "rect", x: X(ctx, a.x + sw / 2, sw * (n - 1)), y: ly - 0.012, w: sw * (n - 1), h: 0.024, fill: c.accent });
  sh.items.forEach((_, i) => {
    const cx = a.x + sw * i + sw / 2;
    prims.push({ t: "ellipse", x: X(ctx, cx - d / 2, d), y: top, w: d, h: d, fill: ctx.hero.bg, line: c.accent, lineW: 1.75 });
    prims.push(text(X(ctx, cx - d / 2, d), top, d, d, [{ runs: [{ text: String(i + 1) }], size: 20, color: ctx.hero.accent, align: "center", rtl: false, bold: true }], ctx.f.head, "badge", "middle"));
    const x = a.x + sw * i + 0.15;
    prims.push(text(X(ctx, x, iw), top + d + 0.3, iw, Math.min(cols[i].h, avail + 0.1), cols[i].paras.map((p) => ({ ...p, align: "center" as const })), ctx.f.body, "step-text"));
  });
  return prims;
}

/** صفوف مرقمة بخطوط رفيعة (قائمة معنونة قصيرة) */
function rowsBody(ctx: Ctx, sh: Shape, a: Area): Prim[] | null {
  const c = ctx.c;
  const lb = leadBlock(ctx, sh.lead, a);
  const top = a.top + lb.h;
  const avail = a.bottom - top;
  const tw = a.w - 0.9;
  for (let k = 1.1; k >= 0.72 - 1e-9; k -= 0.05) {
    const rows = sh.items.map((p) => {
      const runs: TRun[] = p.label ? [{ text: `${p.label}: `, bold: true, color: ctx.titleColor }, { text: p.text }] : [{ text: p.text }];
      const paras = [PR(ctx, runs, Math.round(ctx.m.fontPt * k), c.text)];
      return { paras, h: Math.max(0.5, parasHeight(paras, tw)) };
    });
    const gap = 0.22;
    const total = rows.reduce((s, r) => s + r.h + gap * 2, 0);
    if (total > avail) continue;
    const extra = Math.min(0.18, (avail - total) / Math.max(1, rows.length * 2));
    const prims = [...lb.prims];
    let y = top + 0.05;
    rows.forEach((r, i) => {
      prims.push(text(X(ctx, a.x, 0.8), y - 0.04, 0.8, 0.5, [{ runs: [{ text: num2(i + 1) }], size: Math.round(20 * Math.min(1, k)), color: c.accent, align: startAlign(ctx), rtl: false }], ctx.f.head, "numeral", "top"));
      prims.push(text(X(ctx, a.x + 0.9, tw), y, tw, r.h, r.paras, ctx.f.body, "row-text"));
      y += r.h + gap + extra;
      if (i < rows.length - 1) prims.push({ t: "rect", x: X(ctx, a.x, a.w), y, w: a.w, h: 0.01, fill: c.line });
      y += gap + extra;
    });
    return prims;
  }
  return null;
}

/** القائمة التحريرية العامة (عناوين فرعية + نقاط) */
function plainBody(ctx: Ctx, points: Point[], a: Area): Prim[] {
  const m = ctx.m;
  const body = fit((k) => pointParas(ctx, points, m.fontPt, m.subPt, m.gapPt, k), a.w, a.bottom - a.top, 0.7, 1.2);
  return [text(X(ctx, a.x, a.w), a.top, a.w, Math.min(a.bottom - a.top, body.h + 0.05), body.paras, ctx.f.body, "body")];
}

function contentSlide(s: Extract<Slide, { kind: "content" }>, ctx: Ctx): LaidSlide {
  const c = ctx.c;
  const kicker = s.parts > 1 ? `${s.kicker} · ${s.part}/${s.parts}` : s.kicker;
  let variant = pickVariant(s, ctx);
  const sh = shapeOf(s.points);

  // شرائح بصورة جانبية: العمود النصي يضيق والصورة تملأ الجانب الآخر من الشريحة كاملاً
  const withPhoto = !!ctx.img && (variant === "split" || variant === "quote");
  const colW = withPhoto ? W - PHOTO_W - M - 0.6 : CW;
  const ch = chrome(ctx, kicker, s.title, M, colW);
  const prims: Prim[] = withPhoto ? [...photo(ctx, W - PHOTO_W, 0, PHOTO_W, H), ...ch.prims] : [...ch.prims];
  const a: Area = { x: M, w: colW, top: ch.top, bottom: BOTTOM };

  if (variant === "quote") {
    const p = s.points[0];
    const len = pointText(p).length;
    const base = len <= 140 ? 30 : len <= 220 ? 26 : 22;
    // دون صورة تُحجز مساحة الحلقات الزخرفية في الجانب الآخر
    const tw = withPhoto ? colW - 0.9 : colW - 4.2;
    const st = fit(
      (k) => [PR(ctx, p.label ? [{ text: `${p.label}: `, bold: true, color: c.accent }, { text: p.text }] : [{ text: p.text }], Math.round(base * k), ctx.titleColor)],
      tw,
      a.bottom - a.top - 0.5,
      0.6,
    );
    const ty = a.top + (a.bottom - a.top - st.h) / 2;
    prims.push(text(X(ctx, M - 0.05, 1.0), ty - 1.12, 1.0, 1.0, [{ runs: [{ text: ctx.rtl ? "«" : "“" }], size: 96, color: mix(c.accent, c.bg, 0.45), align: startAlign(ctx), rtl: false }], ctx.f.head, "quote-mark"));
    prims.push({ t: "rect", x: X(ctx, M, 0.08), y: ty, w: 0.08, h: st.h, fill: c.accent });
    prims.push(text(X(ctx, M + 0.5, tw), ty, tw, st.h, st.paras, ctx.f.head, "statement"));
    if (!withPhoto)
      prims.push(...rings({ ...ctx }, W - 2.2, a.top + (a.bottom - a.top) / 2, 1.25, c.line, c.accent, pickIcon(ctx, `${s.title} ${p.text}`, s.sectionNumber)).map((pr) => (pr.t === "icon" ? { ...pr, color: ctx.hero.bg } : pr)));
    return { bg: c.bg, prims, notes: s.notes };
  }

  let body: Prim[] | null = null;
  if (variant === "kpi") body = kpiBody(ctx, sh, a);
  else if (variant === "timeline") body = timelineBody(ctx, sh, a);
  else if (variant === "compare") body = compareBody(ctx, sh, a);
  else if (variant === "pillars") body = pillarsBody(ctx, sh, a);
  else if (variant === "tiles") body = tilesBody(ctx, sh, a);
  else if (variant === "split" || variant === "rows") {
    const clean = !sh.hasSub && s.points.length === sh.items.length + (sh.lead ? 1 : 0) && !sh.items.some((p) => p.prose);
    body = clean ? rowsBody(ctx, sh, a) : null;
  }
  if (!body) {
    variant = "plain";
    body = plainBody(ctx, s.points, a);
  }
  return { bg: c.bg, prims: [...prims, ...body], notes: s.notes };
}

// ---------- شرائح الواجهة ----------

interface Block {
  paras: TPara[];
  font: string;
  role: string;
  gap: number;
  w?: number;
  h?: number;
}

/** كدس كتل نصية عمودياً حول مركز محدد دون تداخل */
function stack(ctx: Ctx, blocks: Block[], x: number, w: number, center = H / 2, minY = 0.55): { prims: Prim[]; top: number; bottom: number; ys: number[] } {
  const hs = blocks.map((b) => b.h ?? parasHeight(b.paras, b.w ?? w) + 0.04);
  const total = hs.reduce((a, h, i) => a + h + (i < blocks.length - 1 ? blocks[i].gap : 0), 0);
  let y = Math.max(minY, center - total / 2);
  const top = y;
  const prims: Prim[] = [];
  const ys: number[] = [];
  blocks.forEach((b, i) => {
    ys.push(y);
    if (b.paras.length) prims.push(text(X(ctx, x, b.w ?? w), y, b.w ?? w, hs[i], b.paras, b.font, b.role));
    y += hs[i] + b.gap;
  });
  return { prims, top, bottom: y - (blocks.length ? blocks[blocks.length - 1].gap : 0), ys };
}

function coverSlide(s: Extract<Slide, { kind: "cover" }>, ctx: Ctx): LaidSlide {
  const h = ctx.hero;
  const m = s.meta;
  const prims: Prim[] = [];
  const hasImg = !!ctx.img;
  if (hasImg) {
    prims.push(...photo(ctx, 0, 0, W, H));
    prims.push(...scrim(ctx, 0, 0, W, H, h.bg, 0.95, 0.22));
  } else {
    prims.push(...rings(ctx, W - 2.75, 3.75, 2.35, h.text, h.accent, ctx.th.icons[0]));
    prims.push(...motif(ctx.th, { x: X(ctx, W - 1.7, 1.1), y: 6.05, w: 1.1, h: 0.95 }, h.text, h.accent));
  }
  const x = 1.15;
  const w = hasImg ? 8.6 : 7.0;
  const LOGO = 1.1;
  if (m.logo) {
    prims.push({ t: "rect", x: X(ctx, W - M - LOGO, LOGO), y: 0.55, w: LOGO, h: LOGO, fill: "FFFFFF", radius: 0.12 });
    prims.push({ t: "image", x: X(ctx, W - M - LOGO + 0.1, LOGO - 0.2), y: 0.65, w: LOGO - 0.2, h: LOGO - 0.2, src: m.logo, fit: "contain", alt: m.institution || "logo" });
  }
  const blocks: Block[] = [];
  const inst = [m.institution, m.faculty].filter((v): v is string => typeof v === "string" && !!v.trim()).map((v) => v.trim());
  if (inst.length)
    blocks.push({ paras: inst.map((v, i) => P(ctx, v, i === 0 ? 13 : 12, i === 0 ? h.accent : ctx.heroMuted, { bold: i === 0, align: startAlign(ctx) })), font: ctx.f.body, role: "institution", gap: 0.35 });
  const t = fit((k) => [P(ctx, m.title || "", Math.round(42 * k), h.text, { bold: true, align: startAlign(ctx) })], w, 2.6, 0.6);
  blocks.push({ paras: t.paras, font: ctx.f.head, role: "title", gap: 0.25 });
  if (typeof m.subtitle === "string" && m.subtitle.trim())
    blocks.push({ paras: fit((k) => [P(ctx, m.subtitle.trim(), Math.round(18 * k), ctx.heroMuted, { align: startAlign(ctx) })], w, 0.9, 0.7).paras, font: ctx.f.body, role: "subtitle", gap: 0.35 });
  const latin = !ctx.rtl;
  const fr = s.meta.language === "fr";
  const people: TPara[] = [];
  const presenters = Array.isArray(m.presenters) ? m.presenters.filter(Boolean) : [];
  if (presenters.length) {
    const label = latin ? (fr ? "Présenté par :" : "Presented by:") : "إعداد:";
    people.push(PR(ctx, [{ text: `${label} `, bold: true, color: h.accent }, { text: presenters.join(latin ? ", " : "، ") }], 14, h.text, { align: startAlign(ctx), rtl: ctx.rtl, spaceAfter: 4 }));
  }
  if (typeof m.supervisor === "string" && m.supervisor.trim()) {
    const label = latin ? (fr ? "Sous la direction de :" : "Supervised by:") : "إشراف:";
    people.push(PR(ctx, [{ text: `${label} `, bold: true, color: h.accent }, { text: m.supervisor.trim() }], 14, h.text, { align: startAlign(ctx), rtl: ctx.rtl, spaceAfter: 4 }));
  }
  if (people.length) blocks.push({ paras: people, font: ctx.f.body, role: "people", gap: 0.3 });
  const year = typeof m.year === "string" ? m.year.trim() : "";
  if (year) blocks.push({ paras: [], font: ctx.f.body, role: "year", gap: 0, h: 0.46 });
  const st = stack(ctx, blocks, x, w, H / 2 + 0.1, m.logo ? 1.85 : 0.6);
  prims.push(...st.prims);
  prims.push({ t: "rect", x: X(ctx, 0.8, 0.08), y: st.top, w: 0.08, h: Math.max(1, st.bottom - st.top - (year ? 0.6 : 0)), fill: h.accent });
  if (year) {
    const yw = Math.min(4, 0.5 + year.length * 0.11);
    const yy = st.ys[st.ys.length - 1];
    prims.push({ t: "rect", x: X(ctx, x, yw), y: yy, w: yw, h: 0.46, fill: h.accent, radius: 0.06 });
    prims.push(text(X(ctx, x, yw), yy, yw, 0.46, [P(ctx, year, 12, h.bg, { bold: true, align: "center" })], ctx.f.body, "year", "middle"));
  }
  return { bg: h.bg, prims, notes: s.notes };
}

function agendaSlide(s: Extract<Slide, { kind: "agenda" }>, ctx: Ctx): LaidSlide {
  const c = ctx.c;
  const h = ctx.hero;
  const prims: Prim[] = [];
  const PW = 4.25;
  prims.push({ t: "rect", x: X(ctx, 0, PW), y: 0, w: PW, h: H, fill: h.bg });
  const latin = !ctx.rtl;
  const kick = latin ? (s.parts > 1 ? `Outline · ${s.part}/${s.parts}` : "Outline") : s.parts > 1 ? `هيكل العرض · ${s.part}/${s.parts}` : "هيكل العرض";
  prims.push({ t: "rect", x: X(ctx, 0.75, 0.5), y: 1.17, w: 0.5, h: 0.06, fill: h.accent });
  prims.push(text(X(ctx, 0.75, PW - 1.3), 1.35, PW - 1.3, 0.4, [P(ctx, kick, 12, h.accent, { bold: true, align: startAlign(ctx) })], ctx.f.body, "kicker", "middle"));
  const t = fit((k) => [P(ctx, s.title, Math.round(36 * k), h.text, { bold: true, align: startAlign(ctx) })], PW - 1.3, 2.4, 0.6);
  prims.push(text(X(ctx, 0.75, PW - 1.3), 1.9, PW - 1.3, t.h, t.paras, ctx.f.head, "title"));
  prims.push(...motif(ctx.th, { x: X(ctx, 0.75, 1.2), y: 5.55, w: 1.2, h: 1.05 }, h.text, h.accent));
  prims.push(text(X(ctx, PW - 1.75, 1.2), 6.85, 1.2, 0.3, [{ runs: [{ text: `${num2(ctx.n)} / ${ctx.total}` }], size: 9, color: ctx.heroMuted, align: endAlign(ctx), rtl: false }], ctx.f.body, "number", "middle"));

  const ax = PW + 0.7;
  const aw = W - ax - M;
  const tw = aw - 1.0;
  const top = 0.75;
  const avail = H - 0.75 - top;
  const build = (k: number, kids: boolean) =>
    s.entries.map((e) => ({
      head: [P(ctx, e.title, Math.round(19 * k), c.text, { bold: true, align: startAlign(ctx) })],
      kids: kids && e.children.length ? [P(ctx, e.children.join("  ·  "), Math.round(12.5 * k), c.muted, { align: startAlign(ctx) })] : [],
    }));
  const rowH = (r: ReturnType<typeof build>[number]) => Math.max(0.5, parasHeight(r.head, tw) + (r.kids.length ? parasHeight(r.kids, tw) + 0.05 : 0));
  const sum = (rs: ReturnType<typeof build>, g: number) => rs.reduce((a, r) => a + rowH(r) + g, 0);
  let k = 1;
  let kids = true;
  let rows = build(k, kids);
  while (k > 0.66 && sum(rows, 0.36) > avail) rows = build((k -= 0.05), kids);
  if (sum(rows, 0.3) > avail) {
    kids = false;
    k = 1;
    rows = build(k, kids);
    while (k > 0.7 && sum(rows, 0.3) > avail) rows = build((k -= 0.05), kids);
  }
  const hs = rows.map(rowH);
  const gap = Math.min(0.62, Math.max(0.24, (avail - hs.reduce((a, b) => a + b, 0)) / Math.max(1, rows.length)));
  const used = hs.reduce((a, b) => a + b + gap, 0) - gap;
  let y = top + Math.max(0, (avail - used) / 2);
  rows.forEach((r, i) => {
    if (y + 0.45 > H - 0.5) return;
    prims.push(text(X(ctx, ax, 0.85), y - 0.06, 0.85, 0.55, [{ runs: [{ text: num2(s.startIndex + i + 1) }], size: 24, color: c.accent, align: startAlign(ctx), rtl: false }], ctx.f.head, "badge", "top"));
    const hh = parasHeight(r.head, tw);
    prims.push(text(X(ctx, ax + 1.0, tw), y, tw, hh, r.head, ctx.f.head, "agenda-title"));
    if (r.kids.length) prims.push(text(X(ctx, ax + 1.0, tw), y + hh + 0.05, tw, parasHeight(r.kids, tw), r.kids, ctx.f.body, "agenda-kids"));
    y += hs[i] + gap / 2;
    if (i < rows.length - 1) prims.push({ t: "rect", x: X(ctx, ax, aw), y: y - 0.02, w: aw, h: 0.01, fill: c.line });
    y += gap / 2;
  });
  return { bg: c.bg, prims, notes: s.notes };
}

function sectionSlide(s: Extract<Slide, { kind: "section" }>, ctx: Ctx): LaidSlide {
  const h = ctx.hero;
  const prims: Prim[] = [];
  const caseStudy = s.variant === "case-study";
  const hasImg = !!ctx.img;
  const PW = 7.3;
  if (hasImg && caseStudy) {
    prims.push(...photo(ctx, 0, 0, W, H));
    prims.push(...scrim(ctx, 0, 0, W, H, h.bg, 0.96, 0.3));
  } else if (hasImg) {
    prims.push(...photo(ctx, PW, 0, W - PW, H));
    prims.push({ t: "rect", x: X(ctx, PW, 0.09), y: 0, w: 0.09, h: H, fill: h.accent });
  } else {
    // دون صورة: رقم المبحث شبحاً كبيراً في الجانب الآخر
    prims.push(
      text(X(ctx, W - 6.6, 6.0), 0.3, 6.0, 6.9, [{ runs: [{ text: caseStudy ? "◆" : num2(s.number) }], size: 330, color: mix(h.bg, h.text, 0.07), align: endAlign(ctx), rtl: false, bold: true }], ctx.f.head, "ghost", "middle"),
    );
    prims.push({ t: "rect", x: X(ctx, W - 0.14, 0.14), y: 0, w: 0.14, h: H, fill: h.accent });
  }
  const x = 0.95;
  const w = hasImg && !caseStudy ? PW - 1.6 : 7.6;
  const blocks: Block[] = [];
  if (caseStudy) {
    blocks.push({ paras: [], font: ctx.f.body, role: "badge", gap: 0.3, h: 0.95 });
  } else {
    blocks.push({ paras: [{ runs: [{ text: num2(s.number) }], size: 80, color: h.accent, align: startAlign(ctx), rtl: false }], font: ctx.f.head, role: "number", gap: 0.12, h: 1.25 });
  }
  blocks.push({ paras: [P(ctx, s.kicker, 15, caseStudy ? h.accent : ctx.heroMuted, { bold: true, align: startAlign(ctx) })], font: ctx.f.body, role: "kicker", gap: 0.15 });
  blocks.push({ paras: fit((k) => [P(ctx, s.title, Math.round(36 * k), h.text, { bold: true, align: startAlign(ctx) })], w, 2.0, 0.6).paras, font: ctx.f.head, role: "title", gap: 0.3 });
  blocks.push({ paras: [], font: ctx.f.body, role: "rule", gap: 0.3, h: 0.06 });
  const kids = s.children.slice(0, 5);
  if (kids.length) {
    const kp = fit(
      (k) =>
        kids.map((t, i) => PR(ctx, [{ text: `${num2(i + 1)}   `, bold: true, color: h.accent }, { text: t }], Math.round(16 * k), h.text, { spaceAfter: 9, align: startAlign(ctx), rtl: ctx.rtl })),
      w,
      2.4,
      0.65,
    );
    blocks.push({ paras: kp.paras, font: ctx.f.body, role: "children", gap: 0 });
  }
  const st = stack(ctx, blocks, x, w, H / 2, 0.5);
  prims.push(...st.prims);
  const ri = blocks.findIndex((b) => b.role === "rule");
  prims.push({ t: "rect", x: X(ctx, x, 1.2), y: st.ys[ri], w: 1.2, h: 0.06, fill: h.accent });
  if (caseStudy) {
    const by = st.ys[0];
    prims.push({ t: "ellipse", x: X(ctx, x, 0.95), y: by, w: 0.95, h: 0.95, fill: h.accent });
    prims.push({ t: "icon", x: X(ctx, x + 0.24, 0.47), y: by + 0.24, w: 0.47, h: 0.47, name: "Building2", color: h.bg });
  }
  return { bg: h.bg, prims, notes: s.notes };
}

function questionSlide(s: Extract<Slide, { kind: "question" }>, ctx: Ctx): LaidSlide {
  const h = ctx.hero;
  const prims: Prim[] = [];
  if (ctx.img) {
    prims.push(...photo(ctx, 0, 0, W, H));
    prims.push(...scrim(ctx, 0, 0, W, H, h.bg, 0.97, 0.55));
  } else {
    prims.push(
      text(X(ctx, W - 5.4, 5.0), 0.2, 5.0, 7.0, [{ runs: [{ text: ctx.rtl ? "؟" : "?" }], size: 400, color: mix(h.bg, h.text, 0.07), align: endAlign(ctx), rtl: ctx.rtl, bold: true }], ctx.f.head, "ghost", "middle"),
    );
  }
  const x = 1.15;
  const w = 9.4;
  prims.push({ t: "rect", x: X(ctx, x, 0.5), y: 1.17, w: 0.5, h: 0.06, fill: h.accent });
  prims.push(text(X(ctx, x + 0.65, 6), 1.0, 6, 0.4, [P(ctx, s.kicker, 13, h.accent, { bold: true, align: startAlign(ctx) })], ctx.f.body, "kicker", "middle"));
  const q = fit((k) => [P(ctx, s.text, Math.round(34 * k), h.text, { bold: true, align: startAlign(ctx) })], w, 4.1, 0.55);
  const qy = 1.75 + (4.4 - q.h) / 2;
  prims.push({ t: "rect", x: X(ctx, 0.8, 0.08), y: qy, w: 0.08, h: q.h, fill: h.accent });
  prims.push(text(X(ctx, x, w), qy, w, q.h, q.paras, ctx.f.head, "question"));
  prims.push(text(X(ctx, W - M - 1.6, 1.6), 7.0, 1.6, 0.3, [{ runs: [{ text: `${num2(ctx.n)} / ${ctx.total}` }], size: 9, color: ctx.heroMuted, align: endAlign(ctx), rtl: false }], ctx.f.body, "number", "middle"));
  return { bg: h.bg, prims, notes: s.notes };
}

function referencesSlide(s: Extract<Slide, { kind: "references" }>, ctx: Ctx): LaidSlide {
  const c = ctx.c;
  const latin = !ctx.rtl;
  const kick = latin ? (s.parts > 1 ? `References · ${s.part}/${s.parts}` : "References") : s.parts > 1 ? `المراجع · ${s.part}/${s.parts}` : "المراجع";
  const ch = chrome(ctx, kick, s.title);
  const avail = BOTTOM + 0.12 - ch.top;
  const body = fit((k) => pointParas(ctx, s.points, 14, 15, 7, k, s.startIndex), CW, avail, 0.72, 1.15);
  ch.prims.push(text(X(ctx, M, CW), ch.top, CW, Math.min(avail, body.h + 0.05), body.paras, ctx.f.body, "references"));
  return { bg: c.bg, prims: ch.prims, notes: s.notes };
}

function closingSlide(s: Extract<Slide, { kind: "closing" }>, ctx: Ctx): LaidSlide {
  const h = ctx.hero;
  const prims: Prim[] = [];
  if (ctx.img) {
    prims.push(...photo(ctx, 0, 0, W, H));
    prims.push(...scrim(ctx, 0, 0, W, H, h.bg, 0.95, 0.25));
  } else {
    prims.push(...rings(ctx, W - 2.75, 3.75, 2.35, h.text, h.accent, ctx.th.icons[0]));
  }
  const x = 1.15;
  const w = ctx.img ? 8.4 : 7.0;
  const blocks: Block[] = [
    { paras: fit((k) => [P(ctx, s.title, Math.round(44 * k), h.text, { bold: true, align: startAlign(ctx) })], w, 2.2, 0.6).paras, font: ctx.f.head, role: "title", gap: 0.3 },
    { paras: [], font: ctx.f.body, role: "rule", gap: 0.3, h: 0.06 },
  ];
  if (s.subtitle) blocks.push({ paras: fit((k) => [P(ctx, s.subtitle, Math.round(18 * k), ctx.heroMuted, { align: startAlign(ctx) })], w, 1.3, 0.7).paras, font: ctx.f.body, role: "subtitle", gap: 0 });
  const st = stack(ctx, blocks, x, w);
  prims.push(...st.prims);
  prims.push({ t: "rect", x: X(ctx, 0.8, 0.08), y: st.top, w: 0.08, h: st.bottom - st.top, fill: h.accent });
  prims.push({ t: "rect", x: X(ctx, x, 1.2), y: st.ys[1], w: 1.2, h: 0.06, fill: h.accent });
  return { bg: h.bg, prims, notes: s.notes };
}

// ---------- نقطة الدخول ----------

/**
 * تخطيط العرض كاملاً. المعامل الرابع اختياري: صور مفهرسة برقم الشريحة (انظر resolveDeckImages في imagery.ts).
 * دونه تُنتَج نفس التصاميم الجديدة ببدائل هندسية للصور.
 */
export function layoutDeck(deck: SlideDeck, th: SlideTheme, opts: DeckOptions = DEFAULT_DECK_OPTIONS, images?: DeckImages): LaidSlide[] {
  const effectiveOpts = opts || DEFAULT_DECK_OPTIONS;
  const total = deck.slides.length;
  const lang = deck.language || (isLatinText(deck.title || "") ? "fr" : "ar");
  const hero = heroColors(th);
  const base = {
    th,
    c: th.colors,
    hero,
    f: themeFonts(th, lang),
    rtl: lang === "ar",
    total,
    deckTitle: deck.title || "",
    m: DENSITY_METRICS[effectiveOpts.density || "balanced"] || DENSITY_METRICS.balanced,
    titleColor: isDark(th.colors.bg) ? th.colors.text : th.colors.primary,
    heroMuted: mix(hero.text, hero.bg, 0.28),
  };
  return deck.slides.map((s, i) => {
    const img = images?.[i];
    const ctx: Ctx = { ...base, n: i + 1, img: img && typeof img.src === "string" && img.src ? img : undefined };
    switch (s.kind) {
      case "cover":
        return coverSlide(s, ctx);
      case "agenda":
        return agendaSlide(s, ctx);
      case "section":
        return sectionSlide(s, ctx);
      case "question":
        return questionSlide(s, ctx);
      case "content":
        return contentSlide(s, ctx);
      case "references":
        return referencesSlide(s, ctx);
      case "closing":
        return closingSlide(s, ctx);
    }
  });
}
