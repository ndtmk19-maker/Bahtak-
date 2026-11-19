// توزيع عناصر البحث المحللة على صفحات A4 بدقة تحاكي الطباعة الفعلية.
//
// أسباب الفراغات القديمة التي يعالجها هذا الملف:
// 1. الفقرة كانت وحدة غير قابلة للتجزئة (حتى 750 حرفاً ≈ 9 أسطر)؛ إذا لم تتسع تُنقل كاملة فتترك فراغاً كبيراً.
//    الآن تُجزأ الفقرات والنقاط الطويلة على حدود الكلمات لملء آخر سطر متاح مع منع الأسطر اليتيمة.
// 2. سقف الارتفاع الثابت (230mm) مع تقديرات تقريبية للأسطر والهوامش. الآن تُقاس الأسطر فعلياً بخط الصفحة
//    وتُحسب السعة من هندسة paper.css (≈ 249mm بعد هامش أمان 3%) وتُخصم الهوامش السفلية بدقة.
// 3. كان كل مبحث يبدأ بصفحة جديدة حتى لو بقيت الصفحة السابقة بأسطر قليلة. الآن (smart) يستمر المبحث
//    في الصفحة الحالية إذا كانت شبه فارغة، مع إبقاء المراجع دائماً في صفحة مستقلة.
// 4. الجداول الطويلة تُقسم بين الصفحات مع تكرار الرأس و«تابع الجدول»، والأشكال/الجداول القصيرة تطفو إلى
//    أعلى الصفحة التالية بينما يُملأ الفراغ الحالي بالنص الموالي (الأعراف المعتمدة في الإخراج الأكاديمي).
import type { AnalyzedCitation, AnalyzedItem, AnalyzedSection, ResearchAnalysis } from './parser';
import type { ResearchLanguage, ResearchPage } from '../types';
import { escapeHtml } from './escape';
import {
  CHART_VIEW_WIDTH,
  chartViewHeight,
  figureLabel,
  renderFigureHtml,
  renderTableHtml,
  tableColumnWeights,
  tableLabel,
  type ChartData,
  type TableData,
} from './docBlocks';
import {
  createTextMeasurer,
  lineMm,
  resolvePageMetrics,
  type LayoutOptions,
  type PageMetrics,
  type TextMeasurer,
} from './layoutMetrics';

export interface PaginationDeps {
  /** منسق النقاط الأكاديمي (أولاً، 1-، أ-) المعرّف في parser.ts */
  formatBullet: (text: string) => string;
}

export interface PaginationResult {
  pages: ResearchPage[];
  planText: string;
}

interface PlacedBlock {
  /** عنصر قائمة يُجمع مع جيرانه داخل <ul> */
  list: boolean;
  html: string;
  citations: AnalyzedCitation[];
}

interface PageState {
  blocks: PlacedBlock[];
  mabhath: string;
  matlab: string;
  usedMm: number;
  footnoteTexts: string[];
  footnoteMm: number;
}

type PlanEntry =
  | { type: 'intro' | 'conclusion' | 'references'; pageNum: number }
  | { type: 'mabhath' | 'matlab'; title: string; pageNum: number };

type FloatItem = { kind: 'table'; item: AnalyzedItem; table: TableData } | { kind: 'figure'; item: AnalyzedItem; chart: ChartData };

// ===== ثوابت مستخرجة من paper.css =====
const PX = 25.4 / 96;
const MABHATH_PT = 15.5;
const MATLAB_PT = 13.5;
const SUBTITLE_PT = 11.8;
const FOOTNOTE_PT = 9;
const FOOTNOTE_LH = 1.42;
const PARAGRAPH_GAP = 2.2; // .doc-paragraph margin-bottom
const PARAGRAPH_INDENT = 8; // .doc-paragraph text-indent
const LIST_INDENT = 6.5; // .doc-ul padding-right
const LIST_ITEM_GAP = 1.8; // .doc-li margin-bottom
const LIST_MARGINS = 1.5 + 2.5; // .doc-ul margin-top + margin-bottom
const FOOTNOTE_SEPARATOR = 1.5 + PX; // .doc-separator
const TABLE_FONT_RATIO = 0.86; // .doc-table font-size
const TABLE_LH = 1.4;
const CAPTION_FONT_RATIO = 0.92;
const SOURCE_FONT_RATIO = 0.8;
const BLOCK_MARGINS = 2.5 + 3; // .doc-table-block / .doc-figure margins
const CHART_MAX_WIDTH = 150; // .doc-chart svg max-width

/** أقل عدد أسطر مسموح في طرفي فقرة مجزأة (منع الأسطر اليتيمة والأرملة) */
const MIN_SPLIT_LINES = 2;
/** أقل فراغ يستحق تأجيل جدول/شكل لملئه بالنص الموالي */
const MIN_FLOAT_GAP_MM = 25;

export function paginateResearch(
  analysis: ResearchAnalysis,
  options: LayoutOptions | undefined,
  deps: PaginationDeps,
): PaginationResult {
  const M: PageMetrics = resolvePageMetrics(options);
  const measure: TextMeasurer = createTextMeasurer(M.fontFamily);
  const W = M.columnWidthMm;
  const bodyLine = lineMm(M.fontSizePt, M.lineHeight);

  const pages: ResearchPage[] = [];
  const plan: PlanEntry[] = [];
  let floats: FloatItem[] = [];
  let page: PageState = blankPage();

  function blankPage(): PageState {
    return { blocks: [], mabhath: '', matlab: '', usedMm: 0, footnoteTexts: [], footnoteMm: 0 };
  }

  // ---------- قياس الارتفاعات ----------
  const mabhathTitleMm = (t: string) =>
    measure.countLines(t, W, MABHATH_PT, { bold: true }) * lineMm(MABHATH_PT, M.lineHeight) + 4 + 2 + 2 * PX;
  const matlabTitleMm = (t: string) =>
    measure.countLines(t, W - 3 - 4 * PX, MATLAB_PT, { bold: true }) * lineMm(MATLAB_PT, M.lineHeight) + 3 + 2.5;
  const subtitleMm = (t: string) =>
    measure.countLines(t, W, SUBTITLE_PT, { bold: true }) * lineMm(SUBTITLE_PT, M.lineHeight) + 2 + 1.2;
  const footnoteMm = (t: string) =>
    measure.countLines(t, M.footerWidthMm, FOOTNOTE_PT) * lineMm(FOOTNOTE_PT, FOOTNOTE_LH) + 0.8;

  const tableFontPt = M.fontSizePt * TABLE_FONT_RATIO;
  const captionPt = M.fontSizePt * CAPTION_FONT_RATIO;
  const sourcePt = M.fontSizePt * SOURCE_FONT_RATIO;
  const captionMm = (label: string) => measure.countLines(label, W, captionPt, { bold: true }) * lineMm(captionPt, TABLE_LH) + 1.5;
  const sourceMm = (src: string) => (src ? measure.countLines(`المصدر: ${src}`, W, sourcePt) * lineMm(sourcePt, TABLE_LH) + 1.2 : 0);

  function tableRowMm(table: TableData, cells: string[], header: boolean): number {
    const weights = tableColumnWeights(table);
    let maxLines = 1;
    cells.forEach((c, ci) => {
      const cellW = Math.max(6, W * (weights[ci] ?? 1 / cells.length) - 3.2);
      maxLines = Math.max(maxLines, measure.countLines(c, cellW, tableFontPt, { bold: header }));
    });
    return maxLines * lineMm(tableFontPt, TABLE_LH) + (header ? 2.4 : 2) + PX;
  }

  function tableMm(table: TableData, num: number, from: number, to: number, continued: boolean, withSource = false): number {
    let h = BLOCK_MARGINS + captionMm(tableLabel(num, table.caption, continued)) + tableRowMm(table, table.headers, true);
    for (let r = from; r < to; r++) h += tableRowMm(table, table.rows[r], false);
    return h + (withSource ? sourceMm(table.source) : 0);
  }

  function figureMm(chart: ChartData, num: number): number {
    const widthMm = Math.min(W, CHART_MAX_WIDTH);
    return BLOCK_MARGINS + (widthMm * chartViewHeight(chart)) / CHART_VIEW_WIDTH + captionMm(figureLabel(num, chart.title)) + sourceMm(chart.source);
  }

  // ---------- محاسبة المساحة والهوامش ----------
  const available = () => M.bodyCapacityMm - page.usedMm - page.footnoteMm;
  const hasContent = () => page.blocks.length > 0 || Boolean(page.mabhath) || Boolean(page.matlab);

  function citationsIn(html: string, cits: AnalyzedCitation[]): AnalyzedCitation[] {
    return cits.filter((c) => html.includes(`<sup>${c.origNum}</sup>`));
  }

  /** كلفة الهوامش الجديدة التي يضيفها عنصر إلى الصفحة الحالية (الهامش المكرر لا يُحسب مرتين) */
  function footnoteCost(cits: AnalyzedCitation[]): number {
    const seen = new Set(page.footnoteTexts);
    let count = page.footnoteTexts.length;
    let mm = 0;
    for (const c of cits) {
      if (!c.text || seen.has(c.text)) continue;
      seen.add(c.text);
      mm += footnoteMm(c.text) + (count === 0 ? FOOTNOTE_SEPARATOR : 0);
      count++;
    }
    // الهوامش تقتطع من ارتفاع العمودين معاً في وضع البطاقة
    return mm * M.columns;
  }

  const fits = (h: number, cits: AnalyzedCitation[]) => h + footnoteCost(cits) <= available() + 0.01;

  function commit(block: PlacedBlock, h: number): void {
    page.footnoteMm += footnoteCost(block.citations);
    for (const c of block.citations) {
      if (c.text && !page.footnoteTexts.includes(c.text)) page.footnoteTexts.push(c.text);
    }
    page.blocks.push(block);
    page.usedMm += h;
  }

  const lastIsList = () => page.blocks.length > 0 && page.blocks[page.blocks.length - 1].list;

  // ---------- إصدار الصفحة ----------
  function emitPage(): void {
    if (!hasContent()) return;
    const footnotes: string[] = [];
    let html = '';
    let inList = false;
    for (const b of page.blocks) {
      // إعادة ترقيم الإحالات محلياً لكل صفحة في تمريرة واحدة (تفادي الاستبدال المزدوج)
      const renumbered = b.html.replace(/<sup>(\d+)<\/sup>/g, (m, n: string) => {
        const c = b.citations.find((x) => String(x.origNum) === n);
        if (!c || !c.text) return m;
        let idx = footnotes.indexOf(c.text);
        if (idx === -1) {
          footnotes.push(c.text);
          idx = footnotes.length - 1;
        }
        return `<sup>${idx + 1}</sup>`;
      });
      if (b.list && !inList) {
        html += '<ul class="doc-ul">';
        inList = true;
      } else if (!b.list && inList) {
        html += '</ul>';
        inList = false;
      }
      html += renumbered;
    }
    if (inList) html += '</ul>';
    pages.push({ mabhathTitle: page.mabhath, matlabTitle: page.matlab, content: html, footnotes });
    page = blankPage();
  }

  /** صفحة جديدة: تُوضع العناصر المؤجلة (جداول/أشكال) أعلاها أولاً */
  function newPage(): void {
    emitPage();
    flushFloats();
  }

  function flushFloats(): void {
    if (floats.length === 0) return;
    const pending = floats;
    floats = [];
    for (const f of pending) {
      if (f.kind === 'table') placeTable(f.item, f.table, false);
      else placeFigure(f.item, f.chart, false);
    }
  }

  // ---------- النصوص المتدفقة (فقرات ونقاط) مع التجزئة ----------
  function placeFlowText(item: AnalyzedItem, kind: 'paragraph' | 'bullet'): void {
    let words = item.rawText.split(/\s+/).filter(Boolean);
    let continued = false;
    const width = kind === 'bullet' ? W - LIST_INDENT : W;
    const gap = kind === 'bullet' ? LIST_ITEM_GAP : PARAGRAPH_GAP;

    const render = (text: string, cont: boolean) => {
      if (kind === 'bullet') {
        return cont ? `<li class="doc-li doc-li--cont">${text}</li>` : `<li class="doc-li">${deps.formatBullet(text)}</li>`;
      }
      return `<p class="doc-paragraph${cont ? ' doc-paragraph--cont' : ''}">${text}</p>`;
    };
    const indentOf = (cont: boolean) => (kind === 'paragraph' && !cont ? PARAGRAPH_INDENT : 0);
    const extra = () => (kind === 'bullet' && !lastIsList() ? LIST_MARGINS : 0);
    const linesOf = (text: string, cont: boolean) =>
      measure.countLines(kind === 'bullet' && !cont ? deps.formatBullet(text) : text, width, M.fontSizePt, { indentMm: indentOf(cont) });

    let guard = 0;
    while (words.length > 0 && guard++ < 200) {
      const text = words.join(' ');
      const totalLines = linesOf(text, continued);
      const fullMm = totalLines * bodyLine + gap + extra();
      const cits = citationsIn(text, item.citations);
      if (fits(fullMm, cits)) {
        commit({ list: kind === 'bullet', html: render(text, continued), citations: cits }, fullMm);
        return;
      }

      // محاولة ملء ما تبقى من الصفحة بجزء من النص
      const maxLines = Math.floor((available() - gap - extra()) / bodyLine);
      let k = 0;
      if (maxLines >= MIN_SPLIT_LINES && totalLines >= MIN_SPLIT_LINES * 2) {
        let lineBudget = Math.min(maxLines, totalLines - MIN_SPLIT_LINES);
        while (lineBudget >= MIN_SPLIT_LINES) {
          k = measure.wordsFitting(words, lineBudget, width, M.fontSizePt, { indentMm: indentOf(continued) });
          const chunk = words.slice(0, k).join(' ');
          const chunkMm = linesOf(chunk, continued) * bodyLine + gap + extra();
          if (k > 0 && k < words.length && fits(chunkMm, citationsIn(chunk, item.citations))) break;
          k = 0;
          lineBudget--;
        }
      }

      if (k > 0) {
        const chunk = words.slice(0, k).join(' ');
        const chunkMm = linesOf(chunk, continued) * bodyLine + gap + extra();
        commit({ list: kind === 'bullet', html: render(chunk, continued), citations: citationsIn(chunk, item.citations) }, chunkMm);
        words = words.slice(k);
        continued = true;
        newPage();
        continue;
      }

      if (page.blocks.length === 0) {
        // صفحة فارغة لا يتسع فيها النص كاملاً ولا يمكن تجزئته بأمان: يوضع كما هو
        commit({ list: kind === 'bullet', html: render(text, continued), citations: cits }, fullMm);
        return;
      }
      newPage();
    }
  }

  // ---------- العناوين ----------
  function minFollowingMm(next: AnalyzedItem | undefined): number {
    if (!next) return 0;
    if (next.type === 'paragraph' || next.type === 'bullet') return MIN_SPLIT_LINES * bodyLine + PARAGRAPH_GAP;
    if (next.type === 'subtitle') return subtitleMm(next.cleanText);
    return 3 * bodyLine;
  }

  function placeSubtitle(item: AnalyzedItem, next: AnalyzedItem | undefined): void {
    const h = subtitleMm(item.cleanText);
    // إبقاء العنوان الفرعي مع سطرين على الأقل مما يليه
    if (page.blocks.length > 0 && !fits(h + minFollowingMm(next), item.citations)) newPage();
    commit({ list: false, html: `<div class="doc-subtitle">${item.rawText.replace(/^#+\s*/, '')}</div>`, citations: item.citations }, h);
  }

  // ---------- الجداول ----------
  function placeTable(item: AnalyzedItem, table: TableData, allowFloat: boolean, hasMoreAfter = false): void {
    const num = item.blockNumber ?? 1;
    let from = 0;
    let continued = false;
    let guard = 0;
    while (from < table.rows.length && guard++ < 100) {
      const to = table.rows.length;
      const fullMm = tableMm(table, num, from, to, continued, false);
      const html = renderTableHtml(table, num, { rowStart: from, rowEnd: to, continued });
      const cits = citationsIn(html, item.citations);
      if (fits(fullMm, cits)) {
        commit({ list: false, html, citations: cits }, fullMm);
        return;
      }

      // تقسيم الصفوف: يُشترط صفان على الأقل في كل جزء
      let r = from;
      while (r < to && fits(tableMm(table, num, from, r + 1, continued, false), item.citations)) r++;
      if (to - r < 2) r = to - 2;
      if (r - from >= 2) {
        const part = renderTableHtml(table, num, { rowStart: from, rowEnd: r, continued, showSource: false });
        commit({ list: false, html: part, citations: citationsIn(part, item.citations) }, tableMm(table, num, from, r, continued, false));
        from = r;
        continued = true;
        newPage();
        continue;
      }

      const fitsEmptyPage = fullMm <= M.bodyCapacityMm;
      if (allowFloat && hasMoreAfter && fitsEmptyPage && available() >= MIN_FLOAT_GAP_MM && !continued) {
        floats.push({ kind: 'table', item, table });
        return;
      }
      if (page.blocks.length === 0) {
        commit({ list: false, html, citations: cits }, fullMm);
        return;
      }
      newPage();
    }
  }

  // ---------- الأشكال ----------
  function placeFigure(item: AnalyzedItem, chart: ChartData, allowFloat: boolean, hasMoreAfter = false): void {
    const num = item.blockNumber ?? 1;
    const h = figureMm(chart, num);
    const html = renderFigureHtml(chart, num);
    const cits = citationsIn(html, item.citations);
    if (fits(h, cits) || page.blocks.length === 0) {
      commit({ list: false, html, citations: cits }, h);
      return;
    }
    if (allowFloat && hasMoreAfter && available() >= MIN_FLOAT_GAP_MM) {
      floats.push({ kind: 'figure', item, chart });
      return;
    }
    newPage();
    commit({ list: false, html, citations: cits }, h);
  }

  // ---------- الأقسام ----------
  function startPageTitles(sec: AnalyzedSection): void {
    page.mabhath = sec.mabhathTitle;
    page.matlab = sec.matlabTitle;
    page.usedMm += (sec.mabhathTitle ? mabhathTitleMm(sec.mabhathTitle) : 0) + (sec.matlabTitle ? matlabTitleMm(sec.matlabTitle) : 0);
  }

  function recordMajor(sec: AnalyzedSection): void {
    const pageNum = pages.length + 1;
    if (sec.type === 'intro' || sec.type === 'conclusion' || sec.type === 'references') {
      const type = sec.type;
      if (!plan.some((e) => e.type === type)) plan.push({ type, pageNum });
      return;
    }
    plan.push({ type: 'mabhath', title: sec.mabhathTitle, pageNum });
    if (sec.matlabTitle) plan.push({ type: 'matlab', title: sec.matlabTitle, pageNum });
  }

  for (const sec of analysis.sections) {
    const isMajor =
      sec.type === 'intro' || sec.type === 'conclusion' || sec.type === 'references' || Boolean(sec.mabhathTitle && sec.mabhathTitle.trim());
    const firstMin = Math.min(sec.items[0] ? 3 * bodyLine : 0, available());

    if (isMajor) {
      // العناصر المؤجلة تُوضع قبل الانتقال إلى قسم رئيسي جديد
      if (floats.length > 0) flushFloats();
      // الأقسام الرئيسية (المقدمة، المباحث، الخاتمة، المراجع) تبدأ دائماً في صفحة جديدة
      if (hasContent()) emitPage();
      recordMajor(sec);
      startPageTitles(sec);
    } else {
      // مطلب يتبع المبحث الحالي: يكفي أن يتسع عنوانه مع ثلاثة أسطر من متنه، ويكمل في نفس الصفحة
      const headMm = matlabTitleMm(sec.matlabTitle);
      if (page.blocks.length > 0 && !fits(headMm + firstMin, [])) newPage();
      if (page.blocks.length === 0 && !page.matlab && !page.mabhath) {
        page.matlab = sec.matlabTitle;
        page.usedMm += headMm;
      } else {
        commit({ list: false, html: `<div class="doc-matlab-title">${escapeHtml(sec.matlabTitle)}</div>`, citations: [] }, headMm);
      }
      plan.push({ type: 'matlab', title: sec.matlabTitle, pageNum: pages.length + 1 });
    }

    if (sec.type === 'references') {
      // قائمة المصادر والمراجع: صفحة واحدة فقط بشكل صارم، مع إسقاط أي مراجع إضافية لا تتسع فيها
      let lastSubtitleIndex = -1;
      let itemsUnderSubtitle = 0;

      for (let idx = 0; idx < sec.items.length; idx++) {
        const item = sec.items[idx];
        if (item.type === 'subtitle') {
          // إذا كان التصنيف السابق بلا مراجع، نحذفه لتفادي رأس تصنيف فارغ في أسفل الصفحة
          if (lastSubtitleIndex !== -1 && itemsUnderSubtitle === 0 && page.blocks.length > 0) {
            const popped = page.blocks.pop();
            if (popped) {
              page.usedMm = Math.max(0, page.usedMm - subtitleMm(sec.items[lastSubtitleIndex].cleanText));
            }
          }

          const h = subtitleMm(item.cleanText);
          // نشترط اتساع العنوان مع مرجع واحد على الأقل بعده (~14mm)
          if (!fits(h + 14, [])) {
            break;
          }
          commit({ list: false, html: `<div class="doc-subtitle">${item.rawText.replace(/^#+\s*/, '')}</div>`, citations: [] }, h);
          lastSubtitleIndex = idx;
          itemsUnderSubtitle = 0;
        } else {
          const formatted = deps.formatBullet(item.rawText);
          const width = W - LIST_INDENT;
          const lines = measure.countLines(formatted, width, M.fontSizePt);
          const gap = lastIsList() ? LIST_ITEM_GAP : LIST_MARGINS;
          const itemMm = lines * bodyLine + gap;

          if (!fits(itemMm, [])) {
            // الصفحة امتلأت: لا نفتح صفحة ثانية للمراجع وفق طلب المستخدم
            break;
          }

          commit({ list: true, html: `<li class="doc-li">${formatted}</li>`, citations: [] }, itemMm);
          itemsUnderSubtitle++;
        }
      }

      // تنظيف نهائي لأي عنوان فرعي فارغ في الأسفل
      if (lastSubtitleIndex !== -1 && itemsUnderSubtitle === 0 && page.blocks.length > 0) {
        const lastBlock = page.blocks[page.blocks.length - 1];
        if (lastBlock && !lastBlock.list) {
          page.blocks.pop();
          page.usedMm = Math.max(0, page.usedMm - subtitleMm(sec.items[lastSubtitleIndex].cleanText));
        }
      }

      if (floats.length > 0) flushFloats();
      continue;
    }

    sec.items.forEach((item, idx) => {
      const hasMoreAfter = idx < sec.items.length - 1;
      switch (item.type) {
        case 'subtitle':
          placeSubtitle(item, sec.items[idx + 1]);
          break;
        case 'bullet':
          placeFlowText(item, 'bullet');
          break;
        case 'table':
          if (item.table) placeTable(item, item.table, true, hasMoreAfter);
          break;
        case 'figure':
          if (item.chart) placeFigure(item, item.chart, true, hasMoreAfter);
          break;
        case 'matlab_header':
          commit({ list: false, html: `<div class="doc-matlab-title">${escapeHtml(item.cleanText)}</div>`, citations: [] }, matlabTitleMm(item.cleanText));
          break;
        default:
          placeFlowText(item, 'paragraph');
      }
    });

    // لا يُسمح للعناصر المؤجلة بتجاوز حدود القسم
    if (floats.length > 0) flushFloats();
  }

  if (floats.length > 0) flushFloats();
  emitPage();

  return { pages, planText: buildPlanText(plan, options?.language) };
}

/** إعادة بناء نص خطة البحث بأرقام الصفحات الفعلية */
function buildPlanText(plan: PlanEntry[], lang?: ResearchLanguage): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  const isLatin = lang === 'fr' || lang === 'en';
  const pageLabel = isLatin ? 'p.' : 'ص';
  return plan
    .map((e) => {
      const p = pad(e.pageNum);
      switch (e.type) {
        case 'intro': {
          const title = lang === 'fr' ? 'Introduction' : lang === 'en' ? 'Introduction' : 'المقدمة';
          return `${title} | ${pageLabel} ${p}`;
        }
        case 'conclusion': {
          const title = lang === 'fr' ? 'Conclusion générale' : lang === 'en' ? 'General Conclusion' : 'الخــاتـمـــة';
          return `${title} | ${pageLabel} ${p}`;
        }
        case 'references': {
          const title = lang === 'fr' ? 'Bibliographie' : lang === 'en' ? 'References' : 'قائمة المصادر والمراجع';
          return `${title} | ${pageLabel} ${p}`;
        }
        case 'mabhath':
          return `${e.title} | ${pageLabel} ${p}`;
        default:
          return `- ${e.title} | ${pageLabel} ${p}`;
      }
    })
    .join('\n')
    .trim();
}
