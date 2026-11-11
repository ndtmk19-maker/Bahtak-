// محرك التخطيط: يحوّل الشرائح الدلالية + القالب إلى عناصر موضعة بالبوصة (أشكال، نصوص، أيقونات).
// تستهلك هذه العناصر طبقتان: مُصدِّر PPTX والمعاينة داخل الموقع، فتتطابق الهندسة بينهما.
import {
  BODY_BOX,
  DENSITY_METRICS,
  LINE_SPACING,
  SLIDE_H,
  SLIDE_W,
  pointText,
  textHeight,
} from "./metrics";
import type { SlideIconName } from "./icons";
import { heroColors, type SlideTheme } from "./themes";
import type { DeckOptions, Point, Slide, SlideDeck } from "./types";

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
  | { t: "image"; x: number; y: number; w: number; h: number; src: string }
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

const M = 0.6;
const BW = BODY_BOX.w;
const BX = SLIDE_W - M - BW;
const BODY_BOTTOM = 6.62;
const BULLET_INDENT = 0.32;

// ---------- أدوات ----------

const para = (text: string, size: number, color: string, o: Partial<TPara> = {}): TPara => ({
  runs: [{ text, bold: o.bold }],
  size,
  color,
  align: "right",
  rtl: true,
  ...o,
});

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
): { paras: TPara[]; h: number } {
  for (let s = max; s >= min - 1e-9; s -= 0.05) {
    const ps = build(s);
    const ph = parasHeight(ps, w);
    if (ph <= h) return { paras: ps, h: ph };
  }
  const ps = build(min);
  return { paras: ps, h: parasHeight(ps, w) };
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
): Prim => ({
  t: "text",
  x,
  y,
  w,
  h,
  paras,
  font,
  role,
  valign,
});

const icon = (th: SlideTheme, n: number) => th.icons[((n % 4) + 4) % 4];

// ---------- الزخارف الخاصة بكل قالب (داخل منطقة آمنة لا يدخلها النص) ----------

function motif(
  th: SlideTheme,
  r: { x: number; y: number; w: number; h: number },
  color: string,
  accent: string,
): Prim[] {
  const out: Prim[] = [];
  const { x, y, w, h } = r;
  switch (th.motif) {
    case "bars": {
      const bw = w / 6;
      [0.28, 0.45, 0.66, 0.92].forEach((k, i) => {
        const bh = h * 0.42 * k;
        out.push({
          t: "rect",
          x: x + w * 0.08 + i * bw * 1.35,
          y: y + h - bh,
          w: bw,
          h: bh,
          fill: i === 3 ? accent : color,
          alpha: i === 3 ? 0.85 : 0.2 + i * 0.12,
        });
      });
      out.push({
        t: "line",
        x1: x,
        y1: y + h,
        x2: x + w,
        y2: y + h,
        color,
        width: 1.25,
        alpha: 0.5,
      });
      break;
    }
    case "grid": {
      const step = 0.3;
      const cols = Math.max(2, Math.floor(w / step));
      const rows = Math.min(14, Math.floor((h * 0.6) / step));
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++)
          out.push({
            t: "ellipse",
            x: x + i * step,
            y: y + j * step,
            w: 0.05,
            h: 0.05,
            fill: (i + j) % 5 === 0 ? accent : color,
            alpha: (i + j) % 5 === 0 ? 0.9 : 0.35,
          });
      out.push({
        t: "line",
        x1: x + w * 0.5,
        y1: y + h * 0.66,
        x2: x + w * 0.5,
        y2: y + h,
        color: accent,
        width: 1.5,
        alpha: 0.7,
      });
      break;
    }
    case "pulse": {
      const my = y + h * 0.18;
      const pts: [number, number][] = [
        [0, 0],
        [0.3, 0],
        [0.4, -0.35],
        [0.52, 0.45],
        [0.62, -0.15],
        [0.7, 0],
        [1, 0],
      ];
      for (let i = 0; i < pts.length - 1; i++)
        out.push({
          t: "line",
          x1: x + pts[i][0] * w,
          y1: my + pts[i][1],
          x2: x + pts[i + 1][0] * w,
          y2: my + pts[i + 1][1],
          color: accent,
          width: 2.25,
        });
      out.push({
        t: "rect",
        x: x + w * 0.45,
        y: y + h * 0.35,
        w: 0.06,
        h: h * 0.65,
        fill: color,
        alpha: 0.25,
      });
      break;
    }
    case "ledger": {
      for (let yy = y + 0.2; yy < y + h; yy += 0.36)
        out.push({ t: "line", x1: x, y1: yy, x2: x + w, y2: yy, color, width: 0.75, alpha: 0.28 });
      out.push({
        t: "line",
        x1: x + w - 0.12,
        y1: y,
        x2: x + w - 0.12,
        y2: y + h,
        color: accent,
        width: 1,
        alpha: 0.75,
      });
      out.push({
        t: "line",
        x1: x + w - 0.04,
        y1: y,
        x2: x + w - 0.04,
        y2: y + h,
        color: accent,
        width: 1,
        alpha: 0.75,
      });
      break;
    }
    case "diagonal": {
      out.push({
        t: "tri",
        x,
        y,
        w,
        h: Math.min(h, w * 1.6),
        fill: color,
        alpha: 0.92,
        flipV: true,
      });
      out.push({
        t: "tri",
        x,
        y: y + h - w * 0.9,
        w: w * 0.75,
        h: w * 0.9,
        fill: accent,
        alpha: 0.85,
      });
      break;
    }
    case "blocks": {
      const s = Math.min(0.42, w / 3);
      [
        [0, 2, accent, 0.95],
        [1, 2, color, 0.85],
        [0, 1, color, 0.35],
        [2, 2, color, 0.2],
      ].forEach(([cx, cy, c, a]) =>
        out.push({
          t: "rect",
          x: x + (cx as number) * (s + 0.06),
          y: y + h - (3 - (cy as number)) * (s + 0.06),
          w: s,
          h: s,
          fill: c as string,
          alpha: a as number,
        }),
      );
      break;
    }
    case "columns": {
      const ch = h * 0.42;
      const by = y + h - ch;
      out.push({ t: "rect", x, y: by - 0.12, w, h: 0.1, fill: accent, alpha: 0.85 });
      [0.12, 0.42, 0.72].forEach((k) =>
        out.push({
          t: "rect",
          x: x + w * k,
          y: by,
          w: w * 0.14,
          h: ch - 0.12,
          fill: color,
          alpha: 0.28,
        }),
      );
      out.push({ t: "rect", x, y: y + h - 0.1, w, h: 0.1, fill: accent, alpha: 0.85 });
      break;
    }
    case "arcs": {
      const cx = x + w / 2;
      const cy = y + h - w / 2;
      [1, 0.72, 0.44].forEach((k, i) => {
        const d = w * k;
        out.push({
          t: "ellipse",
          x: cx - d / 2,
          y: cy - d / 2,
          w: d,
          h: d,
          line: i === 1 ? accent : color,
          lineW: 1.5,
          alpha: 0.7,
        });
      });
      out.push({ t: "ellipse", x: cx - 0.09, y: cy - 0.09, w: 0.18, h: 0.18, fill: accent });
      break;
    }
    default: {
      out.push({
        t: "line",
        x1: x + w * 0.5,
        y1: y,
        x2: x + w * 0.5,
        y2: y + h,
        color,
        width: 1,
        alpha: 0.35,
      });
      out.push({ t: "rect", x: x + w * 0.5 - 0.04, y: y + h * 0.1, w: 0.08, h: 0.9, fill: accent });
    }
  }
  return out;
}

// ---------- الإطار المشترك لشرائح المتن ----------

interface Chrome {
  prims: Prim[];
  bodyTop: number;
}

function chrome(
  th: SlideTheme,
  kicker: string,
  title: string,
  n: number,
  total: number,
): Chrome {
  const c = th.colors;
  const prims: Prim[] = [
    { t: "rect", x: SLIDE_W - 0.16, y: 0, w: 0.16, h: SLIDE_H, fill: c.primary },
  ];
  prims.push(...motif(th, { x: 0.3, y: 0.5, w: 1.15, h: 6.0 }, c.primary, c.accent));
  if (kicker)
    prims.push(
      text(
        BX,
        0.42,
        BW,
        0.34,
        [para(kicker, 13, c.secondary === c.text ? c.primary : c.secondary, { bold: true })],
        th.fonts.body,
        "kicker",
        "middle",
      ),
    );
  const t = fit((s) => [para(title, Math.round(30 * s), c.text, { bold: true })], BW, 1.12, 0.7);
  const th1 = Math.max(0.6, t.h);
  prims.push(text(BX, 0.82, BW, th1, t.paras, th.fonts.head, "title", "top"));
  const uy = 0.82 + th1 + 0.1;
  prims.push({ t: "rect", x: BX + BW - 1.1, y: uy, w: 1.1, h: 0.06, fill: c.accent });
  prims.push({ t: "rect", x: BX, y: 6.86, w: BW, h: 0.012, fill: c.line });
  prims.push(
    text(
      BX,
      6.93,
      1.1,
      0.3,
      [para(`${n} / ${total}`, 10, c.muted, { align: "left", rtl: false })],
      th.fonts.body,
      "number",
      "middle",
    ),
  );
  return { prims, bodyTop: Math.max(2.0, uy + 0.3) };
}

function pointParas(
  points: Point[],
  th: SlideTheme,
  fontPt: number,
  subPt: number,
  gapPt: number,
  s: number,
  numberFrom?: number,
): TPara[] {
  const c = th.colors;
  let num = numberFrom ?? 0;
  return points.map((p) => {
    const size = Math.round((p.kind === "sub" ? subPt : fontPt) * s);
    const align = p.ltr ? "left" : "right";
    if (p.kind === "sub")
      return para(p.text, size, c.primary, {
        bold: true,
        spaceAfter: gapPt * 0.6,
        align,
        rtl: !p.ltr,
      });
    if (p.kind === "lead")
      return para(p.text, size, c.text, { spaceAfter: gapPt * 0.6, align, rtl: !p.ltr });
    const runs: TRun[] = [];
    if (numberFrom !== undefined) runs.push({ text: `${++num}. `, bold: true, color: c.primary });
    if (p.label) runs.push({ text: `${p.label}: `, bold: true, color: c.primary });
    runs.push({ text: p.text });
    return {
      runs,
      size,
      color: c.text,
      align,
      rtl: !p.ltr,
      bullet: numberFrom === undefined,
      spaceAfter: gapPt,
    };
  });
}

// ---------- أنواع الشرائح ----------

function coverSlide(s: Extract<Slide, { kind: "cover" }>, th: SlideTheme): LaidSlide {
  const c = th.colors;
  const m = s.meta;
  const prims: Prim[] = [];
  let bg = c.bg;
  let fg = c.text;
  let sub = c.muted;
  let area = { x: 5.5, w: SLIDE_W - M - 5.5 };

  if (th.cover === "split") {
    prims.push({ t: "rect", x: 0, y: 0, w: 4.85, h: SLIDE_H, fill: c.primary });
    prims.push(...motif(th, { x: 0.45, y: 0.6, w: 1.3, h: 6.3 }, c.onPrimary, c.accent));
    prims.push({ t: "ellipse", x: 1.95, y: 2.35, w: 2.5, h: 2.5, fill: c.onPrimary, alpha: 0.1 });
    prims.push({
      t: "icon",
      x: 2.6,
      y: 3.0,
      w: 1.2,
      h: 1.2,
      name: th.icons[0],
      color: c.onPrimary,
    });
    prims.push({ t: "rect", x: SLIDE_W - 0.16, y: 0, w: 0.16, h: SLIDE_H, fill: c.accent });
  } else if (th.cover === "band") {
    prims.push({ t: "rect", x: 0, y: 0, w: SLIDE_W, h: 0.22, fill: c.primary });
    prims.push({ t: "rect", x: 0, y: SLIDE_H - 0.12, w: SLIDE_W, h: 0.12, fill: c.accent });
    prims.push({ t: "ellipse", x: 0.6, y: 1.9, w: 3.3, h: 3.3, fill: c.primary, alpha: 0.08 });
    prims.push({ t: "ellipse", x: 1.1, y: 2.4, w: 2.3, h: 2.3, fill: c.primary });
    prims.push({
      t: "icon",
      x: 1.7,
      y: 3.0,
      w: 1.1,
      h: 1.1,
      name: th.icons[0],
      color: c.onPrimary,
    });
    prims.push(...motif(th, { x: 0.4, y: 5.55, w: 1.0, h: 1.4 }, c.primary, c.accent));
    area = { x: 4.6, w: SLIDE_W - M - 4.6 };
  } else {
    const hc = heroColors(th);
    bg = hc.bg;
    fg = hc.text;
    sub = hc.text;
    prims.push({ t: "rect", x: 0, y: 0, w: 4.4, h: SLIDE_H, fill: hc.text, alpha: 0.05 });
    prims.push(...motif(th, { x: 0.5, y: 0.6, w: 1.4, h: 6.2 }, hc.text, hc.accent));
    prims.push({ t: "ellipse", x: 2.0, y: 2.6, w: 2.0, h: 2.0, fill: hc.accent });
    prims.push({ t: "icon", x: 2.5, y: 3.1, w: 1.0, h: 1.0, name: th.icons[0], color: hc.bg });
    area = { x: 4.9, w: SLIDE_W - M - 4.9 };
  }

  // كدس النصوص من الأعلى إلى الأسفل دون أي تداخل
  const blocks: { paras: TPara[]; font: string; role: string; gap: number; logo?: boolean }[] = [];
  const inst = [m.institution, m.faculty].filter((v) => v.trim());
  // ترويسة الغلاف: شعار الجامعة في بطاقة بيضاء وبجانبه اسم الجامعة والكلية
  const LOGO = 1.15;
  const hasLogo = !!m.logo;
  const instW = hasLogo ? area.w - LOGO - 0.25 : area.w;
  if (hasLogo && !inst.length)
    blocks.push({ paras: [], font: th.fonts.body, role: "logo", gap: 0.4, logo: true });
  if (inst.length)
    blocks.push({
      logo: hasLogo,
      paras: inst.map((v, i) => para(v, i === 0 ? 15 : 13, sub, { bold: i === 0 })),
      font: th.fonts.body,
      role: "institution",
      gap: 0.45,
    });
  const t = fit((k) => [para(m.title, Math.round(40 * k), fg, { bold: true })], area.w, 2.6, 0.65);
  blocks.push({ paras: t.paras, font: th.fonts.head, role: "title", gap: 0.18 });
  const accentAt = blocks.length;
  if (m.subtitle.trim())
    blocks.push({
      paras: [
        para(m.subtitle, 18, th.cover === "full" ? heroColors(th).accent : c.secondary, {
          bold: true,
        }),
      ],
      font: th.fonts.body,
      role: "subtitle",
      gap: 0.4,
    });
  const people: TPara[] = [];
  if (m.presenters.length) people.push(para(`إعداد: ${m.presenters.join("، ")}`, 15, fg));
  if (m.supervisor.trim()) people.push(para(`إشراف: ${m.supervisor}`, 15, fg));
  if (people.length)
    blocks.push({
      paras: people.map((p) => ({ ...p, spaceAfter: 4 })),
      font: th.fonts.body,
      role: "people",
      gap: 0.25,
    });
  if (m.year.trim())
    blocks.push({ paras: [para(m.year, 13, sub)], font: th.fonts.body, role: "year", gap: 0 });

  const hs = blocks.map((b) =>
    b.logo
      ? Math.max(LOGO, parasHeight(b.paras, instW) + 0.04)
      : parasHeight(b.paras, area.w) + 0.04,
  );
  const total = hs.reduce((a, b, i) => a + b + blocks[i].gap, 0) + 0.22;
  let y = Math.max(0.55, (SLIDE_H - total) / 2);
  blocks.forEach((b, i) => {
    if (b.logo) {
      const ly = y + (hs[i] - LOGO) / 2;
      const lx = area.x + area.w - LOGO;
      prims.push({
        t: "rect",
        x: lx,
        y: ly,
        w: LOGO,
        h: LOGO,
        fill: "FFFFFF",
        radius: 0.14,
        line: c.line,
        lineW: 1,
      });
      prims.push({
        t: "image",
        x: lx + 0.1,
        y: ly + 0.1,
        w: LOGO - 0.2,
        h: LOGO - 0.2,
        src: m.logo,
      });
      if (b.paras.length)
        prims.push(text(area.x, y, instW, hs[i], b.paras, b.font, b.role, "middle"));
    } else prims.push(text(area.x, y, area.w, hs[i], b.paras, b.font, b.role));
    y += hs[i];
    if (i === accentAt - 1) {
      prims.push({
        t: "rect",
        x: area.x + area.w - 1.4,
        y: y + 0.08,
        w: 1.4,
        h: 0.07,
        fill: th.cover === "full" ? heroColors(th).accent : c.accent,
      });
      y += 0.22;
    }
    y += b.gap;
  });
  return { bg, prims, notes: s.notes };
}

function agendaSlide(
  s: Extract<Slide, { kind: "agenda" }>,
  th: SlideTheme,
  n: number,
  total: number,
): LaidSlide {
  const c = th.colors;
  const ch = chrome(
    th,
    s.parts > 1 ? `خطة العرض · ${s.part}/${s.parts}` : "هيكل العرض",
    s.title,
    n,
    total,
  );
  const prims = ch.prims;
  const avail = BODY_BOTTOM - ch.bodyTop;
  const tw = BW - 0.95;
  const build = (k: number) =>
    s.entries.map((e) => ({
      head: [para(e.title, Math.round(20 * k), c.text, { bold: true })],
      kids: e.children.length ? [para(e.children.join("  ·  "), Math.round(14 * k), c.muted)] : [],
    }));
  let k = 1;
  let rows = build(k);
  const rowH = (r: ReturnType<typeof build>[number]) =>
    Math.max(0.62, parasHeight(r.head, tw) + (r.kids.length ? parasHeight(r.kids, tw) + 0.04 : 0));
  while (k > 0.7 && rows.reduce((a, r) => a + rowH(r) + 0.22, 0) > avail) rows = build((k -= 0.05));
  const hs = rows.map(rowH);
  const gap = Math.min(
    0.45,
    Math.max(0.18, (avail - hs.reduce((a, b) => a + b, 0)) / Math.max(1, rows.length)),
  );
  let y = ch.bodyTop + 0.05;
  const bx = BX + BW - 0.62;
  if (rows.length > 1)
    prims.push({
      t: "rect",
      x: bx + 0.29,
      y: y + 0.3,
      w: 0.04,
      h: hs.slice(0, -1).reduce((a, b) => a + b + gap, 0),
      fill: c.line,
    });
  rows.forEach((r, i) => {
    prims.push({ t: "ellipse", x: bx, y, w: 0.62, h: 0.62, fill: i % 2 ? c.secondary : c.primary });
    prims.push(
      text(
        bx,
        y,
        0.62,
        0.62,
        [
          para(String(s.startIndex + i + 1).padStart(2, "0"), 15, c.onPrimary, {
            bold: true,
            align: "center",
            rtl: false,
          }),
        ],
        th.fonts.head,
        "badge",
        "middle",
      ),
    );
    const hh = parasHeight(r.head, tw);
    prims.push(
      text(
        BX,
        y + (r.kids.length ? 0 : (0.62 - hh) / 2),
        tw,
        hh,
        r.head,
        th.fonts.head,
        "agenda-title",
      ),
    );
    if (r.kids.length)
      prims.push(
        text(BX, y + hh + 0.04, tw, parasHeight(r.kids, tw), r.kids, th.fonts.body, "agenda-kids"),
      );
    y += hs[i] + gap;
  });
  return { bg: c.bg, prims, notes: s.notes };
}

function sectionSlide(s: Extract<Slide, { kind: "section" }>, th: SlideTheme): LaidSlide {
  const hc = heroColors(th);
  const fg = hc.text;
  const prims: Prim[] = [];
  prims.push({ t: "rect", x: 0, y: 0, w: 4.9, h: SLIDE_H, fill: fg, alpha: 0.06 });
  prims.push({ t: "ellipse", x: 1.0, y: 2.0, w: 3.5, h: 3.5, fill: fg, alpha: 0.08 });
  prims.push({ t: "ellipse", x: 1.55, y: 2.55, w: 2.4, h: 2.4, fill: hc.accent });
  prims.push({
    t: "icon",
    x: 2.15,
    y: 3.15,
    w: 1.2,
    h: 1.2,
    name: icon(th, s.number - 1),
    color: hc.bg,
  });
  prims.push({ t: "rect", x: SLIDE_W - 0.16, y: 0, w: 0.16, h: SLIDE_H, fill: hc.accent });
  const ax = 5.5;
  const aw = SLIDE_W - M - ax;
  const blocks: { paras: TPara[]; font: string; role: string; gap: number }[] = [
    {
      paras: [para(String(s.number).padStart(2, "0"), 80, hc.accent, { bold: true })],
      font: th.fonts.head,
      role: "number",
      gap: 0.05,
    },
    {
      paras: [para(s.kicker, 18, fg, { bold: true })],
      font: th.fonts.body,
      role: "kicker",
      gap: 0.12,
    },
  ];
  blocks.push({
    paras: fit((k) => [para(s.title, Math.round(36 * k), fg, { bold: true })], aw, 1.9, 0.65).paras,
    font: th.fonts.head,
    role: "title",
    gap: 0.35,
  });
  if (s.children.length) {
    const kids = fit(
      (k) =>
        s.children.map((t) => ({
          ...para(t, Math.round(17 * k), fg),
          bullet: true,
          spaceAfter: 6,
        })),
      aw,
      2.1,
      0.7,
    ).paras;
    blocks.push({ paras: kids, font: th.fonts.body, role: "children", gap: 0 });
  }
  const hs = blocks.map((b) => parasHeight(b.paras, aw) + 0.04);
  let y = Math.max(0.45, (SLIDE_H - hs.reduce((a, b, i) => a + b + blocks[i].gap, 0)) / 2);
  blocks.forEach((b, i) => {
    prims.push(text(ax, y, aw, hs[i], b.paras, b.font, b.role));
    y += hs[i] + b.gap;
  });
  return { bg: hc.bg, prims, notes: s.notes };
}

function questionSlide(
  s: Extract<Slide, { kind: "question" }>,
  th: SlideTheme,
  n: number,
  total: number,
): LaidSlide {
  const c = th.colors;
  const prims: Prim[] = [
    { t: "rect", x: SLIDE_W - 0.16, y: 0, w: 0.16, h: SLIDE_H, fill: c.primary },
  ];
  prims.push(...motif(th, { x: 0.3, y: 0.5, w: 1.15, h: 6.0 }, c.primary, c.accent));
  const cx = 1.9;
  const cw = SLIDE_W - cx - 1.0;
  prims.push({
    t: "rect",
    x: cx,
    y: 1.05,
    w: cw,
    h: 5.3,
    fill: c.surface,
    radius: 0.18,
    line: c.line,
    lineW: 1,
  });
  prims.push({ t: "ellipse", x: cx + cw / 2 - 0.5, y: 0.55, w: 1.0, h: 1.0, fill: c.primary });
  prims.push({
    t: "icon",
    x: cx + cw / 2 - 0.28,
    y: 0.77,
    w: 0.56,
    h: 0.56,
    name: "CircleHelp",
    color: c.onPrimary,
  });
  prims.push(
    text(
      cx + 0.5,
      1.75,
      cw - 1.0,
      0.4,
      [para(s.kicker, 16, c.primary, { bold: true, align: "center" })],
      th.fonts.body,
      "kicker",
      "middle",
    ),
  );
  const q = fit(
    (k) => [para(s.text, Math.round(30 * k), c.text, { bold: true, align: "center" })],
    cw - 1.2,
    3.6,
    0.6,
  );
  prims.push(
    text(cx + 0.6, 2.3 + (3.6 - q.h) / 2, cw - 1.2, q.h, q.paras, th.fonts.head, "question"),
  );
  prims.push(
    text(
      BX,
      6.93,
      1.1,
      0.3,
      [para(`${n} / ${total}`, 10, c.muted, { align: "left", rtl: false })],
      th.fonts.body,
      "number",
      "middle",
    ),
  );
  return { bg: c.bg, prims, notes: s.notes };
}

function cardsBody(
  points: Point[],
  th: SlideTheme,
  top: number,
  sectionNumber: number,
  fontPt: number,
): Prim[] | null {
  const c = th.colors;
  const lead = points[0].kind === "lead" ? points[0] : null;
  const items = points.filter((p) => p.kind === "bullet");
  const prims: Prim[] = [];
  let y = top;
  if (lead) {
    const l = fit((k) => [para(lead.text, Math.round(fontPt * k), c.text)], BW, 1.1, 0.8);
    prims.push(text(BX, y, BW, l.h, l.paras, th.fonts.body, "lead"));
    y += l.h + 0.25;
  }
  const n = items.length;
  const short = items.every((p) => pointText(p).length <= 50);
  const cols = n === 4 && !short ? 2 : n;
  const rows = Math.ceil(n / cols);
  const gap = 0.3;
  const cw = (BW - gap * (cols - 1)) / cols;
  const avail = BODY_BOTTOM - y;
  const pad = 0.24;
  const iw = cw - pad * 2;
  const badge = 0.52;
  for (let k = 1.2; k >= 0.75 - 1e-9; k -= 0.05) {
    const size = Math.round(fontPt * k);
    const cards = items.map((p) => {
      const lab = p.label ? [para(p.label, size + 1, c.primary, { bold: true })] : [];
      const desc = [para(p.text, size, c.text)];
      // العنوان بجانب الرقم إن اتسع في سطر واحد، وإلا تحته بكامل عرض البطاقة
      const besideW = iw - badge - 0.14;
      const beside = !lab.length || parasHeight(lab, besideW) <= badge;
      const lw = beside ? besideW : iw;
      const lh = lab.length ? (beside ? badge : parasHeight(lab, iw)) : badge;
      const ly = beside ? 0 : badge + 0.12;
      const dh = parasHeight(desc, iw);
      return { lab, desc, lw, lh, ly, dh, need: pad + ly + lh + 0.14 + dh + pad };
    });
    const need = Math.max(...cards.map((x) => x.need));
    if (need * rows + gap * (rows - 1) > avail) continue;
    const ch = Math.min(avail / rows - (rows > 1 ? gap / 2 : 0), Math.max(need, 1.9));
    const y0 = y + Math.max(0, (avail - (ch * rows + gap * (rows - 1))) / 2);
    cards.forEach((cd, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = BX + BW - (col + 1) * cw - col * gap;
      const cy = y0 + row * (ch + gap);
      prims.push({
        t: "rect",
        x,
        y: cy,
        w: cw,
        h: ch,
        fill: c.surface,
        radius: 0.12,
        line: c.line,
        lineW: 1,
      });
      prims.push({
        t: "rect",
        x: x + cw - 0.07,
        y: cy + 0.25,
        w: 0.07,
        h: ch - 0.5,
        fill: i % 2 ? c.secondary : c.primary,
      });
      const bx = x + cw - pad - badge;
      prims.push({
        t: "ellipse",
        x: bx,
        y: cy + pad,
        w: badge,
        h: badge,
        fill: i % 2 ? c.secondary : c.primary,
      });
      prims.push(
        text(
          bx,
          cy + pad,
          badge,
          badge,
          [para(String(i + 1), 15, c.onPrimary, { bold: true, align: "center", rtl: false })],
          th.fonts.head,
          "badge",
          "middle",
        ),
      );
      if (cd.lab.length)
        prims.push(
          text(
            x + pad,
            cy + pad + cd.ly,
            cd.lw,
            cd.lh,
            cd.lab,
            th.fonts.head,
            "card-label",
            cd.ly ? "top" : "middle",
          ),
        );
      if (!cd.lab.length || cd.ly)
        prims.push({
          t: "icon",
          x: x + pad,
          y: cy + pad + 0.06,
          w: 0.4,
          h: 0.4,
          name: icon(th, sectionNumber + i),
          color: c.accent,
        });
      prims.push(
        text(
          x + pad,
          cy + pad + cd.ly + cd.lh + 0.14,
          iw,
          cd.dh,
          cd.desc,
          th.fonts.body,
          "card-text",
        ),
      );
    });
    return prims;
  }
  return null;
}

function contentSlide(
  s: Extract<Slide, { kind: "content" }>,
  th: SlideTheme,
  opts: DeckOptions,
  n: number,
  total: number,
): LaidSlide {
  const c = th.colors;
  const m = DENSITY_METRICS[opts.density];
  const kicker = s.parts > 1 ? `${s.kicker} · ${s.part}/${s.parts}` : s.kicker;
  const ch = chrome(th, kicker, s.title, n, total);
  const prims = ch.prims;
  const top = ch.bodyTop;
  const avail = BODY_BOTTOM - top;

  if (s.layout === "cards") {
    const cards = cardsBody(s.points, th, top, s.sectionNumber, m.fontPt);
    if (cards) return { bg: c.bg, prims: [...prims, ...cards], notes: s.notes };
  }
  if (s.layout === "statement") {
    const p = s.points[0];
    const len = pointText(p).length;
    const base = len <= 140 ? 28 : len <= 220 ? 24 : 22;
    const tw = BW - 2.2;
    const st = fit(
      (k) => {
        const runs: TRun[] = p.label
          ? [{ text: `${p.label}: `, bold: true, color: c.primary }, { text: p.text }]
          : [{ text: p.text }];
        return [
          { runs, size: Math.round(base * k), color: c.text, align: "right" as const, rtl: !p.ltr },
        ];
      },
      tw,
      avail - 0.4,
      0.6,
    );
    const ty = top + (avail - st.h) / 2;
    prims.push({ t: "rect", x: BX + BW - 0.1, y: ty - 0.1, w: 0.1, h: st.h + 0.2, fill: c.accent });
    prims.push(text(BX + 1.9, ty, tw, st.h, st.paras, th.fonts.head, "statement"));
    prims.push({
      t: "ellipse",
      x: BX,
      y: top + avail / 2 - 0.8,
      w: 1.6,
      h: 1.6,
      fill: c.primary,
      alpha: 0.1,
    });
    prims.push({
      t: "icon",
      x: BX + 0.4,
      y: top + avail / 2 - 0.4,
      w: 0.8,
      h: 0.8,
      name: icon(th, s.sectionNumber),
      color: c.primary,
    });
    return { bg: c.bg, prims, notes: s.notes };
  }
  const body = fit(
    (k) => pointParas(s.points, th, m.fontPt, m.subPt, m.gapPt, k),
    BW,
    avail,
    0.72,
    1.25,
  );
  prims.push(text(BX, top, BW, Math.min(avail, body.h + 0.05), body.paras, th.fonts.body, "body"));
  return { bg: c.bg, prims, notes: s.notes };
}

function referencesSlide(
  s: Extract<Slide, { kind: "references" }>,
  th: SlideTheme,
  n: number,
  total: number,
): LaidSlide {
  const c = th.colors;
  const ch = chrome(
    th,
    s.parts > 1 ? `المراجع · ${s.part}/${s.parts}` : "المراجع",
    s.title,
    n,
    total,
  );
  const avail = BODY_BOTTOM + 0.15 - ch.bodyTop;
  const body = fit(
    (k) => pointParas(s.points, th, 14, 15, 6, k, s.startIndex),
    BW,
    avail,
    0.75,
    1.2,
  );
  ch.prims.push(
    text(
      BX,
      ch.bodyTop,
      BW,
      Math.min(avail, body.h + 0.05),
      body.paras,
      th.fonts.body,
      "references",
    ),
  );
  return { bg: c.bg, prims: ch.prims, notes: s.notes };
}

function closingSlide(s: Extract<Slide, { kind: "closing" }>, th: SlideTheme): LaidSlide {
  const c = heroColors(th);
  const prims: Prim[] = [];
  prims.push(...motif(th, { x: 0.5, y: 0.6, w: 1.4, h: 6.2 }, c.text, c.accent));
  prims.push({ t: "rect", x: SLIDE_W - 0.16, y: 0, w: 0.16, h: SLIDE_H, fill: c.accent });
  prims.push({ t: "ellipse", x: SLIDE_W / 2 - 0.65, y: 1.35, w: 1.3, h: 1.3, fill: c.accent });
  prims.push({
    t: "icon",
    x: SLIDE_W / 2 - 0.35,
    y: 1.65,
    w: 0.7,
    h: 0.7,
    name: th.icons[0],
    color: c.bg,
  });
  const w = 9.2;
  const x = (SLIDE_W - w) / 2;
  const t = fit(
    (k) => [para(s.title, Math.round(46 * k), c.text, { bold: true, align: "center" })],
    w,
    1.5,
    0.7,
  );
  prims.push(text(x, 3.0, w, t.h, t.paras, th.fonts.head, "title"));
  prims.push({
    t: "rect",
    x: SLIDE_W / 2 - 0.7,
    y: 3.0 + t.h + 0.15,
    w: 1.4,
    h: 0.07,
    fill: c.accent,
  });
  const st = fit(
    (k) => [para(s.subtitle, Math.round(20 * k), c.text, { align: "center" })],
    w,
    1.4,
    0.7,
  );
  prims.push(text(x, 3.0 + t.h + 0.45, w, st.h, st.paras, th.fonts.body, "subtitle"));
  return { bg: c.bg, prims, notes: s.notes };
}

export function layoutDeck(deck: SlideDeck, th: SlideTheme, opts: DeckOptions): LaidSlide[] {
  const total = deck.slides.length;
  return deck.slides.map((s, i) => {
    const n = i + 1;
    switch (s.kind) {
      case "cover":
        return coverSlide(s, th);
      case "agenda":
        return agendaSlide(s, th, n, total);
      case "section":
        return sectionSlide(s, th);
      case "question":
        return questionSlide(s, th, n, total);
      case "content":
        return contentSlide(s, th, opts, n, total);
      case "references":
        return referencesSlide(s, th, n, total);
      case "closing":
        return closingSlide(s, th);
    }
  });
}
