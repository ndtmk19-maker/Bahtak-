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
  const [format, setFormat] = useState<'landscape' | 'reels'>('landscape');
  const close = () => setVideoOpen(false);

  return (
    <Modal open={videoOpen} onClose={close} labelledBy="video-title" size={format === 'reels' ? 'md' : 'lg'}>
      <ModalHeader
        id="video-title"
        icon={<Video />}
        title="شرح شامل: كيف تنجز وتنسّق بحثك في دقائق؟"
        subtitle="دليل مصوّر خطوة بخطوة بالدارجة الجزائرية من صفحة الغلاف حتى تحميل Word و PDF"
        onClose={close}
      />
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {/* اختيار صيغة العرض: شاشة عريضة 16:9 أو ريلز 9:16 */}
        <div className="flex items-center justify-between gap-2 border-b border-black/10 dark:border-white/10 pb-3">
          <div className="flex items-center gap-1.5 rounded-xl bg-black/5 dark:bg-white/5 p-1 text-[0.78rem] font-bold">
            <button
              type="button"
              onClick={() => { setFormat('landscape'); setSource('local'); }}
              className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                format === 'landscape' && source === 'local'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              🖥️ شاشة عريضة (16:9)
            </button>
            <button
              type="button"
              onClick={() => { setFormat('reels'); setSource('local'); }}
              className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                format === 'reels' && source === 'local'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              📱 ريلز إنستغرام (9:16)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSource((s) => (s === 'local' ? 'youtube' : 'local'))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-[0.76rem] font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-black/10 cursor-pointer"
          >
            {source === 'local' ? (
              <>
                <YoutubeIcon className="size-3.5 text-red-500" />
                <span>YouTube</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 text-emerald-500" />
                <span>الفيديو المباشر</span>
              </>
            )}
          </button>
        </div>

        {/* مشغل الفيديو بجودة عالية 1080p */}
        <div className={`relative mx-auto w-full overflow-hidden rounded-2xl bg-zinc-950 border border-black/10 dark:border-white/10 shadow-lg ${
          format === 'reels' && source === 'local' ? 'aspect-[9/16] max-w-[340px]' : 'aspect-video'
        }`}>
          {source === 'local' ? (
            <video
              key={`local-video-${format}`}
              src={format === 'reels' ? '/bahtak_reels_916.mp4' : '/bahtak_tutorial.mp4'}
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

        {/* أزرار التحميل المباشر */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/bahtak_reels_916.mp4"
              download="bahtak_reels_916.mp4"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3.5 py-2 text-[0.78rem] font-bold shadow-sm transition hover:opacity-90 cursor-pointer"
            >
              <Download className="size-3.5" />
              تحميل ريلز إنستغرام (9:16)
            </a>

            <a
              href="/bahtak_tutorial.mp4"
              download="bahtak_tutorial_official.mp4"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-zinc-900 dark:text-white px-3.5 py-2 text-[0.78rem] font-bold shadow-sm transition hover:bg-black/10 cursor-pointer"
            >
              <Download className="size-3.5" />
              تحميل فيديو 16:9 MP4
            </a>
          </div>

          <span className="text-[0.72rem] text-zinc-500 dark:text-zinc-400">
            {format === 'reels' ? '📱 دقة 1080×1920 (Vertical)' : '🖥️ دقة 1920×1080 Full HD'}
          </span>
        </div>
      </div>
    </Modal>
  );
}
