import { useEffect } from 'react';
import { ArrowUpLeft, LayoutTemplate, Presentation, ListChecks } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useUI } from '../../state/UIContext';
import { LINKS } from '../../data/defaults';
import { session } from '../../lib/storage';

const SEEN_KEY = 'charihatek_ad_seen';

/** نافذة تعريف بمنصة «شريحتك» الشريكة — تظهر مرة واحدة في كل جلسة */
export function PartnerModal() {
  const { partnerOpen, setPartnerOpen } = useUI();

  useEffect(() => {
    if (session.get(SEEN_KEY) === 'true') return;
    const t = setTimeout(() => setPartnerOpen(true), 1200);
    return () => clearTimeout(t);
  }, [setPartnerOpen]);

  const close = () => {
    session.set(SEEN_KEY, 'true');
    setPartnerOpen(false);
  };

  const features = [
    { icon: <Presentation />, title: 'عروض جاهزة للمناقشة', body: 'حوّل مذكرتك أو بحثك إلى شرائح عرض بضغطة زر.' },
    { icon: <LayoutTemplate />, title: '18 قالباً ونمطاً بصرياً', body: 'مصممة وفق معايير الجامعات ومطابقة لتخصصك.' },
    { icon: <ListChecks />, title: 'منهجية PPT-Master', body: 'تنظيم متقن للمقدمة، الإشكالية، الفصول، والخاتمة.' },
  ];

  return (
    <Modal open={partnerOpen} onClose={close} labelledBy="partner-title" size="sm">
      <div className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(192,38,211,0.18),rgba(116,68,242,0.12)_45%,transparent_75%)]" />
        <button type="button" onClick={close} aria-label="إغلاق" className="absolute top-3 left-3 z-10 grid size-9 place-items-center rounded-full text-zinc-500 dark:text-zinc-400 transition hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-950 dark:hover:text-white cursor-pointer">
          ✕
        </button>
        <div className="relative flex flex-col items-center px-6 pt-8 pb-6 text-center">
          <div className="relative">
            <img src="/charihatek_logo.png" alt="شريحتك" width={72} height={72} className="size-18 rounded-2xl shadow-sm grayscale opacity-90" />
            <span className="absolute -top-2 -left-3 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 px-2 py-0.5 text-[0.65rem] font-bold shadow-xs">جديد</span>
          </div>
          <div className="mt-4 text-[0.72rem] font-bold tracking-wide text-zinc-600 dark:text-zinc-400">منصة أكاديمية شريكة لـ «بحثك»</div>
          <h2 id="partner-title" className="mt-1 font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            منصة «شريحتك» الذكية
          </h2>
          <p className="mt-1 text-[0.84rem] text-zinc-600 dark:text-zinc-400">لتوليد وتصميم عروض PowerPoint بالذكاء الاصطناعي</p>

          <ul className="mt-5 flex w-full flex-col gap-2 text-right">
            {features.map((f) => (
              <li key={f.title} className="flex gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-850/80 p-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs [&>svg]:size-4">{f.icon}</span>
                <span className="text-[0.8rem] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <strong className="block text-zinc-900 dark:text-zinc-100">{f.title}</strong>
                  {f.body}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex w-full flex-col gap-2">
            <a
              href={LINKS.charihatek}
              target="_blank"
              rel="noopener"
              onClick={close}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(120deg,var(--color-brand-600),var(--color-brand-500)_55%,var(--color-magenta))] text-[0.9rem] font-bold text-white shadow-[0_6px_20px_-6px_rgba(91,46,224,0.6)] transition hover:brightness-110"
            >
              الانتقال إلى «شريحتك» مجاناً <ArrowUpLeft className="size-4" />
            </a>
            <button type="button" data-autofocus onClick={close} className="h-10 rounded-xl text-[0.84rem] font-semibold text-zinc-500 dark:text-zinc-400 transition hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-950 dark:hover:text-white cursor-pointer">
              المتابعة إلى بحثك
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
