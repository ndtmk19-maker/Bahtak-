import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SECTIONS } from '../sections';
import { useUI, type SectionId } from '../../state/UIContext';

export function PanelShell({ id, children, headerExtra }: { id: SectionId; children: ReactNode; headerExtra?: ReactNode }) {
  const { setSection } = useUI();
  const idx = SECTIONS.findIndex((s) => s.id === id);
  const meta = SECTIONS[idx];
  const prev = SECTIONS[idx - 1];
  const next = SECTIONS[idx + 1];

  return (
    <div key={id} className="animate-rise">
      <header className="px-1 pt-1 pb-5">
        <div className="mb-2 flex items-center gap-2 text-[0.72rem] font-bold tracking-wide text-zinc-700 dark:text-zinc-300">
          <span className="tabular-nums">
            الخطوة {idx + 1} من {SECTIONS.length}
          </span>
          <span className="h-px w-6 bg-black/15 dark:bg-white/15" />
          <span>{meta.label}</span>
        </div>
        <h1 className="font-serif text-[1.85rem] leading-[1.25] font-bold text-zinc-950 dark:text-zinc-50">{meta.title}</h1>
        <p className="mt-2 max-w-[44ch] text-[0.86rem] leading-relaxed text-zinc-600 dark:text-zinc-400">{meta.description}</p>
        {headerExtra}
      </header>

      <div className="flex flex-col gap-3.5">{children}</div>

      <nav className="mt-6 flex items-center justify-between gap-3 border-t border-black/10 dark:border-white/10 pt-4" aria-label="التنقل بين الخطوات">
        {prev ? (
          <button type="button" onClick={() => setSection(prev.id)} className="group flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[0.82rem] font-semibold text-zinc-600 dark:text-zinc-400 transition hover:text-zinc-950 dark:hover:text-white cursor-pointer">
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            {prev.label}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button
            type="button"
            onClick={() => setSection(next.id)}
            className="group flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] px-3.5 py-1.5 text-[0.82rem] font-semibold text-zinc-900 dark:text-zinc-100 transition hover:bg-black/10 dark:hover:bg-white/15 cursor-pointer"
          >
            التالي: {next.label}
            <ArrowLeft className="size-4 transition group-hover:-translate-x-0.5" />
          </button>
        )}
      </nav>
    </div>
  );
}
