import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Modal, ModalHeader } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useUI } from '../../state/UIContext';
import {
  AppUpdater,
  checkForAppUpdates,
  isAndroidApp,
  type ApkDownloadProgress,
  type RemoteApkInfo,
} from '../../lib/appUpdater';

interface ApkPromptState {
  open: boolean;
  currentVersionName: string;
  apk: RemoteApkInfo;
  stage: 'ready' | 'downloading' | 'needs_permission' | 'installing' | 'error';
  progress: ApkDownloadProgress;
  errorMsg: string;
}

interface WebOtaBannerState {
  ready: boolean;
  path: string;
  buildId: string;
}

const SKIP_SESSION_KEY = 'bahtak_skipped_apk_version';

export function AppUpdatePrompt() {
  const { showLanding, toast } = useUI();
  const showLandingRef = useRef(showLanding);
  showLandingRef.current = showLanding;

  const [apkPrompt, setApkPrompt] = useState<ApkPromptState | null>(null);
  const [webBanner, setWebBanner] = useState<WebOtaBannerState | null>(null);
  const checkingRef = useRef(false);

  const runCheck = useCallback(
    async (manual: boolean) => {
      if (!isAndroidApp() || checkingRef.current) return;
      checkingRef.current = true;
      if (manual) {
        toast('جاري التحقق من التحديثات...', { tone: 'info' });
      }
      try {
        const result = await checkForAppUpdates();
        if (!result) return;

        if (result.kind === 'apk') {
          const skipped = sessionStorage.getItem(SKIP_SESSION_KEY);
          if (!manual && !result.apk.mandatory && skipped === String(result.apk.versionCode)) {
            return;
          }
          setApkPrompt({
            open: true,
            currentVersionName: result.currentVersionName,
            apk: result.apk,
            stage: 'ready',
            progress: { downloadedBytes: 0, totalBytes: 0, percent: 0 },
            errorMsg: '',
          });
          return;
        }

        if (result.kind === 'web') {
          // تنزيل وتجهيز حزمة الواجهة الجديدة في الخلفية بصمت
          const prepared = await AppUpdater.downloadAndPrepareWebUpdate({
            url: result.web.url,
            buildId: result.web.buildId,
          });

          // إذا كان المستخدم لا يزال في شاشة البداية ولم يبدأ عملاً بعد، نُطبّق التحديث فوراً دون مقاطعة
          if (showLandingRef.current && !manual) {
            await AppUpdater.applyWebBundle({ path: prepared.path });
            return;
          }

          setWebBanner({
            ready: true,
            path: prepared.path,
            buildId: prepared.buildId,
          });
          if (manual) {
            toast('تم تنزيل تحديث جديد للواجهة', {
              description: 'اضغط على «تطبيق التحديث الآن» لتحديث الشاشة فوراً.',
            });
          }
          return;
        }

        if (manual) {
          toast(`أنت تستخدم أحدث إصدار (${result.currentVersionName})`, {
            description: 'لا توجد تحديثات جديدة متوفرة حالياً.',
          });
        }
      } catch (err) {
        if (manual) {
          toast('تعذر التحقق من التحديثات', {
            tone: 'error',
            description: err instanceof Error ? err.message : 'تحقق من اتصالك بالإنترنت.',
          });
        }
      } finally {
        checkingRef.current = false;
      }
    },
    [toast],
  );

  // الفحص التلقائي عند فتح التطبيق
  useEffect(() => {
    if (!isAndroidApp()) return;
    const t = setTimeout(() => {
      runCheck(false);
    }, 1200);
    const onManual = () => {
      runCheck(true);
    };
    window.addEventListener('bahtak:check-update', onManual);
    return () => {
      clearTimeout(t);
      window.removeEventListener('bahtak:check-update', onManual);
    };
  }, [runCheck]);

  // متابعة شريط تقدم تحميل APK وعودة المستخدم من إعدادات الأندرويد
  useEffect(() => {
    if (!isAndroidApp()) return;
    let progressHandle: { remove: () => Promise<void> } | null = null;
    let resumeHandle: { remove: () => Promise<void> } | null = null;

    AppUpdater.addListener('apkDownloadProgress', (ev) => {
      setApkPrompt((prev) => (prev ? { ...prev, progress: ev } : prev));
    }).then((h) => {
      progressHandle = h;
    });

    AppUpdater.addListener('apkInstallResumed', () => {
      setApkPrompt((prev) => (prev ? { ...prev, stage: 'installing' } : prev));
    }).then((h) => {
      resumeHandle = h;
    });

    return () => {
      progressHandle?.remove().catch(() => {});
      resumeHandle?.remove().catch(() => {});
    };
  }, []);

  const startApkDownload = async () => {
    if (!apkPrompt) return;
    setApkPrompt((p) => (p ? { ...p, stage: 'downloading', errorMsg: '' } : p));
    try {
      const res = await AppUpdater.downloadAndInstallApk({ url: apkPrompt.apk.url });
      if (res.status === 'needs_permission') {
        setApkPrompt((p) => (p ? { ...p, stage: 'needs_permission' } : p));
      } else {
        setApkPrompt((p) => (p ? { ...p, stage: 'installing' } : p));
      }
    } catch (err) {
      setApkPrompt((p) =>
        p
          ? {
              ...p,
              stage: 'error',
              errorMsg: err instanceof Error ? err.message : 'تعذر تحميل التحديث.',
            }
          : p,
      );
    }
  };

  const retryApkInstall = async () => {
    if (!apkPrompt) return;
    try {
      const res = await AppUpdater.retryInstallApk();
      if (res.status === 'needs_permission') {
        toast('يرجى تفعيل خيار «السماح من هذا المصدر» أولاً من الإعدادات', { tone: 'info' });
        await startApkDownload();
      } else {
        setApkPrompt((p) => (p ? { ...p, stage: 'installing' } : p));
      }
    } catch {
      startApkDownload();
    }
  };

  const dismissApk = () => {
    if (!apkPrompt || apkPrompt.apk.mandatory) return;
    try {
      sessionStorage.setItem(SKIP_SESSION_KEY, String(apkPrompt.apk.versionCode));
    } catch {
      /* ignore */
    }
    setApkPrompt(null);
  };

  const applyWebOtaNow = async () => {
    if (!webBanner) return;
    try {
      await AppUpdater.applyWebBundle({ path: webBanner.path });
    } catch (err) {
      toast('سيُطبَّق التحديث تلقائياً عند إعادة فتح التطبيق', {
        tone: 'info',
        description: err instanceof Error ? err.message : undefined,
      });
      setWebBanner(null);
    }
  };

  const formatMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <>
      {/* شريط إشعار خفيف عندما يجهز تحديث الواجهة أثناء عمل المستخدم */}
      {webBanner?.ready && !apkPrompt?.open && (
        <div
          dir="rtl"
          className="no-print fixed bottom-4 inset-x-4 z-40 mx-auto flex max-w-md animate-rise items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-zinc-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Sparkles className="size-4.5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[0.82rem] font-bold">تم تجهيز تحديث جديد للتطبيق</div>
              <div className="truncate text-[0.7rem] text-zinc-400">
                سيظهر أيضاً تلقائياً عند فتح التطبيق لاحقاً
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="magic" icon={<RefreshCw className="size-3.5" />} onClick={applyWebOtaNow}>
              تطبيق الآن
            </Button>
            <button
              type="button"
              onClick={() => setWebBanner(null)}
              aria-label="إغلاق"
              className="grid size-7 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* نافذة إشعار وتثبيت تحديث APK الجديد */}
      <Modal
        open={Boolean(apkPrompt?.open)}
        onClose={dismissApk}
        labelledBy="apk-update-title"
        size="sm"
      >
        {apkPrompt && (
          <>
            <ModalHeader
              id="apk-update-title"
              icon={<Sparkles />}
              title={`يتوفر تحديث جديد للتطبيق (${apkPrompt.apk.versionName})`}
              subtitle={`نسختك الحالية: ${apkPrompt.currentVersionName} ➔ الجديدة: ${apkPrompt.apk.versionName}`}
              onClose={dismissApk}
            />
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              {apkPrompt.apk.notes && (
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-3.5 text-[0.82rem] leading-relaxed text-zinc-800 dark:text-zinc-200">
                  <div className="mb-1 text-[0.74rem] font-bold text-zinc-500 dark:text-zinc-400">
                    ما الجديد في هذا التحديث:
                  </div>
                  <p className="whitespace-pre-line">{apkPrompt.apk.notes}</p>
                </div>
              )}

              {apkPrompt.stage === 'downloading' && (
                <div className="flex flex-col gap-2 rounded-2xl border border-black/10 dark:border-white/10 p-3.5">
                  <div className="flex items-center justify-between text-[0.8rem] font-bold">
                    <span>جاري تحميل التحديث...</span>
                    <span className="font-mono tabular-nums">
                      {apkPrompt.progress.percent >= 0 ? `${apkPrompt.progress.percent}%` : '...'}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-zinc-900 dark:bg-white transition-all duration-200"
                      style={{
                        width: `${Math.max(4, apkPrompt.progress.percent > 0 ? apkPrompt.progress.percent : 15)}%`,
                      }}
                    />
                  </div>
                  {apkPrompt.progress.totalBytes > 0 && (
                    <div className="text-[0.72rem] text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {formatMb(apkPrompt.progress.downloadedBytes)} / {formatMb(apkPrompt.progress.totalBytes)}
                    </div>
                  )}
                </div>
              )}

              {apkPrompt.stage === 'needs_permission' && (
                <div className="flex gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-[0.8rem] leading-relaxed text-amber-900 dark:text-amber-200">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <div className="font-bold">مطلوب السماح بالتثبيت لمرة واحدة</div>
                    <p className="mt-0.5">
                      من شاشة الإعدادات المفتوحة أمامك، فعّل خيار <strong>«السماح من هذا المصدر»</strong> ثم ارجع للتطبيق واضغط «متابعة التثبيت».
                    </p>
                  </div>
                </div>
              )}

              {apkPrompt.stage === 'installing' && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-[0.82rem] font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-5 shrink-0" />
                  <span>تم تنزيل التحديث بنجاح وفتح شاشة التثبيت.</span>
                </div>
              )}

              {apkPrompt.stage === 'error' && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-[0.8rem] text-red-700 dark:text-red-300">
                  {apkPrompt.errorMsg || 'حدث خطأ أثناء تحميل ملف التحديث.'}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {apkPrompt.stage === 'needs_permission' ? (
                  <Button variant="magic" size="lg" block icon={<Download className="size-4.5" />} onClick={retryApkInstall}>
                    متابعة تثبيت التحديث
                  </Button>
                ) : (
                  <Button
                    variant="magic"
                    size="lg"
                    block
                    loading={apkPrompt.stage === 'downloading'}
                    icon={<Download className="size-4.5" />}
                    onClick={startApkDownload}
                  >
                    {apkPrompt.stage === 'downloading'
                      ? 'جاري التنزيل...'
                      : apkPrompt.stage === 'installing'
                        ? 'إعادة فتح نافذة التثبيت'
                        : 'تحميل وتثبيت التحديث الآن'}
                  </Button>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <a
                    href={apkPrompt.apk.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[0.76rem] font-semibold text-zinc-600 dark:text-zinc-400 hover:underline"
                  >
                    <ExternalLink className="size-3.5" /> التحميل عبر المتصفح
                  </a>
                  {!apkPrompt.apk.mandatory && apkPrompt.stage !== 'downloading' && (
                    <button
                      type="button"
                      onClick={dismissApk}
                      className="text-[0.78rem] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                    >
                      تذكيري لاحقاً
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
