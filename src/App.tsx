import { Component, type ReactNode, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('App Error caught by boundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 text-center bg-paper text-ink">
          <div className="max-w-md rounded-2xl border border-line bg-white p-8 shadow-card">
            <div className="mb-4 text-3xl">⚠️</div>
            <h2 className="text-xl font-bold font-serif mb-2 text-ink">حدث خطأ غير متوقع</h2>
            <p className="text-sm text-muted mb-6">
              نعتذر عن ذلك. يمكنك إعادة تحميل الصفحة أو الانتقال مباشرة لمنصة العمل.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition"
              >
                إعادة تحميل
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false })}
                className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-ink-2 hover:bg-black/5 transition"
              >
                متابعة
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { AppHeader } from './components/AppHeader';
import { MobileSectionTabs, MobileViewBar, useMediaQuery } from './components/Navigation';
import { PreviewPane } from './components/preview/PreviewPane';
import { ContentPanel } from './components/panels/ContentPanel';
import { CoverPanel } from './components/panels/CoverPanel';
import { PlanPanel } from './components/panels/PlanPanel';
import { PagesPanel } from './components/panels/PagesPanel';
import { StylePanel } from './components/panels/StylePanel';
import { MultiStepWizard } from './components/wizard/MultiStepWizard';
import { StartLanding } from './components/landing/StartLanding';
import { BackgroundPaths } from './components/ui/background-paths';
import { KeyGuideModal } from './components/modals/KeyGuideModal';
import { VideoModal } from './components/modals/VideoModal';
import { PartnerModal } from './components/modals/PartnerModal';
import { ConfirmDialog, Toaster } from './components/modals/Feedback';
import { FeedbackModal } from './components/modals/FeedbackModal';
import { IOSPrintModal } from './components/modals/IOSPrintModal';
import { AdminDashboardModal } from './components/modals/AdminDashboardModal';
import { AppUpdatePrompt } from './components/modals/AppUpdatePrompt';
import { DocumentProvider } from './state/DocumentContext';
import { UIProvider, useUI } from './state/UIContext';
import { ConverterProvider } from './state/ConverterContext';
import { PresentationProvider } from './state/PresentationContext';
import { PresentationStudio } from './components/slides/PresentationStudio';
import { trackEvent } from './lib/analytics';

export default function App() {
  return (
    <ErrorBoundary>
      <UIProvider>
        <DocumentProvider>
          <ConverterProvider>
            <PresentationProvider>
              <AppContent />
            </PresentationProvider>
            <KeyGuideModal />
            <VideoModal />
            <PartnerModal />
            <FeedbackModal />
            <IOSPrintModal />
            <AdminDashboardModal />
            <AppUpdatePrompt />
            <ConfirmDialog />
            <Toaster />
          </ConverterProvider>
        </DocumentProvider>
      </UIProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { showLanding, setAdminModalOpen } = useUI();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // فحص الرابط إذا كان يحتوي على ?admin لفتح اللوحة السرية مباشرة
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('admin')) {
      setAdminModalOpen(true);
    }

    // تسجيل الزيارة مرة واحدة في الجلسة
    const sessionKey = 'bahtak_session_tracked';
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, '1');
      trackEvent({ event_type: 'visit' });
    }
  }, [setAdminModalOpen]);

  return (
    <AnimatePresence mode="wait">
      {showLanding ? (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="min-h-dvh w-full"
        >
          <StartLanding />
        </motion.div>
      ) : (
        <motion.div
          key="workspace"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="size-full"
        >
          <Workspace />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Workspace() {
  const { section, mobileView, viewMode, wizardStep, product } = useUI();
  const panelRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [section, viewMode, wizardStep]);

  return (
    <div className="print-shell flex h-dvh flex-col overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AppHeader isDesktop={isDesktop} />

      {product === 'slides' ? (
        /* نظام العروض التقديمية (PPTX) المبني على نفس محرك التحليل والتوليد */
        <PresentationStudio isDesktop={isDesktop} />
      ) : viewMode === 'wizard' ? (
        /* واجهة الخطوات المستقلة بهوية متناسقة تماماً مع الصفحة الترحيبية */
        <main
          ref={panelRef}
          aria-label="معالج إعداد وتنسيق البحث"
          className="no-print relative min-h-0 flex-1 overflow-y-auto bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 scroll-thin"
        >
          {/* خلفية المسارات المتدفقة الهادئة المتطابقة مع الصفحة الترحيبية */}
          <div className="pointer-events-none fixed inset-0 opacity-25 dark:opacity-20 overflow-hidden">
            <BackgroundPaths interactive={false} speed={0.5}>
              <div />
            </BackgroundPaths>
          </div>

          <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:px-8">
            <MultiStepWizard />
          </div>
        </main>
      ) : (
        /* المحرر الكامل الكلاسيكي مع معاينة A4 الحية جنباً إلى جنب */
        <div className="flex min-h-0 flex-1 bg-white dark:bg-zinc-950">
          <aside
            ref={panelRef}
            aria-label="لوحة التحرير"
            className={`no-print min-h-0 w-full shrink-0 overflow-y-auto border-l border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-4 pt-0 pb-28 scroll-thin sm:px-6 lg:block lg:w-[460px] lg:pt-7 lg:pb-10 xl:w-[500px] ${
              mobileView === 'editor' ? 'block' : 'hidden'
            }`}
          >
            <div className="mx-auto max-w-xl">
              {!isDesktop && <MobileSectionTabs />}
              {section === 'content' && <ContentPanel />}
              {section === 'cover' && <CoverPanel />}
              {section === 'plan' && <PlanPanel />}
              {section === 'pages' && <PagesPanel />}
              {section === 'style' && <StylePanel />}
            </div>
          </aside>
          <PreviewPane className={`flex-1 pb-16 lg:flex lg:pb-0 ${mobileView === 'preview' ? 'flex' : 'hidden'}`} />
        </div>
      )}

      {/* إبقاء عنصر PreviewPane متاحاً لمحرك الطباعة عند طباعة PDF من المعالج */}
      {product === 'research' && viewMode === 'wizard' && (
        <div className="print-only">
          <PreviewPane />
        </div>
      )}

      {product === 'research' && viewMode === 'classic' && <MobileViewBar />}
    </div>
  );
}
