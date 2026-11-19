// مخطِّط العرض التقديمي: يحوّل التحليل البنيوي المشترك (analyzeResearchText) إلى شرائح منطقية.
// يعتمد نفس منهجية نظام البحوث: أقسام أكاديمية ← عناصر (فقرات/نقاط/عناوين فرعية) ← توزيع بميزانية مساحة،
// مع استبدال ميزانية ارتفاع صفحة A4 بميزانية مساحة متن الشريحة، وتحويل الفقرات إلى نقاط قصيرة.
import {
  formatBulletContent,
  type AnalyzedItem,
  type AnalyzedSection,
  type ResearchAnalysis,
} from "../parser";
import {
  isStructuralTitleOnly,
  looksLikePlanLeak,
  sanitizeCoverTitleFromPlanLeak,
  type CustomPlanMabhath,
} from "../aiGenerate";
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
import type { ResearchLanguage } from "../../types";

const ORDINALS_AR = [
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
const ORDINALS_ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

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

/** فصل «المبحث الأول: العنوان» أو «Chapitre I : Titre» أو «Chapter 1: Title» إلى بادئة وعنوان */
export function splitHeading(raw: string, lang: ResearchLanguage = "ar"): { kicker: string; title: string } {
  let t = raw.replace(/^#+\s*/, "").trim();
  let kicker = "";
  for (let pass = 0; pass < 2; pass++) {
    const m = t.match(
      /^((?:(?:ال)?(?:مبحث|مطلب|فصل|فرع|محور)|(?:Chapitre|Section|Partie|Sous-section|Axe)|(?:Chapter|Section|Part|Subsection|Axis))\s+[^:：\-–—]{1,25}?)\s*[:：\-–—]\s*(.+)$/i,
    );
    if (m) {
      const candidateKicker = m[1].trim();
      if (!kicker) {
        kicker = candidateKicker;
      } else if (lang !== "ar" && !isLatin(kicker) && isLatin(candidateKicker)) {
        kicker = candidateKicker;
      }
      t = m[2].trim();
    } else {
      break;
    }
  }
  return { kicker, title: t.replace(/[:：]\s*$/, "") };
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
  const isLat = isLatin(text);
  const m = text.match(/^([^:：،.]{2,55}?)\s*[:：]\s*(.{3,})$/);
  if (m && m[1].split(/\s+/).length <= 8)
    return { kind: "bullet", label: m[1].trim(), text: tidy(m[2]), ...(isLat ? { ltr: true } : {}) };
  return { kind: "bullet", text: tidy(text), ...(isLat ? { ltr: true } : {}) };
}

function itemToPoints(it: AnalyzedItem): Point[] {
  if (it.type === "subtitle" || it.type === "matlab_header") {
    const t = stripTags(it.rawText || it.cleanText).replace(/[:：]\s*$/, "");
    return t ? [{ kind: "sub", text: t, ...(isLatin(t) ? { ltr: true } : {}) }] : [];
  }
  if (it.type === "bullet") {
    // إعادة استعمال منسق القوائم الأكاديمي لعزل علامات التعداد (أولاً، 1-، أ-، [1])
    const html = formatBulletContent(it.rawText);
    const body = stripTags(html.replace(/^<strong>[^<]*<\/strong>\s*/, ""));
    const text = tidy(body);
    if (!text) return [];
    if (text.length > 260) return paragraphToPoints(text);
    return [labelled(text)];
  }
  if (it.type === "table" && it.table) {
    const tbl = it.table;
    const pts: Point[] = [];
    const allTblText = [tbl.caption, ...tbl.headers, ...tbl.rows.flat()].join(" ");
    const isLat = isLatin(allTblText);
    const cleanCaption = tbl.caption
      .replace(/^(?:ال)?(?:الجدول|جدول)\s+رقم\s*\(?\d+\)?\s*[:：\-–—]?\s*/i, "")
      .replace(/^(?:Tableau|Table)\s*(?:n°|no\.?)?\s*\(?\d+\)?\s*[:：\-–—]?\s*/i, "")
      .trim();

    if (cleanCaption) {
      pts.push({ kind: "lead", text: `${cleanCaption}:`, ...(isLat ? { ltr: true } : {}) });
    }

    tbl.rows.slice(0, 4).forEach((r) => {
      const cells = r.map((c) => htmlToPlain(c).trim()).filter(Boolean);
      if (!cells.length) return;
      if (cells.length === 1) {
        pts.push({ kind: "bullet", text: cells[0], ...(isLat ? { ltr: true } : {}) });
      } else {
        const label = cells[0];
        const val = cells.slice(1).join(" — ");
        pts.push({ kind: "bullet", label, text: val, ...(isLat ? { ltr: true } : {}) });
      }
    });

    if (pts.length) return pts;
  }
  return paragraphToPoints(stripTags(it.rawText));
}

function paragraphToPoints(text: string): Point[] {
  if (!text) return [];
  const isLat = isLatin(text);
  if (/[:：]$/.test(text) && text.length <= 170) return [{ kind: "lead", text, ...(isLat ? { ltr: true } : {}) }];
  return splitSentences(text).map((s) => {
    const sLat = isLatin(s);
    return /[:：]$/.test(s)
      ? { kind: "lead", text: s, ...(sLat ? { ltr: true } : {}) }
      : { kind: "bullet", text: tidy(s), prose: true, ...(sLat ? { ltr: true } : {}) };
  });
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

export function buildOutline(a: ResearchAnalysis, lang: ResearchLanguage = "ar"): Outline {
  const o: Outline = {
    intro: [],
    question: "",
    mabahith: [],
    conclusion: [],
    references: [],
    footnotes: [],
  };
  const seenFn = new Set<string>();

  const safeDetectedTitle =
    a.detectedTitle && !looksLikePlanLeak(a.detectedTitle) && !isStructuralTitleOnly(a.detectedTitle)
      ? a.detectedTitle
      : "";

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
      // المطلب: يفتح مبحثاً جديداً إن حمل عنوان مبحث مختلف، وإلا يتبع المبحث الجاري
      if (sec.mabhathTitle.trim() || o.mabahith.length === 0) {
        const h = splitHeading(sec.mabhathTitle || "", lang);
        const lastMb = o.mabahith[o.mabahith.length - 1];
        const isSameAsLast =
          lastMb &&
          sec.mabhathTitle.trim() &&
          (h.title === lastMb.title ||
            (h.kicker && h.kicker === lastMb.kicker) ||
            sec.mabhathTitle.trim().toLowerCase() === `${lastMb.kicker}: ${lastMb.title}`.toLowerCase());

        if (!isSameAsLast) {
          const n = o.mabahith.length;
          const defaultKicker =
            lang === "fr"
              ? `Axe ${ORDINALS_ROMAN[n] || n + 1}`
              : lang === "en"
                ? `Part ${n + 1}`
                : `المحور ${ORDINALS_AR[n] || n + 1}`;
          const defaultTitle =
            lang === "fr"
              ? "Axes de l'exposé"
              : lang === "en"
                ? "Presentation Topics"
                : "محاور العرض";
          o.mabahith.push({
            kicker: h.kicker || defaultKicker,
            title: h.title || safeDetectedTitle || defaultTitle,
            matalib: [],
          });
        }
      }
      const h = splitHeading(sec.matlabTitle || "", lang);
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

function pickCleanTitle(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  return !looksLikePlanLeak(trimmed) && !isStructuralTitleOnly(trimmed) ? trimmed : "";
}

function resolveDeckTitle(
  rawMetaTitle: string,
  rawDetectedTitle: string,
  o: Outline,
): string {
  for (const cand of [rawMetaTitle, rawDetectedTitle]) {
    const clean = pickCleanTitle(cand);
    if (clean) return clean;
    const trimmed = (cand || "").trim();
    if (trimmed) {
      const san = sanitizeCoverTitleFromPlanLeak(trimmed);
      if (
        san.hadLeak &&
        san.extractedPrefix &&
        san.cleaned &&
        !looksLikePlanLeak(san.cleaned) &&
        !isStructuralTitleOnly(san.cleaned)
      ) {
        return san.cleaned;
      }
    }
  }

  const outlineMabahith = o.mabahith
    .map((mb): CustomPlanMabhath | null => {
      const t = (mb.title || "").trim();
      return t && !looksLikePlanLeak(t) && !isStructuralTitleOnly(t)
        ? { title: mb.kicker ? `${mb.kicker}: ${t}` : t, matalib: [] }
        : null;
    })
    .filter((x): x is CustomPlanMabhath => x !== null);

  for (const cand of [rawMetaTitle, rawDetectedTitle]) {
    const trimmed = (cand || "").trim();
    if (!trimmed) continue;
    const san = sanitizeCoverTitleFromPlanLeak(
      trimmed,
      outlineMabahith.length ? outlineMabahith : undefined,
    );
    if (
      san.cleaned &&
      !looksLikePlanLeak(san.cleaned) &&
      !isStructuralTitleOnly(san.cleaned)
    ) {
      return san.cleaned;
    }
  }

  return "عرض تقديمي";
}

export function planDeck(
  a: ResearchAnalysis,
  meta: CoverMeta,
  opts: DeckOptions = DEFAULT_DECK_OPTIONS,
): SlideDeck {
  const lang: ResearchLanguage = meta.language || (isLatin(meta.title || a.detectedTitle || "") ? "fr" : "ar");
  const o = buildOutline(a, lang);
  const title = resolveDeckTitle(meta.title, a.detectedTitle, o);
  const slides: Slide[] = [{ kind: "cover", meta: { ...meta, title, language: lang } }];

  const refs: Point[] = o.references.length
    ? o.references
    : o.footnotes.map((t) => ({
        kind: "bullet" as const,
        text: t,
        ...(isLatin(t) ? { ltr: true } : {}),
      }));
  const showRefs = opts.includeReferences && refs.some((r) => r.kind === "bullet");

  // نصوص وعناوين العرض حسب اللغة المختارة
  const agendaTitle =
    lang === "fr" ? "Sommaire de l'Exposé" : lang === "en" ? "Table of Contents" : "خطة العرض";
  const introEntryTitle =
    lang === "fr"
      ? "Introduction et Problématique"
      : lang === "en"
        ? "Introduction & Problem Statement"
        : "المقدمة والإشكالية";
  const conclusionEntryTitle =
    lang === "fr"
      ? "Conclusion et Perspectives"
      : lang === "en"
        ? "Conclusion & Recommendations"
        : "الخاتمة والنتائج";
  const referencesEntryTitle =
    lang === "fr"
      ? "Sources et Bibliographie"
      : lang === "en"
        ? "References & Bibliography"
        : "المصادر والمراجع";

  // 1. خطة العرض (من شجرة المباحث والمطالب)
  if (opts.includeAgenda) {
    const entries: AgendaEntry[] = [];
    if (o.intro.length || o.question) entries.push({ title: introEntryTitle, children: [] });
    o.mabahith.forEach((mb) => {
      const seenKids = new Set<string>();
      const kids: string[] = [];
      for (const mt of mb.matalib) {
        let rawT = (mt.title || "").trim();
        if (lang !== "ar") {
          rawT = rawT.replace(/^(?:ال)?(?:مطلب|فرع)\s+[^\s:]+\s*[:：\-–—\.]+\s*/i, "").trim();
        }
        if (!rawT) continue;
        const normKey = rawT.toLowerCase().replace(/\s+/g, " ");
        if (!seenKids.has(normKey)) {
          seenKids.add(normKey);
          kids.push(rawT);
        }
      }
      let mbTitle = mb.title;
      if (lang !== "ar") {
        mbTitle = mbTitle.replace(/^(?:ال)?(?:مبحث|فصل|محور)\s+[^\s:]+\s*[:：\-–—\.]+\s*/i, "").trim();
      }
      entries.push({ title: mbTitle, children: kids.slice(0, 3) });
    });
    if (o.conclusion.length) entries.push({ title: conclusionEntryTitle, children: [] });
    if (showRefs) entries.push({ title: referencesEntryTitle, children: [] });
    if (entries.length >= 2) {
      const maxPer = entries.some((e) => e.children.length) ? 6 : 7;
      const parts = splitBalanced(entries, maxPer);
      let idx = 0;
      parts.forEach((p, i) => {
        slides.push({
          kind: "agenda",
          title: agendaTitle,
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
  const introKicker = lang === "fr" ? "Introduction" : lang === "en" ? "Introduction" : "المقدمة";
  const introFallback =
    lang === "fr"
      ? "Introduction générale"
      : lang === "en"
        ? "Introduction & Overview"
        : "مدخل إلى الموضوع";
  const questionKicker =
    lang === "fr" ? "Problématique" : lang === "en" ? "Research Question" : "إشكالية البحث";

  const rawIntroSlides: Slide[] = [];
  o.intro.forEach((g) => rawIntroSlides.push(...contentSlides(g, introKicker, introFallback, 0, opts)));
  const maxIntroSlides = opts.density === "airy" ? 1 : 2;
  const introSlides = rawIntroSlides.slice(0, maxIntroSlides).map((s, idx) => ({
    ...s,
    part: idx + 1,
    parts: Math.min(rawIntroSlides.length, maxIntroSlides),
  }));
  slides.push(...introSlides);
  if (o.question) slides.push({ kind: "question", kicker: questionKicker, text: o.question });

  // 3. المباحث: شريحة فاصلة لكل مبحث ثم مطالبه (بحد أقصى شريحتين لكل مطلب في الوضع القياسي لمنع التضخم)
  const maxSlidesPerMatlab = opts.density === "airy" ? 1 : opts.density === "detailed" ? 3 : 2;

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
      const mtTitle = mt.title || mb.title;

      let mtSlides: Slide[] = [];
      mt.groups.forEach((g) => {
        const grp = g.title ? g : { ...g, title: mtTitle };
        mtSlides.push(
          ...contentSlides(
            grp,
            g.title ? [kicker, mt.title].filter(Boolean).join(" · ") : kicker,
            mtTitle,
            i + 1,
            opts,
          ),
        );
      });

      if (mtSlides.length > maxSlidesPerMatlab) {
        const allPoints = mt.groups.flatMap((g) => {
          if (g.title && g.title !== mtTitle) {
            return [{ kind: "sub" as const, text: g.title, ...(isLatin(g.title) ? { ltr: true } : {}) }, ...g.points];
          }
          return g.points;
        });
        const m = DENSITY_METRICS[opts.density];
        const chunks = chunkPoints(allPoints, m);
        const cappedChunks = chunks.slice(0, maxSlidesPerMatlab);
        mtSlides = cappedChunks.map((pts, idx) => ({
          kind: "content" as const,
          kicker,
          title: mtTitle,
          ...shapeChunk(pts),
          part: idx + 1,
          parts: cappedChunks.length,
          sectionNumber: i + 1,
          notes: opts.includeNotes && mt.groups.flatMap((g) => g.notes).length
            ? mt.groups.flatMap((g) => g.notes).join("\n\n")
            : undefined,
        }));
      } else {
        mtSlides = mtSlides.map((s, idx) => ({
          ...s,
          part: idx + 1,
          parts: mtSlides.length,
        }));
      }

      slides.push(...mtSlides);
    });
  });

  // 4. الخاتمة (بحد أقصى شريحتين)
  const conclusionKicker = lang === "fr" ? "Conclusion" : lang === "en" ? "Conclusion" : "الخاتمة";
  const rawConclusionSlides: Slide[] = [];
  o.conclusion.forEach((g) => rawConclusionSlides.push(...contentSlides(g, conclusionKicker, conclusionKicker, 0, opts)));
  const maxConclusionSlides = opts.density === "airy" ? 1 : 2;
  const conclusionSlides = rawConclusionSlides.slice(0, maxConclusionSlides).map((s, idx) => ({
    ...s,
    part: idx + 1,
    parts: Math.min(rawConclusionSlides.length, maxConclusionSlides),
  }));
  slides.push(...conclusionSlides);

  // 5. المراجع
  const referencesTitle =
    lang === "fr"
      ? "Références Bibliographiques"
      : lang === "en"
        ? "References & Bibliography"
        : "قائمة المصادر والمراجع";
  if (showRefs) {
    const m: BodyMetrics = { fontPt: 14, subPt: 15, gapPt: 6 };
    const chunks = chunkPoints(refs, m, BODY_BOX.w, BODY_BOX.h + 0.3);
    let start = 0;
    chunks.forEach((pts, i) => {
      slides.push({
        kind: "references",
        title: referencesTitle,
        points: pts,
        startIndex: start,
        part: i + 1,
        parts: chunks.length,
      });
      start += pts.filter((p) => p.kind === "bullet").length;
    });
  }

  // 6. الختام
  const closingTitle =
    lang === "fr"
      ? "Merci pour votre attention"
      : lang === "en"
        ? "Thank You for Your Attention"
        : "شكراً لحسن الإصغاء";
  if (opts.includeClosing)
    slides.push({ kind: "closing", title: closingTitle, subtitle: title });

  return { title, slides, structure: o.mabahith.map((mb) => mb.matalib.length), language: lang };
}
