import { ExternalLink, Video } from 'lucide-react';
import { Modal, ModalHeader } from '../ui/Modal';
import { useUI } from '../../state/UIContext';
import { LINKS } from '../../data/defaults';

function youTubeId(url: string): string {
  const m = url.match(/(?:shorts\/|youtu\.be\/|[?&]v=|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : /^[a-zA-Z0-9_-]{11}$/.test(url) ? url : '';
}

export function VideoModal() {
  const { videoOpen, setVideoOpen } = useUI();
  const id = youTubeId(LINKS.tutorialVideo);
  const close = () => setVideoOpen(false);
  return (
    <Modal open={videoOpen} onClose={close} labelledBy="video-title" size="sm">
      <ModalHeader id="video-title" icon={<Video />} title="شرح استخدام «بحثك»" subtitle="خطوات التنسيق الذكي وتوليد الصفحات" onClose={close} />
      <div className="flex flex-col gap-3 p-4">
        <div className="mx-auto aspect-[9/16] max-h-[62dvh] w-full overflow-hidden rounded-2xl bg-ink">
          {/* المصدر يُحمَّل فقط عند فتح النافذة، وإغلاقها يزيل الإطار فيتوقف الصوت فوراً */}
          <iframe
            src={`https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0`}
            title="فيديو شرح طريقة استخدام وتنسيق البحوث في تطبيق بحثك"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="size-full"
          />
        </div>
        <a
          href={LINKS.tutorialVideo}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-800/80 py-2.5 text-[0.82rem] font-semibold text-zinc-800 dark:text-zinc-200 transition hover:border-[#f0b4b4] hover:text-[#c4302b]"
        >
          فتح الفيديو على YouTube مباشرة <ExternalLink className="size-3.5" />
        </a>
      </div>
    </Modal>
  );
}
