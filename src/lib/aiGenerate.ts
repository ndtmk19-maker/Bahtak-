// تنسيق مراحل التوليد بالذكاء الاصطناعي: خطة JSON ثم توليد متوازٍ للمقدمة والمباحث والخاتمة
import {
  LENGTH_CONFIGS,
  buildFallbackPlan,
  buildPlanPrompt,
  buildIntroPrompt,
  buildMabhathPrompt,
  buildConclusionPrompt,
  cleanIntroText,
  fetchAiText,
} from './aiEngine';

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
  customUrl?: string;
  customModel?: string;
  onSections: (sections: SectionProgress[]) => void;
  onDraft: (text: string, totalWords: number) => void;
  onModel: (model: string) => void;
  onStage: (stage: 'plan' | 'writing' | 'done') => void;
}

const countWords = (txt: string) => (txt ? txt.trim().split(/\s+/).filter(Boolean).length : 0);
const cleanSection = (txt: string) => (txt ? txt.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim() : '');

interface AiPlan {
  title: string;
  problematic?: string;
  questions?: string[];
  hypotheses?: string[];
  methodology?: string;
  mabahith: { title: string; matalib?: { title: string }[] }[];
}

export async function generateResearch(o: GenerateOptions): Promise<string> {
  const cfg = LENGTH_CONFIGS[o.length] || LENGTH_CONFIGS.medium;
  const started = Date.now();
  const elapsed = () => Math.round((Date.now() - started) / 100) / 10;
  const call = (prompt: string, onChunk: ((c: string, acc: string) => void) | null, opts: Record<string, unknown>) =>
    fetchAiText(o.provider, o.apiKey, prompt, onChunk, { ...opts, onModelSelect: o.onModel }, o.customUrl, o.customModel) as Promise<string>;

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
      maxTokens: 1200,
    });
  } catch (errPlan) {
    console.warn('تعذر توليد الخطة بالنموذج، الاعتماد على الخطة المنهجية الذكية:', errPlan);
    planRaw = '';
  }

  let plan: AiPlan | null = null;
  if (planRaw) {
    try {
      let json = planRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const f = json.indexOf('{');
      const l = json.lastIndexOf('}');
      if (f !== -1 && l !== -1) json = json.substring(f, l + 1);
      plan = JSON.parse(json);
    } catch {
      plan = null;
    }
  }

  const exactUserTopic = o.topic.trim();
  if (!plan || !plan.mabahith?.length) {
    plan = buildFallbackPlan(exactUserTopic, o.mabhathCount, o.matlabCount, o.length) as AiPlan;
  }
  // إبقاء عنوان البحث مطابقاً حرفياً للعنوان الذي كتبه المستخدم ومنع الذكاء الاصطناعي من استبداله أو إعادة صياغته
  plan.title = exactUserTopic;
  const p = plan;

  // شارات التوليد المتوازي اللحظي لكل الأقسام
  sections = [
    { id: 'plan', label: 'خطة البحث', status: 'done', words: 0, seconds: elapsed() },
    { id: 'intro', label: 'المقدمة', status: 'running', words: 0 },
    ...p.mabahith.map((_, i) => ({ id: `mb${i}`, label: `المبحث ${i + 1}`, status: 'running' as const, words: 0 })),
    { id: 'conclusion', label: 'الخاتمة والمراجع', status: 'running', words: 0 },
  ];
  emit();
  o.onStage('writing');

  // 2. التوليد المتوازي الحقيقي للمقدمة والمباحث والخاتمة بالتزامن عبر Promise.all
  let intro = '';
  const mbTexts: string[] = new Array(p.mabahith.length).fill('');
  let conclusion = '';

  const refreshDraft = () => {
    const cleanedIntro = cleanIntroText(intro);
    const total = countWords(cleanedIntro) + countWords(conclusion) + mbTexts.reduce((a, t) => a + countWords(t), 0);
    let draft = `بحث بعنوان: ${p.title}\n\n` + (cleanedIntro ? cleanedIntro.trim() + '\n\n' : 'المقدمة:\n(جاري الكتابة بالبث المباشر بالتوازي...)\n\n');
    p.mabahith.forEach((mb, i) => {
      draft += mbTexts[i] ? mbTexts[i].trim() + '\n\n' : `${mb.title || `المبحث ${i + 1}`}\n(جاري تحرير المتن بالتوازي...)\n\n`;
    });
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
  const taskIntro = call(buildIntroPrompt(p, cfg), tIntro.onChunk, {
    temperature: 0.35,
    maxTokens: cfg.introMaxTokens,
  }).then(tIntro.done, tIntro.fail);

  // مهام المباحث بالتوازي مع إرجاء زمني خفيف (350ms) بين المباحث لتفادي حظر التردد اللحظي (Rate-limit)
  const perMb = Math.round(cfg.mabahithWords / (p.mabahith.length || 1));
  const taskMbs = p.mabahith.map(async (mb, idx) => {
    await waitMs(350 * (idx + 1));
    const t = track(`mb${idx}`, (v) => (mbTexts[idx] = v));
    return call(buildMabhathPrompt(p, mb, perMb, cfg), t.onChunk, {
      temperature: 0.35,
      maxTokens: cfg.mabhathMaxTokens,
    }).then(t.done, t.fail);
  });

  // مهمة الخاتمة والمراجع مع إرجاء زمني خفيف
  const tConc = track('conclusion', (v) => (conclusion = v));
  const taskConc = (async () => {
    await waitMs(350 * (p.mabahith.length + 1));
    return call(buildConclusionPrompt(p, cfg), tConc.onChunk, {
      temperature: 0.35,
      maxTokens: cfg.conclusionMaxTokens,
    }).then(tConc.done, tConc.fail);
  })();

  // تنفيذ جميع الأقسام بالتوازي التام
  await Promise.all([taskIntro, ...taskMbs, taskConc]);
  o.onStage('done');

  const cleanedIntro = cleanIntroText(intro);
  const finalText =
    `بحث بعنوان: ${p.title.replace(/^#+\s*/, '').trim()}\n\n` +
    cleanSection(cleanedIntro) +
    '\n\n' +
    mbTexts.map(cleanSection).join('\n\n') +
    '\n\n' +
    cleanSection(conclusion);
  o.onDraft(finalText, countWords(finalText));
  return finalText;
}
