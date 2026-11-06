import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  CircleAlert,
  CircleCheck,
  ClipboardPaste,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge, Chip } from '../ui/Controls';
import { YouTubeIcon } from '../ui/BrandIcons';
import { Field, SelectInput, TextArea } from '../ui/Form';
import { Note, Section } from '../ui/Section';
import { useConverter } from '../../state/ConverterContext';
import { useUI } from '../../state/UIContext';
import { useResetApp } from '../../state/useResetApp';
import { DEMO_RAW_TEXT, QUICK_AI_TOPICS } from '../../data/defaults';
import { AI_LENGTHS, AI_PROVIDERS, type AiLength, type AiProvider } from '../../lib/aiGenerate';

export function Step1Input() {
  const { mode, setMode } = useConverter();
  const { setVideoOpen } = useUI();

  return (
    <div className="flex flex-col gap-4">
      {/* زر فيديو الشرح بتصميم يوتيوب */}
      <button
        type="button"
        onClick={() => setVideoOpen(true)}
        className="group flex items-center gap-3.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 p-3 text-right shadow-sm backdrop-blur-md transition hover:border-black/25 dark:hover:border-white/25 cursor-pointer"
      >
        <span className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-black/[0.04] dark:bg-white/[0.04] transition group-hover:bg-red-500/10">
          <YouTubeIcon className="h-7 w-10 transition-transform duration-200 group-hover:scale-110 drop-shadow-sm group-hover:drop-shadow-[0_2px_10px_rgba(255,0,0,0.45)]" />
        </span>
        <span className="flex-1">
          <span className="block text-[0.86rem] font-bold text-zinc-900 dark:text-zinc-100">شاهد فيديو الشرح: كيف تستخدم وتنسق بحثك؟</span>
          <span className="block text-[0.76rem] text-zinc-500 dark:text-zinc-400">دقيقة واحدة تشرح كل خطوة من كتابة البحث إلى طباعته A4 كـ PDF</span>
        </span>
      </button>

      {/* بطاقتا اختيار طريقة الإدخال (Card-based RadioGroup) بتصميم متناسق مع هوية الموقع */}
      <div role="radiogroup" aria-label="طريقة إدخال البحث" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'ai'}
          onClick={() => setMode('ai')}
          className={`group relative flex flex-col items-start gap-2.5 rounded-2xl border p-4 text-right transition-all duration-200 cursor-pointer backdrop-blur-md ${
            mode === 'ai'
              ? 'border-neutral-900 bg-neutral-100/90 dark:border-white dark:bg-white/10 ring-2 ring-neutral-900/10 dark:ring-white/20 shadow-xs'
              : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 hover:border-black/25 dark:hover:border-white/25'
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs transition group-hover:scale-105">
              <Sparkles className="size-5" />
            </span>
            <span className="rounded-full border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 text-[0.68rem] font-bold text-neutral-800 dark:text-neutral-200">موصى به</span>
          </div>
          <div className="font-bold text-neutral-900 dark:text-neutral-100 text-[0.95rem]">توليد بالذكاء الاصطناعي</div>
          <div className="text-[0.76rem] leading-relaxed text-neutral-600 dark:text-neutral-400">صياغة وتوليد البحث كاملاً (مقدمة، مباحث، مطالب، خاتمة، وهوامش مرقمة).</div>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={mode === 'paste'}
          onClick={() => setMode('paste')}
          className={`group relative flex flex-col items-start gap-2.5 rounded-2xl border p-4 text-right transition-all duration-200 cursor-pointer backdrop-blur-md ${
            mode === 'paste'
              ? 'border-neutral-900 bg-neutral-100/90 dark:border-white dark:bg-white/10 ring-2 ring-neutral-900/10 dark:ring-white/20 shadow-xs'
              : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 hover:border-black/25 dark:hover:border-white/25'
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs transition group-hover:scale-105">
              <ClipboardPaste className="size-5" />
            </span>
            <span className="rounded-full border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 text-[0.68rem] font-bold text-neutral-800 dark:text-neutral-200">سريع</span>
          </div>
          <div className="font-bold text-neutral-900 dark:text-neutral-100 text-[0.95rem]">لصق نص مسودة جاهز</div>
          <div className="text-[0.76rem] leading-relaxed text-neutral-600 dark:text-neutral-400">الصق نصاً مكتوباً لديك ليُحلل ويُقسَّم تلقائياً إلى صفحات A4 منسقة.</div>
        </button>
      </div>

      {/* حقول الطريقة المختارة */}
      {mode === 'ai' ? <AiModeFields /> : <PasteModeFields />}
    </div>
  );
}

function PasteModeFields() {
  const { rawText, setRawText, parse } = useConverter();
  const { confirm, toast } = useUI();
  const resetApp = useResetApp();
  const words = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;

  return (
    <div className="flex animate-rise flex-col gap-3.5">
      <ol className="grid grid-cols-3 gap-2">
        {['الصق نص البحث أو جرّب بالنص الجاهز', 'اضغط زر التحليل الذكي', 'يُنسَّق البحث والغلاف والخطة تلقائياً'].map((t, i) => (
          <li key={i} className="flex flex-col gap-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-2.5 backdrop-blur-md">
            <span className="grid size-6 place-items-center rounded-full bg-black/5 dark:bg-white/10 text-[0.72rem] font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{i + 1}</span>
            <span className="text-[0.74rem] leading-snug font-medium text-zinc-800 dark:text-zinc-200">{t}</span>
          </li>
        ))}
      </ol>

      <Section
        title="نص البحث الخام"
        icon={<ClipboardPaste />}
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={async () => rawText && (await confirm({ title: 'مسح نص المربع؟', confirmLabel: 'مسح' })) && setRawText('')}>
              مسح
            </Button>
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={resetApp}>
              جديد
            </Button>
          </>
        }
      >
        <div className="relative">
          <textarea
            aria-label="نص البحث الخام"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={'الصق هنا نص بحثك كاملاً (مقدمة، مبحث أول، مطلب أول، فقرات، هوامش مرقمة مثل [1] أو ^1، وخاتمة)...\n\nأو اضغط «تجربة بنص تجريبي» لمشاهدة النتيجة فوراً.'}
            className="field min-h-[240px] resize-y font-serif text-[0.98rem] leading-[1.9] scroll-thin"
          />
          {!rawText && (
            <button
              type="button"
              onClick={() => {
                setRawText(DEMO_RAW_TEXT);
                toast('تم تحميل نموذج البحث التجريبي', { description: 'اضغط الآن زر «تحليل النص وتوليد الصفحات» لمشاهدة التقسيم والتنسيق.', tone: 'info' });
              }}
              className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10 px-3 py-1.5 text-[0.76rem] font-bold text-zinc-800 dark:text-zinc-200 transition hover:bg-black/10"
            >
              <FlaskConical className="size-3.5" />
              تجربة بنص تجريبي
            </button>
          )}
        </div>
        <div className="-mt-2 flex items-center justify-between text-[0.72rem] text-zinc-500 dark:text-zinc-400">
          <span>
            الصيغ المدعومة: <code className="rounded border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] px-1 text-zinc-800 dark:text-zinc-200">المبحث الأول:</code> <code className="rounded border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] px-1 text-zinc-800 dark:text-zinc-200">المطلب الأول:</code> <code className="rounded border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] px-1 text-zinc-800 dark:text-zinc-200">^1</code>{' '}
            <code className="rounded border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] px-1 text-zinc-800 dark:text-zinc-200">[1]</code>
          </span>
          <span className="tabular-nums">{words.toLocaleString('ar')} كلمة</span>
        </div>
        <Button variant="magic" size="lg" block icon={<Zap className="size-4.5" />} onClick={() => parse()} disabled={!rawText.trim()}>
          تحليل النص وتوليد الصفحات المنسقة
        </Button>
        <Note icon={<Sparkles />} tone="brand">
          التعرف على المباحث والمطالب، منع الصفحات الفارغة، إعادة ترقيم الهوامش 1، 2، 3 لكل صفحة، واستمرار المحتوى تلقائياً دون تكرار العناوين.
        </Note>
      </Section>
    </div>
  );
}

function AiModeFields() {
  const { apiKey, setApiKey, form, setForm, run, generate } = useConverter();
  const { openKeyGuide } = useUI();
  const [showKey, setShowKey] = useState(false);
  const provider = AI_PROVIDERS[form.provider];

  return (
    <div className="flex animate-rise flex-col gap-3.5">
      <Section
        title="مزود الذكاء الاصطناعي ورمز الـ API"
        icon={<KeyRound />}
        actions={
          <Button size="sm" variant="soft" icon={<Lightbulb className="size-3.5" />} onClick={() => openKeyGuide()}>
            كيف أحصل على الرمز مجاناً؟
          </Button>
        }
      >
        <SelectInput label="المزود والنموذج" value={form.provider} onChange={(e) => setForm({ provider: e.target.value as AiProvider })} hint={provider.hint}>
          {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((k) => (
            <option key={k} value={k}>
              {AI_PROVIDERS[k].label}
              {k === 'gemini' ? ' (موصى به ومجاني)' : ''}
            </option>
          ))}
        </SelectInput>

        <Field
          label="رمز الـ API الشخصي"
          aside={
            provider.keyUrl && (
              <a href={provider.keyUrl} target="_blank" rel="noopener noreferrer" className="text-[0.74rem] font-semibold text-zinc-900 dark:text-white underline-offset-4 hover:underline">
                {provider.keyLabel} ↗
              </a>
            )
          }
          hint={
            apiKey ? (
              <span className="inline-flex items-center gap-1 font-semibold text-zinc-800 dark:text-zinc-200">
                <CircleCheck className="size-3.5 text-zinc-900 dark:text-white" /> محفوظ في هذا المتصفح فقط، ويُرسل مباشرة إلى المزود دون أي خادم وسيط.
              </span>
            ) : (
              'يضعه كل طالب لمرة واحدة فقط، ويبقى محفوظاً في متصفحك الشخصي.'
            )
          }
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider.placeholder}
                className="field pl-10 font-mono text-[0.8rem]"
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'إخفاء الرمز' : 'إظهار الرمز'}
                className="absolute top-1/2 left-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button variant="secondary" icon={<Trash2 className="size-4" />} onClick={() => setApiKey('')} disabled={!apiKey} aria-label="مسح الرمز المحفوظ" title="مسح الرمز المحفوظ" />
          </div>
        </Field>

        {form.provider === 'openrouter' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="رابط الواجهة (Endpoint URL)">
              <input className="field font-mono text-[0.78rem]" dir="ltr" value={form.customUrl} onChange={(e) => setForm({ customUrl: e.target.value })} placeholder="https://openrouter.ai/api/v1/chat/completions" />
            </Field>
            <Field label="معرف النموذج (اختياري)">
              <input className="field font-mono text-[0.78rem]" dir="ltr" value={form.customModel} onChange={(e) => setForm({ customModel: e.target.value })} placeholder="openrouter/auto أو deepseek/deepseek-chat" />
            </Field>
          </div>
        )}
      </Section>

      <Section title="موضوع وخطة البحث المطلوب" icon={<BookOpenCheck />}>
        <TextArea
          id="ai-topic-input"
          label={
            <>
              موضوع أو عنوان البحث الأكاديمي <span className="text-danger">*</span>
            </>
          }
          value={form.topic}
          onChange={(e) => setForm({ topic: e.target.value })}
          placeholder={'اكتب هنا موضوع أو عنوان البحث كاملاً، مثال:\n«استراتيجيات إدارة الموارد البشرية وأثرها على الأداء المؤسسي»'}
          className="min-h-[96px]"
        />
        <div className="-mt-1 flex flex-wrap gap-1.5">
          <span className="ml-1 self-center text-[0.72rem] font-semibold text-zinc-500 dark:text-zinc-400">أمثلة سريعة:</span>
          {QUICK_AI_TOPICS.map((q) => (
            <Chip key={q.label} onClick={() => setForm({ topic: q.topic })} icon={<Lightbulb className="size-3" />}>
              {q.label}
            </Chip>
          ))}
        </div>

        <SelectInput
          label="حجم وعمق البحث"
          aside={<Badge tone="brand">الهدف: {AI_LENGTHS[form.length].target}</Badge>}
          value={form.length}
          onChange={(e) => setForm({ length: e.target.value as AiLength })}
          hint="تُضبط ميزانية الكلمات وهيكل المباحث آلياً ليقترب الناتج من عدد الصفحات المحدد."
        >
          {(Object.keys(AI_LENGTHS) as AiLength[]).map((k) => (
            <option key={k} value={k}>
              {AI_LENGTHS[k].label} ({AI_LENGTHS[k].target})
            </option>
          ))}
        </SelectInput>

        <div className="grid grid-cols-2 gap-3">
          <SelectInput label="عدد المباحث" value={form.mabhathCount} onChange={(e) => setForm({ mabhathCount: e.target.value })}>
            <option value="1">مبحث واحد</option>
            <option value="2">مبحثان (قياسي)</option>
            <option value="3">3 مباحث</option>
          </SelectInput>
          <SelectInput label="مطالب كل مبحث" value={form.matlabCount} onChange={(e) => setForm({ matlabCount: e.target.value })}>
            <option value="2">مطلبان (قياسي)</option>
            <option value="3">3 مطالب</option>
          </SelectInput>
        </div>

        <Note icon={<CircleAlert />} tone="warn">
          يكتب الذكاء الاصطناعي إحالات وهوامش ومراجع مقترحة. <strong>راجع كل مرجع وتحقق من وجوده</strong> قبل التسليم، فالنماذج قد تقترح مراجع غير دقيقة.
        </Note>

        <Button variant="magic" size="lg" block loading={run.running} icon={<Wand2 className="size-4.5" />} onClick={generate}>
          {run.running ? `جاري التوليد (${AI_LENGTHS[form.length].target})...` : 'صياغة وتوليد وتنسيق البحث الأكاديمي'}
        </Button>

        {(run.running || run.stage === 'done') && <AiProgress />}
      </Section>
    </div>
  );
}

function AiProgress() {
  const { run, rawText } = useConverter();
  const { setWizardStep } = useUI();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!run.running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [run.running]);
  const seconds = run.duration ?? (now - run.startedAt) / 1000;
  const stageText = run.stage === 'plan' ? 'الخطوة 1: صياغة خطة وهيكل البحث (ثانية واحدة)...' : run.stage === 'writing' ? 'الخطوة 2: توليد نصوص المباحث بالتوازي والبث اللحظي...' : 'اكتمل البحث وتم بناء وتنسيق صفحات A4.';

  return (
    <div className="animate-rise overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-md shadow-xs" aria-live="polite">
      <div className="flex items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-[0.8rem] font-semibold text-zinc-900 dark:text-zinc-100">
          {run.running ? <Loader2 className="size-4 animate-spin text-zinc-800 dark:text-zinc-200" /> : <CircleCheck className="size-4 text-emerald-500" />}
          {stageText}
        </div>
        <span className="rounded-md border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 font-mono text-[0.74rem] font-bold text-zinc-900 dark:text-white tabular-nums">{seconds.toFixed(1)} ث</span>
      </div>
      <ul className="grid grid-cols-2 gap-1.5 p-2.5">
        {(run.sections.length ? run.sections : [{ id: 'plan', label: 'خطة البحث', status: 'running' as const, words: 0 }]).map((s) => (
          <li
            key={s.id}
            className={`relative flex items-center justify-between gap-2 overflow-hidden rounded-lg border px-2.5 py-2 text-[0.76rem] ${
              s.status === 'done' ? 'border-emerald-500/20 bg-emerald-500/10' : s.status === 'error' ? 'border-red-500/20 bg-red-500/10' : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04]'
            }`}
          >
            {s.status === 'running' && <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] bg-[length:200%_100%]" />}
            <span className="relative font-semibold text-zinc-800 dark:text-zinc-200">{s.label}</span>
            <span className={`relative font-bold tabular-nums ${s.status === 'done' ? 'text-ok' : s.status === 'error' ? 'text-danger' : 'text-zinc-900 dark:text-white'}`}>
              {s.status === 'done' ? (s.words ? `${s.words} كلمة` : `${s.seconds} ث`) : s.status === 'error' ? 'تعذر' : s.words ? `${s.words} كلمة` : 'جارٍ...'}
            </span>
          </li>
        ))}
      </ul>

      {run.running && !!rawText && (
        <div className="border-t border-black/10 dark:border-white/10 p-2.5 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-1.5 text-[0.72rem] font-semibold text-zinc-600 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              بث مباشر متدفق لحظياً:
            </span>
            <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">{run.words.toLocaleString('ar')} كلمة</span>
          </div>
          <div className="max-h-24 overflow-hidden rounded-lg bg-black/[0.03] dark:bg-white/[0.04] p-2 text-[0.74rem] font-serif leading-relaxed text-zinc-700 dark:text-zinc-300 select-none line-clamp-3" dir="rtl">
            {rawText.slice(-280)}...
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-black/10 dark:border-white/10 px-3.5 py-2 text-[0.72rem] text-zinc-500 dark:text-zinc-400">
        <span className="tabular-nums font-semibold">إجمالي الكلمات: {run.words.toLocaleString('ar')} كلمة</span>
        <span>
          النموذج النشط: <strong className="font-mono text-zinc-800 dark:text-zinc-200">{run.model}</strong>
        </span>
      </div>

      {run.stage === 'done' && (
        <div className="border-t border-black/10 dark:border-white/10 p-2.5 bg-emerald-500/[0.05]">
          <Button
            variant="magic"
            size="md"
            block
            icon={<ArrowLeft className="size-4" />}
            onClick={() => setWizardStep(4)}
          >
            الانتقال للمعاينة والصفحات المنسقة فوراً
          </Button>
        </div>
      )}
    </div>
  );
}
