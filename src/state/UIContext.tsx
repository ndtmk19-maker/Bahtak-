import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type SectionId = 'content' | 'cover' | 'plan' | 'pages' | 'style';
export type MobileView = 'editor' | 'preview';
export type ToastTone = 'success' | 'error' | 'info';
export type ViewMode = 'wizard' | 'classic';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'default';
}

interface ConfirmState extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

interface UIApi {
  showLanding: boolean;
  setShowLanding: (v: boolean) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  wizardStep: number;
  setWizardStep: React.Dispatch<React.SetStateAction<number>>;
  section: SectionId;
  setSection: (s: SectionId) => void;
  mobileView: MobileView;
  setMobileView: (v: MobileView) => void;
  toasts: Toast[];
  toast: (title: string, opts?: { description?: string; tone?: ToastTone }) => void;
  dismissToast: (id: number) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  confirmState: ConfirmState | null;
  closeConfirm: (v: boolean) => void;
  keyGuide: { open: boolean; notice?: string };
  openKeyGuide: (notice?: string) => void;
  closeKeyGuide: () => void;
  videoOpen: boolean;
  setVideoOpen: (v: boolean) => void;
  partnerOpen: boolean;
  setPartnerOpen: (v: boolean) => void;
  feedbackOpen: boolean;
  setFeedbackOpen: (v: boolean) => void;
  iosModal: { open: boolean; mode: 'guide' | 'inApp' };
  openIOSModal: (mode: 'guide' | 'inApp') => void;
  closeIOSModal: () => void;
  /** يطلب من المعاينة التمرير إلى صفحة محددة */
  focusPage: (domId: string) => void;
}

const Ctx = createContext<UIApi | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      const explicit = localStorage.getItem('bahtak_view_mode');
      if (explicit === 'classic' || explicit === 'wizard') return explicit;
      return localStorage.getItem('saved_baht_document') ? 'classic' : 'wizard';
    } catch {
      return 'wizard';
    }
  });
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [section, setSection] = useState<SectionId>('content');

  const setViewMode = useCallback((m: ViewMode) => {
    setViewModeState(m);
    try {
      localStorage.setItem('bahtak_view_mode', m);
    } catch {
      /* ignore */
    }
  }, []);
  const [mobileView, setMobileView] = useState<MobileView>('editor');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [keyGuide, setKeyGuide] = useState<{ open: boolean; notice?: string }>({ open: false });
  const [videoOpen, setVideoOpen] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [iosModal, setIosModal] = useState<{ open: boolean; mode: 'guide' | 'inApp' }>({ open: false, mode: 'guide' });

  const openIOSModal = useCallback((mode: 'guide' | 'inApp') => {
    setIosModal({ open: true, mode });
  }, []);

  const closeIOSModal = useCallback(() => {
    setIosModal((prev) => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => {
      // إظهار نافذة التقييم للمستخدم تلقائياً بمجرد إتمام أو إغلاق نافذة الطباعة
      setTimeout(() => {
        setFeedbackOpen(true);
      }, 500);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (title: string, opts?: { description?: string; tone?: ToastTone }) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, title, description: opts?.description, tone: opts?.tone || 'success' }]);
      setTimeout(() => dismissToast(id), opts?.tone === 'error' ? 7000 : 4500);
    },
    [dismissToast],
  );

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })), []);
  const closeConfirm = useCallback(
    (v: boolean) => {
      confirmState?.resolve(v);
      setConfirmState(null);
    },
    [confirmState],
  );

  const focusPage = useCallback((domId: string) => {
    setMobileView('preview');
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(domId);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.remove('page-flash');
        void el.offsetWidth;
        el.classList.add('page-flash');
      }, 60);
    });
  }, []);

  const api = useMemo<UIApi>(
    () => ({
      showLanding,
      setShowLanding,
      viewMode,
      setViewMode,
      wizardStep,
      setWizardStep,
      section,
      setSection,
      mobileView,
      setMobileView,
      toasts,
      toast,
      dismissToast,
      confirm,
      confirmState,
      closeConfirm,
      keyGuide,
      openKeyGuide: (notice?: string) => setKeyGuide({ open: true, notice }),
      closeKeyGuide: () => setKeyGuide({ open: false }),
      videoOpen,
      setVideoOpen,
      partnerOpen,
      setPartnerOpen,
      feedbackOpen,
      setFeedbackOpen,
      iosModal,
      openIOSModal,
      closeIOSModal,
      focusPage,
    }),
    [showLanding, setShowLanding, viewMode, setViewMode, wizardStep, setWizardStep, section, mobileView, toasts, toast, dismissToast, confirm, confirmState, closeConfirm, keyGuide, videoOpen, partnerOpen, feedbackOpen, setFeedbackOpen, iosModal, openIOSModal, closeIOSModal, focusPage],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useUI() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUI must be used inside UIProvider');
  return v;
}
