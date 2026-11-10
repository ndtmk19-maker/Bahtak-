/**
 * iosPdfSave.ts — حل مستقل لمشكلة تحميل ملفات PDF على الآيفون / الآيباد (Safari وChrome على iOS)
 * ---------------------------------------------------------------------------------------------
 * المشكلة:
 *   1) إنشاء الـ PDF يستغرق ثوانٍ (عملية async)، فتنتهي صلاحية "نقرة المستخدم" ويرفض Safari
 *      أي تنزيل أو مشاركة برمجية بعدها.
 *   2) التنزيل عبر رابط blob: مع <a download> يُظهر إشعار "تم التحميل" لكن الملف يفشل
 *      (WebKitBlobResource error) إذا أُلغي الرابط بـ revokeObjectURL أو أُغلقت النافذة قبل الحفظ.
 *
 * الحل (هذا الملف):
 *   - بعد إنشاء الملف نعرض لوحة صغيرة فيها زر "حفظ الملف"، فتصبح الضغطة عليه نقرة مستخدم جديدة وصالحة.
 *   - الطريقة الأولى: مشاركة الملف عبر Web Share API (iOS 15+) ← المستخدم يختار «حفظ في الملفات».
 *   - الطريقة الثانية: تنزيل مباشر عبر رابط data: (Base64) بدل blob: فلا يتأثر بإلغاء الروابط.
 *   - الطريقة الثالثة: فتح الملف في تبويب جديد ثم الحفظ من زر المشاركة.
 */

export type IOSPdfSaveResult = "shared" | "downloaded" | "opened" | "dismissed";

export interface IOSPdfSaveOptions {
  /** عدد الصفحات لعرضه في اللوحة (اختياري) */
  pagesCount?: number;
  /** عنوان اللوحة (اختياري) */
  title?: string;
}

/** هل الجهاز آيفون / آيباد / آيبود (بما فيها iPad بوضع سطح المكتب) */
export function isIOSDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return (
    (navigator.platform === "MacIntel" || /Macintosh/i.test(ua)) &&
    (navigator.maxTouchPoints || 0) > 1
  );
}

function ensurePdfName(name: string): string {
  const clean = (name || "document").replace(/[\\/:*?"<>|]+/g, "_").trim() || "document";
  return /\.pdf$/i.test(clean) ? clean : `${clean}.pdf`;
}

function toPdfFile(blob: Blob, fileName: string): File | Blob {
  try {
    return new File([blob], fileName, { type: "application/pdf" });
  } catch {
    return new Blob([blob], { type: "application/pdf" });
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === "string" ? reader.result : "";
      // نضمن نوع MIME الصحيح حتى يتعرف عليه Safari كملف PDF
      resolve(res.replace(/^data:[^;,]*/, "data:application/pdf"));
    };
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

function canShareFile(file: File | Blob): file is File {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  if (!(typeof File === "function" && file instanceof File)) return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STYLE_ID = "ios-pdf-save-style";
const CSS = `
.ips-backdrop{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(9,9,11,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
  font-family:inherit;direction:rtl;animation:ips-fade .2s ease-out}
.ips-card{width:100%;max-width:440px;margin:0 10px calc(10px + env(safe-area-inset-bottom));background:#fff;color:#18181b;
  border-radius:22px;padding:22px 18px 14px;box-shadow:0 24px 60px rgba(0,0,0,.3);animation:ips-up .25s cubic-bezier(.2,.8,.2,1)}
.ips-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.ips-icon{flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#fee2e2;color:#dc2626}
.ips-title{font-size:16px;font-weight:800;line-height:1.35;margin:0}
.ips-sub{font-size:12px;color:#71717a;margin:2px 0 0;word-break:break-word}
.ips-note{font-size:12.5px;line-height:1.7;color:#3f3f46;background:#f4f4f5;border-radius:14px;padding:10px 12px;margin:0 0 12px}
.ips-btn{box-sizing:border-box;display:flex;width:100%;align-items:center;justify-content:center;gap:8px;min-height:50px;
  border:0;border-radius:15px;font:inherit;font-size:15px;font-weight:800;text-decoration:none;cursor:pointer;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;margin-top:8px}
.ips-primary{background:#18181b;color:#fff}
.ips-secondary{background:#fff;color:#18181b;border:1px solid rgba(0,0,0,.14);font-size:14px;font-weight:700}
.ips-ghost{background:transparent;color:#71717a;font-size:14px;font-weight:600;min-height:44px}
.ips-btn[aria-disabled="true"]{opacity:.5;pointer-events:none}
.ips-status{display:none;font-size:12.5px;line-height:1.6;color:#065f46;background:#d1fae5;border-radius:12px;padding:9px 12px;margin-top:10px}
@media (prefers-color-scheme:dark){
  .ips-card{background:#18181b;color:#fafafa}
  .ips-sub{color:#a1a1aa}.ips-note{background:#27272a;color:#d4d4d8}
  .ips-primary{background:#fafafa;color:#18181b}
  .ips-secondary{background:#18181b;color:#fafafa;border-color:rgba(255,255,255,.18)}
  .ips-status{background:rgba(16,185,129,.15);color:#a7f3d0}
}
.dark .ips-card{background:#18181b;color:#fafafa}
.dark .ips-sub{color:#a1a1aa}
.dark .ips-note{background:#27272a;color:#d4d4d8}
.dark .ips-primary{background:#fafafa;color:#18181b}
.dark .ips-secondary{background:#18181b;color:#fafafa;border-color:rgba(255,255,255,.18)}
.dark .ips-status{background:rgba(16,185,129,.15);color:#a7f3d0}
@keyframes ips-fade{from{opacity:0}to{opacity:1}}
@keyframes ips-up{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
`;

const FILE_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 12v6"/><path d="m9 15 3 3 3-3"/></svg>`;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

let activeSheet: { close: (r: IOSPdfSaveResult) => void } | null = null;

/**
 * يعرض لوحة "حفظ ملف PDF" على iOS. الضغط على الزر يمنح Safari نقرة مستخدم جديدة
 * فيعمل الحفظ بشكل موثوق. تُرجع الدالة الطريقة التي حفظ بها المستخدم الملف أو "dismissed".
 */
export function showIOSPdfSaveSheet(
  blob: Blob,
  fileName: string,
  options: IOSPdfSaveOptions = {},
): Promise<IOSPdfSaveResult> {
  activeSheet?.close("dismissed");

  const name = ensurePdfName(fileName);
  const file = toPdfFile(blob, name);
  const shareable = canShareFile(file);
  // رابط blob للفتح في تبويب جديد — لا يُلغى إلا بعد إغلاق اللوحة بوقت طويل
  const blobUrl = URL.createObjectURL(file);

  return new Promise<IOSPdfSaveResult>((resolve) => {
    injectStyle();

    const backdrop = document.createElement("div");
    backdrop.className = "ips-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-label", "حفظ ملف PDF");

    const card = document.createElement("div");
    card.className = "ips-card";
    const meta = [options.pagesCount ? `${options.pagesCount} صفحة A4` : "", formatSize(file.size)]
      .filter(Boolean)
      .join(" · ");

    card.innerHTML = `
      <div class="ips-head">
        <div class="ips-icon">${FILE_ICON}</div>
        <div>
          <p class="ips-title"></p>
          <p class="ips-sub"></p>
        </div>
      </div>
      <p class="ips-note"></p>
    `;
    (card.querySelector(".ips-title") as HTMLElement).textContent =
      options.title || "ملف PDF جاهز للحفظ";
    const subEl = card.querySelector(".ips-sub") as HTMLElement;
    const nameBdi = document.createElement("bdi");
    nameBdi.textContent = name;
    subEl.appendChild(nameBdi);
    if (meta) subEl.appendChild(document.createTextNode(` · ${meta}`));
    (card.querySelector(".ips-note") as HTMLElement).textContent = shareable
      ? "اضغط «حفظ الملف» ثم اختر «حفظ في الملفات» (Save to Files) من قائمة المشاركة."
      : "اضغط «تنزيل الملف» ثم أكّد التنزيل. ستجده في تطبيق «الملفات» داخل مجلد «التنزيلات».";

    const status = document.createElement("div");
    status.className = "ips-status";
    const setStatus = (text: string) => {
      status.textContent = text;
      status.style.display = "block";
    };

    let finished = false;
    const close = (result: IOSPdfSaveResult) => {
      if (finished) return;
      finished = true;
      activeSheet = null;
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      // مهلة طويلة حتى لا يُلغى الملف أثناء تنزيله أو عرضه في التبويب الجديد
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
      resolve(result);
    };
    activeSheet = { close };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("dismissed");
    };
    document.addEventListener("keydown", onKey);

    // 1) المشاركة / الحفظ في الملفات — تُستدعى مباشرة داخل حدث النقر دون أي await قبلها
    if (shareable) {
      const shareBtn = document.createElement("button");
      shareBtn.type = "button";
      shareBtn.className = "ips-btn ips-primary";
      shareBtn.textContent = "حفظ الملف";
      shareBtn.addEventListener("click", () => {
        // نشارك الملف فقط بدون title/text حتى لا يحفظ iOS ملفاً نصياً إضافياً
        navigator
          .share({ files: [file as File] })
          .then(() => close("shared"))
          .catch((err: unknown) => {
            if (err instanceof Error && err.name === "AbortError") return; // أغلق المستخدم القائمة
            setStatus("تعذرت المشاركة في هذا المتصفح. استعمل «تنزيل مباشر» أو «فتح الملف» بالأسفل.");
          });
      });
      card.appendChild(shareBtn);
    }

    // 2) تنزيل مباشر عبر رابط data: (لا يتأثر بإلغاء روابط blob)
    const downloadLink = document.createElement("a");
    downloadLink.className = `ips-btn ${shareable ? "ips-secondary" : "ips-primary"}`;
    downloadLink.textContent = shareable ? "تنزيل مباشر" : "تنزيل الملف";
    downloadLink.setAttribute("download", name);
    downloadLink.setAttribute("aria-disabled", "true");
    downloadLink.href = blobUrl; // مؤقتاً إلى أن يجهز رابط data:
    blobToDataUrl(file)
      .then((dataUrl) => {
        downloadLink.href = dataUrl;
      })
      .catch(() => {
        /* نبقي على رابط blob كبديل */
      })
      .finally(() => downloadLink.removeAttribute("aria-disabled"));
    downloadLink.addEventListener("click", () => {
      setStatus(
        "إذا ظهرت رسالة «هل تريد تنزيل الملف؟» اضغط «تنزيل». ستجده في «الملفات» ← «التنزيلات».",
      );
      setTimeout(() => close("downloaded"), 2500);
    });
    card.appendChild(downloadLink);

    // 3) فتح الملف في تبويب جديد ثم الحفظ من زر المشاركة
    const openLink = document.createElement("a");
    openLink.className = "ips-btn ips-secondary";
    openLink.textContent = "فتح الملف ثم حفظه من زر المشاركة";
    openLink.href = blobUrl;
    openLink.target = "_blank";
    openLink.rel = "noopener";
    openLink.addEventListener("click", () => {
      setTimeout(() => close("opened"), 800);
    });
    card.appendChild(openLink);

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ips-btn ips-ghost";
    cancelBtn.textContent = "إغلاق";
    cancelBtn.addEventListener("click", () => close("dismissed"));
    card.appendChild(cancelBtn);

    card.appendChild(status);
    backdrop.appendChild(card);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close("dismissed");
    });
    document.body.appendChild(backdrop);
  });
}
