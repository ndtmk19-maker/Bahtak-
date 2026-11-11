import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GraduationCap,
  LayoutGrid,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Step1Input } from './Step1Input';
import { Step2Cover } from './Step2Cover';
import { useUI } from '../../state/UIContext';

export interface WizardStepMeta {
  id: number;
  label: string;
  title: string;
  desc: string;
  icon: LucideIcon;
}

export const WIZARD_STEPS: WizardStepMeta[] = [
  {
    id: 1,
    label: 'الغلاف والطلبة',
    title: 'صفحة الغلاف الرسمية وفريق العمل',
    desc: 'اضبط بيانات الطلبة والمشرف، واختَر جامعتك ليظهر شعارها من بين 69 ولاية مع ثيم وتنسيق الغلاف.',
    icon: GraduationCap,
  },
  {
    id: 2,
    label: 'توليد البحث',
    title: 'طريقة إدخال وتوليد البحث',
    desc: 'اختر بين الصياغة التلقائية بالذكاء الاصطناعي لموضوعك أو لصق مسودة جاهزة لتحليلها وتنسيقها.',
    icon: Wand2,
  },
  {
    id: 3,
    label: 'المحرر الكامل وورقة A4',
    title: 'المحرر الكامل ومعاينة ورقة A4',
    desc: 'انتقل مباشرة إلى المحرر الكامل لتعديل الغلاف والخطة والصفحات والتنسيق مع معاينة ورقة A4 الحية والتحميل.',
    icon: LayoutGrid,
  },
];

export function MultiStepWizard() {
  const { wizardStep, setWizardStep, setViewMode, setSection, setMobileView } = useUI();
  const [direction, setDirection] = useState<1 | -1>(1);

  const activeStep = Math.min(Math.max(wizardStep, 1), 2);
  const currentIdx = activeStep - 1;
  const current = WIZARD_STEPS[currentIdx] || WIZARD_STEPS[0];
  const progressPercent = (activeStep / WIZARD_STEPS.length) * 100;

  const openFullEditor = () => {
    setViewMode('classic');
    setSection('pages');
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setMobileView('preview');
    }
  };

  const goToStep = (stepNumber: number) => {
    if (stepNumber === 3) {
      openFullEditor();
      return;
    }
    if (stepNumber === activeStep) return;
    setDirection(stepNumber > activeStep ? 1 : -1);
    setWizardStep(stepNumber);
  };

  const handlePrev = () => {
    if (activeStep > 1) {
      setDirection(-1);
      setWizardStep(activeStep - 1);
    }
  };

  const handleNext = () => {
    if (activeStep < 2) {
      setDirection(1);
      setWizardStep(activeStep + 1);
    } else {
      openFullEditor();
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-8 animate-rise">
      {/* بطاقة الرأسية وشريط التقدم التفاعلي المتناسقة مع هوية الصفحة الترحيبية */}
      <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/85 dark:bg-neutral-900/85 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] backdrop-blur-xl sm:p-6">
        {/* الصف العلوي: شارة الخطوة وزر التبديل للمحرر الكامل */}
        <div className="flex items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1 text-[0.74rem] font-bold text-neutral-800 dark:text-neutral-200 backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-neutral-900 dark:bg-white animate-pulse" />
              الخطوة {activeStep} من {WIZARD_STEPS.length}
            </span>
            <span className="text-[0.76rem] font-semibold text-neutral-500 dark:text-neutral-400 max-sm:hidden">
              {current.label}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setViewMode('classic');
              setSection('content');
            }}
            className="group flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] px-3 py-1.5 text-[0.74rem] font-semibold text-neutral-700 dark:text-neutral-300 transition hover:bg-black/5 dark:hover:bg-white/10"
            title="الانتقال إلى الواجهة المفتوحة الكلاسيكية"
          >
            <LayoutGrid className="size-3.5 transition group-hover:rotate-6 text-neutral-600 dark:text-neutral-400" />
            <span>المحرر الكامل</span>
          </button>
        </div>

        {/* شريط التقدم المرئي بتدرج متناسق مع الحبر والخلفية */}
        <div className="relative mb-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-900 dark:from-white dark:via-neutral-300 dark:to-white shadow-xs"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* مؤشرات الخطوات الـ 3 القابلة للنقر بتصميم ناعم ومتناسق */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3" role="tablist" aria-label="خطوات المعالج">
          {WIZARD_STEPS.map((s) => {
            const isCompleted = s.id < activeStep;
            const isCurrent = s.id === activeStep;
            const Icon = s.icon;

            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                onClick={() => goToStep(s.id)}
                className={`group flex flex-col items-center gap-1.5 rounded-2xl p-2 sm:p-2.5 text-center transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-black/5 dark:bg-white/10 text-neutral-900 dark:text-white'
                    : isCompleted
                    ? 'text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                    : 'text-neutral-400 dark:text-neutral-600 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
                }`}
              >
                <div
                  className={`grid size-8 sm:size-9 place-items-center rounded-xl text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md ring-2 ring-black/10 dark:ring-white/20 scale-105'
                      : isCompleted
                      ? 'bg-black/5 dark:bg-white/10 text-neutral-800 dark:text-neutral-200 border border-black/10 dark:border-white/10'
                      : 'bg-black/[0.03] text-neutral-400 dark:bg-white/[0.03] dark:text-neutral-500'
                  }`}
                >
                  {isCompleted ? <Check className="size-3.5 stroke-[2.5]" /> : <Icon className="size-4" />}
                </div>
                <span className={`text-[0.72rem] sm:text-[0.76rem] font-bold leading-tight line-clamp-1 max-sm:hidden ${isCurrent ? 'text-neutral-900 dark:text-white font-extrabold' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* عنوان ووصف الخطوة الحالية بخط فاخر متناسق مع العنوان الرئيسي */}
        <div className="mt-5 border-t border-black/5 dark:border-white/5 pt-4 text-right">
          <h2 className="font-serif text-[1.4rem] sm:text-[1.65rem] font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
            {current.title}
          </h2>
          <p className="mt-1.5 text-[0.86rem] sm:text-[0.92rem] font-medium text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans">
            {current.desc}
          </p>
        </div>
      </div>

      {/* محتوى الخطوة المتحرك عبر AnimatePresence */}
      <div className="relative min-h-[380px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: direction > 0 ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? 20 : -20 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            {activeStep === 1 && <Step2Cover />}
            {activeStep === 2 && <Step1Input />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* شريط التنقل السفلي بتصميم زجاجي هادئ متطابق مع هوية الموقع */}
      <nav
        aria-label="أزرار التنقل بين الخطوات"
        className="sticky bottom-0 z-20 -mx-4 -mb-4 flex items-center justify-between gap-3 border-t border-black/10 dark:border-white/10 bg-white/85 dark:bg-neutral-950/85 px-4 py-3.5 backdrop-blur-xl sm:-mx-6 sm:px-6 rounded-b-3xl"
      >
        <button
          type="button"
          onClick={handlePrev}
          disabled={activeStep === 1}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[0.84rem] font-bold transition cursor-pointer ${
            activeStep === 1
              ? 'pointer-events-none border-transparent text-neutral-400 opacity-40'
              : 'border-black/10 dark:border-white/10 bg-white/90 dark:bg-neutral-900/90 text-neutral-800 dark:text-neutral-200 shadow-xs hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <ArrowRight className="size-4" />
          <span>السابق</span>
        </button>

        <div className="flex items-center gap-1.5 text-[0.78rem] font-bold text-neutral-500 dark:text-neutral-400 tabular-nums">
          <span className="text-neutral-900 dark:text-white font-extrabold">{activeStep}</span>
          <span className="opacity-40">/</span>
          <span>{WIZARD_STEPS.length}</span>
        </div>

        {activeStep < WIZARD_STEPS.length ? (() => {
          const nextStep = WIZARD_STEPS[activeStep];
          const NextStepIcon = nextStep.icon;
          return (
            <Button
              variant="primary"
              size="md"
              onClick={handleNext}
              className="flex items-center gap-2.5 px-5 py-2.5 shadow-sm group bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-white rounded-xl"
            >
              <span className="grid size-6 place-items-center rounded-lg bg-white/20 dark:bg-black/15 text-current shadow-xs">
                <NextStepIcon className="size-3.5" />
              </span>
              <span>التالي: {nextStep.label}</span>
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            </Button>
          );
        })() : (
          <Button
            variant="primary"
            size="md"
            onClick={handleNext}
            className="flex items-center gap-2.5 px-6 py-2.5 shadow-md group bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 dark:from-white dark:via-neutral-100 dark:to-white text-white dark:text-neutral-900 rounded-xl font-bold"
          >
            <span>المحرر الكامل وورقة A4</span>
            <span className="text-base">🚀</span>
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
          </Button>
        )}
      </nav>
    </div>
  );
}
