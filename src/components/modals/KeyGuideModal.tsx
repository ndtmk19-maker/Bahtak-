import { useEffect, useState } from 'react';
import { CircleCheck, ExternalLink, GraduationCap, Info } from 'lucide-react';
import { Modal, ModalHeader } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useUI } from '../../state/UIContext';
import { useConverter } from '../../state/ConverterContext';

export function KeyGuideModal() {
  const { keyGuide, closeKeyGuide } = useUI();
  const { apiKey, setApiKey, setForm } = useConverter();
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<'idle' | 'empty' | 'saved'>('idle');

  useEffect(() => {
    if (keyGuide.open) {
      setValue(apiKey);
      setFeedback('idle');
    }
  }, [keyGuide.open, apiKey]);

  const save = () => {
    if (!value.trim()) return setFeedback('empty');
    setApiKey(value.trim());
    setForm({ provider: 'gemini' });
    setFeedback('saved');
    setTimeout(closeKeyGuide, 1000);
  };

  const steps = [
    {
      title: 'افتح صفحة التفعيل الرسمية من Google',
      body: (
        <>
          <p>سجّل الدخول بحساب Gmail المعتاد إذا طُلب منك.</p>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#1a73e8] px-3.5 py-2 text-[0.8rem] font-bold text-white transition hover:bg-[#1765cc]"
          >
            فتح Google AI Studio <ExternalLink className="size-3.5" />
          </a>
        </>
      ),
    },
    {
      title: 'أنشئ الرمز ثم انسخه',
      body: (
        <p>
          اضغط الزر الأزرق <span className="rounded bg-[#e8f0fe] px-1.5 py-0.5 font-mono text-[0.76rem] font-bold text-[#1a73e8]">+ Create API Key</span> ثم اختر أي مشروع أو أنشئ مشروعاً جديداً، واضغط{' '}
          <strong>Copy</strong> لنسخ الرمز.
        </p>
      ),
    },
    {
      title: 'الصق الرمز هنا واضغط حفظ',
      body: (
        <div className="flex flex-col gap-2">
          <input
            data-autofocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setFeedback('idle');
            }}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="ألصق الرمز هنا (يبدأ بـ AIzaSy...)"
            className="field font-mono text-[0.8rem]"
            dir="ltr"
            aria-label="رمز Gemini API"
            spellCheck={false}
          />
          <Button variant="magic" block onClick={save}>
            حفظ وتطبيق الرمز
          </Button>
          {feedback === 'empty' && <p className="text-[0.76rem] font-semibold text-danger">يرجى لصق الرمز أولاً.</p>}
          {feedback === 'saved' && (
            <p className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-ok">
              <CircleCheck className="size-4" /> تم حفظ الرمز وتطبيقه، يمكنك الآن توليد أبحاثك فوراً.
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <Modal open={keyGuide.open} onClose={closeKeyGuide} labelledBy="key-guide-title">
      <ModalHeader id="key-guide-title" icon={<GraduationCap />} title="الحصول على رمز التفعيل المجاني" subtitle="3 خطوات سريعة في 30 ثانية" onClose={closeKeyGuide} />
      <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
        {keyGuide.notice && <div className="rounded-xl border border-[#f3dcb6] bg-warn-soft px-3.5 py-2.5 text-[0.8rem] font-semibold text-warn">{keyGuide.notice}</div>}
        <div className="flex gap-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] px-3.5 py-3 text-[0.8rem] leading-relaxed text-zinc-800 dark:text-zinc-200">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>تقدّم Google حصة استخدام مجانية سخية لمفاتيح Gemini دون بطاقة بنكية. كل ما تحتاجه هو حساب Gmail.</span>
        </div>
        <ol className="relative flex flex-col gap-5 before:absolute before:top-3 before:right-[13px] before:bottom-3 before:w-px before:bg-black/10 dark:before:bg-white/10">
          {steps.map((s, i) => (
            <li key={i} className="relative flex gap-3.5">
              <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-[0.78rem] font-bold ring-4 ring-white dark:ring-zinc-900">{i + 1}</span>
              <div className="flex-1 pt-0.5 text-[0.82rem] leading-relaxed text-zinc-700 dark:text-zinc-300">
                <div className="mb-1 font-bold text-zinc-900 dark:text-zinc-100">{s.title}</div>
                {s.body}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
