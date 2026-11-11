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
  /** يُستدعى فور اعتماد خطة البحث النهائية وعنوانها الموحّد للغلاف. */
  onResolvedPlan?: (plan: AiPlan) => void;
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

export interface CustomPlanMabhath {
  title: string;
  matalib: { title: string }[];
}

export interface StudentTopicAnalysis {
  /** هل احتوى الحقل على خطة بحث لصقها الطالب */
  hasCustomPlan: boolean;
  /** المباحث والمطالب المستخلصة من خطة الطالب */
  customMabahith: CustomPlanMabhath[];
  /** هل جميع مباحث الخطة المخصصة تحتوي على مطالب محددة */
  hasAllCustomMatalib: boolean;
  /** هل ذُكرت المقدمة أو الخاتمة ضمن خطة الطالب */
  hasIntroInPlan: boolean;
  hasConclusionInPlan: boolean;
  /** هل تضمنت الخطة المخصصة مبحثاً صريحاً بعنوان «دراسة حالة» */
  caseStudyInPlanMabhath: boolean;
  /** هل كتب الطالب عنواناً صريحاً منفصلاً أم اكتفى بالخطة فقط */
  hasExplicitTitle: boolean;
  /** هل تمت إزالة عبارات زائدة أو أسلوب محادثة مثل «كتابة بحث حول» */
  hadWrapperNoise: boolean;
  /** العنوان النظيف قبل فصل «دراسة حالة» */
  cleanedTopic: string;
  /** تحليل «دراسة حالة» والعنوان المعتمد للغلاف */
  caseStudy: CaseStudyResolution;
}

const ORDINAL_WORDS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const ARABIC_ORD_PATTERN = '(?:الأول|الاول|الثاني|الثانى|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي\\s+عشر|الثاني\\s+عشر|[\\d٠-٩]+)';

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

function mapNormalizedToOriginal(input: string): { norm: string; origStarts: number[] } {
  let norm = '';
  const origStarts: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (/[\u064B-\u065F\u0670\u0640]/.test(ch)) continue;
    let mapped = ch;
    if (ch === 'أ' || ch === 'إ' || ch === 'آ') mapped = 'ا';
    else if (ch === 'ى') mapped = 'ي';
    else if (ch === 'ة') mapped = 'ه';
    norm += mapped;
    origStarts.push(i);
  }
  return { norm, origStarts };
}

/**
 * تنظيف إدخال الطالب من عبارات المحادثة والأوامر والعبارات الزائدة مثل:
 * «أكتب لي بحثاً حول ...» أو «كتابة بحث حول ...» أو «مع المقدمة والخاتمة والمراجع من فضلك»
 * مع الحفاظ التام على العناوين الأكاديمية المشروعة مثل «إعداد الميزانية» و«البحث العلمي ومناهجه».
 */
export function stripTopicChatWrappers(
  rawText: string,
  options?: { allowEmpty?: boolean; planPreamble?: boolean },
): { cleaned: string; stripped: boolean } {
  const original = (rawText || '')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!original) return { cleaned: '', stripped: false };

  let current = original;
  let strippedAny = false;
  let wasQuestionWrapper = false;

  const sliceFromNorm = (str: string, normIndex: number, map: { norm: string; origStarts: number[] }) => {
    if (normIndex <= 0) return str;
    if (normIndex >= map.origStarts.length) return '';
    return str.slice(map.origStarts[normIndex]).trim();
  };

  const sliceToNorm = (str: string, normIndex: number, map: { norm: string; origStarts: number[] }) => {
    if (normIndex <= 0) return '';
    if (normIndex >= map.origStarts.length) return str;
    return str.slice(0, map.origStarts[normIndex]).trim();
  };

  // 1. التحيات وعبارات التلطف الابتدائية
  const greetingRe =
    /^(?:السلام\s+عليكم(?:\s+ورحمه\s+الله(?:\s+وبركاته)?)?|وعليكم\s+السلام(?:\s+ورحمه\s+الله(?:\s+وبركاته)?)?|تحيه\s+طيبه(?:\s+وبعد)?|مرحبا(?:\s+بكم)?|اهلا(?:\s+(?:وسهلا|بكم|بك))?|صباح\s+الخير|مساء\s+الخير|من\s+فضلك|لو\s+سمحت|عافاك|بارك\s+الله\s+فيك|جزاك\s+الله\s+خيرا?|تعيش|مشكور|ارجوك|خويا(?:\s+العزيز)?|اخي(?:\s+الكريم)?|اختي(?:\s+الكريمه)?|استاذي)(?=$|[\s،,:!.\-–—])/i;

  for (let k = 0; k < 5; k++) {
    const map = mapNormalizedToOriginal(current);
    const m = map.norm.match(greetingRe);
    if (!m) break;
    let next = sliceFromNorm(current, m[0].length, map);
    next = next.replace(/^[،,:!.\-–—/\s]+/, '').trim();
    next = next.replace(/^و\s+/, '').trim();
    if (!next && !options?.allowEmpty) break;
    current = next;
    strippedAny = true;
    if (!current) break;
  }

  // 2. أفعال الطلب، صيغ «كتابة بحث حول / إعداد عرض تقديمي حول»، والبادئات الإضافية في بداية السطر
  const reqVerbs =
    '(?:(?:هل\\s+(?:يمكنك|تستطيع|بامكانك|تقدر)\\s+|ممكن\\s+|تقدر\\s+|اريد(?:\\s+منك(?:م)?)?\\s+|نريد(?:\\s+منك(?:م)?)?\\s+|ارغب\\s+في\\s+|اود\\s+|نود\\s+|احتاج(?:\\s+الي)?\\s+|نحتاج(?:\\s+الي)?\\s+|ارجو(?:\\s+منك(?:م)?)?\\s+|ساعدني\\s+(?:في|علي)\\s+|(?:ان\\s+)?سويلي\\s+|(?:ان\\s+)?ديرلي\\s+|بغيت\\s+|نحب\\s+|حابه?\\s+|عا[يو]ز\\s+|ابغ[يى]\\s+|(?:ان\\s+)?(?:اعمل|تعمل)(?:\\s*لي|لي|ي)?\\s+|(?:ان\\s+)?(?:اكتب|تكتب|كتب)(?:\\s*لي|لي)?\\s+|(?:ان\\s+)?(?:اصنع|تصنع)(?:\\s*لي)?\\s+|(?:ان\\s+)?(?:ولد|تولد)(?:\\s*لي)?\\s+|(?:ان\\s+)?(?:انشئ|تنشئ)(?:\\s*لي)?\\s+|(?:ان\\s+)?(?:حضر|تحضر)(?:\\s*لي|لي)?\\s+|(?:ان\\s+)?(?:صغ|تصيغ)(?:\\s*لي)?\\s+|(?:ان\\s+)?(?:اعدد|تعد)(?:\\s*لي)?\\s+|(?:ان\\s+)?(?:جهز|تجهز)(?:\\s*لي|لي)?\\s+|(?:ان\\s+)?(?:صمم|تصمم)(?:\\s*لي|لي)?\\s+|(?:ان\\s+)?(?:نسق|تنسق)(?:\\s*لي|لي)?\\s+|(?:ان\\s+)?(?:رتب|ترتب)(?:\\s*لي|لي)?\\s+|(?:ابحث|دور)\\s*لي\\s+(?:عن|حول|في)\\s+|هات(?:\\s*لي)?\\s+|اعطني\\s+|قدم(?:\\s*لي)?\\s+|اقترح(?:\\s*لي)?\\s+|ابعتلي\\s+|ارسل\\s+لي\\s+|قم\\s+بـ?\\s*))';
  const docAdj =
    '(?:علميا?|اكاديميا?|جامعيا?|تخرج|مصغرا?|مفصلا?|كاملا?|شاملا?|مختصرا?|موجزا?|متكاملا?|معمقا?|منسقا?|جاهزا?(?:\\s+للطباعه)?|محكما?|مميزا?|دقيقا?|بسيطا?|طويلا?|قصيرا?|احترافيا?)';
  const prepWord =
    '(?:بعنوان|باسم|حول(?:\\s+موضوع)?|عن(?:\\s+موضوع)?|في\\s+(?:موضوع|مجال|مقياس|ماده)|في|بخصوص|يتعلق\\s+بـ?|يخص|تحت\\s+عنوان|وفقا?\\s+لـ?|وفق|علي\\s+حسب|بحسب|حسب|علي|[:\\-–—])';
  const strictPrepWord =
    '(?:بعنوان|باسم|حول(?:\\s+موضوع)?|عن(?:\\s+موضوع)?|في\\s+(?:موضوع|مجال|مقياس|ماده)|بخصوص|يتعلق\\s+بـ?|يخص|تحت\\s+عنوان|[:\\-–—])';
  const slidePptToken = '(?:باوربوينت|بوربوينت|بوربوانت|بواربوينت|pptx|powerpoint)';
  const slideDocUnambiguous =
    `(?:(?:ال)?عرضا?(?:\\s+(?:ال)?(?:تقديميا?|توضيحيا?|${slidePptToken}|شرائح))` +
    `|شرائح(?:\\s+(?:${slidePptToken}|(?:ال)?عرض(?:\\s+(?:ال)?تقديمي)?))?` +
    `|سلايدات?` +
    `|(?:برزنتيشن|برزينتيشن|presentation)` +
    `|ملف\\s+(?:${slidePptToken}|عرض(?:\\s+تقديمي)?)|${slidePptToken})`;

  const leadingPatterns: { re: RegExp; isQuestion?: boolean }[] = [
    // عنوان البحث / العرض: / موضوع العرض: / خطة بحث أو عرض حول ...
    {
      re: new RegExp(
        `^(?:عنوان|موضوع|اسم)(?:\\s+(?:هذا\\s+)?(?:ال)?(?:بحث|موضوع|مقاله?|مذكره|ورقه|${slideDocUnambiguous}|عرض))?\\s*(?::|[\\-–—]+|هو)\\s*`,
        'i',
      ),
    },
    {
      re: new RegExp(`^خطه\\s+(?:هذا\\s+)?(?:ال)?(?:بحث|عرض(?:\\s+(?:${slidePptToken}|تقديمي))?|شرائح|برزنتيشن)(?:\\s+${docAdj})*\\s*(?:${prepWord})\\s*`, 'i'),
    },
    // طلبات صريحة تبدأ بفعل (مع أو بدون كلمة بحث/موضوع/عرض تقديمي/شرائح): اكتب لي عرض تقديمي حول...
    {
      re: new RegExp(
        `^${reqVerbs}+` +
          `(?:(?:كتابه|صياغه|عمل|اعداد|انشاء|توليد|تحضير|تجهيز|تاليف|تحرير|انجاز|ترتيب|بناء|تلخيص|تصميم|تنظيم)\\s+)?` +
          `(?:` +
            `(?:هذا\\s+|لي\\s+)?(?:ال)?(?:بحثا?|موضوعا?|مقالا|مقاله|مذكره|ورقه\\s+بحثيه|تقريرا|تقرير|مشروع\\s+بحث|${slideDocUnambiguous})(?:\\s+${docAdj})*\\s*(?:${prepWord}\\s*)?` +
            `|(?:هذا\\s+|لي\\s+)?(?:ال)?عرضا?(?:\\s+${docAdj})*\\s*${strictPrepWord}\\s*` +
            `|(?:${prepWord}\\s*)?` +
          `)`,
        'i',
      ),
      isQuestion: true,
    },
    // مصدر + كلمة بحث أو عرض تقديمي/شرائح + حرف ربط: إعداد عرض تقديمي حول... / تصميم شرائح عن...
    {
      re: new RegExp(
        `^(?:كتابه|صياغه|عمل|اعداد|انشاء|توليد|تحضير|تجهيز|تحرير|انجاز|تاليف|ترتيب|تصميم|تنظيم)\\s+` +
          `(?:` +
            `(?:هذا\\s+|لي\\s+)?(?:ال)?(?:بحثا?|موضوعا?|مذكره|ورقه\\s+بحثيه|تقرير\\s+بحثي|مقاله?\\s+(?:علميه|اكاديميه|بحثيه)|${slideDocUnambiguous})(?:\\s+${docAdj})*\\s*(?:${prepWord})\\s*` +
            `|(?:هذا\\s+|لي\\s+)?(?:ال)?عرضا?(?:\\s+${docAdj})*\\s*(?:${strictPrepWord})\\s*` +
          `)`,
        'i',
      ),
    },
    // أفعال الحديث/الشرح: تكلم عن... / تحدث حول... / اشرح لي...
    {
      re: new RegExp(`^(?:تكلم|تحدث|اشرح|وضح|بين|فصل|احكي)(?:\\s+لي)?\\s+(?:${prepWord})\\s*`, 'i'),
    },
    // بحث [صفة؟] حول/عن/في/بعنوان/: (بدون فعل قبله): بحث حول... / بحث علمي عن...
    {
      re: new RegExp(`^بحثا?(?:\\s+${docAdj})*\\s*(?:${prepWord})\\s*`, 'i'),
    },
    // البحث [العلمي/الأكاديمي] حول/عن/بعنوان/: (يتفادى "البحث العلمي ومناهجه" و"البحث الجنائي في القانون")
    {
      re: /^البحث(?:\s+(?:العلمي|الاكاديمي|الجامعي))?\s*(?:بعنوان|باسم|حول|عن|[:\-–—]+)\s*/i,
    },
    // عرض تقديمي / شرائح / باوربوينت / برزنتيشن [صفة؟] حول/عن/في/بعنوان/: (يتفادى "عرض وطلب" و"عرض النقود")
    {
      re: new RegExp(`^${slideDocUnambiguous}(?:\\s+${docAdj})*\\s*(?:${prepWord})\\s*`, 'i'),
    },
    {
      re: new RegExp(`^(?:ال)?عرض(?:\\s+${docAdj})*\\s*(?:${strictPrepWord})\\s*`, 'i'),
    },
  ];

  for (let pass = 0; pass < 4; pass++) {
    let matchedInPass = false;
    for (const pat of leadingPatterns) {
      const map = mapNormalizedToOriginal(current);
      const m = map.norm.match(pat.re);
      if (!m || m[0].length === 0) continue;
      let candidate = sliceFromNorm(current, m[0].length, map);
      candidate = candidate.replace(/^[\s:\-–—،,|؛]+/, '').trim();
      if (!candidate && !options?.allowEmpty) continue;
      if (pat.isQuestion && /^(?:هل\s+(?:يمكنك|تستطيع|بامكانك|تقدر)|ممكن|تقدر)/i.test(map.norm)) {
        wasQuestionWrapper = true;
      }
      current = candidate;
      strippedAny = true;
      matchedInPass = true;
      break;
    }
    if (!matchedInPass || !current) break;
  }

  // 3. اللواحق والعبارات الزائدة في آخر النص (دون المساس بـ «دراسة حالة» ولا «إعداد خطة البحث»)
  const trailingPatterns: RegExp[] = [
    // روابط الإحالة للخطة في نهاية السطر التمهيدي: "وفق هذه الخطة:" / "على حسب خطة العرض التالية:"
    /[\s،,\-–—:]*(?:(?:وفقا?\s+لـ?|بناء\s+علي|اعتمادا\s+علي|طبقا\s+لـ?|علي\s+حسب|بحسب|حسب|وفق|تحت)\s+(?:هذه\s+)?(?:ال)?(?:خطه(?:\s+(?:هذا\s+)?(?:ال)?(?:بحث|عرض))?)(?:\s+(?:التاليه|الاتيه|المرفقه|المذكوره|المقترحه))?|(?:هذه\s+(?:ال)?خطه|الخطه\s+(?:التاليه|الاتيه|المرفقه|المذكوره|المقترحه)|خطه(?:\s+(?:البحث|العرض))?\s+(?:التاليه|الاتيه|المرفقه|المذكوره|المقترحه)))\s*[:\-–—؟?]*$/i,
    // طلب عناصر هيكلية روتينية في الذيل: "مع المقدمة والخاتمة والمراجع" / "يضم مقدمة ومبحثين وخاتمة وشرائح"
    /[\s،,:\-–—]+(?:مع(?:\s+اضافه|\s+كتابه)?|بالاضافه\s+الي|شاملا?(?:\s+لـ?)?|يضم|يحتوي\s+علي|يتضمن|مرفقا?\s+بـ?)\s+(?:ال)?(?:خطه(?:\s+(?:البحث|العرض))?|مقدمه|خاتمه|هوامش|تهميش|مصادر|مراجع|قائمه\s+(?:ال)?(?:مصادر(?:\s+والمراجع)?|مراجع)|مبحثين|مباحث|مطلبين|مطالب|محورين|محاور|شرائح)\s*(?:[\s،,]+(?:و|مع)?\s*(?:ال)?(?:خطه(?:\s+(?:البحث|العرض))?|مقدمه|خاتمه|هوامش|تهميش|مصادر|مراجع|قائمه\s+(?:ال)?(?:مصادر(?:\s+والمراجع)?|مراجع)|مبحثين|مباحث|مطلبين|مطالب|محورين|محاور|شرائح))*[\s.!؟?\-–—]*$/i,
    // عبارات الأدب والتنسيق في الذيل (تشمل تنسيق العروض التقديمية وعدد الشرائح)
    /[\s،,!.\-–—]*(?:من\s+فضلك|لو\s+سمحت|ارجوك|عافاك|شكرا(?:\s+لك)?|جزاك\s+الله\s+خيرا?|بارك\s+الله\s+فيك|جاهزا?\s+للطباعه|جاهزا?\s+للعرض|منسقا?(?:\s+ومفصلا?)?|باسلوب\s+(?:اكاديمي|علمي)(?:\s+رصين)?|باللغه\s+العربيه|(?:علي\s+شكل|بصيغه|بتنسيق)\s+(?:عرض(?:\s+تقديمي)?|شرائح(?:\s+عرض)?|باوربوينت|بوربوينت|pptx|powerpoint)|(?:في\s+حدود|من|حوالي|نحو)\s+[\d٠-٩]+\s*(?:صفح(?:ه|ات)|شريح(?:ه|ات)|شرائح|سلايد(?:ات)?))[\s.!؟?\-–—]*$/i,
  ];

  for (let pass = 0; pass < 4 && current; pass++) {
    let matchedTail = false;
    for (const tre of trailingPatterns) {
      const map = mapNormalizedToOriginal(current);
      const m = map.norm.match(tre);
      if (!m || typeof m.index !== 'number' || m[0].length === 0) continue;
      const candidate = sliceToNorm(current, m.index, map).replace(/[\s،,:\-–—]+$/, '').trim();
      if (!candidate && !options?.allowEmpty) continue;
      current = candidate;
      strippedAny = true;
      matchedTail = true;
      break;
    }
    if (!matchedTail) break;
  }

  // في سياق سطر تمهيدي يسبق الخطة مباشرة، نحذف التسميات البحتة مثل «خطة البحث:» أو «خطة العرض:»
  if (options?.planPreamble && current) {
    const map = mapNormalizedToOriginal(current);
    const purePlanPreambleRe =
      /^(?:(?:اليك|ها\s+هي|تفضل(?:\s+بـ)?|هذه|هذي)?\s*(?:هي\s+)?(?:خطه\s+(?:هذا\s+)?(?:ال)?(?:بحث|دراسه|عرض(?:\s+تقديمي)?|شرائح)|الخطه(?:\s+(?:المقترحه|التاليه|الاتيه|المرفقه))?|(?:هيكل|مخطط|عناصر|محتويات)\s+(?:البحث|العرض)|فهرس\s+المحتويات)(?:\s*[:\-–—.*]*)?)$/i;
    if (purePlanPreambleRe.test(map.norm.trim())) {
      current = '';
      strippedAny = true;
    }
  }

  if (wasQuestionWrapper) {
    current = current.replace(/[؟?]+\s*$/, '').trim();
  }

  if (current) {
    const balanced = balanceAndStripOuterEdges(current);
    if (balanced) current = balanced;
  }

  current = current.replace(/\s+/g, ' ').trim();
  if (!current && !options?.allowEmpty) {
    return { cleaned: original, stripped: false };
  }
  return { cleaned: current, stripped: strippedAny && current !== original };
}

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
  const cleaned = (text || '')
    .replace(/[\s:\-–—/،,|؛+]+$/g, '')
    .replace(/(?:^|\s)(?:بالإضافة\s+إلى|مع\s+إضافة|مرفق(?:ة)?\s+بـ?|مع|و)\s*$/g, '')
    .replace(/[\s:\-–—/،,|؛+]+$/g, '')
    .replace(/^[\s:\-–—/،,|؛+]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return balanceAndStripOuterEdges(cleaned);
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
  const normalized = stripTopicChatWrappers(topic).cleaned;
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
  const fallbackClean = stripTopicChatWrappers(topic).cleaned || (topic || '').trim();

  if (explicit) {
    return {
      hasCaseStudy: true,
      source: 'explicit',
      company: explicit,
      coverTitle: extracted.coverTitle || fallbackClean,
      coreTopic: extracted.coreTopic || fallbackClean,
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
    coverTitle: extracted.coverTitle || fallbackClean,
    coreTopic: extracted.coreTopic || fallbackClean,
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

const ORDINAL_INDEX_MAP: Record<string, number> = {
  'الأول': 0, 'الاول': 0, '1': 0, '١': 0,
  'الثاني': 1, 'الثانى': 1, '2': 1, '٢': 1,
  'الثالث': 2, '3': 2, '٣': 2,
  'الرابع': 3, '4': 3, '٤': 3,
  'الخامس': 4, '5': 4, '٥': 4,
  'السادس': 5, '6': 5, '٦': 5,
  'السابع': 6, '7': 6, '٧': 6,
  'الثامن': 7, '8': 7, '٨': 7,
  'التاسع': 8, '9': 8, '٩': 8,
  'العاشر': 9, '10': 9, '١٠': 9,
};

type ClassifiedPlanLine =
  | { type: 'ignore' }
  | { type: 'plan_header' }
  | { type: 'intro' }
  | { type: 'conclusion' }
  | { type: 'references' }
  | { type: 'case_study_standalone'; company: string }
  | { type: 'major'; kind: 'mabhath' | 'mihwar' | 'fasl' | 'bab'; subTitle: string }
  | { type: 'matlab_explicit'; subTitle: string }
  | { type: 'fara'; subTitle: string }
  | { type: 'deep_sub'; subTitle: string }
  | { type: 'dotted_sub'; subTitle: string }
  | { type: 'ordinal'; subTitle: string }
  | { type: 'top_num'; subTitle: string }
  | { type: 'alpha_sub'; subTitle: string }
  | { type: 'bullet'; subTitle: string }
  | { type: 'text'; raw: string };

function normalizeIndicDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function cleanOutlineSubTitle(raw: string): string {
  const s = (raw || '')
    .replace(/^[\s:\-–—.،,|؛]+/, '')
    .replace(/[\s:\-–—،,|؛]+$/, '')
    .replace(/\.+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return balanceAndStripOuterEdges(s);
}

function splitTopicIntoPlanLines(rawInput: string): string[] {
  const normalizedNewlines = (rawInput || '')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ')
    .replace(/\r\n?/g, '\n');

  const lines = normalizedNewlines.split('\n');
  const out: string[] = [];

  const ordDef =
    'الأول|الاول|الأولى|الاولى|أول|اول|أولى|اولى|الثاني|الثانى|الثانية|ثان|ثاني|ثانية|الثالث|الثالثة|ثالث|ثالثة|الرابع|الرابعة|رابع|رابعة|الخامس|الخامسة|خامس|خامسة|السادس|السادسة|سادس|سادسة|السابع|السابعة|سابع|سابعة|الثامن|الثامنة|ثامن|ثامنة|التاسع|التاسعة|تاسع|تاسعة|العاشر|العاشرة|عاشر|عاشرة|الحادي\\s+عشر|الثاني\\s+عشر|التمهيدي|تمهيدي';
  const ordPat = `(?:${ordDef}|\\(?\\s*[\\d٠-٩]+\\s*\\)?|[\\d٠-٩]+)`;

  // حساب كثافة الكلمات الهيكلية الصريحة عبر كامل النص لاكتشاف الخطط المسطحة (بلا أسطر أو بلا نقطتين)
  const globalStructMatches = normalizedNewlines.match(
    new RegExp(`(?:^|[\\s،؛|/\\-–—])(?:ال)?(?:مبحث|مطلب|محور|فصل|باب)\\s+${ordPat}(?=$|\\s|[:：\\-–—.\\(/])`, 'gi'),
  );
  const hasMultipleExplicitMarkersGlobally = (globalStructMatches?.length || 0) >= 2;

  const inlineExplicitRe = new RegExp(
    `(?:\\s+|[،؛|/]+\\s*)(?:[-–—]+\\s*)?(?=(?:(?:ال)?(?:مبحث|مطلب|محور|فصل|باب)\\s+${ordPat}\\s*[:：\\-–—.]|(?:المقدمة|الخاتمة|قائمة\\s+(?:المصادر\\s+و)?المراجع)\\s*:))` +
      `|(?:\\s+|(?<=[،؛|/]))[-–—،؛|/]+\\s*(?=(?:ال)?(?:مبحث|مطلب|محور|فصل|باب)\\s+${ordPat}(?:\\s|[:：\\-–—.(/]|$))`,
    'g',
  );
  // تفكيك حتى بدون نقطتين أو شرطة عندما يضم الإدخال 2+ علامات هيكلية واضحة مثل: "المبحث الأول ... المطلب الأول ... المطلب الثاني ..."
  const inlineFlatMarkersRe = new RegExp(
    `(?:\\s+|(?<=[،؛|/:]))(?=(?:ال)?(?:مبحث|مطلب|محور)\\s+${ordPat}(?:\\s|[:：\\-–—.(/]|$))`,
    'g',
  );
  const inlineIntroConcRe =
    /\s*[-–—،؛|/]+\s*(?=(?:(?:ال)?مقدمة|(?:ال)?خاتمة|دراسة\s+حالة|قائمة\s+(?:المصادر\s+و)?المراجع)(?=$|\s|[-–—:]))/g;

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // تفكيك الأسطر المدمجة التي تضم المباحث والمطالب في سطر واحد (دون المساس بالعناوين العادية)
    let split = line.replace(inlineExplicitRe, '\n');
    const lineExplicitMatches = line.match(
      new RegExp(`(?:^|[\\s،؛|/\\-–—:])(?:ال)?(?:مبحث|مطلب|محور)\\s+${ordPat}(?=$|\\s|[:：\\-–—.(/])`, 'gi'),
    );
    if (hasMultipleExplicitMarkersGlobally || (lineExplicitMatches?.length || 0) >= 2) {
      split = split.replace(inlineFlatMarkersRe, '\n');
    }

    const hasExplicitSectionKeyword = new RegExp(`(?:المبحث|مبحث|المطلب|مطلب|المحور|محور|الفصل|فصل)\\s+${ordPat}`, 'i').test(split);
    if (hasExplicitSectionKeyword) {
      split = split.replace(inlineIntroConcRe, '\n');
      split = split.replace(/\s*[-–—]*\s*(?=دراسة\s+حالة\s*:)/g, '\n');
    } else if (
      /(?:^|[\s:：\-–—،])(?:1|١)\s*[.\-\)/]\s*[\u0600-\u06FF]/.test(split) &&
      /\s(?:2|٢)\s*[.\-\)/]\s*[\u0600-\u06FF]/.test(split)
    ) {
      // تفكيك ترقيم خطة في سطر واحد مثل: "الأمن السيبراني: 1. مفهوم الأمن 2. التهديدات 3. الحلول"
      split = split.replace(/(?:\s+|(?<=[:：]))(?=(?:20|1\d|[1-9]|٢٠|١[٠-٩]|[١-٩])\s*[.\-\)/]\s*[\u0600-\u06FF])/g, '\n');
    }

    const didInlineSplit = split !== line;
    for (const part of split.split('\n')) {
      const cleanedPart = (
        didInlineSplit
          ? part.trim().replace(/[\s:：\-–—،؛|/]+$/, '')
          : part.trim().replace(/\s+[-–—،]+$/, '')
      ).trim();
      if (cleanedPart) out.push(cleanedPart);
    }
  }

  return out;
}

const LEADING_BULLET_PREFIX_RE = /^(?:(?:#+\s*|(?:[-*•+–—>▪▫●○◆◇❖✔‣◦⁃]|📌|📋|🔹|🔸|🔻|🔺|✅|▶️?|◀️?|➡️?|⬅️?)+)\s*)+/u;

function classifyPlanLine(rawLine: string): ClassifiedPlanLine {
  const rawTrim = (rawLine || '').replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ').trim();
  if (!rawTrim || /^[-=_*•\s]{2,}$/.test(rawTrim)) return { type: 'ignore' };

  const hadBullet = /^(?:[-*•+▪▫●○◆◇❖✔‣◦⁃]|📌|📋|🔹|🔸|🔻|🔺|✅|▶️?|◀️?|➡️?|⬅️?)\s*/u.test(rawTrim) &&
    /^[-*•+▪▫●○◆◇❖✔‣◦⁃]|^(?:📌|📋|🔹|🔸|🔻|🔺|✅|▶️?|◀️?|➡️?|⬅️?)/u.test(rawTrim);
  const withoutMd = rawTrim
    .replace(LEADING_BULLET_PREFIX_RE, '')
    .replace(/\*\*|__/g, '')
    .replace(/^\*+|\*+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!withoutMd) return { type: 'ignore' };

  const { norm, origStarts } = mapNormalizedToOriginal(withoutMd);
  const normDigit = normalizeIndicDigits(norm);

  const sliceOrigFrom = (normIdx: number) => {
    if (normIdx <= 0) return withoutMd;
    if (normIdx >= origStarts.length) return '';
    return withoutMd.slice(origStarts[normIdx]);
  };

  // نزع الترقيم التمهيدي الاختياري للتحقق مما إذا كان السطر يبدأ بكلمة هيكلية صريحة (مثل: "1. المبحث الأول:")
  let explicitNorm = normDigit;
  let explicitBaseText = withoutMd;
  const leadingNumBeforeKeyword = normDigit.match(
    /^(?:\(?\s*(?:\d+(?:\.\d+)*|[أابجدهوزحط])\s*[\.\-\)\]:/]+\s*|\[\s*\d+\s*\]\s*|(?:اولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا)(?:\s*[:：\-–—.]+\s*|\s+(?=(?:ال)?(?:مبحث|محور|مطلب))))((?:ال)?(?:مبحث|محور|فصل|باب|مطلب|فرع|مقدمه|خاتمه|قائمه|مصادر|مراجع|مدخل|خطه|دراسه\s+حاله).*)$/i,
  );
  if (leadingNumBeforeKeyword) {
    const startIdx = normDigit.length - leadingNumBeforeKeyword[1].length;
    explicitBaseText = sliceOrigFrom(startIdx).trim();
    explicitNorm = leadingNumBeforeKeyword[1];
  }

  const ordPatternNorm =
    '(?:الاول|الاولي|اول|اولي|الثاني|الثانيه|ثان|ثاني|ثانيه|الثالث|الثالثه|ثالث|ثالثه|الرابع|الرابعه|رابع|رابعه|الخامس|الخامسه|خامس|خامسه|السادس|السادسه|سادس|سادسه|السابع|السابعه|سابع|سابعه|الثامن|الثامنه|ثامن|ثامنه|التاسع|التاسعه|تاسع|تاسعه|العاشر|العاشره|عاشر|عاشره|الحادي\\s+عشر|الثاني\\s+عشر|التمهيدي|تمهيدي|النظري|نظري|التطبيقي|تطبيقي|المفاهيمي|مفاهيمي|العملي|عملي|الاخير|اخير|واحد|اثنان|اثنين|\\d+)';

  // 1. عناوين تمهيدية صرفة للخطة
  if (/^(?:خطه\s+(?:هذا\s+)?(?:ال)?(?:بحث|دراسه|عرض)|الخطه(?:\s+(?:المقترحه|التاليه|الاتيه|المرفقه))?|(?:هيكل|مخطط|عناصر|محتويات)\s+(?:البحث|العرض)|فهرس\s+المحتويات)(?:\s*[:：\-–—.*]*)?$/i.test(explicitNorm)) {
    return { type: 'plan_header' };
  }

  // 2. المقدمة / الخاتمة / المراجع
  if (/^(?:(?:ال)?مقدمه(?:\s+(?:عامه|البحث|الدراسه|العرض))?|مدخل\s+عام)(?:\s*[:：\-–—.]\s*.{0,40})?$/i.test(explicitNorm)) {
    return { type: 'intro' };
  }
  if (/^(?:الخاتمه|الخـ?اتـ?مـ+ه|خاتمه(?:\s+(?:عامه|البحث|الدراسه|العرض))?)(?:\s*[:：\-–—.]\s*.{0,40})?$/i.test(explicitNorm)) {
    return { type: 'conclusion' };
  }
  if (/^(?:قائمه\s+المصادر(?:\s+والمراجع)?|المصادر\s+والمراجع|قائمه\s+المراجع|المراجع(?:\s+والمصادر)?|ثبت\s+المصادر)(?:\s*[:：\-–—.].{0,40})?$/i.test(explicitNorm)) {
    return { type: 'references' };
  }

  // 3. المباحث / المحاور / الفصول / الأبواب الصريحة
  const majorRe = new RegExp(
    `^(?:ال)?(مبحث|محور|فصل|باب)(?:\\s+(?:رقم\\s*)?\\(?\\s*${ordPatternNorm}\\s*\\)?(?:\\s*[:：\\-–—.\\(/]|\\s+|$)|\\s*[:：\\-–—]+\\s*)`,
    'i',
  );
  const mMaj = explicitNorm.match(majorRe);
  if (mMaj) {
    const kindRaw = mMaj[1].toLowerCase();
    const kind: 'mabhath' | 'mihwar' | 'fasl' | 'bab' =
      kindRaw === 'محور' ? 'mihwar' : kindRaw === 'فصل' ? 'fasl' : kindRaw === 'باب' ? 'bab' : 'mabhath';
    const { origStarts: expOrig } = mapNormalizedToOriginal(explicitBaseText);
    const tailRaw =
      mMaj[0].length < expOrig.length ? explicitBaseText.slice(expOrig[mMaj[0].length]) : '';
    return { type: 'major', kind, subTitle: cleanOutlineSubTitle(tailRaw) };
  }

  // 4. المطالب الصريحة
  const matlabRe = new RegExp(
    `^(?:ال)?مطلب(?:\\s+(?:رقم\\s*)?\\(?\\s*${ordPatternNorm}\\s*\\)?(?:\\s*[:：\\-–—.\\(/]|\\s+|$)|\\s*[:：\\-–—]+\\s*)`,
    'i',
  );
  const mMat = explicitNorm.match(matlabRe);
  if (mMat) {
    const { origStarts: expOrig } = mapNormalizedToOriginal(explicitBaseText);
    const tailRaw =
      mMat[0].length < expOrig.length ? explicitBaseText.slice(expOrig[mMat[0].length]) : '';
    return { type: 'matlab_explicit', subTitle: cleanOutlineSubTitle(tailRaw) };
  }

  // 5. الفروع الصريحة
  const faraRe = new RegExp(
    `^(?:ال)?فرع(?:\\s+(?:رقم\\s*)?\\(?\\s*${ordPatternNorm}\\s*\\)?(?:\\s*[:：\\-–—.\\(/]|\\s+|$)|\\s*[:：\\-–—]+\\s*)`,
    'i',
  );
  const mFara = explicitNorm.match(faraRe);
  if (mFara) {
    const { origStarts: expOrig } = mapNormalizedToOriginal(explicitBaseText);
    const tailRaw =
      mFara[0].length < expOrig.length ? explicitBaseText.slice(expOrig[mFara[0].length]) : '';
    return { type: 'fara', subTitle: cleanOutlineSubTitle(tailRaw) };
  }

  // 6. دراسة حالة كعنصر مستقل داخل الخطة (ليس مسبوقاً بـ المبحث/المحور)
  if (
    explicitNorm.length <= 140 &&
    /^(?:الجانب\s+التطبيقي\s*[:：\-–—]?\s*)?دراسه\s+حاله(?:\s+(?:تطبيقيه|ميدانيه))?(?:$|\s*[:：\-–—]|\s+(?:حول|عن|في|بـ?)\s*\S+)/i.test(
      explicitNorm,
    )
  ) {
    const strippedCs = extractCaseStudyFromTopic(explicitBaseText);
    return { type: 'case_study_standalone', company: strippedCs.company };
  }

  // 7. الترقيم المتدرج (1.1.1 / 1.1) والترتيبي (أولاً / 1. / أ- / -)
  const deepMatch = normDigit.match(/^\d+\.\d+\.\d+\s*[:：\-–—.)]*\s+(.+)$/);
  if (deepMatch) {
    const startIdx = normDigit.length - deepMatch[1].length;
    return { type: 'deep_sub', subTitle: cleanOutlineSubTitle(sliceOrigFrom(startIdx)) };
  }

  const dottedSubMatch = normDigit.match(/^\(?\s*[1-9]\d?\s*[.\-/]\s*[1-9]\d?\s*\)?\s*[:：\-–—.)]*\s+(.+)$/);
  if (dottedSubMatch) {
    const startIdx = normDigit.length - dottedSubMatch[1].length;
    return { type: 'dotted_sub', subTitle: cleanOutlineSubTitle(sliceOrigFrom(startIdx)) };
  }

  const ordMatch = normDigit.match(
    /^(?:اولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا)\s*[:：\-–—.)]+\s*(.+)$/,
  );
  if (ordMatch) {
    const startIdx = normDigit.length - ordMatch[1].length;
    return { type: 'ordinal', subTitle: cleanOutlineSubTitle(sliceOrigFrom(startIdx)) };
  }

  const topNumMatch = normDigit.match(/^(?:\(\s*(20|1\d|[1-9])\s*\)|(20|1\d|[1-9])\s*[:：\-–—.)/]+)\s*(.+)$/);
  if (topNumMatch) {
    const restText = topNumMatch[3] || '';
    if (restText && !/^(?:صفح[هات]|سنه|عام|%|مليون|مليار)/i.test(normalizeIndicDigits(mapNormalizedToOriginal(restText).norm))) {
      const startIdx = normDigit.length - restText.length;
      return { type: 'top_num', subTitle: cleanOutlineSubTitle(sliceOrigFrom(startIdx)) };
    }
  }

  const alphaSubMatch = normDigit.match(/^(?:\(\s*[أابجدهوزحط]\s*\)|[أابجدهوزحط]\s*[:：\-–—.)/]+)\s*(.+)$/);
  if (alphaSubMatch) {
    const startIdx = normDigit.length - alphaSubMatch[1].length;
    return { type: 'alpha_sub', subTitle: cleanOutlineSubTitle(sliceOrigFrom(startIdx)) };
  }

  if (hadBullet) {
    return { type: 'bullet', subTitle: cleanOutlineSubTitle(withoutMd) };
  }

  return { type: 'text', raw: rawTrim };
}

function deriveTitleFromCustomPlan(customMabahith: CustomPlanMabhath[]): string {
  const cleanedSubs = customMabahith
    .map((m) => stripStructuralPrefix(m.title, 'مبحث'))
    .map((s) =>
      s
        .replace(
          /^(?:الاطار|الإطار)\s+(?:النظري|المفاهيمي|العام|القانوني|المؤسسي)(?:\s+و(?:النظري|المفاهيمي|التطبيقي))?\s+(?:لـ?\s*|حول\s+|في\s+)?/i,
          '',
        )
        .replace(/^(?:ماهيه|ماهية|مفهوم|تطور|نشاه|نشأة|اساسيات|أساسيات|اليات|آليات|ادوات|أدوات|تحديات(?:\s+و[آا]فاق)?|دراسة\s+تحليلية\s+لـ?)\s+/i, '')
        .replace(/^(?:ال)?موضوع(?:\s+الدراسه)?$/i, '')
        .trim(),
    )
    .filter((s) => s.length >= 4 && !/دراسة\s+حال[ةه]/.test(s));

  if (cleanedSubs.length === 0) return 'دراسة أكاديمية وفق الخطة المحددة';
  const first = cleanedSubs[0];
  if (cleanedSubs.length === 1) return first;

  const second = cleanedSubs[1];
  const fTokens = new Set(normalizeArabicComparable(first).split(' ').filter((w) => w.length >= 3));
  const sTokens = normalizeArabicComparable(second).split(' ').filter((w) => w.length >= 3);
  const overlap = sTokens.filter((w) => fTokens.has(w)).length;

  if (overlap >= Math.min(2, sTokens.length)) {
    return first.length >= second.length ? first : second;
  }
  const combined = `${first} و${second}`;
  return combined.length <= 85 ? combined : first;
}

interface ExtractedPlanResult {
  hasCustomPlan: boolean;
  customMabahith: CustomPlanMabhath[];
  hasAllCustomMatalib: boolean;
  hasIntroInPlan: boolean;
  hasConclusionInPlan: boolean;
  preambleText: string;
  hadPreamblePlanLabel: boolean;
  planCaseStudyRequested: boolean;
  planCaseStudyCompany: string;
  caseStudyInPlanMabhath: boolean;
}

function extractPlanFromTopicInput(rawInput: string): ExtractedPlanResult {
  const emptyResult: ExtractedPlanResult = {
    hasCustomPlan: false,
    customMabahith: [],
    hasAllCustomMatalib: false,
    hasIntroInPlan: false,
    hasConclusionInPlan: false,
    preambleText: '',
    hadPreamblePlanLabel: false,
    planCaseStudyRequested: false,
    planCaseStudyCompany: '',
    caseStudyInPlanMabhath: false,
  };

  const lines = splitTopicIntoPlanLines(rawInput);
  if (lines.length < 2) return emptyResult;

  const classified = lines.map((line) => classifyPlanLine(line));

  // دعم صيغة الترتيب بالألفاظ بدون علامات ترقيم (أولاً ... \n ثانياً ...) عند تكرارها سطرين على الأقل
  const bareOrdinalCandidates = classified.map((c) => {
    if (c.type !== 'text') return null;
    const rawTrim = c.raw.replace(/^(?:#+\s*|[-*•+–—>\s]+)+/, '').trim();
    const { norm, origStarts } = mapNormalizedToOriginal(rawTrim);
    const m = norm.match(/^(?:اولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا)\s+(.+)$/);
    if (!m) return null;
    const restNorm = m[1].trim();
    if (
      restNorm.length < 4 ||
      restNorm.length > 110 ||
      /^(?:ان\s+|انا\s+|نحن\s+|اريد|اود|نريد|من\s+فضلك|شكرا|السلام|مرحبا|كيف\s+|هل\s+)/i.test(restNorm)
    ) {
      return null;
    }
    const startIdx = norm.length - m[1].length;
    const subTitle = cleanOutlineSubTitle(startIdx < origStarts.length ? rawTrim.slice(origStarts[startIdx]) : '');
    return subTitle ? ({ type: 'ordinal', subTitle } as ClassifiedPlanLine) : null;
  });
  if (bareOrdinalCandidates.filter(Boolean).length >= 2) {
    bareOrdinalCandidates.forEach((cand, idx) => {
      if (cand) classified[idx] = cand;
    });
  }

  // ترقية العناوين النصية الموجزة التي تسبق «المطلب الأول:» مباشرة (عند وجود سطر عنوان رئيسي يسبقها أو بين كتل المطالب)
  const hasAnyExplicitMajor = classified.some((c) => c.type === 'major');
  const firstMatlabIdx = classified.findIndex((c) => c.type === 'matlab_explicit');
  if (!hasAnyExplicitMajor && firstMatlabIdx !== -1) {
    for (let i = 1; i < classified.length - 1; i++) {
      const cur = classified[i];
      const next = classified[i + 1];
      if (cur.type !== 'text' || next.type !== 'matlab_explicit') continue;
      const cleanedHeading = cur.raw.replace(LEADING_BULLET_PREFIX_RE, '').trim();
      const normHead = mapNormalizedToOriginal(cleanedHeading).norm;
      if (
        cleanedHeading.length >= 4 &&
        cleanedHeading.length <= 100 &&
        !/^(?:عنوان|موضوع|خطه\s+(?:البحث|العرض)|(?:بحث|عرض(?:\s+تقديمي)?)\s+(?:بعنوان|حول|عن)|السلام|مرحبا|اكتب|كتابه|اريد|ممكن|هل\s+)/i.test(normHead)
      ) {
        classified[i] = { type: 'major', kind: 'mabhath', subTitle: cleanOutlineSubTitle(cleanedHeading) };
      }
    }
  }

  const isStructuralStart = (c: ClassifiedPlanLine) =>
    c.type === 'intro' ||
    c.type === 'conclusion' ||
    c.type === 'references' ||
    c.type === 'major' ||
    c.type === 'matlab_explicit' ||
    c.type === 'case_study_standalone' ||
    c.type === 'ordinal' ||
    c.type === 'top_num' ||
    c.type === 'dotted_sub' ||
    c.type === 'bullet';

  const firstStructIdx = classified.findIndex((c) => isStructuralStart(c));
  if (firstStructIdx === -1) return emptyResult;

  const preambleItems = classified.slice(0, firstStructIdx);
  const outlineItems = classified.slice(firstStructIdx);

  const preambleLines: string[] = [];
  let hadPreamblePlanLabel = false;
  for (const item of preambleItems) {
    if (item.type === 'plan_header') {
      hadPreamblePlanLabel = true;
    } else if (item.type === 'text') {
      preambleLines.push(item.raw);
    }
  }

  // معالجة حالة «الفصل الأول -> المبحث الأول -> المطلب الأول»: نُسقط مستوى الفصل الإضافي إذا حوى مباحث صريحة داخله
  const mabhathItems = outlineItems.filter((c): c is Extract<ClassifiedPlanLine, { type: 'major' }> => c.type === 'major' && c.kind === 'mabhath');
  const faslItems = outlineItems.filter((c): c is Extract<ClassifiedPlanLine, { type: 'major' }> => c.type === 'major' && (c.kind === 'fasl' || c.kind === 'bab'));
  const dropFaslWrapper = mabhathItems.length >= 2 && faslItems.length >= 1;

  const effectiveMajors = outlineItems.filter(
    (c): c is Extract<ClassifiedPlanLine, { type: 'major' }> =>
      c.type === 'major' && (!dropFaslWrapper || (c.kind !== 'fasl' && c.kind !== 'bab')),
  );
  const explicitMajorCount = effectiveMajors.length;
  const explicitMatlabCount = outlineItems.filter((c) => c.type === 'matlab_explicit').length;
  const hasExplicitPlanCues =
    hadPreamblePlanLabel ||
    outlineItems.some((c) => c.type === 'intro' || c.type === 'conclusion' || c.type === 'references' || c.type === 'plan_header');

  const topNumItems = outlineItems.filter((c): c is Extract<ClassifiedPlanLine, { type: 'top_num' }> => c.type === 'top_num');
  const ordinalItems = outlineItems.filter((c): c is Extract<ClassifiedPlanLine, { type: 'ordinal' }> => c.type === 'ordinal');
  const bulletItems = outlineItems.filter((c): c is Extract<ClassifiedPlanLine, { type: 'bullet' }> => c.type === 'bullet');
  const subItems = outlineItems.filter(
    (c) => c.type === 'dotted_sub' || c.type === 'alpha_sub' || c.type === 'bullet',
  );

  // هل الخطة المرقمة الحرة تبدو كعناوين خطة حقيقية وليست فقرات نثرية طويلة؟
  const noProseSentences = (items: { subTitle: string }[]) =>
    items.length > 0 &&
    items.every((it) => it.subTitle.length > 0 && it.subTitle.length <= 145) &&
    items.reduce((s, it) => s + it.subTitle.length, 0) / items.length <= 105;

  const hasExplicitMabhathOrMihwar = effectiveMajors.some((m) => m.kind === 'mabhath' || m.kind === 'mihwar');
  let isCustomPlan = false;
  if (
    explicitMajorCount >= 2 ||
    (explicitMajorCount === 1 &&
      (hasExplicitMabhathOrMihwar ||
        explicitMatlabCount >= 1 ||
        hasExplicitPlanCues ||
        subItems.length >= 1 ||
        topNumItems.length + ordinalItems.length >= 1)) ||
    explicitMatlabCount >= 2
  ) {
    isCustomPlan = true;
  } else if (
    (topNumItems.length + ordinalItems.length >= 2 && (subItems.length >= 1 || hasExplicitPlanCues || noProseSentences([...topNumItems, ...ordinalItems]))) ||
    ((topNumItems.length === 1 || ordinalItems.length === 1) && subItems.length >= 2)
  ) {
    isCustomPlan = true;
  } else if (
    bulletItems.length >= 2 &&
    (hasExplicitPlanCues || preambleLines.length > 0) &&
    noProseSentences(bulletItems)
  ) {
    isCustomPlan = true;
  }

  if (!isCustomPlan) return emptyResult;

  // تحديد آلية التجميع (صريح vs ترقيم/ترتيب حر)
  const usesExplicitMajors = explicitMajorCount >= 1;
  const firstTopLevelType = outlineItems.find((c) => c.type === 'ordinal' || c.type === 'top_num')?.type;
  const minorOrdinalType: 'ordinal' | 'top_num' | null =
    !usesExplicitMajors && ordinalItems.length > 0 && topNumItems.length > 0
      ? firstTopLevelType === 'ordinal'
        ? 'top_num'
        : 'ordinal'
      : null;

  interface TempMabhath {
    rawSub: string;
    items: ClassifiedPlanLine[];
  }
  const tempMabahith: TempMabhath[] = [];
  let currentMb: TempMabhath | null = null;
  let hasIntroInPlan = false;
  let hasConclusionInPlan = false;
  let planCaseStudyRequested = false;
  let planCaseStudyCompany = '';

  const ensureCurrentMb = () => {
    if (!currentMb) {
      currentMb = { rawSub: '', items: [] };
      tempMabahith.push(currentMb);
    }
    return currentMb;
  };

  for (const item of outlineItems) {
    if (item.type === 'ignore' || item.type === 'plan_header' || item.type === 'references') continue;
    if (item.type === 'intro') {
      hasIntroInPlan = true;
      continue;
    }
    if (item.type === 'conclusion') {
      hasConclusionInPlan = true;
      continue;
    }
    if (item.type === 'case_study_standalone') {
      planCaseStudyRequested = true;
      if (item.company && !planCaseStudyCompany) {
        planCaseStudyCompany = item.company;
      }
      continue;
    }
    if (item.type === 'text') {
      continue;
    }

    if (usesExplicitMajors) {
      if (item.type === 'major') {
        if (dropFaslWrapper && (item.kind === 'fasl' || item.kind === 'bab')) continue;
        currentMb = { rawSub: item.subTitle, items: [] };
        tempMabahith.push(currentMb);
      } else {
        ensureCurrentMb().items.push(item);
      }
    } else if (explicitMatlabCount >= 2 && topNumItems.length === 0 && ordinalItems.length === 0) {
      if (item.type === 'matlab_explicit') {
        ensureCurrentMb().items.push(item);
      }
    } else if (ordinalItems.length > 0 || topNumItems.length > 0) {
      const isMinorType = item.type === minorOrdinalType;
      if ((item.type === 'ordinal' || item.type === 'top_num') && !isMinorType) {
        currentMb = { rawSub: item.subTitle, items: [] };
        tempMabahith.push(currentMb);
      } else {
        ensureCurrentMb().items.push(item);
      }
    } else if (item.type === 'bullet') {
      currentMb = { rawSub: item.subTitle, items: [] };
      tempMabahith.push(currentMb);
    }
  }

  const finalMabahith: CustomPlanMabhath[] = [];
  const limitedTemp = tempMabahith.slice(0, 10);

  for (let i = 0; i < limitedTemp.length; i++) {
    const tMb = limitedTemp[i];
    const hasExplicitMat = tMb.items.some((x) => x.type === 'matlab_explicit');
    const hasMidTier = tMb.items.some((x) => x.type === 'dotted_sub' || x.type === 'top_num' || x.type === 'ordinal');

    const pickedMatalib: string[] = [];
    for (const sub of tMb.items) {
      if (sub.type === 'fara' || sub.type === 'deep_sub') continue;
      if (hasExplicitMat) {
        if (sub.type === 'matlab_explicit' && sub.subTitle) pickedMatalib.push(sub.subTitle);
      } else if (hasMidTier) {
        if ((sub.type === 'dotted_sub' || sub.type === 'top_num' || sub.type === 'ordinal') && sub.subTitle) {
          pickedMatalib.push(sub.subTitle);
        }
      } else {
        if ((sub.type === 'bullet' || sub.type === 'alpha_sub') && sub.subTitle) {
          pickedMatalib.push(sub.subTitle);
        }
      }
    }

    const mbOrd = ORDINAL_WORDS[i] || String(i + 1);
    const mbSub = tMb.rawSub || `[محور المبحث ${mbOrd}]`;
    const matalib = pickedMatalib.slice(0, 10).map((mtSub, j) => ({
      title: `المطلب ${ORDINAL_WORDS[j] || j + 1}: ${mtSub}`,
    }));

    finalMabahith.push({
      title: `المبحث ${mbOrd}: ${mbSub}`,
      matalib,
    });
  }

  if (finalMabahith.length === 0) return emptyResult;

  const caseStudyInPlanMabhath = finalMabahith.some((mb) =>
    /(?:^|[\s:\-–—«"(])دراس[ةه]\s+حال[ةه](?:$|[\s:\-–—»")])/i.test(
      mapNormalizedToOriginal(stripStructuralPrefix(mb.title, 'مبحث')).norm,
    ),
  );

  return {
    hasCustomPlan: true,
    customMabahith: finalMabahith,
    hasAllCustomMatalib: finalMabahith.every((mb) => mb.matalib.length > 0),
    hasIntroInPlan,
    hasConclusionInPlan,
    preambleText: preambleLines.join(' ').trim(),
    hadPreamblePlanLabel,
    planCaseStudyRequested,
    planCaseStudyCompany,
    caseStudyInPlanMabhath,
  };
}

const PLAN_LEAK_ORD_NORM =
  '(?:الاول|الاولي|اول|اولي|الثاني|الثانيه|ثان|ثاني|ثانيه|الثالث|الثالثه|ثالث|ثالثه|الرابع|الرابعه|رابع|رابعه|الخامس|الخامسه|خامس|خامسه|السادس|السادسه|سادس|سادسه|السابع|السابعه|سابع|سابعه|الثامن|الثامنه|ثامن|ثامنه|التاسع|التاسعه|تاسع|تاسعه|العاشر|العاشره|عاشر|عاشره|التمهيدي|تمهيدي|\\(?\\s*\\d+\\s*\\)?)';

const PLAN_LEAK_PRIMARY_RE = new RegExp(
  `(?:^|[\\s:\\-–—،؛(/\\\\|])(?:ال)?(?:مبحث|مطلب|محور)\\s+${PLAN_LEAK_ORD_NORM}(?=$|\\s|[:：\\-–—.)/\\\\|])`,
  'i',
);

const PLAN_LEAK_SECONDARY_RE = new RegExp(
  `(?:^|[\\s:\\-–—،؛(/\\\\|])(?:(?:ال)?(?:فصل|باب)\\s+${PLAN_LEAK_ORD_NORM}\\s*[:：\\-–—]|(?:خطه\\s+(?:البحث|العرض)|المقدمه|الخاتمه|قائمه\\s+(?:المصادر\\s+و)?المراجع)\\s*[:：\\-–—])|(?:^|\\s)(?:1|١)\\s*[.\\-\\)]\\s*[\\u0600-\\u06FF][\\s\\S]*\\s(?:2|٢)\\s*[.\\-\\)]\\s*[\\u0600-\\u06FF]`,
  'i',
);

export function looksLikePlanLeak(titleCandidate: string): boolean {
  const s = (titleCandidate || '').trim();
  if (!s) return false;
  const { norm } = mapNormalizedToOriginal(s);
  const normDigit = normalizeIndicDigits(norm);
  if (PLAN_LEAK_PRIMARY_RE.test(normDigit)) return true;
  if (PLAN_LEAK_SECONDARY_RE.test(normDigit)) return true;
  if (/\n/.test(s) && s.split('\n').filter((l) => l.trim()).length >= 3) {
    const structLines = s
      .split('\n')
      .map((l) => classifyPlanLine(l))
      .filter((c) => c.type !== 'text' && c.type !== 'ignore');
    if (structLines.length >= 2) return true;
  }
  return false;
}

export function sanitizeCoverTitleFromPlanLeak(
  rawTitle: string,
  fallbackMabahith?: CustomPlanMabhath[],
): { cleaned: string; hadLeak: boolean; extractedPrefix: boolean } {
  const trimmed = (rawTitle || '').replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ').trim();
  if (!trimmed) {
    return { cleaned: '', hadLeak: false, extractedPrefix: false };
  }

  if (!looksLikePlanLeak(trimmed)) {
    return { cleaned: trimmed, hadLeak: false, extractedPrefix: true };
  }

  // استخراج الجزء الواقع قبل بداية أول علامة خطة متسربة (مثل المبحث/المطلب/1.)
  const singleLine = trimmed.replace(/\r\n?/g, '\n');
  const rawLines = singleLine.split('\n').map((l) => l.trim()).filter(Boolean);
  let leadingCandidate = '';

  if (rawLines.length >= 2) {
    const firstNonStructIdx = rawLines.findIndex((l) => {
      const cls = classifyPlanLine(l);
      return cls.type !== 'text' && cls.type !== 'ignore';
    });
    if (firstNonStructIdx > 0) {
      leadingCandidate = rawLines.slice(0, firstNonStructIdx).join(' ').trim();
    } else if (firstNonStructIdx === -1) {
      leadingCandidate = rawLines[0];
    }
  } else {
    leadingCandidate = trimmed;
  }

  if (leadingCandidate) {
    const { norm, origStarts } = mapNormalizedToOriginal(leadingCandidate);
    const normDigit = normalizeIndicDigits(norm);
    let earliestNormIdx = -1;
    for (const re of [PLAN_LEAK_PRIMARY_RE, PLAN_LEAK_SECONDARY_RE]) {
      const m = normDigit.match(re);
      if (m && typeof m.index === 'number') {
        if (earliestNormIdx === -1 || m.index < earliestNormIdx) {
          earliestNormIdx = m.index;
        }
      }
    }
    if (earliestNormIdx !== -1 && earliestNormIdx < origStarts.length) {
      leadingCandidate = leadingCandidate.slice(0, origStarts[earliestNormIdx]).trim();
    }
  }

  if (leadingCandidate) {
    leadingCandidate = leadingCandidate.replace(/[\s:：\-–—،؛/|]+$/, '').trim();
    leadingCandidate = stripTopicChatWrappers(leadingCandidate, { allowEmpty: true, planPreamble: true }).cleaned;
    leadingCandidate = leadingCandidate.replace(/[\s:：\-–—،؛/|]+$/, '').trim();
  }

  if (leadingCandidate && leadingCandidate.length >= 3 && leadingCandidate.length <= 145 && !looksLikePlanLeak(leadingCandidate)) {
    return { cleaned: leadingCandidate, hadLeak: true, extractedPrefix: true };
  }

  const derived = fallbackMabahith?.length ? deriveTitleFromCustomPlan(fallbackMabahith) : '';
  return { cleaned: derived, hadLeak: true, extractedPrefix: false };
}

/**
 * التحليل الشامل والموحّد لمدخلات الطالب في خانة «موضوع أو عنوان البحث»:
 * ١. يكتشف إن لصق الطالب خطة بحث كاملة (بصيغ المباحث أو المحاور أو الترقيم أو القوائم).
 * ٢. ينظّف العبارات الإضافية وأسلوب المحادثة مثل «أكتب لي بحثاً حول...» أو «كتابة بحث حول...».
 * ٣. يفصل «دراسة حالة» تلقائياً ويضمن نظافة عنوان الغلاف بنسبة 100%.
 */
export function analyzeStudentTopic(rawInput: string, explicitCaseStudyCompany?: string): StudentTopicAnalysis {
  const planRes = extractPlanFromTopicInput(rawInput);

  if (!planRes.hasCustomPlan) {
    const rawTrimmed = (rawInput || '')
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const wrapperRes = stripTopicChatWrappers(rawInput);
    const leakRes = sanitizeCoverTitleFromPlanLeak(wrapperRes.cleaned || rawTrimmed);
    const safeTopic = leakRes.hadLeak ? leakRes.cleaned || wrapperRes.cleaned : wrapperRes.cleaned || rawTrimmed;
    const caseStudy = resolveCaseStudySpec(safeTopic || rawInput, explicitCaseStudyCompany);
    return {
      hasCustomPlan: false,
      customMabahith: [],
      hasAllCustomMatalib: false,
      hasIntroInPlan: false,
      hasConclusionInPlan: false,
      caseStudyInPlanMabhath: false,
      hasExplicitTitle: Boolean(safeTopic),
      hadWrapperNoise: wrapperRes.stripped || leakRes.hadLeak,
      cleanedTopic: safeTopic,
      caseStudy,
    };
  }

  const preambleTrimmed = planRes.preambleText;
  const preambleClean = stripTopicChatWrappers(preambleTrimmed, {
    allowEmpty: true,
    planPreamble: true,
  });

  // التحقق إن بقي عنوان صريح حقيقي خالٍ تماماً من أي بقايا مبحث/مطلب بعد التنظيف
  const preSanitizedTitle = preambleClean.cleaned.replace(/[\s:：\-–—،]+$/, '').trim();
  const titleLeakCheck = sanitizeCoverTitleFromPlanLeak(preSanitizedTitle, planRes.customMabahith);
  const rawRemainingTitle = titleLeakCheck.hadLeak
    ? titleLeakCheck.extractedPrefix
      ? titleLeakCheck.cleaned
      : ''
    : preSanitizedTitle;
  const hasExplicitTitle = Boolean(rawRemainingTitle);

  const effectiveTitleSource = hasExplicitTitle
    ? rawRemainingTitle
    : deriveTitleFromCustomPlan(planRes.customMabahith);

  let caseStudy = resolveCaseStudySpec(effectiveTitleSource, explicitCaseStudyCompany);

  // دمج طلب دراسة حالة إن ذُكر كسطر مستقل داخل الخطة نفسها (ولم يدرج كمبحث داخل الخطة ولا في الخانة المخصصة)
  const explicitCompanyTrimmed = (explicitCaseStudyCompany || '').trim();
  if (!explicitCompanyTrimmed) {
    if (planRes.caseStudyInPlanMabhath) {
      caseStudy = {
        ...caseStudy,
        hasCaseStudy: false,
        source: 'none',
        company: '',
      };
    } else if (planRes.planCaseStudyRequested && !caseStudy.hasCaseStudy) {
      caseStudy = {
        ...caseStudy,
        hasCaseStudy: true,
        source: planRes.planCaseStudyCompany ? 'title-named' : 'title-inferred',
        company: planRes.planCaseStudyCompany,
      };
    }
  }

  return {
    hasCustomPlan: true,
    customMabahith: planRes.customMabahith,
    hasAllCustomMatalib: planRes.hasAllCustomMatalib,
    hasIntroInPlan: planRes.hasIntroInPlan,
    hasConclusionInPlan: planRes.hasConclusionInPlan,
    caseStudyInPlanMabhath: planRes.caseStudyInPlanMabhath && !explicitCompanyTrimmed,
    hasExplicitTitle,
    hadWrapperNoise: preambleClean.stripped || planRes.hadPreamblePlanLabel,
    cleanedTopic: effectiveTitleSource,
    caseStudy,
  };
}

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
  options?: {
    coreTopic?: string;
    hasCaseStudy?: boolean;
    customMabahith?: CustomPlanMabhath[];
    allowInferredTitle?: boolean;
  },
): AiPlan {
  const rawExactTopic = (topic || rawPlan?.title || '').trim() || 'موضوع البحث';
  const customMabahith = options?.customMabahith && options.customMabahith.length > 0 ? options.customMabahith : null;
  const topicSanitized = sanitizeCoverTitleFromPlanLeak(rawExactTopic, customMabahith || undefined);
  const exactTopic = topicSanitized.cleaned || 'دراسة أكاديمية وفق الخطة المحددة';
  const analysisTopic = (options?.coreTopic || exactTopic).trim() || exactTopic;
  const hasCaseStudy = !!options?.hasCaseStudy;
  const mCount = customMabahith
    ? Math.max(1, Math.min(10, customMabahith.length))
    : Math.max(1, Math.min(6, parseInt(String(mabhathCountRaw), 10) || 2));
  const defaultTCount = Math.max(1, Math.min(6, parseInt(String(matlabCountRaw), 10) || 2));
  const fb = buildFallbackPlan(analysisTopic, mCount, defaultTCount, 'medium') as AiPlan;

  let finalTitle = exactTopic;
  if ((options?.allowInferredTitle || topicSanitized.hadLeak) && rawPlan?.title) {
    let candidate = stripTopicChatWrappers(rawPlan.title, { allowEmpty: true, planPreamble: true }).cleaned;
    if (hasCaseStudy && candidate) {
      candidate = extractCaseStudyFromTopic(candidate).coverTitle || candidate;
    }
    const normCand = mapNormalizedToOriginal(candidate).norm;
    const isStructuralOrPlaceholder =
      !candidate ||
      candidate.length > 140 ||
      candidate.startsWith('[') ||
      looksLikePlanLeak(candidate) ||
      /^(?:ال)?(?:مبحث|مطلب|محور|فصل|خطه|عنوان|موضوع|صغ\s+عنوانا|عرض\s+تقديمي|عرض\s+باوربوينت)/.test(normCand);
    if (!isStructuralOrPlaceholder) {
      finalTitle = candidate;
    }
  }

  const usedMbTokens: string[][] = [];
  const usedMtTokens: string[][] = [];
  const normalizedMabahith: { title: string; matalib: { title: string }[] }[] = [];
  const strayCaseStudyHeadingRe = /(?:^|[\s:\-–—«"(])دراسة\s+حال[ةه](?:$|[\s:\-–—»")])/i;

  for (let i = 0; i < mCount; i++) {
    const customMb = customMabahith ? customMabahith[i] : null;
    const rawMb = rawPlan?.mabahith?.[i];
    const fbMbSub = stripStructuralPrefix(fb.mabahith[i]?.title || '', 'مبحث') || `المحور ${ORDINAL_WORDS[i] || i + 1}`;

    let mbSub: string;
    if (customMb) {
      const studentMbSub = stripStructuralPrefix(customMb.title || '', 'مبحث');
      const aiMbSub = stripStructuralPrefix(rawMb?.title || '', 'مبحث');
      mbSub =
        studentMbSub && !studentMbSub.startsWith('[')
          ? studentMbSub
          : aiMbSub && !aiMbSub.startsWith('[')
            ? aiMbSub
            : fbMbSub;
    } else {
      mbSub = stripStructuralPrefix(rawMb?.title || '', 'مبحث');
      if (
        !mbSub ||
        mbSub.startsWith('[') ||
        (hasCaseStudy && strayCaseStudyHeadingRe.test(mbSub)) ||
        isTooSimilarHeading(mbSub, usedMbTokens, analysisTopic)
      ) {
        mbSub = fbMbSub;
      }
    }
    usedMbTokens.push(toComparisonTokens(mbSub, analysisTopic));

    const fallbackSeed = customMb && mbSub && !mbSub.startsWith('[') ? mbSub : analysisTopic;
    const fallbackPool: string[] = [];
    for (let shift = 0; shift < 5; shift++) {
      fallbackPool.push(...(getDistinctFallbackMatalib(fallbackSeed, i + shift, 6) as string[]));
    }

    const customMatalib = customMb?.matalib && customMb.matalib.length > 0 ? customMb.matalib : null;
    const tCountForMb = customMatalib ? Math.min(10, customMatalib.length) : defaultTCount;
    const matalib: { title: string }[] = [];

    for (let j = 0; j < tCountForMb; j++) {
      let mtSub: string;
      if (customMatalib) {
        mtSub = stripStructuralPrefix(customMatalib[j]?.title || '', 'مطلب');
        if (!mtSub || mtSub.startsWith('[')) {
          const picked = fallbackPool.find((cand) => !isTooSimilarHeading(cand, usedMtTokens, fallbackSeed));
          mtSub = picked || fallbackPool[j % fallbackPool.length] || `المحور التطبيقي ${ORDINAL_WORDS[j] || j + 1}`;
        }
      } else {
        const rawMtTitle = rawMb?.matalib?.[j]?.title || '';
        mtSub = stripStructuralPrefix(rawMtTitle, 'مطلب');
        if (
          !mtSub ||
          mtSub.startsWith('[') ||
          (hasCaseStudy && strayCaseStudyHeadingRe.test(mtSub)) ||
          isTooSimilarHeading(mtSub, usedMtTokens, analysisTopic)
        ) {
          const picked = fallbackPool.find((cand) => !isTooSimilarHeading(cand, usedMtTokens, analysisTopic));
          mtSub = picked || fallbackPool[j % fallbackPool.length] || `المحور التطبيقي ${ORDINAL_WORDS[j] || j + 1}`;
        }
      }
      usedMtTokens.push(toComparisonTokens(mtSub, fallbackSeed));
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
    title: finalTitle,
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
  const analysis = analyzeStudentTopic(exactUserTopic, o.caseStudyCompany);
  const customMabahith = analysis.hasCustomPlan && analysis.customMabahith.length > 0 ? analysis.customMabahith : undefined;
  const rawCoverCandidate = analysis.caseStudy.coverTitle || analysis.cleanedTopic;
  const provisionalCoverTitle =
    rawCoverCandidate ||
    sanitizeCoverTitleFromPlanLeak(exactUserTopic, customMabahith).cleaned ||
    'بحث أكاديمي وفق الخطة المحددة';
  const hasCaseStudy = analysis.caseStudy.hasCaseStudy;
  let caseCompany = analysis.caseStudy.company;
  const needInferredTitle = Boolean(
    (customMabahith && !analysis.hasExplicitTitle) || (!rawCoverCandidate && looksLikePlanLeak(exactUserTopic)),
  );
  const effectiveMabhathCount = customMabahith ? String(customMabahith.length) : o.mabhathCount;

  let sections: SectionProgress[] = [{ id: 'plan', label: 'خطة البحث', status: 'running', words: 0 }];
  const emit = () => o.onSections(sections.map((s) => ({ ...s })));
  const patch = (id: string, p: Partial<SectionProgress>) => {
    sections = sections.map((s) => (s.id === id ? { ...s, ...p } : s));
    emit();
  };
  emit();
  o.onStage('plan');

  // 1. توليد خطة البحث الحقيقية بصيغة JSON من النموذج (مع الالتزام التام بخطة الطالب إن وجدت)
  let planRaw = '';
  try {
    planRaw = await call(
      buildPlanPrompt(
        provisionalCoverTitle,
        effectiveMabhathCount,
        o.matlabCount,
        cfg,
        caseCompany,
        hasCaseStudy,
        customMabahith ? { customMabahith, needInferredTitle } : undefined,
      ),
      null,
      {
        temperature: 0.25,
        maxTokens: 2800,
      },
    );
  } catch (errPlan) {
    console.warn('تعذر توليد الخطة بالنموذج، الاعتماد على الخطة المنهجية الذكية:', errPlan);
    planRaw = '';
  }

  let plan: AiPlan | null = parseAiPlanJson(planRaw);
  if (hasCaseStudy && !caseCompany && plan?.caseStudyCompany) {
    caseCompany = cleanPlanSuggestedCompany(plan.caseStudyCompany);
  }
  if (!plan || !plan.mabahith?.length) {
    const fbPlan = buildFallbackPlan(analysis.caseStudy.coreTopic || provisionalCoverTitle, effectiveMabhathCount, o.matlabCount, o.length) as AiPlan;
    plan = customMabahith
      ? {
          ...fbPlan,
          ...(plan?.title ? { title: plan.title } : {}),
          ...(plan?.problematic ? { problematic: plan.problematic } : {}),
          ...(Array.isArray(plan?.hypotheses) && plan.hypotheses.length ? { hypotheses: plan.hypotheses } : {}),
          ...(plan?.methodology ? { methodology: plan.methodology } : {}),
          mabahith: customMabahith.map((cm) => ({
            title: cm.title,
            matalib: cm.matalib.map((mt) => ({ ...mt })),
          })),
        }
      : fbPlan;
  }
  // ضبط العدد الدقيق للمباحث والمطالب (مثل 3×3) أو تثبيت خطة الطالب حرفياً
  plan = normalizeResearchPlan(plan, provisionalCoverTitle, effectiveMabhathCount, o.matlabCount, {
    coreTopic: analysis.caseStudy.coreTopic,
    hasCaseStudy,
    customMabahith,
    allowInferredTitle: needInferredTitle,
  });
  if (o.normalizePlan) plan = o.normalizePlan(plan);
  const safePlanTitle = sanitizeCoverTitleFromPlanLeak(plan.title || '', customMabahith).cleaned;
  plan.title = (safePlanTitle || provisionalCoverTitle).trim();
  const p = plan;
  o.onResolvedPlan?.(p);

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
  const totalMatalibCount = p.mabahith.reduce((acc, m) => acc + Math.max(1, m.matalib?.length || 0), 0) || 1;
  const taskMbs = p.mabahith.map(async (mb, idx) => {
    await waitMs(350 * (idx + 1));
    const t = track(`mb${idx}`, (v) => (mbTexts[idx] = v));
    try {
      const expectedMatalib = mb.matalib || [];
      const mbMatalibCount = Math.max(1, expectedMatalib.length);
      const perMb = customMabahith
        ? Math.max(300, Math.round((cfg.mabahithWords * mbMatalibCount) / totalMatalibCount))
        : Math.round(cfg.mabahithWords / (p.mabahith.length || 1));
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
          const rawCs = await call(withAddendum(buildCaseStudyPrompt(p, caseCompany, cfg, analysis.caseStudy.coreTopic)), tCs.onChunk, {
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
