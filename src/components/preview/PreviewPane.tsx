import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import { useDocument } from '../../state/DocumentContext';
import { ContentPage, CoverPage, PlanPage } from './Pages';

const A4_PX = 794; // 210mm بدقة 96dpi
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function PreviewPane({ className = '' }: { className?: string }) {
  const { doc } = useDocument();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.85);
  const [autoFit, setAutoFit] = useState(true);

  const fit = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const pad = el.clientWidth < 640 ? 16 : 64;
    setZoom(Math.round(clamp((el.clientWidth - pad) / A4_PX, 0.25, 1) * 100) / 100);
  }, []);

  useEffect(() => {
    if (!autoFit) return;
    fit();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFit, fit]);

  const change = (delta: number) => {
    setAutoFit(false);
    setZoom((z) => Math.round(clamp(z + delta, 0.25, 1.6) * 100) / 100);
  };

  const total = doc.pages.length + (doc.coverState.enabled ? 1 : 0) + (doc.planState.enabled ? 1 : 0);

  return (
    <div className={`preview-pane relative flex min-h-0 min-w-0 flex-col bg-zinc-100/90 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${className}`}>
      {/* خلفية نقطية هادئة وفاخرة متناسقة مع واجهة الموقع */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.25] dark:opacity-15 [background-image:radial-gradient(#000000_1px,transparent_1px)] dark:[background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />

      <div className="no-print pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 bg-white/85 dark:bg-zinc-900/85 p-1.5 text-zinc-800 dark:text-zinc-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-xl">
          <ToolBtn label="تصغير" onClick={() => change(-0.05)}>
            <Minus className="size-4" />
          </ToolBtn>
          <span className="w-12 text-center text-[0.78rem] font-bold tabular-nums select-none" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <ToolBtn label="تكبير" onClick={() => change(0.05)}>
            <Plus className="size-4" />
          </ToolBtn>
          <span className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
          <ToolBtn label="ملاءمة عرض الشاشة" onClick={() => setAutoFit(true)} active={autoFit}>
            <Maximize2 className="size-3.5" />
          </ToolBtn>
          <ToolBtn
            label="الحجم الافتراضي 85%"
            onClick={() => {
              setAutoFit(false);
              setZoom(0.85);
            }}
          >
            <RotateCcw className="size-3.5" />
          </ToolBtn>
          <span className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
          <span className="px-2.5 text-[0.75rem] font-medium whitespace-nowrap text-zinc-500 dark:text-zinc-400">
            <span className="font-bold text-zinc-900 dark:text-white tabular-nums">{total}</span> صفحة A4
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="preview-scroll relative z-1 min-h-0 flex-1 overflow-auto scroll-thin">
        <div className="doc-stage mx-auto flex w-max flex-col items-center gap-[14mm] px-4 pt-20 pb-24 sm:px-8" style={{ zoom }}>
          {doc.coverState.enabled && <CoverPage doc={doc} />}
          {doc.planState.enabled && <PlanPage doc={doc} />}
          {doc.pages.map((p, i) => (
            <ContentPage key={i} doc={doc} page={p} index={i} />
          ))}
          {total === 0 && (
            <div className="rounded-3xl border border-dashed border-black/15 dark:border-white/15 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md px-10 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
              لا توجد صفحات للعرض حالياً.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`grid size-8 place-items-center rounded-full transition-all active:scale-90 ${
        active
          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
          : 'text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
