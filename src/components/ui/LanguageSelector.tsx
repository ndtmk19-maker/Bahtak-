import { Languages, Check } from 'lucide-react';
import { useConverter } from '../../state/ConverterContext';
import { useDocument } from '../../state/DocumentContext';
import { usePresentation } from '../../state/PresentationContext';
import { useUI } from '../../state/UIContext';
import type { ResearchLanguage } from '../../types';
import { getLocalizedCoverState, getLocalizedPlanTitle } from '../../data/defaults';

interface LanguageSelectorProps {
  variant?: 'card' | 'compact' | 'pill';
  className?: string;
  showHint?: boolean;
}

const LANGUAGES: Array<{
  id: ResearchLanguage;
  name: string;
  nativeName: string;
  flag: string;
  badge: string;
}> = [
  {
    id: 'ar',
    name: 'العربية',
    nativeName: 'العربية',
    flag: '🇩🇿',
    badge: 'الافتراضية',
  },
  {
    id: 'fr',
    name: 'الفرنسية',
    nativeName: 'Français',
    flag: '🇫🇷',
    badge: 'جديد',
  },
  {
    id: 'en',
    name: 'الإنجليزية',
    nativeName: 'English',
    flag: '🇬🇧',
    badge: 'جديد',
  },
];

export function LanguageSelector({ variant = 'card', className = '', showHint = true }: LanguageSelectorProps) {
  const { form, setForm } = useConverter();
  const { doc, update, updateCover, updatePlan } = useDocument();
  const presentation = usePresentation();
  const { product } = useUI();
  const isSlides = product === 'slides';

  const currentLang: ResearchLanguage = isSlides
    ? presentation.language || 'ar'
    : doc.language || form.language || 'ar';

  const handleSelect = (lang: ResearchLanguage) => {
    setForm({ language: lang });
    update({
      language: lang,
      fontFamily: lang === 'ar' ? "'Amiri', serif" : "'Times New Roman', serif",
    });
    updateCover(getLocalizedCoverState(doc.coverState, lang));
    updatePlan({
      pageTitle: getLocalizedPlanTitle(doc.planState.pageTitle, lang),
    });
    presentation.setLanguage(lang);
  };

  if (variant === 'pill' || variant === 'compact') {
    const hasDisplay = /\b(hidden|flex|inline-flex|block|inline-block|grid)\b/.test(className);
    const displayClass = hasDisplay ? '' : 'inline-flex';
    return (
      <div
        role="group"
        aria-label="اختيار لغة العمل"
        className={`${displayClass} items-center gap-1 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 p-1 shadow-xs backdrop-blur-md ${className}`.trim()}
      >
        <span className="flex items-center gap-1 px-2 text-[0.72rem] font-bold text-neutral-600 dark:text-neutral-400">
          <Languages className="size-3.5 text-brand-600 dark:text-brand-400" />
          <span className="max-sm:hidden">اللغة:</span>
        </span>
        {LANGUAGES.map((item) => {
          const isSelected = currentLang === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.74rem] font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-neutral-900 text-white shadow-xs dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-700 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10'
              }`}
            >
              <span className="text-xs leading-none">{item.flag}</span>
              <span>{item.nativeName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 p-3.5 sm:p-4 shadow-xs backdrop-blur-md ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-400/15 dark:text-brand-400">
            <Languages className="size-4" />
          </span>
          <div>
            <span className="block text-[0.84rem] font-bold text-neutral-900 dark:text-neutral-100">
              {isSlides ? 'لغة إنجاز وتنسيق العرض التقديمي (PowerPoint)' : 'لغة إنجاز وتنسيق البحث الأكاديمي'}
            </span>
            <span className="block text-[0.7rem] text-neutral-500 dark:text-neutral-400">
              {isSlides ? "Langue de l'exposé / Presentation Language" : "Langue de recherche / Research Language"}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-0.5 text-[0.7rem] font-bold text-neutral-700 dark:text-neutral-300">
          {currentLang === 'ar' ? '🇩🇿 العربية' : currentLang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
        </span>
      </div>

      <div role="radiogroup" aria-label="لغة العمل" className="grid grid-cols-3 gap-2">
        {LANGUAGES.map((item) => {
          const isSelected = currentLang === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(item.id)}
              className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 sm:py-3 transition-all duration-200 cursor-pointer text-center ${
                isSelected
                  ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm ring-2 ring-neutral-900/15 dark:border-white dark:bg-white dark:text-neutral-900 dark:ring-white/20'
                  : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-neutral-800 dark:text-neutral-200 hover:border-black/25 dark:hover:border-white/25 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg leading-none">{item.flag}</span>
                <span className="text-[0.82rem] sm:text-[0.88rem] font-bold">
                  {item.nativeName}
                </span>
                {isSelected && (
                  <Check className="size-3 sm:size-3.5 stroke-[2.5] text-white dark:text-neutral-900" />
                )}
              </div>
              <span
                className={`text-[0.66rem] font-medium leading-none ${
                  isSelected
                    ? 'text-neutral-300 dark:text-neutral-600'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {item.id === 'ar' ? 'العربية' : item.id === 'fr' ? 'Français' : 'English'}
              </span>
            </button>
          );
        })}
      </div>

      {showHint && (
        <p className="text-[0.72rem] leading-relaxed text-neutral-500 dark:text-neutral-400">
          {isSlides
            ? currentLang === 'ar'
              ? 'تُنظّم شرائح العرض والأجندة والخطوط من اليمين لليسار (RTL) بهيكل أكاديمي متناسق.'
              : currentLang === 'fr'
                ? 'Toutes les diapositives (Sommaire, Titres, Puces, Conclusion) seront générées en français (LTR).'
                : 'All slides (Table of Contents, Headings, Bullets, Conclusion) will be generated in English (LTR).'
            : currentLang === 'ar'
              ? 'تُكتب صفحات البحث والغلاف والهوامش من اليمين لليسان (RTL) بخط Amiri المعتمد.'
              : currentLang === 'fr'
                ? 'Toutes les pages, la page de garde et la bibliographie seront rédigées en français (LTR) avec la police Times New Roman.'
                : 'All pages, cover, table of contents, and references will be generated in English (LTR) with Times New Roman.'}
        </p>
      )}
    </div>
  );
}
