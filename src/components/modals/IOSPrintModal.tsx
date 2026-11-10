import { useState } from 'react';
import { Check, Compass, Copy, Info, Printer, Smartphone } from 'lucide-react';
import { Modal, ModalHeader } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useUI } from '../../state/UIContext';
import { useDocument } from '../../state/DocumentContext';
import { triggerPrintDocument } from '../../lib/printDocument';

export function IOSPrintModal() {
  const { iosModal, closeIOSModal, toast } = useUI();
  const { doc } = useDocument();
  const [copied, setCopied] = useState(false);

  if (!iosModal.open) return null;

  const handleCopyLink = async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : 'https://bahtak.dz';
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast('تم نسخ رابط الموقع بنجاح', {
        description: 'افتح متصفح Safari الآن والصق الرابط في شريط العناوين لتتمكن من تصدير PDF.',
        tone: 'success',
      });
      setTimeout(() => setCopied(false), 4000);
    } catch {
      toast('تعذر نسخ الرابط تلقائياً', {
        description: 'يمكنك نسخ رابط الموقع يدوياً من شريط العنوان.',
        tone: 'error',
      });
    }
  };

  const handleDirectPrint = () => {
    closeIOSModal();
    // استدعاء متزامن تماماً لضمان تفعيل تفاعل المستخدم في سفاري
    triggerPrintDocument(doc.coverState.title);
  };

  const isInApp = iosModal.mode === 'inApp';

  return (
    <Modal
      open={iosModal.open}
      onClose={closeIOSModal}
      labelledBy="ios-modal-title"
      size="md"
    >
      <ModalHeader
        id="ios-modal-title"
        title={isInApp ? 'تنبيه لمستخدمي الآيفون (متصفح التطبيق)' : 'طريقة حفظ البحث كـ PDF على الآيفون'}
        subtitle={
          isInApp
            ? 'متصفحات التطبيقات (انستغرام / تيك توك / فيسبوك) تمنع تحميل ملفات PDF و PowerPoint'
            : 'دليل خطوات حفظ الـ PDF مباشرة عبر نافذة طباعة Safari'
        }
        icon={isInApp ? <Compass className="size-5" /> : <Smartphone className="size-5" />}
        onClose={closeIOSModal}
      />

      <div className="p-5 sm:p-6 flex flex-col gap-4 text-sm text-zinc-700 dark:text-zinc-300">
        {isInApp ? (
          <>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-3">
                <Info className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>أنت تتصفح الموقع حالياً من داخل متصفح تطبيق:</strong>
                  <p className="mt-1">
                    تطبيقات مثل <strong>Instagram</strong> و <strong>TikTok</strong> و <strong>Facebook</strong> تفتح المواقع في متصفح داخلي مقيّد لا يدعم تنزيل ملفات الـ PDF و PowerPoint أو فتح نافذة الطباعة.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="font-bold text-zinc-900 dark:text-white text-sm">
                خطوات تصدير بحثك بنجاح في دقيقة واحدة:
              </h4>

              <div className="flex items-start gap-3 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs">
                  1
                </span>
                <div className="leading-relaxed">
                  <strong className="text-zinc-900 dark:text-white">فتح الموقع في متصفح Safari:</strong>
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                    اضغط على زر النقاط الثلاث <strong>(•••)</strong> في زاوية الشاشة، ثم اختر <strong>"فتح في المتصفح"</strong> أو <strong>"Open in Safari"</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs">
                  2
                </span>
                <div className="leading-relaxed">
                  <strong className="text-zinc-900 dark:text-white">أو انسخ الرابط وافتحه بنفسك:</strong>
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                    انسخ الرابط أدناه، ثم افتح تطبيق Safari على هاتفك والصقه في شريط البحث.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                icon={copied ? <Check className="size-5" /> : <Copy className="size-5" />}
                onClick={handleCopyLink}
                className="w-full justify-center !rounded-2xl !py-3.5"
              >
                {copied ? 'تم نسخ الرابط! افتح Safari والصقه' : 'نسخ رابط الموقع لفتحه في Safari'}
              </Button>

              <Button
                variant="ghost"
                size="md"
                onClick={closeIOSModal}
                className="w-full justify-center !rounded-xl"
              >
                إغلاق
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 text-xs sm:text-sm">
              <p className="leading-relaxed">
                في هواتف آيفون (iOS Safari)، تتم طباعة وحفظ الـ PDF عبر خيارات مشاركة Apple الرسمية:
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs">
                  1
                </span>
                <div className="leading-relaxed">
                  <strong className="text-zinc-900 dark:text-white">فتح نافذة الطباعة:</strong>
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                    اضغط على زر "فتح نافذة الطباعة" أدناه لظهور ورقة خيارات الطباعة من Apple.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs">
                  2
                </span>
                <div className="leading-relaxed">
                  <strong className="text-zinc-900 dark:text-white">الضغط على زر المشاركة (Share):</strong>
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                    في أعلى نافذة الطباعة، اضغط على أيقونة المشاركة <strong>(مربع مع سهم للأعلى ⎋)</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs">
                  3
                </span>
                <div className="leading-relaxed">
                  <strong className="text-zinc-900 dark:text-white">حفظ في الملفات (Save to Files):</strong>
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                    اختر <strong>"حفظ في الملفات"</strong> وحدد المجلد لتنزيل البحث بصيغة PDF نقية وجاهزة للطباعة والتسليم.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-black/15 dark:border-white/15 p-3 text-[0.74rem] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              💡 <strong>طريقة بديلة سريعة:</strong> يمكنك أيضاً في نافذة معاينة الطباعة تكبير أي صفحة بإصبعين (Pinch to zoom)، ثم الضغط على زر المشاركة في أسفل الشاشة واختيار "حفظ في الملفات".
            </div>

            <div className="mt-2 flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                icon={<Printer className="size-5" />}
                onClick={handleDirectPrint}
                className="w-full justify-center !rounded-2xl !py-3.5 !bg-zinc-900 dark:!bg-white !text-white dark:!text-zinc-950"
              >
                فتح نافذة الطباعة الآن ➔
              </Button>

              <Button
                variant="ghost"
                size="md"
                onClick={closeIOSModal}
                className="w-full justify-center !rounded-xl"
              >
                إلغاء
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
