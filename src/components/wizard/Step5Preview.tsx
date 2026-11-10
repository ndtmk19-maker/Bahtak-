import { useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileDown,
  FilePlus2,
  FileText,
  GraduationCap,
  Heading,
  List,
  ListTree,
  Maximize2,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Superscript,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge, Chip } from "../ui/Controls";
import { AppCredits } from "../panels/AppCredits";
import { PageCard, insertInto, SNIPPETS, type ChipType } from "../panels/PagesPanel";
import { ContentPage, CoverPage, PlanPage } from "../preview/Pages";
import { useDocument } from "../../state/DocumentContext";
import { useUI } from "../../state/UIContext";
import { downloadWordDocument } from "../../lib/wordExport";
import { exportDocumentPdf } from "../../lib/pdfExport";
import { imageToDataUrl } from "../../lib/image";
import { isIOS, triggerPrintDocument } from "../../lib/printDocument";
import { trackEvent } from "../../lib/analytics";

export function Step5Preview() {
  const { doc, pagesVersion, addPage } = useDocument();
  const { toast, setMobileView, setViewMode, setSection, setFeedbackOpen, openIOSModal } = useUI();
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");
  const [inlineZoom, setInlineZoom] = useState(0.65);
  const lastFocused = useRef<HTMLTextAreaElement | null>(null);

  const totalA4 =
    doc.pages.length + (doc.coverState.enabled ? 1 : 0) + (doc.planState.enabled ? 1 : 0);

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
        pages_count: totalA4,
        university: doc.coverState.universityName || undefined,
      });
      toast("تم تصدير ملف Word بنجاح", {
        description: "افتح الملف في Microsoft Word أو Google Docs.",
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
          description: res.error || "يمكنك المحاولة مجدداً أو استخدام خيار الطباعة أدناه.",
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

  const finishToClassic = () => {
    setViewMode("classic");
    setSection("content");
    toast("مرحباً بك في المحرر الكامل!", {
      description:
        "يمكنك الآن التبديل بحرية بين تبويبات المحتوى، الغلاف، الخطة، الصفحات، والتنسيق مع معاينة A4 الحية.",
      tone: "info",
    });
  };

  const insertGlobal = (type: ChipType) => {
    const target = lastFocused.current?.isConnected
      ? lastFocused.current
      : document.querySelector<HTMLTextAreaElement>("[data-page-text]");
    if (target) insertInto(target, SNIPPETS[type]);
  };

  return (
    <div className="flex flex-col gap-6 animate-rise">
      {/* بطاقة التهنئة والاكتمال بهوية زجاجية فاخرة */}
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] text-zinc-800 dark:text-zinc-200 shadow-xs">
            <CheckCircle2 className="size-6 text-zinc-700 dark:text-zinc-300" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
              اكتمل إعداد وتنسيق بحثك بنجاح!
            </h3>
            <p className="mt-1 text-xs sm:text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              تم تنسيق صفحات البحث وفق المعايير الأكاديمية الرسمية (A4). يمكنك الآن معاينة الأوراق
              مباشرة أدناه، تصدير ملف Word، أو تحميل ملف PDF جاهز بضغطة واحدة.
            </p>
          </div>
        </div>

        {/* بطاقات الملخص السريع */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3 text-center transition hover:border-black/15">
            <span className="flex items-center justify-center gap-1.5 text-[0.72rem] font-bold text-zinc-500 dark:text-zinc-400">
              <FileText className="size-3.5 text-zinc-600 dark:text-zinc-400" /> إجمالي الصفحات
            </span>
            <div className="mt-1.5 font-bold text-zinc-900 dark:text-white text-base tabular-nums">
              {totalA4} A4
            </div>
            <div className="text-[0.66rem] text-zinc-400">({doc.pages.length} محتوى)</div>
          </div>

          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3 text-center transition hover:border-black/15">
            <span className="flex items-center justify-center gap-1.5 text-[0.72rem] font-bold text-zinc-500 dark:text-zinc-400">
              <GraduationCap className="size-3.5 text-zinc-600 dark:text-zinc-400" /> صفحة الغلاف
            </span>
            <div
              className={`mt-1.5 font-bold text-sm ${doc.coverState.enabled ? "text-zinc-900 dark:text-white" : "text-zinc-400"}`}
            >
              {doc.coverState.enabled ? "✓ مفعّلة" : "معطّلة"}
            </div>
            <div className="truncate text-[0.66rem] text-zinc-400">
              {doc.coverState.universityName || "الجامعة"}
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3 text-center transition hover:border-black/15">
            <span className="flex items-center justify-center gap-1.5 text-[0.72rem] font-bold text-zinc-500 dark:text-zinc-400">
              <ListTree className="size-3.5 text-zinc-600 dark:text-zinc-400" /> صفحة الخطة
            </span>
            <div
              className={`mt-1.5 font-bold text-sm ${doc.planState.enabled ? "text-zinc-900 dark:text-white" : "text-zinc-400"}`}
            >
              {doc.planState.enabled ? "✓ مفعّلة" : "معطّلة"}
            </div>
            <div className="text-[0.66rem] text-zinc-400">
              {doc.planState.showPageNumbers ? "مع أرقام الصفحات" : "عناوين فقط"}
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3 text-center transition hover:border-black/15">
            <span className="flex items-center justify-center gap-1.5 text-[0.72rem] font-bold text-zinc-500 dark:text-zinc-400">
              <SlidersHorizontal className="size-3.5 text-zinc-600 dark:text-zinc-400" /> التنسيق
              والخط
            </span>
            <div className="mt-1.5 font-bold text-sm text-zinc-900 dark:text-white truncate">
              {doc.fontFamily.includes("Amiri")
                ? "الأميري"
                : doc.fontFamily.includes("Cairo")
                  ? "القاهرة"
                  : "تجوال"}
            </div>
            <div className="text-[0.66rem] text-zinc-400">
              {doc.fontSize}pt ·{" "}
              {doc.borderStyle === "double"
                ? "مزدوج"
                : doc.borderStyle === "gold"
                  ? "ذهبي"
                  : doc.borderStyle === "single"
                    ? "مفرد"
                    : "بدون"}
            </div>
          </div>
        </div>
      </div>

      {/* أزرار الإجراءات الكبرى والتصدير */}
      <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-5 text-zinc-800 dark:text-zinc-200" />
          <h4 className="font-serif text-lg font-bold text-zinc-900 dark:text-white">
            تصدير وتحميل البحث
          </h4>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="secondary"
            size="lg"
            icon={<FileDown className="size-5" />}
            loading={exporting}
            onClick={exportWord}
            className="w-full justify-center !rounded-2xl !py-3.5 !border-black/15 dark:!border-white/15 !bg-white/80 dark:!bg-zinc-800/80 !text-zinc-900 dark:!text-white hover:!border-black/30 dark:hover:!border-white/30"
          >
            تصدير ملف Word (.doc)
          </Button>

          <Button
            variant="primary"
            size="lg"
            icon={<Download className="size-5" />}
            loading={exportingPdf}
            onClick={downloadPdf}
            className="w-full justify-center !rounded-2xl !py-3.5 !bg-zinc-900 dark:!bg-white !text-white dark:!text-zinc-950 hover:!bg-zinc-800 dark:hover:!bg-zinc-100 shadow-md"
          >
            {exportingPdf && pdfProgress
              ? `جارٍ تجهيز PDF (${pdfProgress.current}/${pdfProgress.total})...`
              : "تحميل ملف PDF"}
          </Button>
        </div>

        {/* خيار ثانوي للطباعة الورقية أو PDF بنصوص قابلة للنسخ عبر نافذة المتصفح */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] px-3.5 py-2.5 text-xs text-zinc-600 dark:text-zinc-300">
          <span className="leading-relaxed">
            تحتاج طباعة ورقية مباشرة أو ملف PDF بنصوص قابلة للتحديد؟
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={print}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-white/85 dark:bg-zinc-800/85 px-3 py-1.5 font-bold text-[0.74rem] text-zinc-900 dark:text-white shadow-xs transition hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <Printer className="size-3.5" />
              طباعة عبر المتصفح
            </button>
            {isIOS() && (
              <button
                type="button"
                onClick={() => openIOSModal("guide")}
                className="rounded-xl border border-black/10 dark:border-white/10 bg-white/85 dark:bg-zinc-800/85 px-2.5 py-1.5 font-bold text-[0.72rem] text-zinc-700 dark:text-zinc-200 shadow-xs transition hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                دليل الآيفون
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={finishToClassic}
          className="mt-3.5 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] py-3.5 px-6 font-bold text-sm text-zinc-800 dark:text-zinc-200 transition hover:bg-black/5 dark:hover:bg-white/10 hover:border-black/20 cursor-pointer active:scale-[0.99]"
        >
          <span>إنهاء المعالج والانتقال إلى المحرر الكامل المتقدم ➔</span>
        </button>
      </div>

      {/* قسم التبديل بين معاينة A4 الحية ومراجعة المحتوى */}
      <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl overflow-hidden">
        {/* شريط التبويب العلوي */}
        <div className="flex border-b border-black/10 dark:border-white/10 p-2 sm:p-2.5 bg-black/[0.015] dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 px-4 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "preview"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <Eye className="size-4" />
            <span>معاينة ورقة A4 مباشرة ({totalA4} صفحة)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 px-4 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "edit"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <FileText className="size-4" />
            <span>تعديل نصوص وعناوين الصفحات ({doc.pages.length})</span>
          </button>
        </div>

        {/* عرض المعاينة الحية لأوراق A4 مباشرة في الخطوة 5 */}
        {activeTab === "preview" && (
          <div className="relative flex flex-col bg-zinc-100/90 dark:bg-zinc-950 p-4 sm:p-6">
            {/* شريط تكبير وتصغير المعاينة */}
            <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 px-3 py-2 backdrop-blur-md">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                مظهر الورقة الأكاديمي الحقيقي:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="تصغير"
                  onClick={() =>
                    setInlineZoom((z) => Math.max(0.35, Math.round((z - 0.05) * 100) / 100))
                  }
                  className="grid size-7 place-items-center rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-12 text-center text-xs font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
                  {Math.round(inlineZoom * 100)}%
                </span>
                <button
                  type="button"
                  title="تكبير"
                  onClick={() =>
                    setInlineZoom((z) => Math.min(1.2, Math.round((z + 0.05) * 100) / 100))
                  }
                  className="grid size-7 place-items-center rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                </button>
                <button
                  type="button"
                  title="إعادة تعيين إلى 65%"
                  onClick={() => setInlineZoom(0.65)}
                  className="grid size-7 place-items-center rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  <RotateCcw className="size-3" />
                </button>
              </div>
            </div>

            {/* مسرح الأوراق A4 */}
            <div className="max-h-[580px] overflow-auto rounded-2xl border border-black/10 dark:border-white/10 bg-zinc-200/50 dark:bg-black/40 p-4 scroll-thin">
              <div
                className="doc-stage mx-auto flex w-max flex-col items-center gap-[12mm] py-4"
                style={{ zoom: inlineZoom }}
              >
                {doc.coverState.enabled && <CoverPage doc={doc} />}
                {doc.planState.enabled && <PlanPage doc={doc} />}
                {doc.pages.map((p, i) => (
                  <ContentPage key={i} doc={doc} page={p} index={i} />
                ))}
                {totalA4 === 0 && (
                  <div className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 bg-white/70 dark:bg-zinc-900/70 p-8 text-center text-xs text-zinc-500">
                    لا توجد صفحات للعرض حالياً.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* محرر صفحات المحتوى السريع */}
        {activeTab === "edit" && (
          <div className="p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                قائمة صفحات البحث ومحتواها:
              </span>
              <Button
                variant="primary"
                size="sm"
                icon={<FilePlus2 className="size-4" />}
                onClick={addPage}
                className="!rounded-xl !bg-zinc-900 dark:!bg-white !text-white dark:!text-zinc-950"
              >
                إضافة صفحة جديدة
              </Button>
            </div>

            {doc.pages.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-2.5">
                <span className="ml-1 text-[0.72rem] font-semibold text-zinc-500 dark:text-zinc-400">
                  إدراج سريع:
                </span>
                <Chip
                  icon={<Heading className="size-3 text-zinc-600 dark:text-zinc-400" />}
                  onClick={() => insertGlobal("h3")}
                >
                  عنوان فرعي
                </Chip>
                <Chip
                  icon={<List className="size-3 text-zinc-600 dark:text-zinc-400" />}
                  onClick={() => insertGlobal("ul")}
                >
                  قائمة نقاط
                </Chip>
                <Chip
                  icon={<Superscript className="size-3 text-zinc-600 dark:text-zinc-400" />}
                  onClick={() => insertGlobal("fn")}
                >
                  إحالة [1]
                </Chip>
              </div>
            )}

            {doc.pages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] px-6 py-8 text-center text-xs sm:text-sm text-zinc-500">
                لا توجد صفحات محتوى حالياً.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {doc.pages.map((p, i) => (
                  <PageCard
                    key={`${pagesVersion}-${i}`}
                    page={p}
                    index={i}
                    total={doc.pages.length}
                    onFocusText={(el) => (lastFocused.current = el)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* حقوق التطبيق وتحميل APK */}
      <AppCredits />
    </div>
  );
}
