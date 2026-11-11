// @ts-nocheck
// محرك تحليل النص الخام وتقسيمه إلى صفحات A4 أكاديمية.
// الخوارزمية منقولة كما هي من المشروع الأصلي (parseRawTextToDocument) مع فصلها عن واجهة DOM
// لتصبح دالة نقية تُرجع النتيجة بدلاً من تعديل الحالة مباشرة.
import { escapeHtml } from './escape';
import type { ResearchPage } from '../types';

export class ParseError extends Error {}

export interface ParseResult {
  pages: ResearchPage[];
  detectedTitle: string;
  planText: string;
}

// ===== المرحلة الأولى: التحليل البنيوي المستقل عن صيغة الإخراج =====
// تُستعمل هذه المرحلة كما هي في نظام البحوث (صفحات A4 / Word / PDF) وفي نظام العروض التقديمية (PPTX).

export type AnalyzedItemType = 'subtitle' | 'bullet' | 'paragraph' | 'matlab_header';
export interface AnalyzedCitation { origNum: number; text: string; newPageNum?: number }
export interface AnalyzedItem { type: AnalyzedItemType; rawText: string; cleanText: string; heightMm: number; citations: AnalyzedCitation[] }
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

// تعبير منتظم لأرقام وترتيب المباحث والمطالب (يدعم الهمزات والأرقام العربية والهندية)
const ARABIC_STRUCT_ORD = '(?:الأول|الاول|الثاني|الثانى|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي\\s+عشر|الثاني\\s+عشر|[\\d٠-٩]+)';

function stripDisplayMarkdown(line: string): string {
    const s = (line || '')
        .trim()
        .replace(/^(?:#+\s*|[-*•–—>\s]+)+/, '')
        .replace(/\*\*|__/g, '')
        .replace(/^\*+|\*+$/g, '')
        .trim();

    const numberedStructMatch = s.match(
        /^(?:\(?\s*(?:[\d٠-٩]+|[أ-ي])\s*[\.\-\)\]:]+|\[\s*[\d٠-٩]+\s*\]\s*)\s*((?:(?:ال)?(?:مبحث|مطلب|مقدمة|خاتمة|هوامش|قائمة\s+المصادر)|دراسة\s+حالة|أولاً|أولا|ثانياً|ثانيا).*)$/i,
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
        .trim();

    // إزالة الترقيم التمهيدي مثل "3. المطلب الثالث:" فقط إذا سبق عنواناً هيكلياً صريحاً
    const numberedStructMatch = s.match(
        /^(?:\(?\s*(?:[\d٠-٩]+|[أ-ي])\s*[\.\-\)\]:]+|\[\s*[\d٠-٩]+\s*\]\s*|(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا)\s*[:\-–—.]?)\s*((?:(?:ال)?(?:مبحث|مطلب|مقدمة|خاتمة|هوامش|قائمة\s+المصادر)|دراسة\s+حالة).*)$/i,
    );
    if (numberedStructMatch) {
        s = numberedStructMatch[1].trim();
    }

    return s.replace(/^(المبحث|مبحث|المطلب|مطلب)\s*(?:رقم\s*)?([\d٠-٩]+)/i, '$1 $2');
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

export function analyzeResearchText(rawInput: string): ResearchAnalysis {
            const rawText = (rawInput || '').trim();
            if (!rawText) {
                throw new ParseError('الرجاء لصق نص البحث في المربع أولاً!');
            }

            // 1. تنظيف النص من الرموز الخفية وتطويل الحروف والرموز الخاصة بمحررات النصوص
            let cleanText = rawText.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ');
            cleanText = cleanText.replace(/\\([.&_*\\#\-\(\)\[\]])/g, '$1');
            cleanText = cleanText.replace(/ـ+(?=[\u0621-\u064A])/g, '');
            cleanText = cleanText.replace(
                new RegExp(`([\\.!\\?؟]|\\^\\d+|\\[\\d+\\])\\s+(?=(?:\\*{1,3}|#+\\s*)?(?:(?:المبحث|المطلب)\\s+${ARABIC_STRUCT_ORD}|دراسة\\s+حالة)\\s*[:\\-–—])`, 'g'),
                '$1\n\n',
            );

            // 2. استخراج عنوان البحث الرئيسي إن وجد
            let detectedTitle = '';
            const titleMatch = cleanText.match(/(?:بحث\s+بعنوان|عنوان\s+البحث|موضوع\s+البحث)\s*[:\-]?\s*["«]?([^"\n\r»]+)["»]?/i);
            if (titleMatch) {
                detectedTitle = titleMatch[1].trim().replace(/^[:"«\s]+|[:"»\s]+$/g, '');
            }

            if (!detectedTitle) {
                const planTitleInQuotes = cleanText.match(/(?:خطة\s+البحث|فهرس\s+البحث)[^"\n\r»]*["«]([^"\n\r»]+)["»]/i);
                if (planTitleInQuotes) {
                    detectedTitle = planTitleInQuotes[1].trim().replace(/^[:"«\s]+|[:"»\s]+$/g, '');
                }
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
                if (/\|\s*(?:ص|صفحة)\s*\.?\s*\d*/i.test(trimmed)) {
                    planLinesWithPage.push(trimmed);
                } else {
                    nonPlanLines.push(line);
                }
            });

            if (planLinesWithPage.length >= 2) {
                extractedPlan = planLinesWithPage.join('\n');
                bodyText = nonPlanLines.join('\n');
            } else {
                // ب) فحص وجود كتلة صريحة تبدأ بـ "خطة البحث" أو "فهرس" قبل المقدمة الحقيقية
                const planHeaderRegex = /(?:^|\n)\s*(?:#+\s*)?(?:📋\s*)?(?:خطة\s+البحث(?:\s+المحسّنة|\s+المقترحة|\s+العامة)?|فهرس\s+البحث|فهرس\s+المحتويات|هيكل\s+البحث|الفهرس|المحتويات)[\s:\-]*/i;
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

                        if (/^(?:بحث\s+بعنوان|عنوان\s+البحث)\s*[:\-]/i.test(hl)) {
                            bodyStartIndexInLines = i;
                            break;
                        }

                        if (/^(?:المقدمة|مقدمة|مدخل\s+عام)[\s:\-]*$/i.test(hl)) {
                            let nextNonEmpty = '';
                            for (let j = i + 1; j < linesAfterPlan.length; j++) {
                                if (linesAfterPlan[j].trim()) {
                                    nextNonEmpty = stripStructuralMarkdown(linesAfterPlan[j]);
                                    break;
                                }
                            }
                            if (nextNonEmpty && !/^(?:المبحث|مبحث|المطلب|مطلب|دراسة\s+حالة|خاتمة|الخاتمة|مراجع|المراجع)/i.test(nextNonEmpty) && nextNonEmpty.length > 30) {
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
                            if (tr && /^(?:المبحث|مبحث|المطلب|مطلب|دراسة\s+حالة|المقدمة|مقدمة|الخاتمة|خاتمة|قائمة|المصادر|المراجع)/i.test(tr)) {
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
                    const introRegex = /(?:^|\n)\s*(?:#+\s*|\*{1,3}\s*)?(?:المقدمة|مقدمة|مدخل\s+عام)(?:\*{1,3})?[\s:\-]*\n/gi;
                    const matches = [...bodyText.matchAll(introRegex)];
                    if (matches.length >= 2) {
                        const firstIdx = matches[0].index;
                        const secondIdx = matches[1].index;
                        const between = bodyText.substring(firstIdx, secondIdx);
                        const betweenLines = between.split('\n').map(l => stripStructuralMarkdown(l)).filter(l => l);
                        const isOutlineOnly = betweenLines.every(l => l.length < 120 && /^(?:المبحث|مبحث|المطلب|مطلب|دراسة\s+حالة|المقدمة|مقدمة|الخاتمة|خاتمة|فهرس|خطة)/i.test(l));
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
            const isStructuralHeading = /^(?:المقدمة|مقدمة|مدخل\s+عام|مدخل|تمهيد|خطة\s+البحث|خطة|فهرس|المحتويات|هيكل\s+البحث|المبحث|مبحث|المطلب|مطلب|دراسة\s+حالة|الفرع|فرع|أولاً|ثانياً|ثالثاً|رابعاً|خامساً|الخاتمة|خاتمة|قائمة|المصادر|المراجع|الفصل|فصل|الباب|باب)(?:[\s:\-–—\(\[\{.\d]|$)/i;

            if (!detectedTitle && rawLines.length > 0) {
                const firstLine = rawLines[0].trim();
                const firstHeading = stripStructuralMarkdown(firstLine);
                if (!isStructuralHeading.test(firstHeading) && firstLine.length <= 250) {
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

            const mabhathHeadingRe = new RegExp(`^(?:المبحث|مبحث)\\s+${ARABIC_STRUCT_ORD}(?:[\\s:\\-–—\\.\\(/]|$)`, 'i');
            const matlabHeadingRe = new RegExp(`^(?:المطلب|مطلب)\\s+${ARABIC_STRUCT_ORD}(?:[\\s:\\-–—\\.\\(/]|$)`, 'i');
            const caseFirstHeadingRe = /^(?:أولاً|أولا)\s*[:\-–—\.]+/i;
            const caseSecondHeadingRe = /^(?:ثانياً|ثانيا)\s*[:\-–—\.]+/i;

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

                if (/^(?:بحث\s+بعنوان|عنوان\s+البحث|موضوع\s+البحث)\s*[:\-]/i.test(headingLine)) {
                    continue;
                }

                const cleanLineNoQuotes = headingLine.replace(/^[:"«'\s]+|[:"»'\s]+$/g, '').trim();
                if (detectedTitle && (cleanLineNoQuotes === detectedTitle || (titleLineToSkip && line === titleLineToSkip))) {
                    continue; // تجاوز سطر العنوان حتى لا يدخل في متن المقدمة أو يُنشئ صفحة منفردة
                }

                // المقدمة
                if (/^(?:المقدمة|مقدمة|مقدمة\s+البحث|مدخل\s+عام)[\s:\-]*$/i.test(headingLine)) {
                    flushPendingMabhathIfOrphaned();
                    startNewSection('intro', 'المقدمة', '');
                    pendingMabhath = '';
                    pendingPreambleLines = [];
                    resetCaseStudyState();
                    continue;
                }

                // الخاتمة
                if (/^(?:الخاتمة|الخـاتـمـــة|الخــاتـمـــة|خاتمة|خاتمة\s+البحث)[\s:\-]*$/i.test(headingLine)) {
                    flushPendingMabhathIfOrphaned();
                    startNewSection('conclusion', 'الخــاتـمـــة', '');
                    pendingMabhath = '';
                    pendingPreambleLines = [];
                    resetCaseStudyState();
                    continue;
                }

                // قائمة المراجع
                if (/^(?:قائمة\s+المصادر\s+والمراجع|المصادر\s+والمراجع|قائمة\s+المراجع|المراجع\s+والمصادر|المراجع)[\s:\-]*$/i.test(headingLine)) {
                    flushPendingMabhathIfOrphaned();
                    startNewSection('references', 'قائمة المصادر والمراجع', '');
                    pendingMabhath = '';
                    pendingPreambleLines = [];
                    resetCaseStudyState();
                    continue;
                }

                // المبحث (مع دعم الماركداون والشرطات والنقاط والأرقام)
                if (mabhathHeadingRe.test(headingLine)) {
                    flushPendingMabhathIfOrphaned();
                    pendingMabhath = headingLine;
                    pendingPreambleLines = [];
                    resetCaseStudyState();
                    continue;
                }

                // دراسة حالة (قسم مستقل قبل الخاتمة بدون تسميته كمبحث)
                const isExplicitCaseStudyColon = /^(?:دراسة\s+حالة|الجانب\s+التطبيقي\s*[:\-–—]?\s*دراسة\s+حالة)\s*[:\-–—]/i.test(headingLine);
                const isStandaloneCaseStudyTitle = /^دراسة\s+حالة(?:\s+(?:ميدانية|تطبيقية))?(?:\s+(?:حول|عن)\s+.+)?$/i.test(headingLine) && headingLine.length <= 75 && !/[.،؟!]$/.test(headingLine);
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
                    startNewSection('matlab', pendingMabhath, headingLine);
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
                    startNewSection('intro', 'المقدمة', '');
                }

                curSection.lines.push(line);
            }
            flushPendingMabhathIfOrphaned();
            if (curSection) rawSections.push(curSection);

            // تجهيز عناصر كل قسم (استخراج الإحالات وتحديد الارتفاعات التقريبية)
            const processedSections = [];
            let carryMabhathTitle = '';
            rawSections.forEach((sec) => {
                const contentLines = [];
                const rawFootnotes = [];
                let inFootnotesBlock = false;

                sec.lines.forEach(line => {
                    const trimmed = line.trim();
                    const headingTrimmed = stripStructuralMarkdown(trimmed);
                    if (/^(?:الهوامش|المراجع|قائمة\s+الهوامش|هوامش\s+الصفحة)\s*[:\-]?$/i.test(headingTrimmed)) {
                        inFootnotesBlock = true;
                        return;
                    }

                    const isCitationTerm = /(?:ص\s*\.?\s*\d+|دار\s+|نشر|مطبعة|طبعة|جامعة|مرجع\s+سبق|مجلة|أطروحة|مذكرة)/i.test(trimmed);
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
                    const splitted = splitInlineList(cl);
                    splitted.forEach(sp => {
                        if (sp && sp.trim()) expandedContentLines.push(sp.trim());
                    });
                });

                // تحويل أسطر المحتوى إلى عناصر هيكلية مع استخراج أرقام الإحالات وتحديد الارتفاع المتوقع
                const items = [];
                expandedContentLines.forEach((line, idx) => {
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
                        const prev = expandedContentLines[idx - 1].trim();
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
                            const prev = expandedContentLines[idx - 1].trim();
                            if (/^(?:[-*•–—]\s*)?(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)\s*[:/\-–—.]/i.test(prev) || /^\(?\d+[\.\-\)/:]\s+/.test(prev) || /^[-*•–—]\s+/.test(prev)) {
                                hasSiblingListItems = true;
                            }
                        }
                        if (idx + 1 < expandedContentLines.length) {
                            const next = expandedContentLines[idx + 1].trim();
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
                                       (isOrd && !inListContext && !hasSiblingListItems && processedLine.length < 100 && (idx + 1 < expandedContentLines.length && !/^(?:#+\s*)?(?:[-*•–—]\s*)?(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)\s*[:/\-–—.]/i.test(expandedContentLines[idx + 1]))) ||
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
export function parseRawText(rawInput: string): ParseResult {
            const { detectedTitle, extractedPlan, sections: processedSections } = analyzeResearchText(rawInput);

            // خوارزمية التوزيع على الصفحات وفق القواعد الأكاديمية:
            // 1. الانتقال إلى مبحث جديد (أو مقدمة أو خاتمة أو مراجع) يستلزم الانتقال لصفحة جديدة دائماً!
            // 2. الانتقال من مطلب إلى مطلب آخر داخل نفس المبحث لا يستلزم صفحة جديدة بل يواصل في نفس الصفحة إذا كان هناك متسع.
            const MAX_PAGE_HEIGHT_MM = 230; // الحد الأقصى الآمن للارتفاع بالمليمتر داخل إطار الصفحة
            const parsedPages = [];
            const recordedPlan = [];

            let curPageItems = [];
            let curPageMabhath = '';
            let curPageMatlab = '';
            let curHeight = 0;

            function getHeaderHeight(mabhath, matlab) {
                let h = 0;
                if (mabhath) h += 17;
                if (matlab) h += 14;
                return h;
            }

            function emitCurrentPage() {
                if (curPageItems.length === 0) return;

                // ربط الهوامش بالصفحة وإعادة ترقيمها محلياً من 1، 2، 3... لكل صفحة بدقة متناهية
                const pageFootnotes = [];

                curPageItems.forEach(it => {
                    if (it.citations && it.citations.length > 0) {
                        it.citations.forEach(c => {
                            if (c.text) {
                                let existingIndex = pageFootnotes.indexOf(c.text);
                                if (existingIndex === -1) {
                                    pageFootnotes.push(c.text);
                                    c.newPageNum = pageFootnotes.length;
                                } else {
                                    c.newPageNum = existingIndex + 1;
                                }
                            }
                        });
                    }
                });

                // توليد محتوى HTML مع أرقام الإحالات المعاد ضبطها للصفحة وتجميع عناصر القوائم داخل <ul>
                let contentHtml = '';
                let inList = false;

                curPageItems.forEach(it => {
                    let text = it.rawText || '';
                    if (it.citations && it.citations.length > 0) {
                        it.citations.forEach(c => {
                            if (c.newPageNum) {
                                text = text.replace(new RegExp(`<sup>${c.origNum}</sup>`, 'g'), `<sup>${c.newPageNum}</sup>`);
                            }
                        });
                    }

                    if (it.type === 'bullet') {
                        if (!inList) {
                            contentHtml += `<ul class="doc-ul">`;
                            inList = true;
                        }
                        const bulletFormatted = formatBulletContent(text);
                        contentHtml += `<li class="doc-li">${bulletFormatted}</li>`;
                    } else {
                        if (inList) {
                            contentHtml += `</ul>`;
                            inList = false;
                        }

                        if (it.type === 'matlab_header') {
                            contentHtml += `<div class="doc-matlab-title">${escapeHtml(it.cleanText)}</div>`;
                        } else if (it.type === 'subtitle') {
                            contentHtml += `<div class="doc-subtitle">${text.replace(/^#+\s*/, '')}</div>`;
                        } else {
                            contentHtml += `<p class="doc-paragraph">${text}</p>`;
                        }
                    }
                });

                if (inList) {
                    contentHtml += `</ul>`;
                    inList = false;
                }

                parsedPages.push({
                    mabhathTitle: curPageMabhath,
                    matlabTitle: curPageMatlab,
                    content: contentHtml,
                    footnotes: pageFootnotes
                });

                curPageItems = [];
                curPageMabhath = '';
                curPageMatlab = '';
                curHeight = 0;
            }

            processedSections.forEach(sec => {
                // فحص هل يجب فتح صفحة جديدة إجبارياً:
                // (المقدمة، الخاتمة، المراجع، أو بداية مبحث جديد بحيث sec.mabhathTitle غير فارغ)
                const isNewMajorSection = sec.type === 'intro' || sec.type === 'conclusion' || sec.type === 'references' || (sec.mabhathTitle && sec.mabhathTitle.trim() !== '');

                if (isNewMajorSection) {
                    if (curPageItems.length > 0) {
                        emitCurrentPage();
                    }
                    curPageMabhath = sec.mabhathTitle;
                    curPageMatlab = sec.matlabTitle;
                    curHeight = getHeaderHeight(curPageMabhath, curPageMatlab);

                    const curPageNum = parsedPages.length + 1;
                    if (sec.type === 'intro') {
                        if (!recordedPlan.some(e => e.type === 'intro')) {
                            recordedPlan.push({ type: 'intro', pageNum: curPageNum });
                        }
                    } else if (sec.type === 'conclusion') {
                        if (!recordedPlan.some(e => e.type === 'conclusion')) {
                            recordedPlan.push({ type: 'conclusion', pageNum: curPageNum });
                        }
                    } else if (sec.type === 'references') {
                        if (!recordedPlan.some(e => e.type === 'references')) {
                            recordedPlan.push({ type: 'references', pageNum: curPageNum });
                        }
                    } else {
                        recordedPlan.push({ type: 'mabhath', title: sec.mabhathTitle, pageNum: curPageNum });
                        if (sec.matlabTitle) {
                            recordedPlan.push({ type: 'matlab', title: sec.matlabTitle, pageNum: curPageNum });
                        }
                    }
                } else {
                    // مطلب إضافي يتبع لنفس المبحث الحالي:
                    // نتحقق إن كان هناك متسع في الصفحة الحالية لإكمال المطلب فيها
                    const matlabHeaderHeight = 14;
                    const firstItemHeight = sec.items.length > 0 ? sec.items[0].heightMm : 0;
                    const neededHeight = matlabHeaderHeight + firstItemHeight;

                    if (curPageItems.length > 0 && (curHeight + neededHeight > MAX_PAGE_HEIGHT_MM)) {
                        emitCurrentPage();
                        curPageMabhath = '';
                        curPageMatlab = sec.matlabTitle;
                        curHeight = 14;
                    } else {
                        // إكمال في نفس الصفحة!
                        if (curPageItems.length === 0) {
                            curPageMatlab = sec.matlabTitle;
                            curHeight = 14;
                        } else {
                            curPageItems.push({
                                type: 'matlab_header',
                                cleanText: sec.matlabTitle,
                                heightMm: matlabHeaderHeight,
                                citations: []
                            });
                            curHeight += matlabHeaderHeight;
                        }
                    }

                    const curPageNum = parsedPages.length + 1;
                    recordedPlan.push({ type: 'matlab', title: sec.matlabTitle, pageNum: curPageNum });
                }



                sec.items.forEach(item => {
                    let fnHeight = (item.citations ? item.citations.length : 0) * 6;
                    if (curPageItems.length > 0 && (curHeight + item.heightMm + fnHeight > MAX_PAGE_HEIGHT_MM)) {
                        emitCurrentPage();
                        curHeight = 0;
                    }
                    curPageItems.push(item);
                    curHeight += item.heightMm + fnHeight;
                });
            });

            if (curPageItems.length > 0) {
                emitCurrentPage();
            }

            if (parsedPages.length === 0) {
                throw new ParseError('لم يتم العثور على أقسام واضحة في النص. تأكد من احتواء النص على كلمات مثل (المقدمة، المبحث، المطلب، الخاتمة).');
            }


            // تحديث خطة البحث تلقائياً بالأقسام والصفحات الفعلية
            let updatedPlan = '';
            recordedPlan.forEach(entry => {
                const pNumStr = entry.pageNum < 10 ? `0${entry.pageNum}` : `${entry.pageNum}`;
                if (entry.type === 'intro') {
                    updatedPlan += `المقدمة | ص ${pNumStr}\n`;
                } else if (entry.type === 'conclusion') {
                    updatedPlan += `الخــاتـمـــة | ص ${pNumStr}\n`;
                } else if (entry.type === 'references') {
                    updatedPlan += `قائمة المصادر والمراجع | ص ${pNumStr}\n`;
                } else if (entry.type === 'mabhath') {
                    updatedPlan += `${entry.title} | ص ${pNumStr}\n`;
                } else if (entry.type === 'matlab') {
                    updatedPlan += `- ${entry.title} | ص ${pNumStr}\n`;
                }
            });

            return {
                pages: parsedPages,
                detectedTitle,
                planText: updatedPlan.trim() || extractedPlan.trim(),
            };
}
