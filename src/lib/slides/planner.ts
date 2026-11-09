// مخطِّط العرض التقديمي: يحوّل التحليل البنيوي المشترك (analyzeResearchText) إلى شرائح منطقية.
// يعتمد نفس منهجية نظام البحوث: أقسام أكاديمية ← عناصر (فقرات/نقاط/عناوين فرعية) ← توزيع بميزانية مساحة،
// مع استبدال ميزانية ارتفاع صفحة A4 بميزانية مساحة متن الشريحة، وتحويل الفقرات إلى نقاط قصيرة.
import {
  formatBulletContent,
  type AnalyzedItem,
  type AnalyzedSection,
  type ResearchAnalysis,
} from "../parser";
import { BODY_BOX, DENSITY_METRICS, pointHeight, pointText, type BodyMetrics } from "./metrics";
import type {
  AgendaEntry,
  ContentLayout,
  CoverMeta,
  DeckOptions,
  Point,
  Slide,
  SlideDeck,
} from "./types";

const ORDINALS = [
  "الأول",
  "الثاني",
  "الثالث",
  "الرابع",
  "الخامس",
  "السادس",
  "السابع",
  "الثامن",
  "التاسع",
  "العاشر",
];

export const DEFAULT_DECK_OPTIONS: DeckOptions = {
  density: "balanced",
  includeAgenda: true,
  includeSectionDividers: true,
  includeReferences: true,
  includeClosing: true,
  includeNotes: true,
};

interface Group {
  title: string;
  points: Point[];
  notes: string[];
}
interface MatlabNode {
  kicker: string;
  title: string;
  groups: Group[];
}
interface MabhathNode {
  kicker: string;
  title: string;
  matalib: MatlabNode[];
}
interface Outline {
  intro: Group[];
  question: string;
  mabahith: MabhathNode[];
  conclusion: Group[];
  references: Point[];
  footnotes: string[];
}

// ---------- أدوات معالجة النص ----------

const stripTags = (html: string) =>
  html
    .replace(/<sup>.*?<\/sup>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const isLatin = (t: string) => {
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  const arabic = (t.match(/[\u0600-\u06FF]/g) || []).length;
  return latin > arabic;
};

/** فصل «المبحث الأول: العنوان» إلى بادئة وعنوان */
export function splitHeading(raw: string): { kicker: string; title: string } {
  const t = raw.replace(/^#+\s*/, "").trim();
  const m = t.match(/^((?:ال)?(?:مبحث|مطلب|فصل|فرع|محور)\s+[^:：\-–—]{1,20}?)\s*[:：\-–—]\s*(.+)$/);
  if (m) return { kicker: m[1].trim(), title: m[2].trim() };
  return { kicker: "", title: t.replace(/[:：]\s*$/, "") };
}

const tidy = (t: string) =>
  t
    .replace(/^[•\-*–—\s]+/, "")
    .replace(/\s*\.\s*$/, "")
    .trim();

/** تقسيم الفقرة إلى جمل (نفس قاعدة splitLongParagraph في المحلل) ثم تقسيم الجمل الطويلة عند الفواصل المنطقية */
function splitSentences(text: string, maxChars = 230): string[] {
  const out: string[] = [];
  text
    .split(/(?<=[.!?؟])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => {
      if (s.length <= maxChars) return out.push(s);
      const clauses = s.split(
        /(?<=[؛;])\s+|(?<=،)\s+(?=(?:إذ|حيث|مما|كما|بينما|غير|لذلك|ولذلك|وذلك|بل|ثم)\s)/,
      );
      let cur = "";
      clauses.forEach((c) => {
        if (cur && (cur + " " + c).length > maxChars) {
          out.push(cur.trim());
          cur = c;
        } else cur = cur ? `${cur} ${c}` : c;
      });
      if (cur.trim()) out.push(cur.trim());
    });
  return out;
}

function labelled(text: string): Point {
  const m = text.match(/^([^:：،.]{2,55}?)\s*[:：]\s*(.{3,})$/);
  if (m && m[1].split(/\s+/).length <= 8)
    return { kind: "bullet", label: m[1].trim(), text: tidy(m[2]) };
  return { kind: "bullet", text: tidy(text) };
}

function itemToPoints(it: AnalyzedItem): Point[] {
  if (it.type === "subtitle" || it.type === "matlab_header") {
    const t = stripTags(it.rawText || it.cleanText).replace(/[:：]\s*$/, "");
    return t ? [{ kind: "sub", text: t }] : [];
  }
  if (it.type === "bullet") {
    // إعادة استعمال منسق القوائم الأكاديمي لعزل علامات التعداد (أولاً، 1-، أ-، [1])
    const html = formatBulletContent(it.rawText);
    const body = stripTags(html.replace(/^<strong>[^<]*<\/strong>\s*/, ""));
    const text = tidy(body);
    if (!text) return [];
    if (text.length > 260) return paragraphToPoints(text);
    return [{ ...labelled(text), ...(isLatin(text) ? { ltr: true } : {}) }];
  }
  return paragraphToPoints(stripTags(it.rawText));
}

function paragraphToPoints(text: string): Point[] {
  if (!text) return [];
  if (/[:：]$/.test(text) && text.length <= 170) return [{ kind: "lead", text }];
  return splitSentences(text).map((s) =>
    /[:：]$/.test(s) ? { kind: "lead", text: s } : { kind: "bullet", text: tidy(s), prose: true },
  );
}

/** تجميع نقاط القسم في مجموعات يبدأ كل منها بعنوان فرعي */
function toGroups(sec: AnalyzedSection): Group[] {
  const groups: Group[] = [];
  let cur: Group = { title: "", points: [], notes: [] };
  const flush = () => {
    if (cur.points.length) groups.push(cur);
  };
  sec.items.forEach((it) => {
    const pts = itemToPoints(it);
    const plain = stripTags(it.rawText || it.cleanText);
    pts.forEach((p) => {
      const headingLike =
        p.kind === "sub" || (p.kind === "lead" && p.text.split(/\s+/).length <= 5);
      if (headingLike) {
        flush();
        cur = { title: p.text.replace(/[:：]\s*$/, ""), points: [], notes: [] };
      } else cur.points.push(p);
    });
    if (plain) cur.notes.push(plain);
  });
  flush();
  return groups;
}

// ---------- بناء الهيكل المنطقي من التحليل ----------

export function buildOutline(a: ResearchAnalysis): Outline {
  const o: Outline = {
    intro: [],
    question: "",
    mabahith: [],
    conclusion: [],
    references: [],
    footnotes: [],
  };
  const seenFn = new Set<string>();

  a.sections.forEach((sec) => {
    sec.rawFootnotes.forEach((f) => {
      const t = f.text.trim();
      if (t && !seenFn.has(t)) {
        seenFn.add(t);
        o.footnotes.push(t);
      }
    });

    if (sec.type === "intro") o.intro.push(...toGroups(sec));
    else if (sec.type === "conclusion") o.conclusion.push(...toGroups(sec));
    else if (sec.type === "references") {
      sec.items.forEach((it) =>
        o.references.push(
          ...itemToPoints(it).map((p) =>
            p.kind === "bullet" ? { ...p, label: undefined, text: pointText(p) } : p,
          ),
        ),
      );
    } else {
      // المطلب: يفتح مبحثاً جديداً إن حمل عنوان مبحث، وإلا يتبع المبحث الجاري
      if (sec.mabhathTitle.trim() || o.mabahith.length === 0) {
        const h = splitHeading(sec.mabhathTitle || "");
        const n = o.mabahith.length;
        o.mabahith.push({
          kicker: h.kicker || `المحور ${ORDINALS[n] || n + 1}`,
          title: h.title || a.detectedTitle || "محاور العرض",
          matalib: [],
        });
      }
      const h = splitHeading(sec.matlabTitle || "");
      o.mabahith[o.mabahith.length - 1].matalib.push({
        kicker: h.kicker,
        title: h.title,
        groups: toGroups(sec),
      });
    }
  });

  // استخراج الإشكالية (آخر تساؤل في المقدمة) لعرضها في شريحة مستقلة
  for (let g = o.intro.length - 1; g >= 0 && !o.question; g--) {
    const pts = o.intro[g].points;
    for (let i = pts.length - 1; i >= 0; i--) {
      if (/[؟?]\s*$/.test(pts[i].text)) {
        let q = pts[i].text;
        if (q.includes(":")) q = q.slice(q.lastIndexOf(":") + 1);
        o.question = q.trim().replace(/^ف(?=(?:كيف|ما|هل|إلى|لماذا|متى|أين|من)\s)/, "");
        pts.splice(i, 1);
        break;
      }
    }
  }
  o.intro = o.intro.filter((g) => g.points.length);
  return o;
}

// ---------- التوزيع على الشرائح بميزانية المساحة ----------

/** توزيع متوازن: يحدد عدد الشرائح اللازم ثم يملؤها بالتساوي، ويمنع بقاء جملة تمهيدية في آخر الشريحة */
export function chunkPoints(
  points: Point[],
  m: BodyMetrics,
  widthIn = BODY_BOX.w,
  budgetIn = BODY_BOX.h,
): Point[][] {
  if (!points.length) return [];
  const hs = points.map((p) => pointHeight(p, widthIn, m));
  const total = hs.reduce((a, b) => a + b, 0);
  const n = Math.max(1, Math.ceil(total / budgetIn));
  const target = total / n;
  const chunks: Point[][] = [];
  let cur: Point[] = [];
  let h = 0;
  points.forEach((p, i) => {
    const over = h + hs[i] > budgetIn;
    const balanced = chunks.length < n - 1 && h >= target * 0.9 && h + hs[i] > target * 1.1;
    if (cur.length && (over || balanced)) {
      const carry: Point[] = [];
      while (cur.length > 1 && cur[cur.length - 1].kind !== "bullet") carry.unshift(cur.pop()!);
      chunks.push(cur);
      cur = carry;
      h = carry.reduce((a, c) => a + pointHeight(c, widthIn, m), 0);
    }
    cur.push(p);
    h += hs[i];
  });
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** يختار شكل الشريحة حسب طبيعة المحتوى، وقد يحوّل جملة افتتاحية إلى تمهيد فوق البطاقات */
export function shapeChunk(input: Point[]): { points: Point[]; layout: ContentLayout } {
  let points = input;
  const bulletsIn = points.filter((p) => p.kind === "bullet");
  // جملة عامة تسبق نقاطاً معنونة: تُعرض تمهيداً لا بطاقةً مستقلة
  if (
    points[0]?.kind === "bullet" &&
    !points[0].label &&
    bulletsIn.length >= 3 &&
    bulletsIn.slice(1).every((b) => b.label)
  ) {
    points = [{ ...points[0], kind: "lead" }, ...points.slice(1)];
  }
  const bullets = points.filter((p) => p.kind === "bullet");
  const leadFirst = points.length === bullets.length + 1 && points[0].kind === "lead";
  if (points.length === 1 && points[0].kind !== "sub" && pointText(points[0]).length <= 280)
    return { points, layout: "statement" };
  const labelled = bullets.some((b) => b.label);
  if (
    bullets.length >= 2 &&
    bullets.length <= 4 &&
    (bullets.length === points.length || leadFirst) &&
    bullets.every((b) => !b.ltr && pointText(b).length <= (labelled ? 150 : 110)) &&
    (labelled || bullets.every((b) => !b.prose)) &&
    (bullets.length >= 3 || labelled)
  )
    return { points, layout: "cards" };
  return { points: input, layout: "list" };
}

export const chooseLayout = (points: Point[]): ContentLayout => shapeChunk(points).layout;

function contentSlides(
  group: Group,
  kicker: string,
  fallbackTitle: string,
  sectionNumber: number,
  opts: DeckOptions,
): Slide[] {
  const m = DENSITY_METRICS[opts.density];
  const chunks = chunkPoints(group.points, m);
  const notes = opts.includeNotes && group.notes.length ? group.notes.join("\n\n") : undefined;
  return chunks.map((pts, i) => ({
    kind: "content" as const,
    kicker,
    title: group.title || fallbackTitle,
    ...shapeChunk(pts),
    part: i + 1,
    parts: chunks.length,
    sectionNumber,
    notes,
  }));
}

function splitBalanced<T>(items: T[], maxPer: number): T[][] {
  const n = Math.max(1, Math.ceil(items.length / maxPer));
  const per = Math.ceil(items.length / n);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
  return out;
}

export function planDeck(
  a: ResearchAnalysis,
  meta: CoverMeta,
  opts: DeckOptions = DEFAULT_DECK_OPTIONS,
): SlideDeck {
  const o = buildOutline(a);
  const title = meta.title.trim() || a.detectedTitle || "عرض تقديمي";
  const slides: Slide[] = [{ kind: "cover", meta: { ...meta, title } }];

  const refs: Point[] = o.references.length
    ? o.references
    : o.footnotes.map((t) => ({
        kind: "bullet" as const,
        text: t,
        ...(isLatin(t) ? { ltr: true } : {}),
      }));
  const showRefs = opts.includeReferences && refs.some((r) => r.kind === "bullet");

  // 1. خطة العرض (من شجرة المباحث والمطالب)
  if (opts.includeAgenda) {
    const entries: AgendaEntry[] = [];
    if (o.intro.length || o.question) entries.push({ title: "المقدمة والإشكالية", children: [] });
    o.mabahith.forEach((mb) =>
      entries.push({ title: mb.title, children: mb.matalib.map((mt) => mt.title).filter(Boolean) }),
    );
    if (o.conclusion.length) entries.push({ title: "الخاتمة والنتائج", children: [] });
    if (showRefs) entries.push({ title: "المصادر والمراجع", children: [] });
    if (entries.length >= 2) {
      const maxPer = entries.some((e) => e.children.length) ? 6 : 7;
      const parts = splitBalanced(entries, maxPer);
      let idx = 0;
      parts.forEach((p, i) => {
        slides.push({
          kind: "agenda",
          title: "خطة العرض",
          entries: p,
          startIndex: idx,
          part: i + 1,
          parts: parts.length,
        });
        idx += p.length;
      });
    }
  }

  // 2. المقدمة ثم الإشكالية
  o.intro.forEach((g) => slides.push(...contentSlides(g, "المقدمة", "مدخل إلى الموضوع", 0, opts)));
  if (o.question) slides.push({ kind: "question", kicker: "إشكالية البحث", text: o.question });

  // 3. المباحث: شريحة فاصلة لكل مبحث ثم مطالبه
  o.mabahith.forEach((mb, i) => {
    if (opts.includeSectionDividers) {
      slides.push({
        kind: "section",
        number: i + 1,
        kicker: mb.kicker,
        title: mb.title,
        children: mb.matalib.map((mt) => mt.title).filter(Boolean),
      });
    }
    mb.matalib.forEach((mt) => {
      const kicker = [mb.kicker, mt.kicker].filter(Boolean).join(" · ");
      mt.groups.forEach((g) => {
        const grp = g.title ? g : { ...g, title: mt.title || mb.title };
        slides.push(
          ...contentSlides(
            grp,
            g.title ? [kicker, mt.title].filter(Boolean).join(" · ") : kicker,
            mt.title || mb.title,
            i + 1,
            opts,
          ),
        );
      });
    });
  });

  // 4. الخاتمة
  o.conclusion.forEach((g) => slides.push(...contentSlides(g, "الخاتمة", "الخاتمة", 0, opts)));

  // 5. المراجع
  if (showRefs) {
    const m: BodyMetrics = { fontPt: 14, subPt: 15, gapPt: 6 };
    const chunks = chunkPoints(refs, m, BODY_BOX.w, BODY_BOX.h + 0.3);
    let start = 0;
    chunks.forEach((pts, i) => {
      slides.push({
        kind: "references",
        title: "قائمة المصادر والمراجع",
        points: pts,
        startIndex: start,
        part: i + 1,
        parts: chunks.length,
      });
      start += pts.filter((p) => p.kind === "bullet").length;
    });
  }

  // 6. الختام
  if (opts.includeClosing)
    slides.push({ kind: "closing", title: "شكراً لحسن الإصغاء", subtitle: title });

  return { title, slides, structure: o.mabahith.map((mb) => mb.matalib.length) };
}
