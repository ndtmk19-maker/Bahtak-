import { useEffect, useState } from 'react';
import { Eye, PencilLine } from 'lucide-react';
import { LiquidNavbar, type NimbusFx } from '@/components/ui/liquid-glass-navbar';
import { SECTIONS } from './sections';
import { useUI } from '../state/UIContext';
import { useDocument } from '../state/DocumentContext';

/** شريط التنقل بين أقسام المحرر بتأثير الزجاج السائل (بألوان الهوية) */
const FX: Record<string, NimbusFx> = { content: 'spin', cover: 'glow', plan: 'drop', pages: 'wave', style: 'pop' };

export function SectionNav({ compact, className }: { compact?: boolean; className?: string }) {
  const { section, setSection } = useUI();
  const isDark = useMediaQuery('(prefers-color-scheme: dark)');
  const items = SECTIONS.map((s) => {
    const Icon = s.icon;
    return { label: s.label, icon: <Icon size={18} strokeWidth={1.9} aria-hidden />, fx: FX[s.id] };
  });
  return (
    <LiquidNavbar
      ariaLabel="أقسام المحرر"
      tone={isDark ? 'dark' : 'light'}
      items={items}
      active={SECTIONS.findIndex((s) => s.id === section)}
      onChange={(i) => setSection(SECTIONS[i].id)}
      compact={compact}
      className={`no-print ${className ?? ''}`}
    />
  );
}

/** ربط حالة React باستعلام وسائط CSS */
export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** شريط الأقسام أعلى لوحة التحرير (الهاتف والأجهزة اللوحية) */
export function MobileSectionTabs() {
  return (
    <div className="no-print sticky top-0 z-20 -mx-4 mb-4 flex justify-center bg-gradient-to-b from-white via-white/80 to-transparent dark:from-zinc-950 dark:via-zinc-950/80 px-4 pt-3 pb-4 sm:-mx-6 sm:px-6">
      <SectionNav />
    </div>
  );
}

/** شريط التبديل السفلي بين التحرير والمعاينة (الهاتف) */
export function MobileViewBar() {
  const { mobileView, setMobileView } = useUI();
  const { doc } = useDocument();
  const total = doc.pages.length + (doc.coverState.enabled ? 1 : 0) + (doc.planState.enabled ? 1 : 0);
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden">
      <div className="mx-auto flex max-w-md rounded-2xl bg-black/5 dark:bg-white/5 p-1" role="tablist" aria-label="وضع العرض">
        {(
          [
            { id: 'editor', label: 'التحرير', icon: <PencilLine className="size-4" /> },
            { id: 'preview', label: 'معاينة A4', icon: <Eye className="size-4" /> },
          ] as const
        ).map((t) => {
          const active = mobileView === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMobileView(t.id)}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[0.86rem] font-bold transition-all cursor-pointer ${
                active
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {t.icon}
              {t.label}
              {t.id === 'preview' && (
                <span className="rounded-full bg-zinc-900 dark:bg-white px-1.5 text-[0.66rem] font-bold text-white dark:text-zinc-950 tabular-nums">
                  {total}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
