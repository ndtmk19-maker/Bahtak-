import { useEffect, useRef, useState } from "react";
import {
  Check,
  CloudUpload,
  Compass,
  Download,
  FileDown,
  FileText,
  Home,
  LayoutGrid,
  Loader2,
  MoreVertical,
  Presentation,
  Printer,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Button } from "./ui/Button";
import { AndroidIcon } from "./ui/BrandIcons";
import { isAndroidApp } from "../lib/appUpdater";
import { useDocument } from "../state/DocumentContext";
import { useUI } from "../state/UIContext";
import { usePresentation } from "../state/PresentationContext";
import { useResetApp } from "../state/useResetApp";
import { downloadWordDocument } from "../lib/wordExport";
import { exportDocumentPdf } from "../lib/pdfExport";
import { imageToDataUrl } from "../lib/image";
import { LINKS } from "../data/defaults";
import { SectionNav, useMediaQuery } from "./Navigation";
import { isIOS, triggerPrintDocument } from "../lib/printDocument";
import { trackEvent, trackApkDownload } from "../lib/analytics";

export function AppHeader({ isDesktop }: { isDesktop: boolean }) {
  const isWide = useMediaQuery("(min-width: 1280px)");
  const { doc, saveStatus } = useDocument();
  const {
    toast,
    setMobileView,
    viewMode,
    setViewMode,
    setSection,
    setShowLanding,
    setFeedbackOpen,
    openIOSModal,
    setAdminModalOpen,
    product,
    setProduct,
  } = useUI();
  const presentation = usePresentation();
  const isSlides = product === "slides";
  const resetApp = useResetApp();
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const logoClicksRef = useRef(0);
  const logoTimerRef = useRef<number | null>(null);

  const handleLogoClick = () => {
    logoClicksRef.current += 1;
    if (logoTimerRef.current) clearTimeout(logoTimerRef.current);
    if (logoClicksRef.current >= 5) {
      logoClicksRef.current = 0;
      setAdminModalOpen(true);
      return;
    }
    logoTimerRef.current = window.setTimeout(() => {
      logoClicksRef.current = 0;
    }, 1500);
    setShowLanding(true);
  };

  const exportWord = async () => {
    setExporting(true);
    try {
      let d = doc;
      const cs = doc.coverState;
      if (cs.enabled && cs.logoUrl && !cs.logoBase64) {
        d = { ...doc, coverState: { ...cs, logoBase64: await imageToDataUrl(cs.logoUrl) } };
      }
      downloadWordDocument(d);
      trackEvent({
        event_type: "export_word",
        topic: doc.coverState.title || undefined,
        university: doc.coverState.universityName || undefined,
      });
      toast("تم تصدير ملف Word", {
        description: "افتح الملف في Microsoft Word واحفظه بصيغة .docx إذا رغبت.",
      });
      setTimeout(() => setFeedbackOpen(true), 1200);
    } catch (err) {
      toast("حدث خطأ أثناء تصدير ملف Word", {
        tone: "error",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  };

  const totalA4 =
    doc.pages.length + (doc.coverState.enabled ? 1 : 0) + (doc.planState.enabled ? 1 : 0);

  const downloadPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    setPdfProgress(null);
    try {
      const res = await exportDocumentPdf(doc, {
        onProgress: (current, total) => setPdfProgress({ current, total }),
        onGenerated: () => {
          setExportingPdf(false);
          setPdfProgress(null);
        },
      });
      if (res.inAppBrowser) {
        openIOSModal("inApp");
        return;
      }
      if (!res.success) {
        toast("تعذر إنشاء ملف PDF", {
          tone: "error",
          description: res.error || "يمكنك المحاولة مجدداً أو استخدام خيار الطباعة من القائمة (⋮).",
        });
        return;
      }
      if (res.iosResult === "dismissed") {
        return;
      }
      trackEvent({
        event_type: "export_pdf",
        topic: doc.coverState.title || undefined,
        pages_count: res.pagesCount || totalA4,
        university: doc.coverState.universityName || undefined,
      });
      if (res.iosResult === "shared") {
        toast("تم حفظ ملف PDF بنجاح", {
          description: `${res.fileName} — يمكنك فتحه الآن من تطبيق «الملفات».`,
        });
      } else if (res.iosResult === "downloaded") {
        toast("تم بدء تنزيل ملف PDF", {
          description: `${res.fileName} — ستجده في تطبيق «الملفات» ➔ «التنزيلات».`,
        });
      } else if (res.iosResult === "opened") {
        toast("تم فتح ملف PDF للمعاينة", {
          description: "اضغط على زر المشاركة (⎋) ثم اختر «حفظ في الملفات».",
        });
      } else {
        toast("تم تحميل ملف PDF بنجاح", {
          description: res.nativeAndroid
            ? `تم حفظ ${res.fileName} في التنزيلات ومشاركته (${res.pagesCount} صفحة A4).`
            : `${res.fileName} — ${res.pagesCount} صفحة A4 جاهزة للطباعة والتسليم.`,
        });
      }
      setTimeout(() => setFeedbackOpen(true), 1200);
    } finally {
      setExportingPdf(false);
      setPdfProgress(null);
    }
  };

  const print = () => {
    setMobileView("preview");
    // استدعاء متزامن ومباشر دون تأخير زمني لضمان فتح نافذة الطباعة في سفاري iOS
    const res = triggerPrintDocument(doc.coverState.title);
    trackEvent({
      event_type: "export_pdf",
      topic: doc.coverState.title || undefined,
      pages_count: totalA4,
      university: doc.coverState.universityName || undefined,
    });
    if (res.inAppBrowser) {
      openIOSModal("inApp");
    } else if (isIOS()) {
      toast("طريقة حفظ الـ PDF على الآيفون 📱", {
        description:
          'في نافذة الطباعة: اضغط على زر المشاركة (Share ⎋) في الأعلى ثم اختر "حفظ في الملفات".',
        tone: "info",
      });
    }
  };

  return (
    <header className="no-print relative z-30 flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 bg-white/85 dark:bg-neutral-950/85 backdrop-blur-md px-3 sm:px-5 lg:h-[68px]">
      <button
        type="button"
        onClick={handleLogoClick}
        className="flex min-w-0 shrink-0 items-center gap-3 text-right cursor-pointer transition hover:opacity-85 select-none"
        aria-label="العودة لصفحة البداية والتعريف"
        title="الصفحة الرئيسية (اضغط 5 مرات للوحة الإدارة)"
      >
        <img
          src="/app_icon.png"
          alt="Bahtak Logo"
          width={38}
          height={38}
          className="size-[38px] shrink-0 rounded-xl object-contain shadow-xs border border-black/10 dark:border-white/10"
        />
        <div className="min-w-0 leading-tight">
          <div className="flex items-baseline gap-1.5 text-[1.02rem] font-bold text-zinc-900 dark:text-white">
            <span className="max-sm:hidden">Bahtak</span>{" "}
            <span className="text-zinc-400 max-sm:hidden">—</span>{" "}
            <span className="font-serif text-[1.2rem]">بحثك</span>
          </div>
          <div className="hidden truncate text-[0.72rem] text-zinc-500 md:block lg:hidden">
            منسّق وتوليد البحوث الأكاديمية والتحميل المباشر
          </div>
        </div>
      </button>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        {isDesktop &&
          (isSlides ? (
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06] px-3.5 py-1 text-[0.78rem] font-bold text-neutral-800 dark:text-neutral-200 shadow-xs backdrop-blur-md">
                <Presentation className="size-4 text-neutral-700 dark:text-neutral-300" />
                <span>استوديو العروض التقديمية (PowerPoint)</span>
              </span>
              <button
                type="button"
                onClick={() => setProduct("research")}
                className="flex h-8 items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-800/80 px-3 text-[0.76rem] font-semibold text-neutral-800 dark:text-neutral-200 shadow-xs transition hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <FileText className="size-3.5" />
                <span>نظام البحوث ➔</span>
              </button>
            </div>
          ) : viewMode === "classic" ? (
            <div className="flex items-center gap-2">
              <SectionNav compact={!isWide} />
              <button
                type="button"
                onClick={() => setViewMode("wizard")}
                className="flex h-9 items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-800/80 px-3.5 text-[0.78rem] font-semibold text-zinc-800 dark:text-zinc-200 shadow-xs transition hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                title="إعادة فتح معالج إعداد البحث خطوة بخطوة"
              >
                <Compass className="size-4 text-zinc-700 dark:text-zinc-300" />
                <span>🧭 إعادة فتح المعالج</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06] px-3.5 py-1 text-[0.78rem] font-bold text-neutral-800 dark:text-neutral-200 shadow-xs backdrop-blur-md">
                <Compass className="size-4 text-neutral-700 dark:text-neutral-300" />
                <span>معالج إعداد وتنسيق البحث (4 خطوات)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setViewMode("classic");
                  setSection("content");
                }}
                className="flex h-8 items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-800/80 px-3 text-[0.76rem] font-semibold text-neutral-800 dark:text-neutral-200 shadow-xs transition hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <span>المحرر الكامل ➔</span>
              </button>
            </div>
          ))}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!isSlides && <SaveIndicator status={saveStatus} />}

        <span className="mx-1 hidden h-6 w-px bg-black/10 dark:bg-white/10 lg:block" />

        {isSlides ? (
          <Button
            variant="primary"
            icon={<Download className="size-4" />}
            loading={presentation.exporting}
            onClick={presentation.exportPptx}
            disabled={!presentation.laid.length}
            title="تحميل العرض بصيغة PowerPoint (.pptx)"
            className="max-sm:px-3"
          >
            <span className="max-sm:hidden">PowerPoint</span>
            <span className="sm:hidden">PPTX</span>
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              icon={<FileDown className="size-4" />}
              loading={exporting}
              onClick={exportWord}
              title="تصدير البحث بصيغة Word (.doc)"
              className="max-sm:px-3"
            >
              <span className="max-sm:hidden">Word</span>
            </Button>
            <Button
              variant="primary"
              icon={<Download className="size-4" />}
              loading={exportingPdf}
              onClick={downloadPdf}
              title="تحميل البحث مباشرة بصيغة PDF"
              className="max-sm:px-3"
            >
              <span className="max-sm:hidden">
                {exportingPdf && pdfProgress
                  ? `PDF (${pdfProgress.current}/${pdfProgress.total})`
                  : "تحميل PDF"}
              </span>
              <span className="sm:hidden">
                {exportingPdf && pdfProgress
                  ? `${pdfProgress.current}/${pdfProgress.total}`
                  : "PDF"}
              </span>
            </Button>
          </>
        )}

        <MoreMenu
          onReset={resetApp}
          viewMode={viewMode}
          onToggleView={() => setViewMode(viewMode === "wizard" ? "classic" : "wizard")}
          onOpenLanding={() => setShowLanding(true)}
          onOpenAdmin={() => setAdminModalOpen(true)}
          isSlides={isSlides}
          onToggleProduct={() => setProduct(isSlides ? "research" : "slides")}
          onPrint={print}
        />
      </div>
    </header>
  );
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" }) {
  if (status === "idle") return null;
  return (
    <span
      className="ml-2 hidden items-center gap-1.5 text-[0.72rem] font-medium text-zinc-500 dark:text-zinc-400 md:inline-flex lg:hidden xl:inline-flex"
      aria-live="polite"
    >
      {status === "saving" ? (
        <Loader2 className="size-3.5 animate-spin text-zinc-700 dark:text-zinc-300" />
      ) : (
        <Check className="size-3.5 text-zinc-900 dark:text-white" />
      )}
      {status === "saving" ? "جارٍ الحفظ" : "محفوظ تلقائياً"}
    </span>
  );
}

function MoreMenu({
  onReset,
  viewMode,
  onToggleView,
  onOpenLanding,
  onOpenAdmin,
  isSlides,
  onToggleProduct,
  onPrint,
}: {
  onReset: () => void;
  viewMode: "wizard" | "classic";
  onToggleView: () => void;
  onOpenLanding: () => void;
  onOpenAdmin: () => void;
  isSlides: boolean;
  onToggleProduct: () => void;
  onPrint: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[0.84rem] font-semibold text-zinc-800 dark:text-zinc-200 transition hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer";
  const inAndroidApp = isAndroidApp();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="المزيد"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-xl text-zinc-800 dark:text-zinc-200 transition hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
      >
        <MoreVertical className="size-5" />
      </button>
      {open && (
        <div
          className="absolute top-12 left-0 z-40 w-64 animate-rise rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 p-1.5 shadow-xl backdrop-blur-xl"
          role="menu"
        >
          <button
            type="button"
            className={`${item} font-bold text-zinc-950 dark:text-white`}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onToggleProduct();
            }}
          >
            {isSlides ? (
              <>
                <FileText className="size-5 text-zinc-800 dark:text-zinc-200" />
                الانتقال إلى نظام البحوث
              </>
            ) : (
              <>
                <Presentation className="size-5 text-zinc-800 dark:text-zinc-200" />
                عروض PowerPoint (PPTX)
                <span className="mr-auto rounded-full bg-black/5 dark:bg-white/10 px-1.5 text-[0.62rem] font-bold text-zinc-700 dark:text-zinc-300">
                  جديد
                </span>
              </>
            )}
          </button>
          {!isSlides && (
            <>
              <button
                type="button"
                className={item}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onPrint();
                }}
              >
                <Printer className="size-5 text-zinc-800 dark:text-zinc-200" />
                طباعة ورقية / PDF نصي
              </button>
              <button
                type="button"
                className={item}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onToggleView();
                }}
              >
                {viewMode === "wizard" ? (
                  <>
                    <LayoutGrid className="size-5 text-zinc-800 dark:text-zinc-200" />
                    الانتقال للمحرر الكامل
                  </>
                ) : (
                  <>
                    <Compass className="size-5 text-zinc-800 dark:text-zinc-200" />🧭 إعادة فتح
                    المعالج
                  </>
                )}
              </button>
            </>
          )}
          <button
            type="button"
            className={item}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenLanding();
            }}
          >
            <Home className="size-5 text-zinc-700 dark:text-zinc-300" />
            صفحة البداية والتعريف
          </button>
          <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
          {inAndroidApp ? (
            <button
              type="button"
              className={item}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new CustomEvent("bahtak:check-update"));
              }}
            >
              <RefreshCw className="size-5 text-zinc-800 dark:text-zinc-200" />
              التحقق من تحديثات التطبيق
            </button>
          ) : (
            <a
              href={LINKS.apk}
              download="Bahtak.apk"
              className={item}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                trackApkDownload('تحميل تطبيق الأندرويد (القائمة العلوية)');
              }}
            >
              <AndroidIcon className="size-5 text-zinc-800 dark:text-zinc-200" />
              تطبيق أندرويد (APK)
              <Download className="mr-auto size-4 text-zinc-400" />
            </a>
          )}
          <button
            type="button"
            className={`${item} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20`}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onReset();
            }}
          >
            <RotateCcw className="size-5" />
            {isSlides ? "إعادة تعيين وبدء عرض جديد" : "إعادة تعيين وبدء بحث جديد"}
          </button>
          <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 text-[0.7rem] text-zinc-500 dark:text-zinc-400">
            <CloudUpload className="size-3.5" />{" "}
            {isSlides ? "يُحفظ عرضك تلقائياً في هذا المتصفح" : "يُحفظ بحثك تلقائياً في هذا المتصفح"}
          </div>
          <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenAdmin();
            }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[0.74rem] font-semibold text-zinc-500 dark:text-zinc-400 transition hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="text-xs">🔒</span>
              لوحة الإحصائيات السرية
            </span>
            <span className="rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5 font-mono text-[0.62rem] text-zinc-600 dark:text-zinc-300">
              1919
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
