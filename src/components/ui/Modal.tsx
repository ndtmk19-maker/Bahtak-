import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Modal({ open, onClose, children, labelledBy, size = 'md' }: { open: boolean; onClose: () => void; children: ReactNode; labelledBy: string; size?: 'sm' | 'md' | 'lg' }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus() ?? panel.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };
  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" dir="rtl">
      <div className="absolute inset-0 animate-fade bg-[#140f24]/55 backdrop-blur-[3px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`relative max-h-[92dvh] w-full ${widths[size]} animate-rise overflow-y-auto rounded-t-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-pop outline-none scroll-thin sm:rounded-3xl`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalHeader({ id, title, subtitle, icon, onClose }: { id: string; title: string; subtitle?: string; icon?: ReactNode; onClose: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 px-5 py-4 backdrop-blur sm:px-6">
      <div className="flex items-start gap-3">
        {icon && <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs [&>svg]:size-5">{icon}</span>}
        <div>
          <h2 id={id} className="text-base leading-7 font-bold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          {subtitle && <p className="text-[0.8rem] leading-relaxed text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 dark:text-zinc-400 transition hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-950 dark:hover:text-white cursor-pointer">
        <X className="size-5" />
      </button>
    </div>
  );
}
