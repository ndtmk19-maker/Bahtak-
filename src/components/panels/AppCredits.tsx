import { useRef } from 'react';
import { Download } from 'lucide-react';
import { AndroidIcon, InstagramIcon } from '../ui/BrandIcons';
import { LINKS } from '../../data/defaults';
import { useUI } from '../../state/UIContext';

/** بطاقة تطبيق الأندرويد وحقوق المطور بتصميم متناسق مع الهوية البصرية الفاخرة */
export function AppCredits() {
  const { setAdminModalOpen } = useUI();
  const clicksRef = useRef(0);

  const handleIconClick = () => {
    clicksRef.current += 1;
    if (clicksRef.current >= 5) {
      clicksRef.current = 0;
      setAdminModalOpen(true);
    }
    setTimeout(() => {
      clicksRef.current = 0;
    }, 1500);
  };
  return (
    <div className="mt-3 grid gap-3">
      <a
        href={LINKS.apk}
        download="Bahtak.apk"
        className="group relative overflow-hidden flex items-center gap-3.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 p-4 shadow-sm backdrop-blur-md transition hover:border-black/25 dark:hover:border-white/25 hover:shadow-md"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm transition group-hover:scale-105">
          <AndroidIcon className="size-5.5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[0.88rem] font-bold text-zinc-900 dark:text-white">تطبيق الأندرويد الرسمي (APK)</span>
          <span className="block text-[0.74rem] leading-relaxed text-zinc-600 dark:text-zinc-400">نسخة الهواتف كاملة وسريعة مع شريط تنقل سفلي وحفظ كامل للبحوث</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 dark:bg-white px-3.5 py-2 text-[0.76rem] font-bold text-white dark:text-zinc-900 transition group-hover:scale-105 shadow-sm">
          <Download className="size-3.5" />
          تحميل
        </span>
      </a>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-1.5 py-2 text-[0.75rem] text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-2.5">
          <img
            src="/app_icon.png"
            alt="Bahtak Logo"
            width={32}
            height={32}
            onClick={handleIconClick}
            className="size-8 shrink-0 rounded-lg object-contain shadow-xs border border-black/10 dark:border-white/10 cursor-pointer select-none"
            title="Bahtak"
          />
          <div className="leading-relaxed">
            <div className="font-bold text-zinc-900 dark:text-white">Bahtak — بحثك</div>
            <div>هذا التطبيق من عمل : mk.abdouuu · جميع الحقوق محفوظة © 2026</div>
          </div>
        </div>
        <a
          href={LINKS.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-3.5 py-1.5 font-semibold text-zinc-800 dark:text-zinc-200 transition hover:border-black/25 hover:bg-black/5 dark:hover:bg-white/10"
          dir="ltr"
        >
          <InstagramIcon className="size-3.5" />
          {LINKS.instagramHandle}
        </a>
      </div>
    </div>
  );
}
