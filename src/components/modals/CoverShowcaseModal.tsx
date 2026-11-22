import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Eye, Printer, RotateCcw, Sparkles, X } from 'lucide-react';
import { COVER_TEMPLATES, type CoverTemplate } from '../preview/cover/templates';
import { ExperimentalCoverPage } from '../preview/Pages';
import { useDocument } from '../../state/DocumentContext';
import { useUI } from '../../state/UIContext';
import { Button } from '../ui/Button';
import type { CoverTemplateId } from '../../types';

interface CoverShowcaseModalProps {
  open: boolean;
  onClose: () => void;
}

const THUMB_SCALE = 0.22;

export function CoverShowcaseModal({ open, onClose }: CoverShowcaseModalProps) {
  const { doc, updateCover } = useDocument();
  const { toast } = useUI();
  const cs = doc.coverState;

  const [selectedId, setSelectedId] = useState<CoverTemplateId>(
    cs.coverTemplate || 'classic-ornate'
  );

  if (!open || typeof document === 'undefined') return null;

  const activeTemplate = COVER_TEMPLATES.find((t) => t.id === selectedId) || COVER_TEMPLATES[0];

  const handleApply = (id: CoverTemplateId) => {
    updateCover({
      useExperimentalDesign: true,
      coverTemplate: id,
    });
    toast(`تم اعتماد قالب الغلاف التجريبي: ${activeTemplate.name}`, { tone: 'ok' });
    onClose();
  };

  const handleRevertToClassic = () => {
    updateCover({
      useExperimentalDesign: false,
    });
    toast('تمت العودة للغلاف الأكاديمي الكلاسيكي الأصلي');
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div className="relative flex h-[92vh] w-full max-w-[1450px] flex-col overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Sparkles className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                  مختبر الأغلفة الأكاديمية (النسخة التجريبية — Beta)
                </h2>
                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[0.68rem] font-bold text-amber-700 dark:text-amber-300">
                  12 قالباً جديداً
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                استعراض ومقارنة تصاميم الغلاف الرسمية A4 بتفاصيل مذكرتك الحالية قبل اعتمادها في العرض
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cs.useExperimentalDesign && (
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw className="size-3.5" />}
                onClick={handleRevertToClassic}
                title="الرجوع للغلاف الكلاسيكي الأصلي"
              >
                العودة للغلاف الأصلي
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={<Check className="size-4" />}
              onClick={() => handleApply(selectedId)}
            >
              اعتماد «{activeTemplate.name}»
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-lg border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Thumbnails Sidebar */}
          <aside className="w-[340px] shrink-0 overflow-y-auto border-l border-black/10 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 p-4 scroll-thin">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                اختر قالباً للمعاينة ({COVER_TEMPLATES.length}):
              </span>
              <span className="text-[0.7rem] text-zinc-400">انقر للعرض</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {COVER_TEMPLATES.map((t: CoverTemplate) => {
                const isSelected = selectedId === t.id;
                const isCurrentActive = cs.useExperimentalDesign && (cs.coverTemplate || 'classic-ornate') === t.id;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`group relative flex flex-col items-center rounded-xl border p-2 text-center transition cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 shadow-md ring-2 ring-amber-500/30'
                        : 'border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800/70 hover:border-black/20 dark:hover:border-white/20 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {/* Miniature A4 thumbnail */}
                    <div
                      className="overflow-hidden rounded-md border border-black/10 bg-white shadow-xs"
                      style={{
                        width: `calc(210mm * ${THUMB_SCALE})`,
                        height: `calc(297mm * ${THUMB_SCALE})`,
                      }}
                    >
                      <div
                        style={{
                          transform: `scale(${THUMB_SCALE})`,
                          transformOrigin: 'top right',
                          pointerEvents: 'none',
                        }}
                      >
                        <ExperimentalCoverPage doc={doc} templateId={t.id} />
                      </div>
                    </div>

                    <div className="mt-2 flex w-full items-center justify-between px-1">
                      <span
                        className={`truncate text-[0.75rem] ${
                          isSelected
                            ? 'font-extrabold text-amber-900 dark:text-amber-200'
                            : 'font-semibold text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        {t.name}
                      </span>
                      {isCurrentActive && (
                        <span className="size-2 rounded-full bg-emerald-500 shrink-0" title="المعتمد حالياً" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Preview Stage */}
          <main className="relative flex flex-1 items-center justify-center overflow-auto bg-stone-200/60 dark:bg-zinc-950/80 p-6 scroll-thin">
            <div className="flex flex-col items-center">
              <div className="mb-3 flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 px-4 py-1.5 shadow-sm text-xs font-bold text-zinc-800 dark:text-zinc-200">
                <span>معاينة واقعية بنسبة A4:</span>
                <span className="text-amber-600 dark:text-amber-400 font-extrabold">{activeTemplate.name}</span>
                <span className="mx-1 h-3 w-px bg-black/15 dark:bg-white/15" />
                <button
                  type="button"
                  onClick={() => handleApply(selectedId)}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Check className="size-3.5" />
                  <span>تفعيل للبحث</span>
                </button>
              </div>

              {/* Scaled A4 Cover */}
              <div className="overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/10">
                <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', marginBottom: '-55mm' }}>
                  <ExperimentalCoverPage doc={doc} templateId={selectedId} />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>,
    document.body
  );
}
