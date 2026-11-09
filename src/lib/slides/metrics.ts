// مقاييس الشريحة وتقدير المساحة التي يشغلها النص (يستعملها المخطِّط والتخطيط معاً)
import type { Point, SlideDensity } from "./types";

export const SLIDE_W = 13.333;
export const SLIDE_H = 7.5;

/** متوسط عرض الحرف العربي نسبةً إلى حجم الخط (تقدير متحفظ لخطوط Arial / Tahoma / Times) */
const GLYPH_EM = 0.5;
export const LINE_SPACING = 1.12;

export interface BodyMetrics {
  fontPt: number;
  subPt: number;
  gapPt: number;
}

export const DENSITY_METRICS: Record<SlideDensity, BodyMetrics> = {
  airy: { fontPt: 21, subPt: 22, gapPt: 12 },
  balanced: { fontPt: 18, subPt: 20, gapPt: 10 },
  detailed: { fontPt: 16, subPt: 18, gapPt: 8 },
};

/** مساحة متن الشريحة القياسية (بالبوصة) التي يُبنى عليها التقسيم */
export const BODY_BOX = { w: 10.9, h: 4.55 };

/** الخط العريض أعرض بنحو 15% في الحروف العربية */
const BOLD_FACTOR = 1.15;

export function charsPerLine(widthIn: number, pt: number, bold = false): number {
  return Math.max(8, Math.floor((widthIn * 72) / (pt * GLYPH_EM * (bold ? BOLD_FACTOR : 1))));
}

export function linesFor(text: string, widthIn: number, pt: number, bold = false): number {
  const cpl = charsPerLine(widthIn, pt, bold);
  return text.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / cpl)), 0);
}

/** ارتفاع كتلة نصية بالبوصة */
export function textHeight(
  text: string,
  widthIn: number,
  pt: number,
  spacing = LINE_SPACING,
  bold = false,
): number {
  return (linesFor(text, widthIn, pt, bold) * pt * spacing * 1.2) / 72;
}

export function pointText(p: Point): string {
  return p.label ? `${p.label}: ${p.text}` : p.text;
}

/** ارتفاع نقطة داخل قائمة (مع المسافة بعدها) */
export function pointHeight(p: Point, widthIn: number, m: BodyMetrics): number {
  const pt = p.kind === "sub" ? m.subPt : m.fontPt;
  const indent = p.kind === "bullet" ? 0.35 : 0;
  return textHeight(pointText(p), widthIn - indent, pt) + m.gapPt / 72;
}
