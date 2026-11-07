import { useState } from 'react';
import { Download, ExternalLink, Play, Sparkles, Video } from 'lucide-react';
import { Modal, ModalHeader } from '../ui/Modal';
import { useUI } from '../../state/UIContext';
import { LINKS } from '../../data/defaults';

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function VideoModal() {
  const { videoOpen, setVideoOpen } = useUI();
  const [source, setSource] = useState<'local' | 'youtube'>('local');
  const close = () => setVideoOpen(false);

  return (
    <Modal open={videoOpen} onClose={close} labelledBy="video-title" size="lg">
      <ModalHeader
        id="video-title"
        icon={<Video />}
        title="شرح شامل: كيف تنجز وتنسّق بحثك في دقائق؟"
        subtitle="دليل مصوّر خطوة بخطوة بالدارجة الجزائرية من صفحة الغلاف حتى تحميل Word و PDF"
        onClose={close}
      />
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {/* مشغل الفيديو بجودة عالية 1080p ومقاس 16:9 */}
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-950 border border-black/10 dark:border-white/10 shadow-lg">
          {source === 'local' ? (
            <video
              key="local-video"
              src="/bahtak_tutorial.mp4"
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="size-full object-contain"
            >
              <track src="/subtitles.srt" kind="subtitles" srcLang="ar" label="العربية (الدارجة)" default />
              متصفحك لا يدعم تشغيل الفيديو المباشر.
            </video>
          ) : (
            <iframe
              src="https://www.youtube.com/embed/uXaSKzTdk1s?autoplay=1&playsinline=1&rel=0"
              title="فيديو شرح تطبيق بحثك"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="size-full"
            />
          )}
        </div>

        {/* أزرار التحميل والتبديل */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <a
              href="/bahtak_tutorial.mp4"
              download="bahtak_tutorial_official.mp4"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 px-4 py-2.5 text-[0.82rem] font-bold shadow-sm transition hover:opacity-90 cursor-pointer"
            >
              <Download className="size-4" />
              تحميل الفيديو بجودة عالية (MP4)
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSource((s) => (s === 'local' ? 'youtube' : 'local'))}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-[0.8rem] font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-black/10 cursor-pointer"
            >
              {source === 'local' ? (
                <>
                  <YoutubeIcon className="size-4 text-red-500" />
                  المشاهدة على YouTube
                </>
              ) : (
                <>
                  <Sparkles className="size-4 text-emerald-500" />
                  مشاهدة الفيديو المباشر (1080p)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
