import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useUI } from '../../state/UIContext';

export function ConfirmDialog() {
  const { confirmState, closeConfirm } = useUI();
  return (
    <Modal open={!!confirmState} onClose={() => closeConfirm(false)} labelledBy="confirm-title" size="sm">
      {confirmState && (
        <div className="p-6">
          <h2 id="confirm-title" className="text-[1.05rem] font-bold text-zinc-900 dark:text-zinc-100">
            {confirmState.title}
          </h2>
          {confirmState.message && <p className="mt-2 text-[0.85rem] leading-relaxed text-zinc-600 dark:text-zinc-400">{confirmState.message}</p>}
          <div className="mt-6 flex flex-row-reverse gap-2 sm:justify-start">
            <Button variant="ghost" onClick={() => closeConfirm(false)}>
              إلغاء
            </Button>
            <Button
              data-autofocus
              variant="primary"
              className={confirmState.tone === 'danger' ? '!bg-danger hover:!bg-[#a72d24]' : ''}
              onClick={() => closeConfirm(true)}
            >
              {confirmState.confirmLabel || 'تأكيد'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function Toaster() {
  const { toasts, dismissToast } = useUI();
  return createPortal(
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite" dir="rtl">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="pointer-events-auto flex w-full max-w-md animate-rise items-start gap-3 rounded-2xl bg-zinc-900 border border-white/10 px-4 py-3 text-white shadow-xl backdrop-blur-md">
          <span className={`mt-0.5 ${t.tone === 'error' ? 'text-red-400' : t.tone === 'info' ? 'text-zinc-300' : 'text-emerald-400'}`}>
            {t.tone === 'error' ? <CircleAlert className="size-5" /> : t.tone === 'info' ? <Info className="size-5" /> : <CircleCheck className="size-5" />}
          </span>
          <div className="flex-1">
            <div className="text-[0.86rem] font-bold">{t.title}</div>
            {t.description && <div className="mt-0.5 text-[0.78rem] leading-relaxed text-white/70">{t.description}</div>}
          </div>
          <button type="button" onClick={() => dismissToast(t.id)} aria-label="إغلاق التنبيه" className="text-white/50 transition hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
