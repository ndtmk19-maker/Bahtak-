// @ts-nocheck — مرحلة التحليل البنيوي موروثة من المشروع الأصلي بصيغة JavaScript؛
// الأجزاء الجديدة (الجداول/الأشكال/التوزيع) مكتوبة بـ TypeScript صارم في docBlocks.ts و paginator.ts و layoutMetrics.ts.
// محرك تحليل النص الخام وتقسيمه إلى صفحات A4 أكاديمية.
// المرحلة الأولى (analyzeResearchText) مستقلة عن صيغة الإخراج وتُستعمل أيضاً في العروض التقديمية،
// والمرحلة الثانية (parseRawText) تفوّض التوزيع على الصفحات إلى paginator.ts.
import { isStructuralTitleOnly, looksLikePlanLeak, sanitizeCoverTitleFromPlanLeak } from './aiGenerate';
import type { ResearchPage } from '../types';
import {
    CHART_FENCE_START_RE,
    CHART_MARKER_RE,
    FIGURE_CAPTION_RE,
    SOURCE_LINE_RE,
    TABLE_CAPTION_RE,
    chartSummary,
    figureLabel,
    formatInlineText,
    isTableRowLine,
    parseChartSpec,
    parseMarkdownTable,
    tableLabel,
    tableSummary,
    type ChartData,
    type TableData,
} from './docBlocks';
import { paginateResearch } from './paginator';
import type { LayoutOptions } from './layoutMetrics';

export class ParseError extends Error {}

export interface ParseResult {
  pages: ResearchPage[];
  detectedTitle: string;
  planText: string;
}

// ===== المرحلة الأولى: التحليل البنيوي المستقل عن صيغة الإخراج =====
// تُستعمل هذه المرحلة كما هي في نظام البحوث (صفحات A4 / Word / PDF) وفي نظام العروض التقديمية (PPTX).

export type AnalyzedItemType = 'subtitle' | 'bullet' | 'paragraph' | 'matlab_header' | 'table' | 'figure';
export interface AnalyzedCitation { origNum: number; text: string; newPageNum?: number }
export interface AnalyzedItem {
  type: AnalyzedItemType;
  /** للنصوص: المتن مع وسوم الإحالة. للجداول والأشكال: ملخص نصي يُستعمل في العروض التقديمية */
  rawText: string;
  cleanText: string;
  /** تقدير قديم محفوظ للتوافق فقط؛ التوزيع الفعلي يقيس الارتفاعات في paginator.ts */
  heightMm: number;
  citations: AnalyzedCitation[];
  table?: TableData;
  chart?: ChartData;
  /** رقم الجدول أو الشكل التسلسلي في البحث كاملاً */
  blockNumber?: number;
}
export type AnalyzedSectionType = 'intro' | 'matlab' | 'conclusion' | 'references';
export interface AnalyzedSection {
  type: AnalyzedSectionType;
  mabhathTitle: string;
  matlabTitle: string;
  items: AnalyzedItem[];
  rawFootnotes: { num: number; text: string }[];
}
export interface ResearchAnalysis {
  detectedTitle: string;
  /** خطة مكتوبة مسبقاً داخل النص (إن وجدت) */
  extractedPlan: string;
  sections: AnalyzedSection[];
}

// تعبير منتظم لأرقام وترتيب المباحث والمطالب (يدعم العربية واللاتينية)
const ARABIC_STRUCT_ORD = '(?:الأول|الاول|الثاني|الثانى|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي\\s+عشر|الثاني\\s+عشر|[\\d٠-٩]+)';
const LATIN_STRUCT_ORD = '(?:[IVXLCDMivxlcdm]+|\\d+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Premier|Première|Deuxième|Troisième|Quatrième|Cinquième|Sixième|Septième|Huitième|Neuvième|Dixième)';
const ANY_STRUCT_ORD = `(?:${ARABIC_STRUCT_ORD}|${LATIN_STRUCT_ORD})`;

function stripDisplayMarkdown(line: string): string {
    let s = (line || '')
        .trim()
        .replace(/^(?:#+\s*|[-*•–—>\s]+)+/, '')
        .replace(/\*\*|__/g, '')
        .replace(/^\*+|\*+$/g, '')
        .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06EDـ]+(?=[A-Za-z])/g, '')
        .replace(/(?<=[A-Za-z])[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06EDـ]+/g, '')
        .trim();

    const numberedStructMatch = s.match(
        /^(?:\(?\s*(?:[\d٠-٩]+|[أ-ي]|[a-zA-Z]|[IVXLCDMivxlcdm]+)\s*[\.\-\)\]:]+|\[\s*[\d٠-٩]+\s*\]\s*)\s*((?:(?:ال)?(?:مبحث|مطلب|مقدمة|خاتمة|هوامش|قائمة\s+المصادر)|دراسة\s+حالة|أولاً|أولا|ثانياً|ثانيا|Chapitre|Chapter|Axe|Section|Sous-section|Subsection|Introduction|Conclusion|Bibliographie|References|Bibliography|Étude\s+de\s+cas|Etude\s+de\s+cas|Case\s+Study).*)$/i,
    );
    return numberedStructMatch ? numberedStructMatch[1].trim() : s;
}

function stripStructuralMarkdown(line: string): string {
    let s = (line || '')
        .trim()
        .replace(/^(?:#+\s*|[-*•–—>\s]+)+/, '')
        .replace(/\*\*|__/g, '')
        .replace(/^\*+|\*+$/g, '')
        .replace(/[\u064B-\u065F\u0670ـ]/g, '')
        .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06EDـ]+(?=[A-Za-z])/g, '')
        .replace(/(?<=[A-Za-z])[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06EDـ]+/g, '')
        .trim();

    // إزالة الترقيم التمهيدي مثل "3. المطلب الثالث:" أو "1. Chapitre I:" فقط إذا سبق عنواناً هيكلياً صريحاً
    const numberedStructMatch = s.match(
        /^(?:\(?\s*(?:[\d٠-٩]+|[أ-ي]|[a-zA-Z]|[IVXLCDMivxlcdm]+)\s*[\.\-\)\]:]+|\[\s*[\d٠-٩]+\s*\]\s*|(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|Premièrement|Deuxièmement|Troisièmement|First|Second|Third)\s*[:\-–—.]?)\s*((?:(?:ال)?(?:مبحث|مطلب|مقدمة|خاتمة|هوامش|قائمة\s+المصادر)|دراسة\s+حالة|Chapitre|Chapter|Axe|Section|Sous-section|Subsection|Introduction|Conclusion|Bibliographie|References|Bibliography|Étude\s+de\s+cas|Etude\s+de\s+cas|Case\s+Study).*)$/i,
    );
    if (numberedStructMatch) {
        s = numberedStructMatch[1].trim();
    }

    s = s.replace(/^(المبحث|مبحث|المطلب|مطلب)\s*(?:رقم\s*)?([\d٠-٩]+)/i, '$1 $2');
    s = s.replace(/^(Chapitre|Chapter|Axe|Section)\s*(?:n°|no\.?|numéro|number)?\s*([0-9IVXLCDMivxlcdm]+)/i, '$1 $2');
    return s;
}

// تعبير منتظم لاكتشاف عبارات التمهيد للقوائم والنقاط (أهمها، عناصرها، خصائصها، أنواعها، مهامها، أهدافها، مميزاتها، كما يلي، كالاتي...)
export const LIST_INTRO_REGEX = /(?:أهم|اهم|أبرز|ابرز|عناصر|العناصر|مكونات|المكونات|أنواع|انواع|الأنواع|الانواع|أقسام|اقسام|الأقسام|الاقسام|أصناف|اصناف|خصائص|الخصائص|مميزات|المميزات|سمات|السمات|مهام|مهمات|المهام|المهمات|وظائف|الوظائف|أهداف|اهداف|الأهداف|الاهداف|شروط|الشروط|ركائز|الركائز|مبادئ|المبادئ|أبعاد|ابعاد|الأبعاد|مراحل|المراحل|خطوات|الخطوات|متطلبات|المتطلبات|ما\s*يلي|كما\s*يلي|كالآتي|كالاتي|كالآتى|كالاتى|الآتي|الاتي|التالي|التالية|تتمثل\s+في|تتمثل\s+فى|تنقسم\s+إلى|تنقسم\s+الى|تتفرع\s+إلى|تتفرع\s+الى)[^:\n]{0,80}[:\-–—]/i;

// دالة مساعدة لتفكيك القوائم المدمجة في نفس السطر (Inline Lists)
export function splitInlineList(text) {
    if (!text || typeof text !== 'string') return [text];

    function extractSegments(str, matches) {
        if (!matches || matches.length < 2) return null;
        const starts = matches.map(m => {
            const offset = m[0].search(/(?:[-*•–—]|\(?\d+|[أ-ي]|أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)/);
            return m.index + (offset >= 0 ? offset : 0);
        });

        const parts = [];
        const prefix = str.substring(0, starts[0]).trim();
        if (prefix) parts.push(prefix);

        for (let i = 0; i < starts.length; i++) {
            const start = starts[i];
            const end = (i + 1 < starts.length) ? starts[i + 1] : str.length;
            let chunk = str.substring(start, end).trim();
            chunk = chunk.replace(/^[.،؛!؟\s]+/, '').trim();
            if (chunk) parts.push(chunk);
        }
        return parts;
    }

    function splitByMarkers(str) {
        const ordMatches = [...str.matchAll(/(?:^|[\s.،؛!؟]+)(?:[-*•–—]\s*)?(أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)\s*[:/\-–—.]/g)];
        if (ordMatches.length >= 2) return extractSegments(str, ordMatches);

        const numMatches = [...str.matchAll(/(?:^|[\s.،؛!؟]+)(?:[-*•–—]\s*)?\(?(\d+)\s*[\.\-\)/:]\s+/g)];
        if (numMatches.length >= 2) {
            const n1 = parseInt(numMatches[0][1], 10);
            const n2 = parseInt(numMatches[1][1], 10);
            if (n1 === 1 || n2 === n1 + 1) return extractSegments(str, numMatches);
        }

        const letterMatches = [...str.matchAll(/(?:^|[\s.،؛!؟]+)(?:[-*•–—]\s*)?([أ-ي])\s*[\.\-\)/:]\s+/g)];
        if (letterMatches.length >= 2) return extractSegments(str, letterMatches);

        const bulletMatches = [...str.matchAll(/(?:^|[\s.،؛!؟]+)([-*•–—]\s+)/g)];
        if (bulletMatches.length >= 2) return extractSegments(str, bulletMatches);

        return null;
    }

    // أ) فحص وجود تمهيد صريح للقائمة مثل "ومن أهمها:" أو "عناصرها ما يلي:"
    const introMatch = text.match(LIST_INTRO_REGEX);
    if (introMatch) {
        const introEndIdx = introMatch.index + introMatch[0].length;
        const introPart = text.substring(0, introEndIdx).trim();
        const restPart = text.substring(introEndIdx).trim();

        if (restPart.length > 0) {
            const subSplit = splitByMarkers(restPart);
            if (subSplit && subSplit.length > 0) {
                return [introPart, ...subSplit];
            } else {
                const commaItems = restPart.split(/[,،؛]\s+/).map(p => p.trim().replace(/^[-*•–—\s]+/, '')).filter(p => p.length > 0);
                if (commaItems.length >= 2) {
                    return [introPart, ...commaItems.map(ci => `• ${ci}`)];
                }
            }
        }
    }

    // ب) فحص السطر ككل
    const directSplit = splitByMarkers(text);
    if (directSplit && directSplit.length > 1) return directSplit;

    return [text];
}

// دالة لتنسيق عناصر القوائم والنقاط أكاديمياً (إبراز أولاً، 1-، أ- بخط عريض)
export function formatBulletContent(text) {
    const cleanSym = text.replace(/^[-*•–—]\s*/, '').trim();

    // 1. تعداد ترتيبي (أولاً، ثانياً...)
    const ordMatch = text.match(/^(?:[-*•–—]\s*)?(أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)\s*([:/\-–—.]?)\s*(.*)$/);
    if (ordMatch) {
        const colon = ordMatch[2] ? (ordMatch[2] === ':' ? ':' : ` ${ordMatch[2]}`) : ':';
        return `<strong>${ordMatch[1]}${colon}</strong> ${ordMatch[3]}`;
    }

    // 2. تعداد عددي (1-، 1.، (1)...)
    const numMatch = text.match(/^(?:[-*•–—]\s*)?(\(?\d+[\.\-\)/:]|\d+\s*[\.\-\)/:])\s*(.*)$/);
    if (numMatch) {
        return `<strong>${numMatch[1]}</strong> ${numMatch[2]}`;
    }

    // 3. تعداد حرفي (أ-، ب-...)
    const letMatch = text.match(/^(?:[-*•–—]\s*)?([أ-ي][\.\-\)/:])\s+(.*)$/);
    if (letMatch) {
        return `<strong>${letMatch[1]}</strong> ${letMatch[2]}`;
    }

    // 4. ترقيم مراجع ومصادر [1]، [2]...
    const refNumMatch = text.match(/^(?:[-*•–—]\s*)?(\[\d+\]|\(\d+\))\s*(.*)$/);
    if (refNumMatch) {
        return `<strong>${refNumMatch[1]}</strong> ${refNumMatch[2]}`;
    }

    return cleanSym;
}

// دالة مساعدة لتقسيم الفقرات الضخمة جداً إن وجدت عند علامات الترقيم
export function splitLongParagraph(text, maxChars = 750) {
    if (text.length <= maxChars) return [text];
    const sentences = text.split(/(?<=[.!?؟])\s+/);
    const chunks = [];
    let cur = '';
    sentences.forEach(s => {
        if ((cur + ' ' + s).trim().length > maxChars && cur) {
            chunks.push(cur.trim());
            cur = s;
        } else {
            cur = cur ? (cur + ' ' + s) : s;
        }
    });
    if (cur.trim()) chunks.push(cur.trim());
    return chunks.length > 0 ? chunks : [text];
}

// ===== تجميع كتل الجداول والأشكال قبل كشف الهوامش وتفكيك القوائم =====
interface TableEntry { kind: 'table'; lines: string[]; caption: string; source: string }
interface ChartEntry { kind: 'chart'; chart: ChartData; caption: string; source: string }
type BlockEntry = TableEntry | ChartEntry;

function stripCaptionMarkdown(line: string): string {
    return (line || '').trim().replace(/^#+\s*/, '').replace(/^[-*•]\s+/, '').trim();
}

/** قراءة مواصفات شكل بياني تبدأ عند السطر start (سطر واحد أو كتلة مسيجة أو وسم متعدد الأسطر) */
function readChartBlock(lines: string[], start: number): { chart: ChartData | null; end: number } | null {
    const first = lines[start].trim();
    const single = CHART_MARKER_RE.exec(first);
    if (single) return { chart: parseChartSpec(single[1]), end: start };

    if (CHART_FENCE_START_RE.test(first)) {
        let json = '';
        for (let j = start + 1; j < lines.length && j < start + 60; j++) {
            const l = lines[j].trim();
            if (/^```\s*$/.test(l)) return { chart: parseChartSpec(json), end: j };
            json += l;
            // النموذج قد يحذف سياج الإغلاق: ننهي الكتلة عند اكتمال JSON صالح
            const parsed = parseChartSpec(json);
            if (parsed && /\}\s*$/.test(json)) {
                const after = lines[j + 1] ? lines[j + 1].trim() : '';
                return { chart: parsed, end: /^```\s*$/.test(after) ? j + 1 : j };
            }
        }
        return null;
    }

    if (/^\[\[\s*(?:CHART|chart|شكل|رسم)\b/.test(first)) {
        let buf = first;
        for (let j = start + 1; j < lines.length && j < start + 60; j++) {
            if (/\]\]\s*$/.test(buf)) break;
            buf += lines[j].trim();
            if (/\]\]\s*$/.test(buf)) {
                const m = CHART_MARKER_RE.exec(buf);
                return { chart: m ? parseChartSpec(m[1]) : null, end: j };
            }
        }
    }
    return null;
}

function groupBlockLines(lines: string[]): Array<string | BlockEntry> {
    const out: Array<string | BlockEntry> = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();

        // أ) جدول Markdown: أسطر متتالية تبدأ وتنتهي بـ |
        if (isTableRowLine(line)) {
            const tLines: string[] = [];
            while (i < lines.length && isTableRowLine(lines[i].trim())) {
                tLines.push(lines[i].trim());
                i++;
            }
            if (tLines.length < 2) {
                out.push(...tLines);
                continue;
            }
            let caption = '';
            let source = '';
            const prev = out[out.length - 1];
            if (typeof prev === 'string') {
                const cm = TABLE_CAPTION_RE.exec(stripCaptionMarkdown(prev));
                if (cm) {
                    caption = cm[3];
                    out.pop();
                }
            }
            // المصدر (وأحياناً العنوان) يرد بعد الجدول مباشرة
            for (let look = 0; look < 2 && i < lines.length; look++) {
                const nxt = stripCaptionMarkdown(lines[i]);
                const sm = !source ? SOURCE_LINE_RE.exec(nxt) : null;
                if (sm) { source = sm[1]; i++; continue; }
                const cm = !caption ? TABLE_CAPTION_RE.exec(nxt) : null;
                if (cm) { caption = cm[3]; i++; continue; }
                break;
            }
            out.push({ kind: 'table', lines: tLines, caption, source });
            continue;
        }

        // ب) شكل بياني: [[CHART {...}]] أو كتلة ```chart
        if (CHART_MARKER_RE.test(line) || CHART_FENCE_START_RE.test(line) || /^\[\[\s*(?:CHART|chart|شكل|رسم)\b/.test(line)) {
            const block = readChartBlock(lines, i);
            if (block) {
                i = block.end + 1;
                if (!block.chart) continue; // مواصفات غير صالحة: تُحذف بدل طباعة JSON خام في الورقة
                let caption = '';
                let source = block.chart.source || '';
                const prev = out[out.length - 1];
                if (typeof prev === 'string') {
                    const fm = FIGURE_CAPTION_RE.exec(stripCaptionMarkdown(prev));
                    if (fm) { caption = fm[2]; out.pop(); }
                }
                for (let look = 0; look < 2 && i < lines.length; look++) {
                    const nxt = stripCaptionMarkdown(lines[i]);
                    const sm = !source ? SOURCE_LINE_RE.exec(nxt) : null;
                    if (sm) { source = sm[1]; i++; continue; }
                    const fm = !caption ? FIGURE_CAPTION_RE.exec(nxt) : null;
                    if (fm) { caption = fm[2]; i++; continue; }
                    break;
                }
                out.push({ kind: 'chart', chart: block.chart, caption, source });
                continue;
            }
        }

        out.push(lines[i]);
        i++;
    }
    return out;
}

/** استخراج الإحالات من HTML عنصر غير نصي وربطها بنصوص الهوامش */
function collectCitations(html: string, rawFootnotes: { num: number; text: string }[]) {
    const seen = new Set<number>();
    const citations = [];
    for (const m of html.matchAll(/<sup>(\d+)<\/sup>/g)) {
        const origNum = parseInt(m[1], 10);
        if (seen.has(origNum)) continue;
        seen.add(origNum);
        const fnObj = rawFootnotes.find(f => f.num === origNum);
        citations.push({ origNum, text: fnObj ? fnObj.text : '' });
    }
    return citations;
}

export function analyzeResearchText(rawInput: string): ResearchAnalysis {
            const rawText = (rawInput || '').trim();
            if (!rawText) {
                throw new ParseError('الرجاء لصق نص البحث في المربع أولاً!');
            }

            // 1. تنظيف النص من الرموز الخفية وتطويل الحروف والرموز الخاصة بمحررات النصوص
            let cleanText = rawText.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ');
            cleanText = cleanText.replace(/\\([.&_*\\#\-\(\)\[\]])/g, '$1');
            cleanText = cleanText.replace(/ـ+(?=[\u0621-\u064A])/g, '');
            // تنقية أي حركات تشكيل عربية متطفلة تلتصق خطأً بالأحرف اللاتينية
            cleanText = cleanText
                .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06EDـ]+(?=[A-Za-z])/g, '')
                .replace(/(?<=[A-Za-z])[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06EDـ]+/g, '');
            cleanText = cleanText.replace(
                new RegExp(`([\\.!\\?؟]|\\^\\d+|\\[\\d+\\])\\s+(?=(?:\\*{1,3}|#+\\s*)?(?:(?:المبحث|مبحث|Chapitre|Chapter)\\s+${ANY_STRUCT_ORD}|(?:المطلب|مطلب|Section|Sous-section|Subsection)\\s+${ANY_STRUCT_ORD}|دراسة\\s+حالة|Étude\\s+de\\s+cas|Etude\\s+de\\s+cas|Case\\s+Study)\\s*[:\\-–—])`, 'gi'),
                '$1\n\n',
            );

            // 2. استخراج عنوان البحث الرئيسي إن وجد
            let detectedTitle = '';
            const titleMatch = cleanText.match(/(?:بحث\s+بعنوان|عنوان\s+البحث|موضوع\s+البحث|Titre\s+de\s+la\s+recherche|Sujet|Thème|Research\s+Title|Title|Topic)\s*[:\-]?\s*["«]?([^"\n\r»]+)["»]?/i);
            if (titleMatch) {
                detectedTitle = titleMatch[1].trim().replace(/^[:"«\s]+|[:"»\s]+$/g, '');
            }

            if (!detectedTitle) {
                const planTitleInQuotes = cleanText.match(/(?:خطة\s+البحث|فهرس\s+البحث|Sommaire|Plan|Table\s+of\s+Contents|Outline)[^"\n\r»]*["«]([^"\n\r»]+)["»]/i);
                if (planTitleInQuotes) {
                    detectedTitle = planTitleInQuotes[1].trim().replace(/^[:"«\s]+|[:"»\s]+$/g, '');
                }
            }

            if (detectedTitle && (looksLikePlanLeak(detectedTitle) || isStructuralTitleOnly(detectedTitle))) {
                const sanitized = sanitizeCoverTitleFromPlanLeak(detectedTitle);
                detectedTitle =
                    sanitized.cleaned && !looksLikePlanLeak(sanitized.cleaned) && !isStructuralTitleOnly(sanitized.cleaned)
                        ? sanitized.cleaned
                        : '';
            }

            // 3. عزل وتجريد خطة البحث المكتوبة مسبقاً لمنع تكرارها كصفحات مستقلة في متن البحث
            let extractedPlan = '';
            let bodyText = cleanText;

            // أ) إذا كان النص يحتوي على أسطر خطة صريحة متبوعة بأرقام صفحات بصيغة "| ص"
            const allCleanLines = cleanText.split('\n');
            const planLinesWithPage = [];
            const nonPlanLines = [];

            allCleanLines.forEach(line => {
                const trimmed = line.trim();
                // سطر خطة بصيغة «العنوان | ص 05» أو «Titre | p. 05»
                if (!trimmed.startsWith('|') && /\|\s*(?:ص|صفحة|p\.|page|pp\.)\s*\.?\s*[\d٠-٩]*\s*$/i.test(trimmed)) {
                    planLinesWithPage.push(trimmed);
                } else {
                    nonPlanLines.push(line);
                }
            });

            if (planLinesWithPage.length >= 2) {
                extractedPlan = planLinesWithPage.join('\n');
                bodyText = nonPlanLines.join('\n');
            } else {
                // ب) فحص وجود كتلة صريحة تبدأ بـ "خطة البحث" أو "فهرس" أو "Sommaire" أو "Table of Contents" قبل المقدمة الحقيقية
                const planHeaderRegex = /(?:^|\n)\s*(?:#+\s*)?(?:📋\s*)?(?:خطة\s+البحث(?:\s+المحسّنة|\s+المقترحة|\s+العامة)?|فهرس\s+البحث|فهرس\s+المحتويات|هيكل\s+البحث|الفهرس|المحتويات|Sommaire|Table\s+des\s+matières|Plan\s+de\s+travail|Plan\s+de\s+la\s+recherche|Table\s+of\s+Contents|Contents|Research\s+Outline)[\s:\-]*/i;
                const planHeaderMatch = bodyText.match(planHeaderRegex);

                if (planHeaderMatch) {
                    const planStartIndex = planHeaderMatch.index;
                    const textFromPlan = bodyText.substring(planStartIndex + planHeaderMatch[0].length);
                    const linesAfterPlan = textFromPlan.split('\n');
                    let bodyStartIndexInLines = -1;

                    for (let i = 0; i < linesAfterPlan.length; i++) {
                        const l = linesAfterPlan[i].trim();
                        if (!l) continue;
                        const hl = stripStructuralMarkdown(l);

                        if (/^(?:بحث\s+بعنوان|عنوان\s+البحث|Titre\s+de\s+la\s+recherche|Research\s+Title)\s*[:\-]/i.test(hl)) {
                            bodyStartIndexInLines = i;
                            break;
                        }

                        if (/^(?:المقدمة|مقدمة|مدخل\s+عام|Introduction|General\s+Introduction|Introduction\s+générale)[\s:\-]*$/i.test(hl)) {
                            let nextNonEmpty = '';
                            for (let j = i + 1; j < linesAfterPlan.length; j++) {
                                if (linesAfterPlan[j].trim()) {
                                    nextNonEmpty = stripStructuralMarkdown(linesAfterPlan[j]);
                                    break;
                                }
                            }
                            if (nextNonEmpty && !/^(?:المبحث|مبحث|المطلب|مطلب|دراسة\s+حالة|خاتمة|الخاتمة|مراجع|المراجع|Chapitre|Chapter|Section|Sous-section|Subsection|Étude\s+de\s+cas|Etude\s+de\s+cas|Case\s+Study|Conclusion|Bibliographie|References)/i.test(nextNonEmpty) && nextNonEmpty.length > 30) {
                                bodyStartIndexInLines = i;
                                break;
                            }
                        }
                    }

                    if (bodyStartIndexInLines !== -1) {
                        const planBlockLines = linesAfterPlan.slice(0, bodyStartIndexInLines);
                        const validPlanLines = [];
                        planBlockLines.forEach(pl => {
                            const tr = stripStructuralMarkdown(pl);
                            if (tr && /^(?:المبحث|مبحث|المطلب|مطلب|دراسة\s+حالة|المقدمة|مقدمة|الخاتمة|خاتمة|قائمة|المصادر|المراجع|Chapitre|Chapter|Section|Sous-section|Subsection|Étude\s+de\s+cas|Etude\s+de\s+cas|Case\s+Study|Introduction|Conclusion|Bibliographie|Références|References|Bibliography)/i.test(tr)) {
                                validPlanLines.push(tr);
                            }
                        });

                        if (validPlanLines.length > 0) {
                            extractedPlan = validPlanLines.join('\n');
                        }

                        bodyText = bodyText.substring(0, planStartIndex) + '\n' + linesAfterPlan.slice(bodyStartIndexInLines).join('\n');
                    }
                } else {
                    // ج) حالة وجود هيكل خطة في البداية متبوع بمقدمة مكررة
                    const introRegex = /(?:^|\n)\s*(?:#+\s*|\*{1,3}\s*)?(?:المقدمة|مقدمة|مدخل\s+عام|Introduction|General\s+Introduction|Introduction\s+générale)(?:\*{1,3})?[\s:\-]*\n/gi;
                    const matches = [...bodyText.matchAll(introRegex)];
                    if (matches.length >= 2) {
                        const firstIdx = matches[0].index;
                        const secondIdx = matches[1].index;
                        const between = bodyText.substring(firstIdx, secondIdx);
                        const betweenLines = between.split('\n').map(l => stripStructuralMarkdown(l)).filter(l => l);
                        const isOutlineOnly = betweenLines.every(l => l.length < 120 && /^(?:المبحث|مبحث|المطلب|مطلب|دراسة\s+حالة|المقدمة|مقدمة|الخاتمة|خاتمة|فهرس|خطة|Chapitre|Chapter|Section|Sous-section|Subsection|Étude\s+de\s+cas|Etude\s+de\s+cas|Case\s+Study|Introduction|Conclusion|Sommaire|Plan|Outline)/i.test(l));
                        if (isOutlineOnly) {
                            extractedPlan = betweenLines.join('\n');
                            bodyText = bodyText.substring(0, firstIdx) + '\n' + bodyText.substring(secondIdx);
                        }
                    }
                }
            }

            const rawLines = bodyText.split('\n').map(l => l.trim()).filter(l => l !== '');
            if (rawLines.length === 0) {
                throw new ParseError('النص المدخل لا يحتوي على فقرات أو محتوى كافٍ.');
            }

            let titleLineToSkip = '';
            const isStructuralHeading = /^(?:المقدمة|مقدمة|مدخل\s+عام|مدخل|تمهيد|خطة\s+البحث|خطة|فهرس|المحتويات|هيكل\s+البحث|المبحث|مبحث|المطلب|مطلب|دراسة\s+حالة|الفرع|فرع|أولاً|ثانياً|ثالثاً|رابعاً|خامساً|الخاتمة|خاتمة|قائمة|المصادر|المراجع|الفصل|فصل|الباب|باب|Introduction|General\s+Introduction|Introduction\s+générale|Conclusion|General\s+Conclusion|Conclusion\s+générale|Chapitre|Chapter|Section|Sous-section|Subsection|Partie|Part|Bibliographie|Références|References|Bibliography|Works\s+Cited|Étude\s+de\s+cas|Etude\s+de\s+cas|Case\s+Study|Sommaire|Table\s+des\s+matières|Table\s+of\s+Contents|Plan|Outline)(?:[\s:\-–—\(\[\{.\d]|$)/i;

            if (!detectedTitle && rawLines.length > 0) {
                const firstLine = rawLines[0].trim();
                const firstHeading = stripStructuralMarkdown(firstLine);
                if (
                    !isStructuralHeading.test(firstHeading) &&
                    firstLine.length <= 250 &&
                    !looksLikePlanLeak(firstHeading) &&
                    !isStructuralTitleOnly(firstHeading)
                ) {
                    detectedTitle = firstHeading.replace(/^[:"«'\s]+|[:"»'\s]+$/g, '').trim();
                    titleLineToSkip = firstLine;
                }
            }

            // تجميع النص في أقسام أكاديمية رئيسية (المقدمة، المباحث، المطالب، دراسة الحالة، الخاتمة، المراجع)
            const rawSections = [];
            let curSection = null;

            function startNewSection(type, mabhath, matlab) {
                if (curSection) rawSections.push(curSection);
                curSection = {
                    type: type,
                    mabhathTitle: mabhath || '',
                    matlabTitle: matlab || '',
                    lines: []
                };
            }

            const mabhathHeadingRe = new RegExp(`^(?:(?:المبحث|مبحث)\\s+${ARABIC_STRUCT_ORD}|(?:Chapitre|Chapter|Axe)\\s+${ANY_STRUCT_ORD})(?:[\\s:\\-–—\\.\\(/]|$)`, 'i');
            const matlabHeadingRe = new RegExp(`^(?:(?:المطلب|مطلب)\\s+${ARABIC_STRUCT_ORD}|(?:Section|Sous-section|Subsection)\\s+${ANY_STRUCT_ORD})(?:[\\s:\\-–—\\.\\(/]|$)`, 'i');
            const caseFirstHeadingRe = /^(?:أولاً|أولا|Premièrement|First)\s*[:\-–—\.]+/i;
            const caseSecondHeadingRe = /^(?:ثانياً|ثانيا|Deuxièmement|Second)\s*[:\-–—\.]+/i;

            let pendingMabhath = '';
            let pendingPreambleLines = [];
            let inCaseStudy = false;
            let seenCaseFirst = false;
            let seenCaseSecond = false;
            let hasUnmatchedInnerFirst = false;

            function resetCaseStudyState() {
                inCaseStudy = false;
                seenCaseFirst = false;
                seenCaseSecond = false;
                hasUnmatchedInnerFirst = false;
            }

            function flushPendingMabhathIfOrphaned() {
                if (pendingMabhath) {
                    startNewSection('matlab', pendingMabhath, '');
                    if (pendingPreambleLines.length > 0) {
                        curSection.lines.push(...pendingPreambleLines);
                        pendingPreambleLines = [];
                    }
                    pendingMabhath = '';
                }
            }

            for (let i = 0; i < rawLines.length; i++) {
                let line = rawLines[i].trim();
                const isBulletPrefixed = /^[-*•]\s*/.test(line);
                const headingLine = stripStructuralMarkdown(line);

                if (/^(?:بحث\s+بعنوان|عنوان\s+البحث|موضوع\s+البحث|Recherche\s+intitul[eé]e|Titre\s+de\s+la\s+recherche|Sujet(?:\s+de\s+recherche)?|Th[eè]me|Research\s+Paper|Research\s+Title|Topic)\s*[:\-–—]?/i.test(headingLine)) {
                    continue;
                }

                const cleanLineNoQuotes = headingLine.replace(/^[:"«'\s]+|[:"»'\s]+$/g, '').trim();
                if (detectedTitle && (cleanLineNoQuotes === detectedTitle || (titleLineToSkip && line === titleLineToSkip))) {
                    continue; // تجاوز سطر العنوان حتى لا يدخل في متن المقدمة أو يُنشئ صفحة منفردة
                }

                const isLatinDoc = (cleanText.match(/[A-Za-z]/g) || []).length > (cleanText.match(/[\u0600-\u06FF]/g) || []).length;

                // المقدمة
                if (/^(?:المقدمة|مقدمة|مقدمة\s+البحث|مدخل\s+عام|Introduction|General\s+Introduction|Introduction\s+générale)[\s:\-]*$/i.test(headingLine)) {
                    flushPendingMabhathIfOrphaned();
                    startNewSection('intro', stripDisplayMarkdown(line) || (isLatinDoc ? 'Introduction' : 'المقدمة'), '');
                    pendingMabhath = '';
                    pendingPreambleLines = [];
                    resetCaseStudyState();
                    continue;
                }

                // الخاتمة
                if (/^(?:الخاتمة|الخـاتـمـــة|الخــاتـمـــة|خاتمة|خاتمة\s+البحث|Conclusion|General\s+Conclusion|Conclusion\s+générale)[\s:\-]*$/i.test(headingLine)) {
                    flushPendingMabhathIfOrphaned();
                    startNewSection('conclusion', stripDisplayMarkdown(line) || (isLatinDoc ? 'Conclusion générale' : 'الخــاتـمـــة'), '');
                    pendingMabhath = '';
                    pendingPreambleLines = [];
                    resetCaseStudyState();
                    continue;
                }

                // قائمة المراجع
                if (/^(?:قائمة\s+المصادر\s+والمراجع|المصادر\s+والمراجع|قائمة\s+المراجع|المراجع\s+والمصادر|المراجع|Bibliographie|Références|References|Bibliography|Works\s+Cited|Sources\s+et\s+Références)[\s:\-]*$/i.test(headingLine)) {
                    flushPendingMabhathIfOrphaned();
                    startNewSection('references', stripDisplayMarkdown(line) || (isLatinDoc ? 'Bibliographie' : 'قائمة المصادر والمراجع'), '');
                    pendingMabhath = '';
                    pendingPreambleLines = [];
                    resetCaseStudyState();
                    continue;
                }

                // المبحث (مع دعم الماركداون والشرطات والنقاط والأرقام)
                if (mabhathHeadingRe.test(headingLine)) {
                    flushPendingMabhathIfOrphaned();
                    pendingMabhath = stripDisplayMarkdown(line);
                    pendingPreambleLines = [];
                    resetCaseStudyState();
                    continue;
                }

                // دراسة حالة (قسم مستقل قبل الخاتمة بدون تسميته كمبحث)
                const isExplicitCaseStudyColon = /^(?:دراسة\s+حالة|الجانب\s+التطبيقي\s*[:\-–—]?\s*دراسة\s+حالة|Étude\s+de\s+cas|Etude\s+de\s+cas|Case\s+Study)\s*[:\-–—]/i.test(headingLine);
                const isStandaloneCaseStudyTitle = /^(?:دراسة\s+حالة|Étude\s+de\s+cas|Etude\s+de\s+cas|Case\s+Study)(?:\s+(?:ميدانية|تطبيقية|pratique|empirique))?(?:\s+(?:حول|عن|sur|on)\s+.+)?$/i.test(headingLine) && headingLine.length <= 85 && !/[.،؟!]$/.test(headingLine);
                if (!isBulletPrefixed && headingLine.length <= 140 && (isExplicitCaseStudyColon || isStandaloneCaseStudyTitle)) {
                    flushPendingMabhathIfOrphaned();
                    pendingMabhath = stripDisplayMarkdown(line);
                    pendingPreambleLines = [];
                    inCaseStudy = true;
                    seenCaseFirst = false;
                    seenCaseSecond = false;
                    hasUnmatchedInnerFirst = false;
                    continue;
                }

                // العنوانان الفرعيان داخل دراسة الحالة (أولاً: التعريف بالمؤسسة / ثانياً: الموضوع في المؤسسة)
                if (inCaseStudy) {
                    if (!seenCaseFirst && !isBulletPrefixed && caseFirstHeadingRe.test(headingLine) && headingLine.length <= 130 && !/[.،؟!]$/.test(headingLine)) {
                        startNewSection('matlab', pendingMabhath, stripDisplayMarkdown(line));
                        if (pendingPreambleLines.length > 0) {
                            curSection.lines.push(...pendingPreambleLines);
                            pendingPreambleLines = [];
                        }
                        pendingMabhath = '';
                        seenCaseFirst = true;
                        hasUnmatchedInnerFirst = false;
                        continue;
                    }
                    if (!seenCaseSecond) {
                        if (seenCaseFirst && caseFirstHeadingRe.test(headingLine)) {
                            hasUnmatchedInnerFirst = true;
                        } else if (caseSecondHeadingRe.test(headingLine)) {
                            const prevNonEmpty = [...(curSection?.lines || [])].reverse().find(l => l.trim());
                            const prevClean = prevNonEmpty ? stripStructuralMarkdown(prevNonEmpty) : '';
                            const prevIsListIntro = prevClean && (LIST_INTRO_REGEX.test(prevClean) || (prevClean.endsWith(':') && prevClean.length < 85));
                            if (!isBulletPrefixed && !hasUnmatchedInnerFirst && !prevIsListIntro && headingLine.length <= 110 && !/[.،؟!]$/.test(headingLine)) {
                                startNewSection('matlab', pendingMabhath, stripDisplayMarkdown(line));
                                if (pendingPreambleLines.length > 0) {
                                    curSection.lines.push(...pendingPreambleLines);
                                    pendingPreambleLines = [];
                                }
                                pendingMabhath = '';
                                seenCaseSecond = true;
                                continue;
                            }
                            if (hasUnmatchedInnerFirst) {
                                hasUnmatchedInnerFirst = false;
                            }
                        }
                    }
                }

                // المطلب (مع دعم الماركداون والشرطات والنقاط والأرقام)
                if (matlabHeadingRe.test(headingLine)) {
                    startNewSection('matlab', pendingMabhath, stripDisplayMarkdown(line));
                    if (pendingPreambleLines.length > 0) {
                        curSection.lines.push(...pendingPreambleLines);
                        pendingPreambleLines = [];
                    }
                    pendingMabhath = '';
                    continue;
                }

                if (pendingMabhath) {
                    // حفظ أي سطر تمهيدي يرد بين عنوان المبحث وأول مطلب له بدلاً من دمجه في المبحث السابق
                    pendingPreambleLines.push(line);
                    continue;
                }

                if (!curSection) {
                    startNewSection('intro', isLatinDoc ? 'Introduction' : 'المقدمة', '');
                }

                curSection.lines.push(line);
            }
            flushPendingMabhathIfOrphaned();
            if (curSection) rawSections.push(curSection);

            // تجهيز عناصر كل قسم (استخراج الإحالات وتحديد الارتفاعات التقريبية)
            const processedSections = [];
            let carryMabhathTitle = '';
            // ترقيم تسلسلي موحد للجداول والأشكال عبر البحث كاملاً (بترتيب ورودها)
            let tableCounter = 0;
            let figureCounter = 0;

            function buildBlockItem(entry: BlockEntry, rawFootnotes): AnalyzedItem | null {
                if (entry.kind === 'table') {
                    const table = parseMarkdownTable(entry.lines, entry.caption, entry.source);
                    if (!table) return null;
                    const n = ++tableCounter;
                    const html = [formatInlineText(table.caption), formatInlineText(table.source), ...table.headers, ...table.rows.flat()].join(' ');
                    return { type: 'table', rawText: tableSummary(table, n), cleanText: tableLabel(n, table.caption), heightMm: 0, citations: collectCitations(html, rawFootnotes), table, blockNumber: n };
                }
                const n = ++figureCounter;
                const chart = { ...entry.chart, title: entry.caption || entry.chart.title, source: entry.source || entry.chart.source };
                return { type: 'figure', rawText: chartSummary(chart, n), cleanText: figureLabel(n, chart.title), heightMm: 0, citations: collectCitations(formatInlineText(chart.source), rawFootnotes), chart, blockNumber: n };
            }

            rawSections.forEach((sec) => {
                const contentLines = [];
                const rawFootnotes = [];
                let inFootnotesBlock = false;

                groupBlockLines(sec.lines).forEach(entry => {
                    if (typeof entry !== 'string') {
                        contentLines.push(entry);
                        return;
                    }
                    const trimmed = entry.trim();
                    const headingTrimmed = stripStructuralMarkdown(trimmed);
                    if (/^(?:الهوامش|المراجع|قائمة\s+الهوامش|هوامش\s+الصفحة|Notes|Footnotes|Notes\s+de\s+bas\s+de\s+page)\s*[:\-]?$/i.test(headingTrimmed)) {
                        inFootnotesBlock = true;
                        return;
                    }

                    const isCitationTerm = /(?:ص\s*\.?\s*\d+|p\.\s*\d+|pp\.\s*\d+|دار\s+|نشر|مطبعة|طبعة|éd\.|ed\.|vol\.|univ\.|press|éditions|جامعة|مرجع\s+سبق|op\.\s*cit|ibid|in\s*:|مجلة|أطروحة|مذكرة)/i.test(trimmed);
                    const isFn = (sec.type !== 'references') && (
                                 /^[\^]\s*\d+/.test(trimmed) || 
                                 /^\[\d+\]/.test(trimmed) ||
                                 /^\(\d+\)\s+[^\d]/.test(trimmed) ||
                                 (/^[\^\[\(]?\s*\d+\s*[\.\)\]\-]?\s+[^\d]/.test(trimmed) && (isCitationTerm || inFootnotesBlock)) ||
                                 /^مرجع\s*[:\-\d]/i.test(trimmed));

                    if (isFn) {
                        const numMatch = trimmed.match(/^[\^\[\(]?\s*(\d+)[\.\)\]\-]?/);
                        const fnNum = numMatch ? parseInt(numMatch[1], 10) : (rawFootnotes.length + 1);
                        const cleanFnText = trimmed.replace(/^[\^\[\(\d\]\)\.\-\s:]+/, '').trim();
                        if (cleanFnText) {
                            rawFootnotes.push({ num: fnNum, text: cleanFnText });
                        }
                    } else {
                        contentLines.push(trimmed);
                    }
                });

                if (sec.type !== 'matlab') {
                    carryMabhathTitle = '';
                }

                // حماية حاسمة: منع إنشاء أقسام فارغة مع حفظ عنوان المبحث المتبوع للمطلب التالي في حال حذف المطلب الفارغ
                if (contentLines.length === 0 && rawFootnotes.length === 0) {
                    if (sec.type === 'matlab' && sec.mabhathTitle) {
                        carryMabhathTitle = sec.mabhathTitle;
                    }
                    return;
                }

                const effectiveMabhathTitle = sec.type === 'matlab' ? (sec.mabhathTitle || carryMabhathTitle) : sec.mabhathTitle;
                if (sec.type === 'matlab' && effectiveMabhathTitle) {
                    carryMabhathTitle = '';
                }

                // تفكيك أي قوائم أو نقاط تعداد مدمجة في نفس السطر
                const expandedContentLines = [];
                contentLines.forEach(cl => {
                    if (typeof cl !== 'string') {
                        expandedContentLines.push(cl);
                        return;
                    }
                    const splitted = splitInlineList(cl);
                    splitted.forEach(sp => {
                        if (sp && sp.trim()) expandedContentLines.push(sp.trim());
                    });
                });

                // تحويل أسطر المحتوى إلى عناصر هيكلية مع استخراج أرقام الإحالات وتحديد الارتفاع المتوقع
                const items = [];
                // نص السطر المجاور (الكتل غير النصية تُعامل كسطر فارغ في فحوص السياق)
                const lineText = (i: number): string => {
                    const v = expandedContentLines[i];
                    return typeof v === 'string' ? v.trim() : '';
                };
                expandedContentLines.forEach((line, idx) => {
                    if (typeof line !== 'string') {
                        const blockItem = buildBlockItem(line, rawFootnotes);
                        if (blockItem) items.push(blockItem);
                        return;
                    }
                    let processedLine = line;
                    if (sec.type !== 'references') {
                        processedLine = processedLine.replace(/\$?[\^](\d+)\$?/g, '<sup>$1</sup>');
                        processedLine = processedLine.replace(/\[(\d+)\]/g, '<sup>$1</sup>');
                    }

                    const isOrd = /^(?:#+\s*)?(?:[-*•–—]\s*)?(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)\s*[:/\-–—.]/i.test(processedLine);
                    const isNum = /^(?:#+\s*)?(?:[-*•–—]\s*)?(?:[\(\[]?\d+[\.\-\)/:\]]|\d+\s*[\.\-\)/:])\s*/.test(processedLine);
                    const isLet = /^(?:#+\s*)?(?:[-*•–—]\s*)?[أ-ي][\.\-\)/:]\s+/.test(processedLine);
                    const isSym = /^[-*•–—]\s+/.test(processedLine);

                    // فحص السياق السابق للقوائم
                    let inListContext = false;
                    if (idx > 0) {
                        const prev = lineText(idx - 1);
                        const prevItem = items[items.length - 1];
                        if (LIST_INTRO_REGEX.test(prev) || (prev.endsWith(':') && prev.length < 80)) {
                            inListContext = true;
                        } else if (prevItem && prevItem.type === 'bullet') {
                            const isParagraphTransition = /^(?:ويعد|وتعد|كما\s+أن|وفي\s+هذا|وفي\s+سياق|ومن\s+جهة\s+أخرى|أما\s+|والجدير\s+بالذكر|وخلاصة\s+القول|وبناء\s+على|وتأسيساً\s+على)/i.test(processedLine);
                            if (!isParagraphTransition && processedLine.length < 350 && !processedLine.endsWith(':')) {
                                inListContext = true;
                            }
                        }
                    }

                    let hasSiblingListItems = false;
                    if (isOrd || isNum || isLet) {
                        if (idx > 0) {
                            const prev = lineText(idx - 1);
                            if (/^(?:[-*•–—]\s*)?(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)\s*[:/\-–—.]/i.test(prev) || /^\(?\d+[\.\-\)/:]\s+/.test(prev) || /^[-*•–—]\s+/.test(prev)) {
                                hasSiblingListItems = true;
                            }
                        }
                        if (idx + 1 < expandedContentLines.length) {
                            const next = lineText(idx + 1);
                            if (/^(?:[-*•–—]\s*)?(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)\s*[:/\-–—.]/i.test(next) || /^\(?\d+[\.\-\)/:]\s+/.test(next) || /^[-*•–—]\s+/.test(next)) {
                                hasSiblingListItems = true;
                            }
                        }
                    }

                    const isIntro = LIST_INTRO_REGEX.test(processedLine);

                    const isSubtitle = !isIntro && ((/^#{1,4}\s+/.test(processedLine)) ||
                                       (/^(?:الفرع\s+(?:الأول|الثاني|الثالث|الرابع|الخامس))\s*[:\-]/i.test(processedLine)) ||
                                       (/^(?:أهمية\s+البحث|أهداف\s+البحث|إشكالية\s+البحث|فرضيات\s+البحث|منهجية\s+البحث|الأسئلة\s+الفرعية|أبرز\s+النتائج|التوصيات|التوصيات\s+والاقتراحات)\s*[:\-]?$/i.test(processedLine)) ||
                                       (sec.type === 'references' && /^(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|الكتب|المؤلفات|المجلات|الدوريات|الأطروحات|المعاجم|القوانين|المواقع)[\s:\-–—]/i.test(processedLine)) ||
                                       (isOrd && !inListContext && !hasSiblingListItems && processedLine.length < 100 && (idx + 1 < expandedContentLines.length && !/^(?:#+\s*)?(?:[-*•–—]\s*)?(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)\s*[:/\-–—.]/i.test(lineText(idx + 1)))) ||
                                       (processedLine.endsWith(':') && processedLine.length < 75 && !processedLine.includes('.') && !isOrd && !isNum && !isSym));

                    const isBullet = !isSubtitle && !isIntro && (isSym || isNum || isLet || (isOrd && (inListContext || hasSiblingListItems || processedLine.length < 250)) || (inListContext && processedLine.length < 350 && !processedLine.endsWith(':')));

                    if (isSubtitle) {
                        const clean = processedLine.replace(/^#+\s*/, '');
                        const heightMm = Math.ceil(clean.length / 70) * 7.5 + 4.5;
                        const citations = [];
                        const supMatches = [...processedLine.matchAll(/<sup>(\d+)<\/sup>/g)];
                        supMatches.forEach(m => {
                            const origNum = parseInt(m[1], 10);
                            const fnObj = rawFootnotes.find(f => f.num === origNum);
                            citations.push({ origNum: origNum, text: fnObj ? fnObj.text : '' });
                        });
                        items.push({ type: 'subtitle', rawText: processedLine, cleanText: clean, heightMm, citations });
                    } else if (isBullet) {
                        const clean = processedLine.replace(/^[-*•–—]\s*/, '');
                        const heightMm = Math.ceil(clean.length / 80) * 6.5 + 3.2;
                        const citations = [];
                        const supMatches = [...processedLine.matchAll(/<sup>(\d+)<\/sup>/g)];
                        supMatches.forEach(m => {
                            const origNum = parseInt(m[1], 10);
                            const fnObj = rawFootnotes.find(f => f.num === origNum);
                            citations.push({ origNum: origNum, text: fnObj ? fnObj.text : '' });
                        });
                        items.push({ type: 'bullet', rawText: processedLine, cleanText: clean, heightMm, citations });
                    } else {
                        // تقسيم الفقرات الطويلة جداً إن لزم الأمر
                        const subParagraphs = splitLongParagraph(processedLine, 750);
                        subParagraphs.forEach(subP => {
                            const heightMm = Math.ceil(subP.length / 85) * 6.6 + 4;
                            const citations = [];
                            const supMatches = [...subP.matchAll(/<sup>(\d+)<\/sup>/g)];
                            supMatches.forEach(m => {
                                const origNum = parseInt(m[1], 10);
                                const fnObj = rawFootnotes.find(f => f.num === origNum);
                                citations.push({ origNum: origNum, text: fnObj ? fnObj.text : '' });
                            });
                            items.push({ type: 'paragraph', rawText: subP, cleanText: subP, heightMm, citations });
                        });
                    }
                });

                processedSections.push({
                    type: sec.type,
                    mabhathTitle: effectiveMabhathTitle,
                    matlabTitle: sec.matlabTitle,
                    items: items,
                    rawFootnotes: rawFootnotes
                });
            });

            return { detectedTitle, extractedPlan, sections: processedSections };
}

// ===== المرحلة الثانية: التوزيع على صفحات A4 (خاص بإخراج البحث) =====
// القواعد الأكاديمية المعتمدة (التفاصيل في paginator.ts):
// 1. المقدمة والمراجع تبدأ دائماً بصفحة جديدة؛ المبحث والخاتمة كذلك إلا إذا كانت الصفحة الحالية شبه فارغة.
// 2. المطلب التالي يواصل في الصفحة نفسها متى اتسع عنوانه مع ثلاثة أسطر من متنه.
// 3. الفقرات والنقاط الطويلة تُجزأ لملء الصفحة، والجداول الطويلة تُقسم مع تكرار رأسها.
export function parseRawText(rawInput: string, options?: LayoutOptions): ParseResult {
            const analysis = analyzeResearchText(rawInput);
            const { pages, planText } = paginateResearch(analysis, options, { formatBullet: formatBulletContent });

            if (pages.length === 0) {
                const isLatin = options?.language === 'fr' || options?.language === 'en';
                throw new ParseError(
                    isLatin
                        ? 'Aucune section académique valide trouvée. Assurez-vous que le texte contient (Introduction, Chapitre/Chapter, Section, Conclusion).'
                        : 'لم يتم العثور على أقسام واضحة في النص. تأكد من احتواء النص على كلمات مثل (المقدمة، المبحث، المطلب، الخاتمة).'
                );
            }

            return {
                pages,
                detectedTitle: analysis.detectedTitle,
                planText: planText || analysis.extractedPlan.trim(),
            };
}
