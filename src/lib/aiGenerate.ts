// تنسيق مراحل التوليد بالذكاء الاصطناعي: خطة JSON ثم توليد متوازٍ للمقدمة والمباحث والخاتمة
import {
  LENGTH_CONFIGS,
  buildFallbackPlan,
  getDistinctFallbackMatalib,
  buildPlanPrompt,
  buildIntroPrompt,
  buildMabhathPrompt,
  buildMissingMatalibPrompt,
  buildCaseStudyPrompt,
  buildConclusionPrompt,
  cleanIntroText,
  fetchAiText,
} from './aiEngine';
import { rotateSystemGeminiKey } from './aiKeys';

export type AiProvider = 'gemini' | 'groq' | 'openai' | 'openrouter';
export type AiLength = 'short' | 'medium' | 'giant' | 'huge';

export const AI_PROVIDERS: Record<AiProvider, { label: string; hint: string; keyUrl?: string; keyLabel?: string; placeholder: string }> = {
  gemini: {
    label: 'Google Gemini',
    hint: 'Gemini 3.5 Flash-Lite & 3.5 Flash — فائق السرعة ومجاني (موصى به للطلبة)',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyLabel: 'احصل على مفتاح Gemini مجاني في 30 ثانية',
    placeholder: 'ألصق مفتاح Gemini هنا (يبدأ بـ AIzaSy...)',
  },
  groq: {
    label: 'Groq',
    hint: 'Llama 3.3 70B & 8B Instant — سرعة استثنائية',
    keyUrl: 'https://console.groq.com/keys',
    keyLabel: 'صفحة مفاتيح Groq المجانية',
    placeholder: 'ألصق مفتاح Groq هنا (يبدأ بـ gsk_...)',
  },
  openai: {
    label: 'OpenAI',
    hint: 'ChatGPT: GPT-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLabel: 'صفحة مفاتيح OpenAI',
    placeholder: 'ألصق مفتاح OpenAI هنا (يبدأ بـ sk-...)',
  },
  openrouter: {
    label: 'OpenRouter / DeepSeek',
    hint: 'مزود مخصص متوافق مع واجهة OpenAI',
    placeholder: 'ألصق مفتاح الـ API للمزود المخصص هنا',
  },
};

export const AI_LENGTHS: Record<AiLength, { label: string; target: string; mabhath: string; matlab: string }> = {
  medium: { label: 'بحث متوسط — الحجم القياسي الموصى به', target: '8 إلى 12 صفحة', mabhath: '2', matlab: '2' },
  short: { label: 'بحث موجز ومركز', target: '5 إلى 8 صفحات', mabhath: '1', matlab: '2' },
  giant: { label: 'بحث موسع ومعمق', target: '12 إلى 16 صفحة', mabhath: '2', matlab: '3' },
  huge: { label: 'بحث تخرج مطول', target: '20 إلى 25 صفحة', mabhath: '3', matlab: '3' },
};

export type SectionStatus = 'waiting' | 'running' | 'done' | 'error';
export interface SectionProgress {
  id: string;
  label: string;
  status: SectionStatus;
  words: number;
  seconds?: number;
}

export interface GenerateOptions {
  provider: AiProvider;
  apiKey: string;
  topic: string;
  length: AiLength;
  mabhathCount: string;
  matlabCount: string;
  /** اسم الشركة أو المؤسسة لإضافة قسم «دراسة حالة» قبل الخاتمة (اتركه فارغاً لتجاوزه). */
  caseStudyCompany?: string;
  customUrl?: string;
  customModel?: string;
  onSections: (sections: SectionProgress[]) => void;
  onDraft: (text: string, totalWords: number) => void;
  onModel: (model: string) => void;
  onStage: (stage: 'plan' | 'writing' | 'done') => void;
  /** توجيهات إضافية تُلحق بتعليمات المقدمة والمباحث والخاتمة (مثل تكييف الصياغة لشرائح العرض). لا تمس تعليمات الخطة. */
  promptAddendum?: string;
  /** تعديل الخطة بعد توليدها وقبل كتابة الأقسام (مثل فرض عدد ثابت من المباحث والمطالب). */
  normalizePlan?: (plan: AiPlan) => AiPlan;
}

const countWords = (txt: string) => (txt ? txt.trim().split(/\s+/).filter(Boolean).length : 0);
const cleanSection = (txt: string) => (txt ? txt.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim() : '');

export interface AiPlan {
  title: string;
  problematic?: string;
  questions?: string[];
  hypotheses?: string[];
  methodology?: string;
  mabahith: { title: string; matalib?: { title: string }[] }[];
}

const ORDINAL_WORDS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
const ARABIC_ORD_PATTERN = '(?:الأول|الاول|الثاني|الثانى|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي\\s+عشر|الثاني\\s+عشر|[\\d٠-٩]+)';

const ORDINAL_INDEX_MAP: Record<string, number> = {
  'الأول': 0, 'الاول': 0, '1': 0, '١': 0,
  'الثاني': 1, 'الثانى': 1, '2': 1, '٢': 1,
  'الثالث': 2, '3': 2, '٣': 2,
  'الرابع': 3, '4': 3, '٤': 3,
  'الخامس': 4, '5': 4, '٥': 4,
  'السادس': 5, '6': 5, '٦': 5,
};

function stripHeadingDisplayMarkdown(line: string): string {
  const s = (line || '')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ')
    .trim()
    .replace(/^(?:#+\s*|[-*•–—>\s]+)+/, '')
    .replace(/\*\*|__/g, '')
    .replace(/^\*+|\*+$/g, '')
    .replace(/^["«']+|["»']+$/g, '')
    .trim();

  const numberedStructMatch = s.match(
    /^(?:\(?\s*(?:[\d٠-٩]+|[أ-ي])\s*[\.\-\)\]:]+|\[\s*[\d٠-٩]+\s*\]\s*)\s*((?:(?:ال)?(?:مبحث|مطلب|مقدمة|خاتمة|هوامش|قائمة\s+المصادر)|دراسة\s+حالة|أولاً|أولا|ثانياً|ثانيا).*)$/i,
  );
  return numberedStructMatch ? numberedStructMatch[1].trim() : s;
}

function stripHeadingMarkdown(line: string): string {
  let s = (line || '')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ')
    .trim()
    .replace(/^(?:#+\s*|[-*•–—>\s]+)+/, '')
    .replace(/\*\*|__/g, '')
    .replace(/^\*+|\*+$/g, '')
    .replace(/^["«']+|["»']+$/g, '')
    .replace(/[\u064B-\u065F\u0670ـ]/g, '')
    .trim();

  // إزالة الترقيم التمهيدي مثل "3. المطلب الثالث:" أو "(3) المطلب" أو "ثالثاً: المطلب" فقط عندما يسبق عنواناً هيكلياً
  const numberedStructMatch = s.match(
    /^(?:\(?\s*(?:[\d٠-٩]+|[أ-ي])\s*[\.\-\)\]:]+|\[\s*[\d٠-٩]+\s*\]\s*|(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا)\s*[:\-–—.]?)\s*((?:(?:ال)?(?:مبحث|مطلب|مقدمة|خاتمة|هوامش|قائمة\s+المصادر)|دراسة\s+حالة).*)$/i,
  );
  if (numberedStructMatch) {
    s = numberedStructMatch[1].trim();
  }

  // توحيد صيغة "المطلب رقم 3:" أو "المطلب3:" إلى "المطلب 3:"
  s = s.replace(/^(المبحث|مبحث|المطلب|مطلب)\s*(?:رقم\s*)?([\d٠-٩]+)/i, '$1 $2');
  return s;
}

function splitInlineStructuralHeadings(text: string): string {
  return (text || '').replace(
    new RegExp(`([\\.!\\?؟]|\\^\\d+|\\[\\d+\\])\\s+(?=(?:\\*{1,3}|#+\\s*)?(?:المبحث|المطلب)\\s+${ARABIC_ORD_PATTERN}\\s*[:\\-–—])`, 'g'),
    '$1\n\n',
  );
}

function stripStructuralPrefix(title: string, keyword: 'مبحث' | 'مطلب'): string {
  const cleaned = stripHeadingMarkdown(title);
  return cleaned
    .replace(new RegExp(`^(?:ال)?${keyword}\\s+${ARABIC_ORD_PATTERN}(?:\\s*[:：\\-–—\\.]+)?\\s*`, 'i'), '')
    .replace(new RegExp(`^(?:ال)?${keyword}\\s*[:：\\-–—]+\\s*`, 'i'), '')
    .trim();
}

function normalizeArabicComparable(text: string): string {
  return (text || '')
    .replace(/[\u064B-\u065F\u0670ـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064Aa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toComparisonTokens(subTitle: string, topic: string): string[] {
  const normSub = normalizeArabicComparable(subTitle);
  const normTopic = normalizeArabicComparable(topic);
  const stopWords = new Set(['في', 'من', 'علي', 'إلي', 'الي', 'عن', 'مع', 'حول', 'بين', 'لـ', 'ال', 'و', 'او', 'ثم', 'حيث', 'دراسه', 'تحليل']);
  const topicTokens = new Set(normTopic.split(' ').filter((w) => w.length >= 3));

  const withoutTopicStr = normTopic.length >= 3 ? normSub.split(normTopic).join(' ') : normSub;
  const rawTokens = withoutTopicStr.split(' ').filter(Boolean);
  const filtered = rawTokens.filter((tok) => {
    const bare = tok.replace(/^(?:وال|بال|كال|فال|لل|ال|ل)/, '');
    if (stopWords.has(tok) || stopWords.has(bare)) return false;
    if (topicTokens.has(tok) || (bare.length >= 3 && topicTokens.has(bare))) return false;
    return tok.length >= 2;
  });

  // إذا كان العنوان مبنياً حصراً من كلمات الموضوع، نبقي الرموز الأصلية بدون حذف كلمات الموضوع
  if (filtered.length === 0) {
    return rawTokens.filter((t) => t.length >= 2 && !stopWords.has(t));
  }
  return filtered;
}

function isTooSimilarHeading(subTitle: string, existingTokenLists: string[][], topic: string): boolean {
  const tokens = toComparisonTokens(subTitle, topic);
  if (tokens.length === 0) return true;
  const sig = tokens.join(' ');
  const tokSet = new Set(tokens);

  for (const prev of existingTokenLists) {
    if (prev.length === 0) continue;
    if (prev.join(' ') === sig) return true;
    const prevSet = new Set(prev);
    let overlap = 0;
    for (const t of tokSet) {
      if (prevSet.has(t)) overlap++;
    }
    const minLen = Math.min(tokSet.size, prevSet.size);
    const maxLen = Math.max(tokSet.size, prevSet.size);
    if (minLen === 1 && maxLen <= 2 && overlap === 1) return true;
    if (minLen >= 2 && overlap / minLen >= 0.78) return true;
  }
  return false;
}

export function parseAiPlanJson(planRaw: string): AiPlan | null {
  if (!planRaw) return null;
  try {
    let json = planRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const f = json.indexOf('{');
    const l = json.lastIndexOf('}');
    if (f !== -1 && l !== -1 && l > f) json = json.substring(f, l + 1);
    json = json.replace(/,\s*([}\]])/g, '$1');
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as AiPlan;
  } catch {
    return null;
  }
}

/**
 * توحيد الخطة الأكاديمية وضبط عدد المباحث والمطالب الدقيق (mCount × tCount)،
 * ومنع تكرار مطالب المبحث الأول داخل المبحث الثاني أو الثالث أو أي مبحث آخر.
 */
export function normalizeResearchPlan(
  rawPlan: AiPlan | null | undefined,
  topic: string,
  mabhathCountRaw: string | number,
  matlabCountRaw: string | number,
): AiPlan {
  const exactTopic = (topic || rawPlan?.title || '').trim() || 'موضوع البحث';
  const mCount = Math.max(1, Math.min(6, parseInt(String(mabhathCountRaw), 10) || 2));
  const tCount = Math.max(1, Math.min(6, parseInt(String(matlabCountRaw), 10) || 2));
  const fb = buildFallbackPlan(exactTopic, mCount, tCount, 'medium') as AiPlan;

  const usedMbTokens: string[][] = [];
  const usedMtTokens: string[][] = [];
  const normalizedMabahith: { title: string; matalib: { title: string }[] }[] = [];

  for (let i = 0; i < mCount; i++) {
    const rawMb = rawPlan?.mabahith?.[i];
    const fbMbSub = stripStructuralPrefix(fb.mabahith[i]?.title || '', 'مبحث') || `المحور ${ORDINAL_WORDS[i] || i + 1}`;
    let mbSub = stripStructuralPrefix(rawMb?.title || '', 'مبحث');
    if (!mbSub || mbSub.startsWith('[') || isTooSimilarHeading(mbSub, usedMbTokens, exactTopic)) {
      mbSub = fbMbSub;
    }
    usedMbTokens.push(toComparisonTokens(mbSub, exactTopic));

    // جمع قائمة مرشحين احتياطيين متميزين لهذا المبحث (ثم من المباحث المجاورة عند الحاجة)
    const fallbackPool: string[] = [];
    for (let shift = 0; shift < 5; shift++) {
      fallbackPool.push(...(getDistinctFallbackMatalib(exactTopic, i + shift, 6) as string[]));
    }

    const matalib: { title: string }[] = [];
    for (let j = 0; j < tCount; j++) {
      const rawMtTitle = rawMb?.matalib?.[j]?.title || '';
      let mtSub = stripStructuralPrefix(rawMtTitle, 'مطلب');
      if (!mtSub || mtSub.startsWith('[') || isTooSimilarHeading(mtSub, usedMtTokens, exactTopic)) {
        const picked = fallbackPool.find((cand) => !isTooSimilarHeading(cand, usedMtTokens, exactTopic));
        mtSub = picked || fallbackPool[j % fallbackPool.length] || `المحور التطبيقي ${ORDINAL_WORDS[j] || j + 1}`;
      }
      usedMtTokens.push(toComparisonTokens(mtSub, exactTopic));
      matalib.push({
        title: `المطلب ${ORDINAL_WORDS[j] || j + 1}: ${mtSub}`,
      });
    }

    normalizedMabahith.push({
      title: `المبحث ${ORDINAL_WORDS[i] || i + 1}: ${mbSub}`,
      matalib,
    });
  }

  return {
    title: exactTopic,
    problematic: rawPlan?.problematic?.trim() || fb.problematic,
    questions: Array.isArray(rawPlan?.questions) ? rawPlan.questions : fb.questions,
    hypotheses: Array.isArray(rawPlan?.hypotheses) && rawPlan.hypotheses.length ? rawPlan.hypotheses : fb.hypotheses,
    methodology: rawPlan?.methodology?.trim() || fb.methodology,
    mabahith: normalizedMabahith,
  };
}

/**
 * تنظيف نص المبحث المتولد من علامات الماركداون حول العناوين، ومنع تسرب مبحث إضافي أو خاتمة داخل نفس الاستجابة
 */
export function sanitizeMabhathOutput(
  rawText: string,
  mb: { title: string; matalib?: { title: string }[] },
): string {
  const cleanedRaw = splitInlineStructuralHeadings(cleanSection(rawText).replace(/\r\n/g, '\n'));
  if (!cleanedRaw) return '';

  const mabhathHeadingRe = new RegExp(`^(?:المبحث|مبحث)\\s+${ARABIC_ORD_PATTERN}(?:[\\s:\\-–—\\.\\(/]|$)`, 'i');
  const matlabHeadingRe = new RegExp(`^(?:المطلب|مطلب)\\s+${ARABIC_ORD_PATTERN}(?:[\\s:\\-–—\\.\\(/]|$)`, 'i');
  const footnotesHeadingRe = /^(?:الهوامش|المراجع|قائمة\s+الهوامش|هوامش\s+الصفحة)\s*[:\-]?$/i;
  const conclusionHeadingRe = /^(?:الخاتمة|الخـاتـمـــة|الخــاتـمـــة|خاتمة|خاتمة\s+البحث|قائمة\s+المصادر\s+والمراجع|المصادر\s+والمراجع)\s*[:\-]?$/i;

  const lines = cleanedRaw.split('\n');
  const out: string[] = [];
  let seenMabhathHeader = false;
  let seenMatlabHeader = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      out.push('');
      continue;
    }

    const stripped = stripHeadingMarkdown(trimmed);

    if (conclusionHeadingRe.test(stripped) && seenMatlabHeader) {
      break;
    }

    if (mabhathHeadingRe.test(stripped)) {
      if (!seenMabhathHeader && !seenMatlabHeader) {
        out.push(mb.title);
        seenMabhathHeader = true;
        continue;
      }
      // إذا تسرّب عنوان مبحث جديد بعد كتابة مطالب داخل هذا المبحث، نوقف القراءة قبله تماماً
      if (seenMatlabHeader) {
        break;
      }
      continue;
    }

    if (matlabHeadingRe.test(stripped)) {
      seenMatlabHeader = true;
      out.push(stripped);
      continue;
    }

    if (footnotesHeadingRe.test(stripped)) {
      out.push(stripped.endsWith(':') ? stripped : `${stripped}:`);
      continue;
    }

    out.push(trimmed);
  }

  let res = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (seenMatlabHeader && !seenMabhathHeader) {
    res = `${mb.title}\n\n${res}`;
  }
  return res;
}

/**
 * اكتشاف المطالب الناقصة أو المبتورة داخل نص مبحث معين لإكمالها آلياً دون فقدان أي مطلب
 */
export function findMissingMatalibIndices(
  mabhathText: string,
  expectedMatalib: { title: string }[],
): number[] {
  const count = expectedMatalib?.length || 0;
  if (count === 0) return [];
  const lines = splitInlineStructuralHeadings(mabhathText || '').replace(/\r\n/g, '\n').split('\n');
  const matlabRe = new RegExp(`^(?:المطلب|مطلب)\\s+(${ARABIC_ORD_PATTERN})(?:[\\s:\\-–—\\.\\(/]|$)`, 'i');
  const footnotesRe = /^(?:الهوامش|المراجع|قائمة\s+الهوامش)\s*[:\-]?$/i;

  const sectionBodies = new Map<number, number>();
  let curOrdIdx: number | null = null;
  let curBodyChars = 0;

  const commitCurrent = () => {
    if (curOrdIdx !== null) {
      const prev = sectionBodies.get(curOrdIdx) || 0;
      sectionBodies.set(curOrdIdx, Math.max(prev, curBodyChars));
    }
  };

  for (const line of lines) {
    const stripped = stripHeadingMarkdown(line);
    if (!stripped) continue;

    const m = stripped.match(matlabRe);
    if (m) {
      commitCurrent();
      const ordKey = m[1].replace(/\s+/g, ' ').trim();
      curOrdIdx = ORDINAL_INDEX_MAP[ordKey] ?? null;
      curBodyChars = 0;
      continue;
    }

    if (curOrdIdx !== null) {
      if (footnotesRe.test(stripped) || /^[\^\[\(]?\s*\d+/.test(stripped)) continue;
      curBodyChars += stripped.length;
    }
  }
  commitCurrent();

  const missing: number[] = [];
  for (let k = 0; k < count; k++) {
    const chars = sectionBodies.get(k) || 0;
    if (chars < 20) missing.push(k);
  }
  return missing;
}

function stripContinuationDuplicateHeader(text: string, missingMatalib?: { title: string }[]): string {
  const lines = splitInlineStructuralHeadings(cleanSection(text).replace(/\r\n/g, '\n')).split('\n');
  const mbRe = new RegExp(`^(?:المبحث|مبحث)\\s+${ARABIC_ORD_PATTERN}(?:[\\s:\\-–—\\.\\(/]|$)`, 'i');
  const mtRe = new RegExp(`^(?:المطلب|مطلب)\\s+${ARABIC_ORD_PATTERN}(?:[\\s:\\-–—\\.\\(/]|$)`, 'i');
  const out: string[] = [];
  let startedBodyOrMatlab = false;
  let mappedCount = 0;

  for (const l of lines) {
    const stripped = stripHeadingMarkdown(l);
    if (!startedBodyOrMatlab && (!stripped || mbRe.test(stripped))) {
      continue;
    }
    if (mtRe.test(stripped)) {
      startedBodyOrMatlab = true;
      // إذا أعاد النموذج ترقيماً خاطئاً مثل "المطلب الأول" أثناء الاستكمال، نصحح العنوان ليطابق المطلب الناقص الفعلي
      const canonical = missingMatalib && missingMatalib[mappedCount] ? missingMatalib[mappedCount].title : stripped;
      out.push(canonical);
      mappedCount++;
      continue;
    }
    if (mbRe.test(stripped) && startedBodyOrMatlab) {
      break;
    }
    if (stripped) startedBodyOrMatlab = true;
    out.push(l);
  }

  let res = out.join('\n').trim();
  // إذا كتب النموذج متن المطلب الناقص مباشرة بدون سطر العنوان، ندرج عنوان المطلب المتوقع أعلى المتن
  if (res && mappedCount === 0 && missingMatalib && missingMatalib[0]?.title) {
    res = `${missingMatalib[0].title}\n${res}`;
  }
  return res;
}

function trimTrailingEmptyMatlabStub(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const matlabRe = new RegExp(`^(?:المطلب|مطلب)\\s+${ARABIC_ORD_PATTERN}(?:[\\s:\\-–—\\.\\(]|$)`, 'i');
  while (lines.length > 0 && !lines[lines.length - 1].trim()) {
    lines.pop();
  }
  if (lines.length > 0 && matlabRe.test(stripHeadingMarkdown(lines[lines.length - 1]))) {
    lines.pop();
  }
  return lines.join('\n').trim();
}

/**
 * تنظيف نص «دراسة حالة» وتثبيت عنوانها الرئيسي بصيغة «دراسة حالة: [اسم المؤسسة]»
 * مع استبعاد أي تسمية كمبحث أو تسرب للخاتمة أو المراجع النهائية.
 */
export function sanitizeCaseStudyOutput(rawText: string, company: string): string {
  const cleanCompany = (company || '').trim();
  if (!cleanCompany) return cleanSection(rawText);
  const canonicalHeader = `دراسة حالة: ${cleanCompany}`;
  const cleanedRaw = splitInlineStructuralHeadings(cleanSection(rawText).replace(/\r\n/g, '\n'));
  if (!cleanedRaw) return '';

  const accidentalMabhathRe = new RegExp(`^(?:المبحث|مبحث)\\s+${ARABIC_ORD_PATTERN}(?:[\\s:\\-–—\\.\\(/]|$)`, 'i');
  const caseLineRe = /^(?:دراسة\s+حالة|الجانب\s+التطبيقي\s*[:\-–—]?\s*دراسة\s+حالة)(?:[\s:\-–—]|$)/i;
  const stopLeakRe = /^(?:الخاتمة|الخـاتـمـــة|الخــاتـمـــة|خاتمة|خاتمة\s+البحث|قائمة\s+المصادر\s+والمراجع|المصادر\s+والمراجع)\s*[:\-]?$/i;
  const footnotesHeadingRe = /^(?:الهوامش|المراجع|قائمة\s+الهوامش|هوامش\s+الصفحة)\s*[:\-]?$/i;
  const firstSubRe = /^(?:أولاً|أولا)\s*[:\-–—\.]+/i;
  const secondSubRe = /^(?:ثانياً|ثانيا)\s*[:\-–—\.]+/i;

  const lines = cleanedRaw.split('\n');
  const out: string[] = [];
  let seenCaseHeader = false;
  let seenFirst = false;
  let seenSecond = false;
  let hasInnerFirst = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      out.push('');
      continue;
    }

    const stripped = stripHeadingMarkdown(trimmed);
    const displayStripped = stripHeadingDisplayMarkdown(trimmed);
    const isBulletPrefixed = /^[-*•]\s*/.test(trimmed);

    if (stopLeakRe.test(stripped) && (seenFirst || seenSecond)) {
      break;
    }

    // ضمان تثبيت العنوان الأول بصيغة «دراسة حالة: ...» ومنع وصفه كمبحث
    if (!seenCaseHeader && (caseLineRe.test(stripped) || accidentalMabhathRe.test(stripped))) {
      out.push(canonicalHeader);
      seenCaseHeader = true;
      continue;
    }

    if (seenCaseHeader && caseLineRe.test(stripped) && stripped.length <= 140) {
      continue;
    }

    if (!seenFirst && !isBulletPrefixed && firstSubRe.test(stripped) && stripped.length <= 130 && !/[.،؟!]$/.test(stripped)) {
      out.push(displayStripped);
      seenFirst = true;
      hasInnerFirst = false;
      continue;
    }

    if (seenFirst && !seenSecond) {
      if (firstSubRe.test(stripped)) {
        hasInnerFirst = true;
      } else if (secondSubRe.test(stripped)) {
        if (!isBulletPrefixed && !hasInnerFirst && stripped.length <= 110 && !/[.،؟!]$/.test(stripped)) {
          out.push(displayStripped);
          seenSecond = true;
          continue;
        }
        hasInnerFirst = false;
      }
    }

    if (footnotesHeadingRe.test(stripped)) {
      out.push(stripped.endsWith(':') ? stripped : `${stripped}:`);
      continue;
    }

    out.push(trimmed);
  }

  let res = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (res && !seenCaseHeader) {
    res = `${canonicalHeader}\n\n${res}`;
  }
  return res;
}

export async function generateResearch(o: GenerateOptions): Promise<string> {
  const cfg = LENGTH_CONFIGS[o.length] || LENGTH_CONFIGS.medium;
  const started = Date.now();
  const elapsed = () => Math.round((Date.now() - started) / 100) / 10;
  const call = (prompt: string, onChunk: ((c: string, acc: string) => void) | null, opts: Record<string, unknown>) =>
    fetchAiText(o.provider, o.apiKey, prompt, onChunk, { ...opts, onModelSelect: o.onModel }, o.customUrl, o.customModel) as Promise<string>;
  const withAddendum = (prompt: string) => (o.promptAddendum ? `${prompt}\n\n${o.promptAddendum}` : prompt);
  const caseCompany = (o.caseStudyCompany || '').trim();
  const hasCaseStudy = caseCompany.length > 0;

  let sections: SectionProgress[] = [{ id: 'plan', label: 'خطة البحث', status: 'running', words: 0 }];
  const emit = () => o.onSections(sections.map((s) => ({ ...s })));
  const patch = (id: string, p: Partial<SectionProgress>) => {
    sections = sections.map((s) => (s.id === id ? { ...s, ...p } : s));
    emit();
  };
  emit();
  o.onStage('plan');

  // 1. توليد خطة البحث الحقيقية بصيغة JSON من النموذج
  let planRaw = '';
  try {
    planRaw = await call(buildPlanPrompt(o.topic, o.mabhathCount, o.matlabCount, cfg), null, {
      temperature: 0.25,
      maxTokens: 2400,
    });
  } catch (errPlan) {
    console.warn('تعذر توليد الخطة بالنموذج، الاعتماد على الخطة المنهجية الذكية:', errPlan);
    planRaw = '';
  }

  let plan: AiPlan | null = parseAiPlanJson(planRaw);
  const exactUserTopic = o.topic.trim();
  if (!plan || !plan.mabahith?.length) {
    plan = buildFallbackPlan(exactUserTopic, o.mabhathCount, o.matlabCount, o.length) as AiPlan;
  }
  // ضبط العدد الدقيق للمباحث والمطالب (مثل 3×3) ومنع أي تكرار في خطة المباحث
  plan = normalizeResearchPlan(plan, exactUserTopic, o.mabhathCount, o.matlabCount);
  if (o.normalizePlan) plan = o.normalizePlan(plan);
  plan.title = exactUserTopic;
  const p = plan;

  // شارات التوليد المتوازي اللحظي لكل الأقسام
  sections = [
    { id: 'plan', label: 'خطة البحث', status: 'done', words: 0, seconds: elapsed() },
    { id: 'intro', label: 'المقدمة', status: 'running', words: 0 },
    ...p.mabahith.map((_, i) => ({ id: `mb${i}`, label: `المبحث ${i + 1}`, status: 'running' as const, words: 0 })),
    ...(hasCaseStudy ? [{ id: 'casestudy', label: 'دراسة حالة', status: 'running' as const, words: 0 }] : []),
    { id: 'conclusion', label: 'الخاتمة والمراجع', status: 'running', words: 0 },
  ];
  emit();
  o.onStage('writing');

  // 2. التوليد المتوازي الحقيقي للمقدمة والمباحث ودراسة الحالة (إن وجدت) والخاتمة بالتزامن عبر Promise.all
  let intro = '';
  const mbTexts: string[] = new Array(p.mabahith.length).fill('');
  let caseStudy = '';
  let conclusion = '';

  const refreshDraft = () => {
    const cleanedIntro = cleanIntroText(intro);
    const total =
      countWords(cleanedIntro) +
      mbTexts.reduce((a, t) => a + countWords(t), 0) +
      (hasCaseStudy ? countWords(caseStudy) : 0) +
      countWords(conclusion);
    let draft = `بحث بعنوان: ${p.title}\n\n` + (cleanedIntro ? cleanedIntro.trim() + '\n\n' : 'المقدمة:\n(جاري الكتابة بالبث المباشر بالتوازي...)\n\n');
    p.mabahith.forEach((mb, i) => {
      draft += mbTexts[i] ? mbTexts[i].trim() + '\n\n' : `${mb.title || `المبحث ${i + 1}`}\n(جاري تحرير المتن بالتوازي...)\n\n`;
    });
    if (hasCaseStudy) {
      draft += caseStudy ? caseStudy.trim() + '\n\n' : `دراسة حالة: ${caseCompany}\n(جاري تحرير دراسة الحالة بالتوازي...)\n\n`;
    }
    draft += conclusion ? conclusion.trim() : 'الخـاتـمـــة:\n(جاري الصياغة واستخراج قائمة المصادر والمراجع...)';
    o.onDraft(draft, total);
  };

  const track = (id: string, setter: (v: string) => void) => ({
    onChunk: (_c: string, acc: string) => {
      setter(acc);
      patch(id, { words: countWords(acc) });
      refreshDraft();
    },
    done: (res: string) => {
      setter(res);
      patch(id, { status: 'done', words: countWords(res), seconds: elapsed() });
      refreshDraft();
      return res;
    },
    fail: (err: unknown) => {
      console.warn(`Section ${id} failed:`, err);
      patch(id, { status: 'error' });
      throw err;
    },
  });

  // مهلة مساعدة لتفادي التزاحم الفجائي على الـ API في نفس المللي ثانية
  const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // مهمة المقدمة (تبدأ فوراً) مع تنقية الإشكالية واستبعاد أي تساؤلات فرعية
  const tIntro = {
    onChunk: (_c: string, acc: string) => {
      intro = acc;
      patch('intro', { words: countWords(cleanIntroText(acc)) });
      refreshDraft();
    },
    done: (res: string) => {
      const cleaned = cleanIntroText(res);
      intro = cleaned;
      patch('intro', { status: 'done', words: countWords(cleaned), seconds: elapsed() });
      refreshDraft();
      return cleaned;
    },
    fail: (err: unknown) => {
      console.warn('Section intro failed:', err);
      patch('intro', { status: 'error' });
      throw err;
    },
  };
  const taskIntro = call(withAddendum(buildIntroPrompt(p, cfg, caseCompany)), tIntro.onChunk, {
    temperature: 0.35,
    maxTokens: cfg.introMaxTokens,
  }).then(tIntro.done, tIntro.fail);

  // مهام المباحث بالتوازي مع تحقق واستكمال آلي للمطالب الناقصة عند انقطاع البث أو اختصار النموذج
  const perMb = Math.round(cfg.mabahithWords / (p.mabahith.length || 1));
  const taskMbs = p.mabahith.map(async (mb, idx) => {
    await waitMs(350 * (idx + 1));
    const t = track(`mb${idx}`, (v) => (mbTexts[idx] = v));
    try {
      const expectedMatalib = mb.matalib || [];
      const dynamicMaxTokens = Math.min(8192, Math.max(cfg.mabhathMaxTokens, expectedMatalib.length * 1400));
      const rawMbText = await call(withAddendum(buildMabhathPrompt(p, mb, perMb, cfg)), t.onChunk, {
        temperature: 0.35,
        maxTokens: dynamicMaxTokens,
      });

      let verifiedMbText = sanitizeMabhathOutput(rawMbText, mb);
      let missingIndices = findMissingMatalibIndices(verifiedMbText, expectedMatalib);

      if (missingIndices.length > 0 && expectedMatalib.length > 0) {
        const missingMatalib = missingIndices.map((k) => expectedMatalib[k]).filter(Boolean);
        const perMatlabWords = Math.max(120, Math.round(perMb / expectedMatalib.length));
        try {
          const contRaw = await call(
            withAddendum(buildMissingMatalibPrompt(p, mb, missingMatalib, perMatlabWords, cfg)),
            (_c, acc) => {
              const previewCombined = `${trimTrailingEmptyMatlabStub(verifiedMbText)}\n\n${stripContinuationDuplicateHeader(acc, missingMatalib)}`;
              mbTexts[idx] = previewCombined;
              patch(`mb${idx}`, { words: countWords(previewCombined) });
              refreshDraft();
            },
            {
              temperature: 0.35,
              maxTokens: Math.min(8192, Math.max(2000, missingMatalib.length * 1600)),
            },
          );
          const cleanCont = stripContinuationDuplicateHeader(contRaw, missingMatalib);
          if (cleanCont) {
            const baseText = trimTrailingEmptyMatlabStub(verifiedMbText) || mb.title;
            verifiedMbText = sanitizeMabhathOutput(`${baseText}\n\n${cleanCont}`, mb);
          }
        } catch (errCont) {
          console.warn(`Continuation for mb${idx} failed:`, errCont);
        }

        // تحقق ثانٍ: إذا بقي أي مطلب ناقص بعد الاستكمال الأول (مثلاً بسبب حد الحصة أو توقف جزئي)، نعيد المحاولة له منفرداً مع تدوير المفتاح
        missingIndices = findMissingMatalibIndices(verifiedMbText, expectedMatalib);
        if (missingIndices.length > 0) {
          if (o.provider === 'gemini') rotateSystemGeminiKey();
          await waitMs(1200);
          for (const mk of missingIndices) {
            const targetMt = expectedMatalib[mk];
            if (!targetMt) continue;
            try {
              const retryRaw = await call(
                withAddendum(buildMissingMatalibPrompt(p, mb, [targetMt], perMatlabWords, cfg)),
                null,
                {
                  temperature: 0.3,
                  maxTokens: 2000,
                },
              );
              const cleanRetry = stripContinuationDuplicateHeader(retryRaw, [targetMt]);
              if (cleanRetry) {
                const baseText = trimTrailingEmptyMatlabStub(verifiedMbText) || mb.title;
                verifiedMbText = sanitizeMabhathOutput(`${baseText}\n\n${cleanRetry}`, mb);
              }
            } catch (errRetry) {
              console.warn(`Retry continuation for mb${idx} matlab ${mk} failed:`, errRetry);
            }
          }
        }
      }

      return t.done(verifiedMbText || rawMbText);
    } catch (err) {
      return t.fail(err);
    }
  });

  // مهمة دراسة الحالة التطبيقية (تُنَفَّذ فقط عند إدخال اسم شركة/مؤسسة) وتوضع بعد المباحث وقبل الخاتمة
  const taskCaseStudy = hasCaseStudy
    ? (async () => {
        await waitMs(350 * (p.mabahith.length + 1));
        const tCs = track('casestudy', (v) => (caseStudy = v));
        try {
          const rawCs = await call(withAddendum(buildCaseStudyPrompt(p, caseCompany, cfg)), tCs.onChunk, {
            temperature: 0.35,
            maxTokens: 2800,
          });
          const cleanedCs = sanitizeCaseStudyOutput(rawCs, caseCompany);
          return tCs.done(cleanedCs || rawCs);
        } catch (err) {
          return tCs.fail(err);
        }
      })()
    : Promise.resolve('');

  // مهمة الخاتمة والمراجع مع إرجاء زمني خفيف
  const tConc = track('conclusion', (v) => (conclusion = v));
  const taskConc = (async () => {
    await waitMs(350 * (p.mabahith.length + (hasCaseStudy ? 2 : 1)));
    return call(withAddendum(buildConclusionPrompt(p, cfg, caseCompany)), tConc.onChunk, {
      temperature: 0.35,
      maxTokens: cfg.conclusionMaxTokens,
    }).then(tConc.done, tConc.fail);
  })();

  // تنفيذ جميع الأقسام بالتوازي التام
  await Promise.all([taskIntro, ...taskMbs, taskCaseStudy, taskConc]);
  o.onStage('done');

  const cleanedIntro = cleanIntroText(intro);
  const parts = [
    `بحث بعنوان: ${p.title.replace(/^#+\s*/, '').trim()}`,
    cleanSection(cleanedIntro),
    ...mbTexts.map(cleanSection),
    ...(hasCaseStudy ? [cleanSection(sanitizeCaseStudyOutput(caseStudy, caseCompany))] : []),
    cleanSection(conclusion),
  ].filter(Boolean);
  const finalText = parts.join('\n\n');
  o.onDraft(finalText, countWords(finalText));
  return finalText;
}
