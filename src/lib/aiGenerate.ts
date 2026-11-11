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
  caseStudyCompany?: string;
  mabahith: { title: string; matalib?: { title: string }[] }[];
}

export interface ExtractedTopicCaseStudy {
  /** هل احتوى العنوان طلب «دراسة حالة» */
  hasKeyword: boolean;
  /** اسم الشركة أو المؤسسة المستخرج من العنوان إن وُجد صراحة */
  company: string;
  /** عنوان البحث النظيف للغلاف (بدون عبارة «دراسة حالة ...» وما يتبعها) */
  coverTitle: string;
  /** موضوع البحث الأساسي المستخدم في المباحث والمحور التطبيقي */
  coreTopic: string;
}

export interface CaseStudyResolution {
  hasCaseStudy: boolean;
  source: 'none' | 'explicit' | 'title-named' | 'title-inferred';
  company: string;
  /** عنوان البحث المعتمد للغلاف بدون أي «دراسة حالة ...» */
  coverTitle: string;
  coreTopic: string;
}

const METHODOLOGY_PREFIX_RE = /(?:^|[\s،,])(?:منهج|منهجية|منهجيه|أسلوب|اسلوب|طريقة|طريقه|تقنية|تقنيه|أداة|اداة|مفهوم|ماهية|ماهيه|استراتيجية|استراتيجيه|استخدام|تطبيق|أهمية|اهمية|دور)\s*$/;
const CASE_QUALIFIERS_RE = /^(?:تطبيقية|تطبيقيه|ميدانية|ميدانيه|تحليلية|تحليليه|وصفية|وصفيه|استطلاعية|استطلاعيه|استكشافية|استكشافيه|تشخيصية|تشخيصيه|واقعية|واقعيه|عملية|عمليه|علمية|علميه|مقارنة|مقارنه|نموذجية|نموذجيه|شاملة|شامله|مختصرة|مختصره|مصغرة|مصغره)(?=$|\s|[:\-–—،,/|؛])/;
const ENTITY_PREFIX_NOUNS = 'مؤسسة|مؤسسه|شركة|شركه|بنك|مصرف|مجمع|مصنع|مديرية|مديريه|مستشفى|مستشفي|بلدية|بلديه|ولاية|ولايه|دائرة|دائره|جامعة|جامعه|كلية|كليه|معهد|ديوان|وكالة|وكاله|هيئة|هيئه|مركز|صندوق|مطار|ميناء|مكتب|مخبر|فندق|مطبعة|مطبعه|متوسطة|متوسطه|ثانوية|ثانويه|ابتدائية|ابتدائيه|مدرسة|مدرسه|جمعية|جمعيه|منظمة|منظمه|تعاونية|تعاونيه|إدارة|ادارة|اداره|مصلحة|مصلحه|فرع|وحدة|وحده|قسم|خطوط|اتصالات|بريد|تأمين|تامين|قرض';
const KNOWN_MAJOR_ENTITIES = 'سوناطراك|سونلغاز|نفطال|موبيليس|جازي|أوريدو|اوريدو|كوندور|صيدال|كوسيدار|سيفيتال|اتصالات|بريد';
const NON_ENTITY_MANAGEMENT_SUBJECTS_RE = /^(?:إدارة|ادارة|اداره)\s+(?:ال)?(?:أجور|اجور|أعمال|اعمال|موارد|جودة|جوده|مخاطر|مشاريع|معرفة|معرفه|إنتاج|انتاج|أزمات|ازمات|تغيير|مخزون|تكاليف|ديون|سيولة|سيوله|عمليات|مبيعات|تسويق|سلسلة|علاقات|وقت|أداء|اداء|تطوير|استراتيجية|استراتيجيه|معارف)(?=$|\s|[:\-–—،,/|؛])/;

const GENERIC_PLACEHOLDER_COMPANIES = new Set([
  'شركه', 'مؤسسه', 'موسسه', 'بنك', 'مصرف', 'منظمه', 'اداره', 'هيئه', 'مشروع', 'متجر',
  'مؤسسه اقتصاديه', 'موسسه اقتصاديه', 'مؤسسه اقتصاديه جزائريه', 'شركه اقتصاديه', 'شركه تجاريه',
  'مؤسسه عموميه', 'مؤسسه عموميه اقتصاديه', 'اداره عموميه', 'بنك تجاري', 'مصرف اسلامي',
  'شركه ما', 'مؤسسه ما', 'بنك ما', 'احدي المؤسسات', 'احدي الشركات', 'احد البنوك', 'احد المصارف',
  'بعض الشركات', 'بعض المؤسسات', 'نموذج', 'نموذجيه', 'واقعيه', 'مثال', 'الموضوع', 'هذا الموضوع',
  'دراسه حاله', 'الشركه', 'المؤسسه', 'البنك', 'المصنع', 'الاداره',
  'ها', 'هم', 'هو', 'هي', 'ذلك', 'هذه', 'هذا',
  'حولها', 'عليها', 'عنها', 'فيها', 'بها', 'لها', 'منها', 'اليها',
  'حوله', 'عليه', 'عنه', 'فيه', 'به', 'له', 'منه', 'اليه',
]);

function stripDiacriticsWithIndexMap(input: string): { stripped: string; origStarts: number[] } {
  let stripped = '';
  const origStarts: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (/[\u064B-\u065F\u0670\u0640]/.test(ch)) continue;
    stripped += ch;
    origStarts.push(i);
  }
  return { stripped, origStarts };
}

function isGenericOrPronounEntity(candidate: string): boolean {
  const norm = normalizeArabicComparable(candidate);
  if (!norm || norm.length < 2) return true;
  if (GENERIC_PLACEHOLDER_COMPANIES.has(norm)) return true;
  if (/^(?:ل|ب|في|على|عن|حول|مع|من)(?:ها|هم|هما|ه)$/.test(norm)) return true;
  if (/^(?:اسم|عنوان|مثال)\s+(?:الشركه|المؤسسه|شركه|مؤسسه)/.test(norm)) return true;
  return false;
}

function balanceAndStripOuterEdges(raw: string): string {
  let s = raw.trim();
  const pairs: [string, string][] = [
    ['(', ')'],
    ['[', ']'],
    ['«', '»'],
    ['"', '"'],
    ["'", "'"],
  ];

  // إزالة الأقواس المغلفة الكاملة مثل «(شركة سوناطراك)» مع الحفاظ على "(BEA)" غير المغلفة
  let changed = true;
  while (changed && s.length >= 2) {
    changed = false;
    for (const [open, close] of pairs) {
      if (s.startsWith(open) && s.endsWith(close)) {
        if (open === close) {
          const inner = s.slice(1, -1);
          if (!inner.includes(open)) {
            s = inner.trim();
            changed = true;
            break;
          }
        } else {
          let depth = 0;
          let closesEntire = true;
          for (let i = 0; i < s.length; i++) {
            if (s[i] === open) depth++;
            else if (s[i] === close) {
              depth--;
              if (depth === 0 && i < s.length - 1) {
                closesEntire = false;
                break;
              }
            }
          }
          if (closesEntire && depth === 0) {
            s = s.slice(1, -1).trim();
            changed = true;
            break;
          }
        }
      }
    }
  }

  // إزالة أي قوس مغلق يتيم في الطرف دون أن يقابله قوس مفتوح داخل النص
  for (const [open, close] of pairs) {
    if (open === close) {
      const count = s.split(open).length - 1;
      if (count % 2 === 1) {
        if (s.startsWith(open)) s = s.slice(1).trim();
        else if (s.endsWith(close)) s = s.slice(0, -1).trim();
      }
    } else {
      while (s.endsWith(close) && s.split(open).length < s.split(close).length) {
        s = s.slice(0, -1).trim();
      }
      while (s.startsWith(open) && s.split(open).length > s.split(close).length) {
        s = s.slice(1).trim();
      }
    }
  }
  return s;
}

function cleanExtractedCaseStudyEntity(rawCandidate: string): string {
  let s = (rawCandidate || '').replace(/\s+/g, ' ').trim();
  s = balanceAndStripOuterEdges(s);
  s = s.replace(/^[\s:\-–—/،,|؛.]+|[\s:\-–—/،,|؛.]+$/g, '').trim();

  // إزالة الصفات الملحقة بـ "حالة" وحروف الجر والربط في بداية اسم المؤسسة
  for (let guard = 0; guard < 6; guard++) {
    const prev = s;
    s = s.replace(/^[\s:\-–—/،,|؛.]+/, '').trim();
    s = s.replace(CASE_QUALIFIERS_RE, '').trim();
    s = s.replace(/^[\s:\-–—/،,|؛.]+/, '').trim();
    s = s.replace(/^(?:على\s+مستوى|في\s+إطار|في\s+اطار|من\s+خلال|الخاصة\s+بـ?\s*|الخاصه\s+بـ?\s*|المتعلقة\s+بـ?\s*|المتعلقه\s+بـ?\s*|خاص\s+بـ?\s*|بخصوص|بالنسبة\s+لـ?\s*|بالنسبه\s+لـ?\s*)(?=\s|$)/, '').trim();
    s = s.replace(/^(?:حول|عن|على|في|لدى|عند|بين|مع|من)(?=\s|$)/, '').trim();
    s = s.replace(/^(?:لـ+|بـ+)\s*/, '').trim();
    if (s === prev) break;
  }

  // فك حروف الجر الملتصقة بالاسم المؤسسي: "بمؤسسة..." / "لشركة..." / "للشركة..." / "بالمستشفى..."
  s = s.replace(
    new RegExp(`^لل(?=(?:${ENTITY_PREFIX_NOUNS}|${KNOWN_MAJOR_ENTITIES})(?:\\s|$))`),
    'ال',
  );
  s = s.replace(
    new RegExp(`^بال(?=(?:${ENTITY_PREFIX_NOUNS})(?:\\s|$))`),
    'ال',
  );
  s = s.replace(
    new RegExp(`^(?:ب|ل)(?=(?:${ENTITY_PREFIX_NOUNS}|${KNOWN_MAJOR_ENTITIES})(?:\\s|$))`),
    '',
  );

  // إزالة الفترات الزمنية الملحقة في نهاية التسمية فقط (مع بقاء التواريخ في عنوان الغلاف كما هي)
  s = s.replace(/[\s،,]*(?:خلال\s+(?:ال)?فترة|للفترة|للسنوات|خلال\s+(?:ال)?سنوات|من\s+(?:سنة|عام)|خلال\s+(?:سنة|عام)|لسنة|لعام)(?=$|\s).*$/i, '').trim();
  s = s.replace(/\s*\(\s*\d{4}\s*(?:[-–—/]|إلى)\s*\d{4}\s*\)\s*$/, '').trim();

  s = balanceAndStripOuterEdges(s);
  s = s.replace(/^[\s:\-–—/،,|؛.]+|[\s:\-–—/،,|؛.]+$/g, '').trim();

  if (isGenericOrPronounEntity(s)) return '';
  return s;
}

function cleanTopicCoreFragment(text: string): string {
  return (text || '')
    .replace(/[\s:\-–—/،,|؛+]+$/g, '')
    .replace(/(?:^|\s)(?:بالإضافة\s+إلى|مع\s+إضافة|مرفق(?:ة)?\s+بـ?|مع|و)\s*$/g, '')
    .replace(/[\s:\-–—/،,|؛+]+$/g, '')
    .replace(/^[\s:\-–—/،,|؛+]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTrailingEntityFromBeforeTopic(beforeText: string): { core: string; entity: string } | null {
  const prepRegex = new RegExp(
    `^(.+?)\\s+(?:في|لدى|على\\s+مستوى|بـ?)\\s*((?:(?:${ENTITY_PREFIX_NOUNS})\\s+\\S.*|(?:الشركة|المؤسسة|البنك|القرض|الصندوق)\\s+(?:الوطنية|الوطني|الخارجي|الشعبي|الجزائرية|الجزائري)(?:$|\\s.*)|(?:${KNOWN_MAJOR_ENTITIES})(?:\\s+\\S.*)?))$`,
  );
  const attachedPrepRegex = new RegExp(
    `^(.+?)\\s+(?:ب|ل)((?:${ENTITY_PREFIX_NOUNS})\\s+\\S.*|(?:${KNOWN_MAJOR_ENTITIES})(?:\\s+\\S.*)?)$`,
  );

  for (const re of [prepRegex, attachedPrepRegex]) {
    const m = beforeText.match(re);
    if (m && m[1] && m[2]) {
      const candidate = cleanExtractedCaseStudyEntity(m[2]);
      const core = cleanTopicCoreFragment(m[1]);
      if (
        candidate &&
        core &&
        !isGenericOrPronounEntity(candidate) &&
        !NON_ENTITY_MANAGEMENT_SUBJECTS_RE.test(candidate)
      ) {
        return { core, entity: candidate };
      }
    }
  }
  return null;
}

/**
 * الكشف الذكي عن «دراسة حالة» داخل عنوان أو موضوع البحث الذي يكتبه الطالب،
 * واستخراج اسم الشركة/المؤسسة وعنوان الموضوع الأساسي بدقة.
 */
export function extractCaseStudyFromTopic(topic: string): ExtractedTopicCaseStudy {
  const normalized = (topic || '')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return { hasKeyword: false, company: '', coverTitle: '', coreTopic: '' };

  const { stripped, origStarts } = stripDiacriticsWithIndexMap(normalized);
  const triggerRe = /(?:^|[\s\-–—:(\[{\«"'،,/|؛+])(و?\s*(?:دراسة\s+حال[ةه]|دراسة\s+الحال[ةه]))(?=$|[\s\-–—:)\]}\»"'،,/|؛.+])/g;

  const openToClose: Record<string, string> = { '(': ')', '[': ']', '«': '»', '"': '"', "'": "'" };

  interface TriggerMatch {
    rawStart: number;
    rawEnd: number;
    beforeTrimmed: string;
    openDelim: string | null;
    closeDelim: string | null;
    openPos: number;
  }

  let chosen: TriggerMatch | null = null;
  let m: RegExpExecArray | null;
  while ((m = triggerRe.exec(stripped)) !== null) {
    const fullStart = m.index;
    const matchedPhrase = m[1];
    const phraseOffset = m[0].indexOf(matchedPhrase);
    const trimmedLeadingWaw = matchedPhrase.replace(/^و\s+/, '').replace(/^و(?=دراسة)/, '');
    const innerShift = matchedPhrase.length - trimmedLeadingWaw.length;

    const strippedStart = fullStart + phraseOffset + innerShift;
    const strippedEnd = fullStart + phraseOffset + matchedPhrase.length;

    const rawStart = origStarts[strippedStart] ?? 0;
    const rawEnd = strippedEnd < origStarts.length ? origStarts[strippedEnd] : normalized.length;

    const strippedBefore = stripped.slice(0, strippedStart).replace(/[\s\-–—:(\[{\«"'،,/|؛+]+$/, '');
    const isDefinite = /^دراسة\s+الحال[ةه]$/.test(trimmedLeadingWaw.replace(/\s+/g, ' '));
    const hasSepBefore = /[\-–—:(\[{\«"'،,/|؛+]\s*$/.test(stripped.slice(0, strippedStart)) || /\s(?:مع|و)\s*$/.test(stripped.slice(0, strippedStart));

    if (METHODOLOGY_PREFIX_RE.test(strippedBefore)) {
      continue;
    }
    if (isDefinite && !hasSepBefore) {
      // تفادي الجمل المنهجية مثل "أهمية دراسة الحالة في التشخيص"
      const strippedAfterTest = stripped.slice(strippedEnd).trim();
      if (!/^[:\-–—)\]}»"']/.test(strippedAfterTest)) {
        continue;
      }
    }

    // التحقق إن كانت عبارة «دراسة حالة» مفتوحة بقوس مثل "(دراسة حالة بنك الجزائر)"
    const rawBeforeDirect = normalized.slice(0, rawStart).replace(/\s+$/, '');
    const lastBeforeChar = rawBeforeDirect ? rawBeforeDirect[rawBeforeDirect.length - 1] : '';
    const openDelim = openToClose[lastBeforeChar] ? lastBeforeChar : null;

    chosen = {
      rawStart,
      rawEnd,
      beforeTrimmed: openDelim ? rawBeforeDirect.slice(0, -1) : normalized.slice(0, rawStart),
      openDelim,
      closeDelim: openDelim ? openToClose[openDelim] : null,
      openPos: openDelim ? rawBeforeDirect.length - 1 : rawStart,
    };
  }

  if (!chosen) {
    return { hasKeyword: false, company: '', coverTitle: normalized, coreTopic: normalized };
  }

  // الحالة 1: عبارة «دراسة حالة» في بداية العنوان
  const beforeCleanTest = cleanTopicCoreFragment(chosen.beforeTrimmed);
  if (!beforeCleanTest) {
    const rawTail = normalized.slice(chosen.rawEnd).trim();
    // حالة: "دراسة حالة مؤسسة سوناطراك حول إدارة الأجور"
    const splitMidMatch = rawTail.match(/^[:\-–—\s]*(.+?)\s+(?:حول|عن|في\s+مجال|في\s+موضوع|بخصوص)\s+(.+)$/);
    if (splitMidMatch) {
      const candCompany = cleanExtractedCaseStudyEntity(splitMidMatch[1]);
      const candTopic = cleanTopicCoreFragment(splitMidMatch[2]);
      if (candCompany && candTopic) {
        return { hasKeyword: true, company: candCompany, coverTitle: candTopic, coreTopic: candTopic };
      }
    }
    // حالة: "دراسة حالة: إدارة الأجور في شركة سوناطراك" أو "دراسة حالة شركة موبيليس"
    const cleanTail = cleanExtractedCaseStudyEntity(rawTail);
    const tailInBefore = extractTrailingEntityFromBeforeTopic(rawTail.replace(/^[\s:\-–—/|]+/, ''));
    if (tailInBefore) {
      return { hasKeyword: true, company: tailInBefore.entity, coverTitle: tailInBefore.core, coreTopic: tailInBefore.core };
    }
    const startsWithEntity =
      new RegExp(`^(?:ال)?(?:${ENTITY_PREFIX_NOUNS}|${KNOWN_MAJOR_ENTITIES})(?:\\s|$)`).test(cleanTail) &&
      !NON_ENTITY_MANAGEMENT_SUBJECTS_RE.test(cleanTail);
    if (startsWithEntity && cleanTail) {
      return { hasKeyword: true, company: cleanTail, coverTitle: cleanTail, coreTopic: normalized };
    }
    const cleanOnlyTopic = cleanTopicCoreFragment(rawTail.replace(/^(?:حول|عن|في\s+مجال|في\s+موضوع)\s+/, '')) || normalized;
    return { hasKeyword: true, company: '', coverTitle: cleanOnlyTopic, coreTopic: cleanOnlyTopic };
  }

  // الحالة 2: عبارة «دراسة حالة» بعد عنوان البحث (الحالة الشائعة لدى الطلبة)
  let rawCaseBlock = normalized.slice(chosen.rawEnd);
  let afterClose = '';

  if (chosen.openDelim && chosen.closeDelim) {
    const open = chosen.openDelim;
    const close = chosen.closeDelim;
    if (open === close) {
      const idx = rawCaseBlock.indexOf(close);
      if (idx !== -1) {
        afterClose = rawCaseBlock.slice(idx + 1);
        rawCaseBlock = rawCaseBlock.slice(0, idx);
      }
    } else {
      let depth = 1;
      for (let i = 0; i < rawCaseBlock.length; i++) {
        if (rawCaseBlock[i] === open) depth++;
        else if (rawCaseBlock[i] === close) {
          depth--;
          if (depth === 0) {
            afterClose = rawCaseBlock.slice(i + 1);
            rawCaseBlock = rawCaseBlock.slice(0, i);
            break;
          }
        }
      }
    }
  }

  let company = cleanExtractedCaseStudyEntity(rawCaseBlock);
  const coverTitle =
    cleanTopicCoreFragment(
      afterClose.trim() && !/^(?:خلال|للفترة|لسنة|لعام)(?=$|\s)/.test(afterClose.trim())
        ? `${beforeCleanTest} ${cleanTopicCoreFragment(afterClose)}`
        : beforeCleanTest,
    ) || normalized;
  let coreTopic = coverTitle;

  // إذا كتب الطالب "الموضوع في شركة سوناطراك (دراسة حالة)" ولم يضع اسماً بعد "دراسة حالة"
  if (!company) {
    const recovered = extractTrailingEntityFromBeforeTopic(coreTopic);
    if (recovered) {
      company = recovered.entity;
      coreTopic = recovered.core;
    }
  }

  return {
    hasKeyword: true,
    company,
    coverTitle,
    coreTopic: coreTopic || normalized,
  };
}

/**
 * الدمج المعتمد بين الخانة المخصصة «دراسة حالة حول شركة أو مؤسسة» والكشف التلقائي من العنوان:
 * الخانة المخصصة تأخذ الأولوية دائماً إن مُلئت، وإلا يُعتمد ما ورد في العنوان.
 */
export function resolveCaseStudySpec(topic: string, explicitCompany?: string): CaseStudyResolution {
  const explicit = (explicitCompany || '').trim();
  const extracted = extractCaseStudyFromTopic(topic);
  const rawTopicTrimmed = (topic || '').trim();

  if (explicit) {
    return {
      hasCaseStudy: true,
      source: 'explicit',
      company: explicit,
      coverTitle: extracted.hasKeyword ? extracted.coverTitle : rawTopicTrimmed,
      coreTopic: extracted.hasKeyword ? extracted.coreTopic : rawTopicTrimmed,
    };
  }

  if (extracted.hasKeyword) {
    return {
      hasCaseStudy: true,
      source: extracted.company ? 'title-named' : 'title-inferred',
      company: extracted.company,
      coverTitle: extracted.coverTitle,
      coreTopic: extracted.coreTopic,
    };
  }

  return {
    hasCaseStudy: false,
    source: 'none',
    company: '',
    coverTitle: rawTopicTrimmed,
    coreTopic: rawTopicTrimmed,
  };
}

function cleanPlanSuggestedCompany(raw: string | undefined): string {
  const s = (raw || '')
    .replace(/^[\s"*«'\[]+|[\s"*»'\]]+$/g, '')
    .replace(/^دراسة\s+حالة\s*[:\-–—]\s*/i, '')
    .trim();
  if (!s || /\[|\]|اسم\s+شركة|اسم\s+مؤسسة|مثال\s*:/i.test(s)) return '';
  if (isGenericOrPronounEntity(s)) return '';
  return s;
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
  options?: { coreTopic?: string; hasCaseStudy?: boolean },
): AiPlan {
  const exactTopic = (topic || rawPlan?.title || '').trim() || 'موضوع البحث';
  const analysisTopic = (options?.coreTopic || exactTopic).trim() || exactTopic;
  const hasCaseStudy = !!options?.hasCaseStudy;
  const mCount = Math.max(1, Math.min(6, parseInt(String(mabhathCountRaw), 10) || 2));
  const tCount = Math.max(1, Math.min(6, parseInt(String(matlabCountRaw), 10) || 2));
  const fb = buildFallbackPlan(analysisTopic, mCount, tCount, 'medium') as AiPlan;

  const usedMbTokens: string[][] = [];
  const usedMtTokens: string[][] = [];
  const normalizedMabahith: { title: string; matalib: { title: string }[] }[] = [];
  const strayCaseStudyHeadingRe = /(?:^|[\s:\-–—«"(])دراسة\s+حال[ةه](?:$|[\s:\-–—»")])/i;

  for (let i = 0; i < mCount; i++) {
    const rawMb = rawPlan?.mabahith?.[i];
    const fbMbSub = stripStructuralPrefix(fb.mabahith[i]?.title || '', 'مبحث') || `المحور ${ORDINAL_WORDS[i] || i + 1}`;
    let mbSub = stripStructuralPrefix(rawMb?.title || '', 'مبحث');
    if (
      !mbSub ||
      mbSub.startsWith('[') ||
      (hasCaseStudy && strayCaseStudyHeadingRe.test(mbSub)) ||
      isTooSimilarHeading(mbSub, usedMbTokens, analysisTopic)
    ) {
      mbSub = fbMbSub;
    }
    usedMbTokens.push(toComparisonTokens(mbSub, analysisTopic));

    // جمع قائمة مرشحين احتياطيين متميزين لهذا المبحث (ثم من المباحث المجاورة عند الحاجة)
    const fallbackPool: string[] = [];
    for (let shift = 0; shift < 5; shift++) {
      fallbackPool.push(...(getDistinctFallbackMatalib(analysisTopic, i + shift, 6) as string[]));
    }

    const matalib: { title: string }[] = [];
    for (let j = 0; j < tCount; j++) {
      const rawMtTitle = rawMb?.matalib?.[j]?.title || '';
      let mtSub = stripStructuralPrefix(rawMtTitle, 'مطلب');
      if (
        !mtSub ||
        mtSub.startsWith('[') ||
        (hasCaseStudy && strayCaseStudyHeadingRe.test(mtSub)) ||
        isTooSimilarHeading(mtSub, usedMtTokens, analysisTopic)
      ) {
        const picked = fallbackPool.find((cand) => !isTooSimilarHeading(cand, usedMtTokens, analysisTopic));
        mtSub = picked || fallbackPool[j % fallbackPool.length] || `المحور التطبيقي ${ORDINAL_WORDS[j] || j + 1}`;
      }
      usedMtTokens.push(toComparisonTokens(mtSub, analysisTopic));
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
    caseStudyCompany: rawPlan?.caseStudyCompany,
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
export function sanitizeCaseStudyOutput(rawText: string, company?: string): string {
  const cleanCompany = (company || '').trim();
  const explicitCanonicalHeader = cleanCompany ? `دراسة حالة: ${cleanCompany}` : '';
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
      if (explicitCanonicalHeader) {
        out.push(explicitCanonicalHeader);
      } else {
        const cleanedLine = displayStripped
          .replace(new RegExp(`^(?:ال)?مبحث\\s+${ARABIC_ORD_PATTERN}\\s*[:\\-–—\\.]*\\s*`, 'i'), '')
          .trim();
        out.push(caseLineRe.test(cleanedLine) ? cleanedLine : `دراسة حالة: ${cleanedLine || 'تطبيقية'}`);
      }
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
    const fallbackHeader = explicitCanonicalHeader || 'دراسة حالة تطبيقية';
    res = `${fallbackHeader}\n\n${res}`;
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
  const exactUserTopic = o.topic.trim();
  const csSpec = resolveCaseStudySpec(exactUserTopic, o.caseStudyCompany);
  const cleanCoverTitle = csSpec.coverTitle || exactUserTopic;
  const hasCaseStudy = csSpec.hasCaseStudy;
  let caseCompany = csSpec.company;

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
    planRaw = await call(buildPlanPrompt(cleanCoverTitle, o.mabhathCount, o.matlabCount, cfg, caseCompany, hasCaseStudy), null, {
      temperature: 0.25,
      maxTokens: 2400,
    });
  } catch (errPlan) {
    console.warn('تعذر توليد الخطة بالنموذج، الاعتماد على الخطة المنهجية الذكية:', errPlan);
    planRaw = '';
  }

  let plan: AiPlan | null = parseAiPlanJson(planRaw);
  if (hasCaseStudy && !caseCompany && plan?.caseStudyCompany) {
    caseCompany = cleanPlanSuggestedCompany(plan.caseStudyCompany);
  }
  if (!plan || !plan.mabahith?.length) {
    plan = buildFallbackPlan(csSpec.coreTopic || cleanCoverTitle, o.mabhathCount, o.matlabCount, o.length) as AiPlan;
  }
  // ضبط العدد الدقيق للمباحث والمطالب (مثل 3×3) ومنع أي تكرار في خطة المباحث أو تداخلها مع دراسة الحالة
  plan = normalizeResearchPlan(plan, cleanCoverTitle, o.mabhathCount, o.matlabCount, {
    coreTopic: csSpec.coreTopic,
    hasCaseStudy,
  });
  if (o.normalizePlan) plan = o.normalizePlan(plan);
  plan.title = cleanCoverTitle;
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
      const pendingCaseHeader = caseCompany ? `دراسة حالة: ${caseCompany}` : 'دراسة حالة تطبيقية';
      draft += caseStudy ? caseStudy.trim() + '\n\n' : `${pendingCaseHeader}\n(جاري تحرير دراسة الحالة بالتوازي...)\n\n`;
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
  const taskIntro = call(withAddendum(buildIntroPrompt(p, cfg, caseCompany, hasCaseStudy)), tIntro.onChunk, {
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
      const rawMbText = await call(withAddendum(buildMabhathPrompt(p, mb, perMb, cfg, hasCaseStudy)), t.onChunk, {
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

  // مهمة دراسة الحالة التطبيقية (تُنَفَّذ عند إدخال اسم شركة/مؤسسة أو اكتشاف «دراسة حالة» في العنوان) وتوضع بعد المباحث وقبل الخاتمة
  const taskCaseStudy = hasCaseStudy
    ? (async () => {
        await waitMs(350 * (p.mabahith.length + 1));
        const tCs = track('casestudy', (v) => (caseStudy = v));
        try {
          const rawCs = await call(withAddendum(buildCaseStudyPrompt(p, caseCompany, cfg, csSpec.coreTopic)), tCs.onChunk, {
            temperature: 0.35,
            maxTokens: 4096,
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
    return call(withAddendum(buildConclusionPrompt(p, cfg, caseCompany, hasCaseStudy)), tConc.onChunk, {
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
