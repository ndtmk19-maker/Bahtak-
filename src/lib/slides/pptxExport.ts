// مُصدِّر PowerPoint: يحوّل العناصر الموضعة إلى أشكال ونصوص أصلية قابلة للتعديل داخل PowerPoint (PPTX)
import PptxGenJS from "pptxgenjs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SLIDE_ICONS, type SlideIconName } from "./icons";
import type { LaidSlide, Prim, TPara } from "./layout";
import { imageToDataUrl } from "../image";
import { isInAppBrowser } from "../printDocument";
import type { SlideTheme } from "./themes";

const cache = new Map<string, Promise<string | null>>();

/** تحويل الأيقونة إلى صورة PNG شفافة (data URL) لإدراجها في ملف PowerPoint */
function iconToPng(name: SlideIconName, color: string, px = 256): Promise<string | null> {
  const key = `${name}|${color}|${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = new Promise<string | null>((resolve) => {
    try {
      if (typeof document === "undefined") return resolve(null);
      const svg = renderToStaticMarkup(
        createElement(SLIDE_ICONS[name], { size: px, color: `#${color}`, strokeWidth: 1.75 }),
      );
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = px;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, px, px);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    } catch {
      resolve(null);
    }
  });
  cache.set(key, job);
  return job;
}

/** تحميل الشعار كـ data URL مع أبعاده الطبيعية */
async function loadImage(src: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    let data = src.startsWith("data:") ? src : await imageToDataUrl(src);
    if (!data.startsWith("data:")) return null;
    const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
      const im = new Image();
      im.onload = () => resolve({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 });
      im.onerror = () => resolve(null);
      im.src = data;
    });
    if (!dims) return null;
    // PowerPoint يدعم PNG وJPEG بشكل موثوق: تحويل الصيغ الأخرى (مثل SVG وWebP) إلى PNG
    if (!/^data:image\/(png|jpe?g)/i.test(data)) {
      const c = document.createElement("canvas");
      const scale = Math.min(1, 1200 / Math.max(dims.w, dims.h)) || 1;
      c.width = Math.round(dims.w * scale) || 512;
      c.height = Math.round(dims.h * scale) || 512;
      const im = new Image();
      await new Promise((r) => ((im.onload = r), (im.onerror = r), (im.src = data)));
      c.getContext("2d")?.drawImage(im, 0, 0, c.width, c.height);
      data = c.toDataURL("image/png");
    }
    return { data, ...dims };
  } catch {
    return null;
  }
}

const tr = (alpha?: number) => (alpha === undefined ? 0 : Math.round((1 - alpha) * 100));
const fill = (color?: string, alpha?: number) =>
  color
    ? { color, transparency: tr(alpha) }
    : { type: "none" as const, color: "FFFFFF", transparency: 100 };
const line = (color?: string, w?: number, alpha?: number) =>
  color ? { color, width: w || 1, transparency: tr(alpha) } : { type: "none" as const };

function textRuns(paras: TPara[]): PptxGenJS.TextProps[] {
  const out: PptxGenJS.TextProps[] = [];
  paras.forEach((p, pi) => {
    p.runs.forEach((r, ri) => {
      out.push({
        text: r.text,
        options: {
          bold: r.bold ?? p.bold ?? false,
          color: r.color || p.color,
          fontSize: p.size,
          align: p.align,
          rtlMode: p.rtl,
          lang: p.rtl ? "ar-SA" : "en-US",
          lineSpacingMultiple: 1.0,
          paraSpaceAfter: p.spaceAfter || 0,
          ...(p.bullet ? { bullet: { code: "25CF", indent: 18 } } : {}),
          ...(ri === p.runs.length - 1 && pi < paras.length - 1 ? { breakLine: true } : {}),
        },
      });
    });
  });
  return out;
}

async function addPrim(pptx: PptxGenJS, slide: PptxGenJS.Slide, p: Prim) {
  switch (p.t) {
    case "image": {
      const img = await loadImage(p.src);
      if (!img) break;
      // احتواء الصورة داخل الإطار مع الحفاظ على نسبة أبعادها الأصلية
      const k = Math.min(p.w / img.w, p.h / img.h);
      const w = img.w * k;
      const h = img.h * k;
      slide.addImage({
        data: img.data,
        x: p.x + (p.w - w) / 2,
        y: p.y + (p.h - h) / 2,
        w,
        h,
        altText: "شعار الجامعة",
      });
      break;
    }
    case "rect":
      slide.addShape(p.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        fill: fill(p.fill, p.alpha),
        line: line(p.line, p.lineW),
        ...(p.radius ? { rectRadius: p.radius } : {}),
      });
      break;
    case "ellipse":
      slide.addShape(pptx.ShapeType.ellipse, {
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        fill: fill(p.fill, p.alpha),
        line: line(p.line, p.lineW, p.fill ? undefined : p.alpha),
      });
      break;
    case "tri":
      slide.addShape(pptx.ShapeType.rtTriangle, {
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        fill: fill(p.fill, p.alpha),
        line: line(),
        flipH: !!p.flipH,
        flipV: !!p.flipV,
      });
      break;
    case "line": {
      const x = Math.min(p.x1, p.x2);
      const y = Math.min(p.y1, p.y2);
      slide.addShape(pptx.ShapeType.line, {
        x,
        y,
        w: Math.max(0.001, Math.abs(p.x2 - p.x1)),
        h: Math.max(0.001, Math.abs(p.y2 - p.y1)),
        line: line(p.color, p.width, p.alpha),
        flipV: (p.x2 - p.x1) * (p.y2 - p.y1) < 0,
      });
      break;
    }
    case "text":
      slide.addText(textRuns(p.paras), {
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        fontFace: p.font,
        valign: p.valign,
        margin: 0,
        wrap: true,
        fit: "shrink",
        objectName: p.role,
      });
      break;
    case "icon": {
      const data = await iconToPng(p.name, p.color);
      if (data) slide.addImage({ data, x: p.x, y: p.y, w: p.w, h: p.h, altText: p.name });
      break;
    }
  }
}

export interface PptxMeta {
  title: string;
  author: string;
  subject?: string;
}

export async function buildPptx(
  slides: LaidSlide[],
  theme: SlideTheme,
  meta: PptxMeta,
): Promise<PptxGenJS> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.rtlMode = true;
  pptx.title = meta.title;
  pptx.author = meta.author || "Bahtak";
  pptx.company = "Bahtak — بحثك";
  pptx.subject = meta.subject || meta.title;
  pptx.theme = { headFontFace: theme.fonts.head, bodyFontFace: theme.fonts.body };
  for (const ls of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: ls.bg };
    for (const p of ls.prims) await addPrim(pptx, slide, p);
    if (ls.notes) slide.addNotes(ls.notes);
  }
  return pptx;
}

export interface PptxExportResult {
  success: boolean;
  fileName?: string;
  inAppBrowser?: boolean;
  nativeAndroid?: boolean;
  error?: string;
}

export function safeFileName(title: string) {
  const base = (title || "عرض_تقديمي")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\\/:*?"<>|#%&{}~$!'`=@+]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 80)
    .replace(/[._]+$/g, "");
  return `${base || "عرض_تقديمي"}.pptx`;
}

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function createPptxBlob(buffer: ArrayBuffer, fileName: string): Blob {
  // تغليف البيانات بـ File/Blob بنوع PPTX الرسمي بدلاً من application/zip الذي تُخرجه JSZip
  // لأن متصفحات الهواتف (Safari iOS وChrome Android) تستبدل اللاحقة بـ .zip إذا كان النوع application/zip
  if (typeof File === "function") {
    try {
      return new File([buffer], fileName, { type: PPTX_MIME });
    } catch {
      /* fallback to Blob */
    }
  }
  return new Blob([buffer], { type: PPTX_MIME });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(parts.join(""));
}

/** إنشاء ملف PPTX وتنزيله بنوع MIME الرسمي الصحيح لمنع حفظه بصيغة ZIP على الهواتف */
export async function downloadPptx(
  slides: LaidSlide[],
  theme: SlideTheme,
  meta: PptxMeta,
): Promise<PptxExportResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { success: false, error: "التصدير غير مدعوم خارج بيئة المتصفح" };
  }

  if (isInAppBrowser()) {
    return { success: false, inAppBrowser: true };
  }

  try {
    const pptx = await buildPptx(slides, theme, meta);
    const buffer = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
    const fileName = safeFileName(meta.title);

    const nativeBridge = (
      window as unknown as {
        AndroidNativeFile?: {
          saveBase64File?: (b64: string, name: string, mime: string) => boolean;
        };
      }
    ).AndroidNativeFile;
    if (nativeBridge && typeof nativeBridge.saveBase64File === "function") {
      const base64 = arrayBufferToBase64(buffer);
      if (nativeBridge.saveBase64File(base64, fileName, PPTX_MIME)) {
        return { success: true, fileName, nativeAndroid: true };
      }
    }

    const pptxBlob = createPptxBlob(buffer, fileName);
    const url = URL.createObjectURL(pptxBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.type = PPTX_MIME;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 60000);
    return { success: true, fileName };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
