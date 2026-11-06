import type { ReactNode } from 'react';

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer ${
        checked ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-700'
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white dark:bg-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-all duration-200 ${
          checked ? 'right-[22px]' : 'right-0.5'
        }`}
      />
    </button>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: SegmentOption<T>[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-black/5 dark:bg-white/5 p-1 border border-black/5 dark:border-white/5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[9px] px-2 font-semibold transition-all duration-200 cursor-pointer ${
              size === 'sm' ? 'min-h-8 text-[0.76rem]' : 'min-h-9 text-[0.82rem]'
            } py-1 leading-tight ${
              active ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** خيارات مرئية على شكل بطاقات (للثيمات والإطارات والخطوط) */
export function ChoiceCards<T extends string>({ value, onChange, options, label, cols = 2 }: { value: T; onChange: (v: T) => void; options: { value: T; title: string; desc?: string; preview?: ReactNode }[]; label: string; cols?: 2 | 3 | 4 }) {
  const grid = cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2.5 ${grid}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`group flex flex-col items-stretch gap-2 rounded-xl border p-3 text-right transition-all duration-150 cursor-pointer ${
              active
                ? 'border-neutral-900 bg-neutral-100/90 dark:border-white dark:bg-white/10 ring-2 ring-neutral-900/10 dark:ring-white/20 shadow-xs'
                : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 hover:border-black/25 dark:hover:border-white/25'
            }`}
          >
            {o.preview}
            <span className="text-[0.82rem] leading-tight font-bold text-neutral-900 dark:text-neutral-100">{o.title}</span>
            {o.desc && <span className="-mt-1 text-[0.72rem] leading-snug text-neutral-500 dark:text-neutral-400">{o.desc}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ children, onClick, icon, title }: { children: ReactNode; onClick: () => void; icon?: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-800/80 px-2.5 text-[0.74rem] font-semibold text-neutral-800 dark:text-neutral-200 transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 cursor-pointer shadow-2xs"
    >
      {icon}
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'ok' | 'warn' }) {
  const tones = {
    neutral: 'bg-black/5 text-neutral-800 dark:bg-white/10 dark:text-neutral-200',
    brand: 'border border-black/10 dark:border-white/10 bg-black/[0.04] text-zinc-800 dark:bg-white/[0.06] dark:text-zinc-200',
    ok: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20',
    warn: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold tabular-nums ${tones[tone]}`}>{children}</span>;
}
