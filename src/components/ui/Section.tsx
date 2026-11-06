import type { ReactNode } from 'react';

/** مجموعة إعدادات داخل اللوحة: عنوان صغير + محتوى بتصميم منسجم مع الهوية البصرية للواجهة الترحيبية */
export function Section({ title, icon, actions, children, description }: { title: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode; description?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-900/70 p-4 shadow-xs backdrop-blur-md sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-[11rem] flex-1 items-start gap-2.5">
          {icon && <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 shadow-2xs [&>svg]:size-4">{icon}</span>}
          <div>
            <h3 className="text-[0.92rem] leading-7 font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
            {description && <p className="text-[0.76rem] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function ToggleRow({ title, description, control }: { title: string; description: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-900/70 px-4 py-3.5 shadow-xs sm:px-5 backdrop-blur-md">
      <div>
        <div className="text-[0.9rem] font-bold text-zinc-900 dark:text-zinc-100">{title}</div>
        <div className="text-[0.76rem] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</div>
      </div>
      {control}
    </div>
  );
}

export function Note({ children, icon, tone = 'neutral' }: { children: ReactNode; icon?: ReactNode; tone?: 'neutral' | 'brand' | 'warn' }) {
  const tones = {
    neutral: 'bg-black/[0.03] text-neutral-800 dark:bg-white/[0.04] dark:text-neutral-200 border-black/10 dark:border-white/10',
    brand: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800/60 dark:text-neutral-100 border-black/10 dark:border-white/10',
    warn: 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/20',
  };
  return (
    <div className={`flex gap-2.5 rounded-xl border px-3 py-2.5 text-[0.78rem] leading-relaxed ${tones[tone]}`}>
      {icon && <span className="mt-0.5 shrink-0 [&>svg]:size-4">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}
