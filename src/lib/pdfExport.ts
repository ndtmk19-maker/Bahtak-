// تصدير البحث مباشرة بصيغة PDF حقيقية عبر التقاط صفحات A4 بالحجم الكامل مع الحفاظ على الخطوط العربية والتنسيق
import type { DocumentState } from "../types";
import { PLACEHOLDER_TITLE } from "../data/defaults";
import { imageToDataUrl } from "./image";
import { isIOSDevice, showIOSPdfSaveSheet, type IOSPdfSaveResult } from "./iosPdfSave";
import { isIOS, isInAppBrowser } from "./printDocument";

export interface PdfExportResult {
  success: boolean;
  fileName?: string;
  pagesCount?: number;
  inAppBrowser?: boolean;
  nativeAndroid?: boolean;
  iosResult?: IOSPdfSaveResult;
  fileSize?: number;
  error?: string;
}

export interface PdfExportOptions {
  onProgress?: (current: number, total: number) => void;
  onGenerated?: () => void;
  scale?: number;
}

const FALLBACK_LOGO = "/assets/univ_logos/MESRS.png";

export function buildPdfFileName(title?: string): string {
  const clean =
    title && title !== PLACEHOLDER_TITLE && title.trim() ? title.trim() : "بحث_أكاديمي_منسق";
  const base = clean
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\\/:*?"<>|#%&{}~$!'`=@+]+/g, "_")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 90)
    .replace(/[._]+$/g, "");
  return `${base || "بحث_أكاديمي_منسق"}.pdf`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === "string" ? reader.result : "";
      const comma = res.indexOf(",");
      resolve(comma !== -1 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(reader.error || new Error("فشل تحويل ملف PDF"));
    reader.readAsDataURL(blob);
  });
}

function getSourcePageElements(): HTMLElement[] {
  // نختار النسخة الوحيدة المعتمدة داخل PreviewPane (سواء الكلاسيكي أو .print-only في المعالج) لتفادي تكرار الصفحات
  const primary = Array.from(
    document.querySelectorAll<HTMLElement>(".preview-pane .doc-stage .a4-page"),
  );
  if (primary.length > 0) return primary;
  const fallbackStage = document.querySelector(".doc-stage");
  if (!fallbackStage) return [];
  return Array.from(fallbackStage.querySelectorAll<HTMLElement>(".a4-page"));
}

async function inlineCloneImages(root: HTMLElement, cache: Map<string, string>): Promise<void> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const rawSrc = img.getAttribute("src") || img.currentSrc || img.src || "";
      if (!rawSrc || rawSrc.startsWith("data:")) return;
      let dataUrl = cache.get(rawSrc);
      if (!dataUrl) {
        dataUrl = await imageToDataUrl(rawSrc);
        if (!dataUrl.startsWith("data:") && !rawSrc.includes("MESRS.png")) {
          dataUrl = await imageToDataUrl(FALLBACK_LOGO);
        }
        cache.set(rawSrc, dataUrl);
      }
      img.removeAttribute("srcset");
      img.decoding = "sync";
      img.loading = "eager";
      img.src = dataUrl;
      if (typeof img.decode === "function") {
        try {
          await img.decode();
        } catch {
          /* ignore decode errors */
        }
      }
    }),
  );
}

const nextFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const yieldMainThread = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * إنشاء وتحميل ملف PDF مباشر بحجم A4 لجميع صفحات البحث (الغلاف + الخطة + المحتوى)
 */
export async function exportDocumentPdf(
  doc: DocumentState,
  options: PdfExportOptions = {},
): Promise<PdfExportResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { success: false, error: "التصدير غير مدعوم خارج بيئة المتصفح" };
  }

  // متصفحات التطبيقات (TikTok / Instagram / Facebook) تمنع تنزيل الملفات من Blob
  if (isInAppBrowser()) {
    return { success: false, inAppBrowser: true };
  }

  const sourcePages = getSourcePageElements();
  if (sourcePages.length === 0) {
    return { success: false, error: "لا توجد صفحات بحث جاهزة للتصدير حالياً" };
  }

  const fileName = buildPdfFileName(doc.coverState.title);
  const scale = options.scale ?? 2;

  const [{ jsPDF }, { createContext, destroyContext, domToJpeg, waitUntilLoad }] =
    await Promise.all([import("jspdf"), import("modern-screenshot")]);

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore font wait issues */
    }
  }

  // حاوية معزولة خارج الشاشة بدون zoom أو dark-mode أو display:none لالتقاط A4 بمقاس 210×296mm الحقيقي
  const host = document.createElement("div");
  host.id = "bahtak-pdf-export-host";
  host.dir = "rtl";
  host.lang = "ar";
  host.style.cssText = [
    "position: fixed",
    "left: -100000px",
    "top: 0",
    "width: 210mm",
    "margin: 0",
    "padding: 0",
    "background: #ffffff",
    "color: #111111",
    "color-scheme: light",
    "pointer-events: none",
    "z-index: -1",
  ].join(";");

  const imageCache = new Map<string, string>();
  let screenshotContext: Awaited<ReturnType<typeof createContext>> | null = null;

  try {
    const clones = await Promise.all(
      sourcePages.map(async (srcEl) => {
        const clone = srcEl.cloneNode(true) as HTMLElement;
        clone.removeAttribute("id");
        clone.style.zoom = "1";
        clone.style.boxShadow = "none";
        clone.style.borderRadius = "0";
        clone.style.margin = "0";
        clone.style.transform = "none";
        await inlineCloneImages(clone, imageCache);
        host.appendChild(clone);
        return clone;
      }),
    );

    document.body.appendChild(host);
    await waitUntilLoad(host, { timeout: 10000 });
    await nextFrames();

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    pdf.setProperties({
      title: doc.coverState.title || "بحث أكاديمي منسق",
      creator: "Bahtak — بحثك",
      subject: doc.coverState.workType || "بحث جامعي",
      author: doc.coverState.studentsText?.split("\n").map((s) => s.trim()).find(Boolean) || "Bahtak",
    });

    screenshotContext = await createContext(clones[0], {
      autoDestruct: false,
      scale,
      type: "image/jpeg",
      quality: 0.92,
      backgroundColor: "#ffffff",
      maximumCanvasSize: 4096,
      timeout: 15000,
      features: {
        restoreScrollPosition: false,
      },
      // إزالة أبعاد البكسل الجزئية المحسوبة (inline-size/block-size/height) عن النصوص وحاوياتها حتى لا تتداخل الأسطر داخل SVG
      onCloneEachNode: (cloned) => {
        if (!(cloned instanceof HTMLElement)) return;
        const tag = cloned.tagName;
        if (tag === "IMG" || tag === "HR") return;
        const cls = typeof cloned.className === "string" ? cloned.className : "";
        if (cls.includes("a4-page")) return;

        // الحفاظ فقط على أبعاد الإطارات الهندسية وصناديق الشعارات والخطوط الفاصلة
        const keepBoxSize =
          cls.includes("page-border") ||
          cls.includes("page-inner-border") ||
          cls.includes("cover-page-container") ||
          cls.includes("cover-logo-box") ||
          cls.includes("cover-logo-placeholder") ||
          cls.includes("cover-top-line") ||
          cls.includes("cover-diamond-divider") ||
          cls.includes("cover-diamond-line") ||
          cls.includes("doc-separator") ||
          cls.includes("plan-row-dots");

        // إعادة تفعيل التوزيع التلقائي للهوامش المرنة (margin: auto) بدل البكسلات المجمّدة حتى لا ينزاح التذييل خارج الإطار
        if (cls.includes("cover-page-container")) {
          cloned.style.setProperty("box-sizing", "border-box");
        }
        if (cls.includes("cover-body")) {
          cloned.style.setProperty("margin-top", "auto");
          cloned.style.setProperty("margin-bottom", "auto");
        }
        if (cls.includes("cover-footer") || cls.includes("doc-footer")) {
          cloned.style.setProperty("margin-top", "auto");
        }

        cloned.style.removeProperty("block-size");
        cloned.style.removeProperty("min-block-size");
        cloned.style.removeProperty("max-block-size");

        if (!keepBoxSize) {
          cloned.style.removeProperty("inline-size");
          cloned.style.removeProperty("height");
          // تحرير العرض المجمّد عن النصوص (ما عدا العناصر التي تتطلب عرضاً صريحاً كـ 100%)
          if (
            tag === "SPAN" ||
            tag === "P" ||
            tag === "STRONG" ||
            tag === "SUP" ||
            tag === "LI" ||
            cls.includes("cover-country") ||
            cls.includes("cover-ministry") ||
            cls.includes("cover-university-line") ||
            cls.includes("cover-faculty-line") ||
            cls.includes("cover-type-label") ||
            cls.includes("cover-main-title") ||
            cls.includes("cover-subtitle") ||
            cls.includes("cover-info-heading") ||
            cls.includes("cover-info-names") ||
            cls.includes("cover-academic-year") ||
            cls.includes("plan-row-title") ||
            cls.includes("doc-mabhath-title") ||
            cls.includes("doc-matlab-title") ||
            cls.includes("doc-subtitle")
          ) {
            cloned.style.removeProperty("width");
          }
        }
      },
    });

    for (let i = 0; i < clones.length; i++) {
      const pageEl = clones[i];
      options.onProgress?.(i + 1, clones.length);

      const rect = pageEl.getBoundingClientRect();
      screenshotContext.fontFamilies.clear();
      screenshotContext.node = pageEl;
      if (rect.width > 0 && rect.height > 0) {
        screenshotContext.width = rect.width;
        screenshotContext.height = rect.height;
      }

      const dataUrl = await domToJpeg(screenshotContext);

      if (i > 0) pdf.addPage("a4", "portrait");
      const ratioHeightMm = rect.width > 0 ? (rect.height / rect.width) * 210 : 296;
      const drawHeightMm = Math.min(297, Math.max(100, ratioHeightMm));
      const drawY = (297 - drawHeightMm) / 2;
      pdf.addImage(dataUrl, "JPEG", 0, drawY, 210, drawHeightMm, undefined, "FAST");

      await yieldMainThread();
    }

    const pdfBlob = pdf.output("blob");
    const createPdfFile = (blob: Blob, name: string): File | Blob => {
      if (typeof File === "function") {
        try {
          return new File([blob], name, { type: "application/pdf" });
        } catch {
          /* fallback to typed Blob */
        }
      }
      return new Blob([blob], { type: "application/pdf" });
    };
    const pdfFile = createPdfFile(pdfBlob, fileName);

    const nativeBridge = (
      window as unknown as {
        AndroidNativeFile?: {
          saveBase64File?: (b64: string, name: string, mime: string) => boolean;
        };
      }
    ).AndroidNativeFile;

    if (nativeBridge && typeof nativeBridge.saveBase64File === "function") {
      const base64 = await blobToBase64(pdfFile);
      if (nativeBridge.saveBase64File(base64, fileName, "application/pdf")) {
        return { success: true, fileName, pagesCount: clones.length, nativeAndroid: true };
      }
    }

    // متصفحات iOS (Safari وChrome على الآيفون) تلغي تنزيل <a download> البرمجي بعد العمليات غير المتزامنة الطويلة؛
    // لذلك نعرض لوحة حفظ iOS بنقرة مباشرة (Web Share / رابط data: / فتح في تبويب جديد)
    if (isIOSDevice() || isIOS()) {
      options.onGenerated?.();
      const iosResult = await showIOSPdfSaveSheet(pdfFile, fileName, {
        pagesCount: clones.length,
        title: "ملف PDF جاهز للحفظ على الآيفون",
      });
      return {
        success: true,
        fileName,
        pagesCount: clones.length,
        iosResult,
        fileSize: pdfFile.size,
      };
    }

    options.onGenerated?.();
    const url = URL.createObjectURL(pdfFile);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.type = "application/pdf";
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 60000);

    return { success: true, fileName, pagesCount: clones.length, fileSize: pdfFile.size };
  } catch (err) {
    console.error("PDF export failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (screenshotContext) {
      try {
        destroyContext(screenshotContext);
      } catch {
        /* ignore */
      }
    }
    host.remove();
  }
}
