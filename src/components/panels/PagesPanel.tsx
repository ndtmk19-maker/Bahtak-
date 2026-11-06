import { useRef, useState } from 'react';
import { Eye, FilePlus2, FileText, Heading, List, Pilcrow, Quote, Scissors, Sparkle, Superscript, Trash2 } from 'lucide-react';
import { PanelShell } from './PanelShell';
import { Button } from '../ui/Button';
import { Badge, Chip } from '../ui/Controls';
import { Note } from '../ui/Section';
import { useDocument } from '../../state/DocumentContext';
import { useUI } from '../../state/UIContext';
import { pageHtmlToText } from '../../lib/pageText';
import type { ResearchPage } from '../../types';

export type ChipType = 'p' | 'h3' | 'ul' | 'fn' | 'q';
export const SNIPPETS: Record<ChipType, string> = {
  p: '\n\nفقرة جديدة هنا...\n\n',
  h3: '\n# عنوان فرعي جديد\n',
  ul: '\n- نقطة أولى\n- نقطة ثانية\n- نقطة ثالثة\n',
  fn: ' [1] ',
  q: '\n« نص مقتبس بدقة »\n',
};

export function PagesPanel() {
  const { doc, pagesVersion, addPage } = useDocument();
  const lastFocused = useRef<HTMLTextAreaElement | null>(null);

  // إدراج وسم في آخر مربع محتوى تم التركيز عليه (أو أول صفحة)
  const insertGlobal = (type: ChipType) => {
    const target = lastFocused.current?.isConnected ? lastFocused.current : document.querySelector<HTMLTextAreaElement>('[data-page-text]');
    if (target) insertInto(target, SNIPPETS[type]);
  };

  return (
    <PanelShell
      id="pages"
      headerExtra={
        <div className="mt-4 flex items-center justify-between gap-3">
          <Badge tone="brand">
            <FileText className="size-3 text-zinc-600 dark:text-zinc-400" /> {doc.pages.length} صفحة محتوى
          </Badge>
          <Button variant="primary" size="sm" icon={<FilePlus2 className="size-4" />} onClick={addPage}>
            إضافة صفحة جديدة
          </Button>
        </div>
      }
    >
      {doc.pages.length > 0 && (
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 px-3 py-2 backdrop-blur-md shadow-xs">
          <span className="ml-1 text-[0.72rem] font-semibold text-zinc-500 dark:text-zinc-400">إدراج في المربع النشط:</span>
          <Chip icon={<Heading className="size-3 text-zinc-600 dark:text-zinc-400" />} onClick={() => insertGlobal('h3')}>
            عنوان فرعي
          </Chip>
          <Chip icon={<List className="size-3 text-zinc-600 dark:text-zinc-400" />} onClick={() => insertGlobal('ul')}>
            قائمة نقاط
          </Chip>
          <Chip icon={<Superscript className="size-3 text-zinc-600 dark:text-zinc-400" />} onClick={() => insertGlobal('fn')}>
            إحالة [1]
          </Chip>
        </div>
      )}

      {doc.pages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] px-6 py-10 text-center text-[0.85rem] leading-loose text-zinc-500 dark:text-zinc-400">
          لا توجد صفحات محتوى حالياً.
          <br />
          أضف صفحة جديدة للكتابة يدوياً، أو حوّل بحثك تلقائياً من قسم «المحتوى».
        </div>
      ) : (
        doc.pages.map((p, i) => <PageCard key={`${pagesVersion}-${i}`} page={p} index={i} total={doc.pages.length} onFocusText={(el) => (lastFocused.current = el)} />)
      )}

      <Note>
        صيغة المتن: <code className="rounded border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] px-1 text-zinc-800 dark:text-zinc-200">## عنوان مطلب</code> <code className="rounded border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] px-1 text-zinc-800 dark:text-zinc-200"># عنوان فرعي</code> <code className="rounded border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] px-1 text-zinc-800 dark:text-zinc-200">- نقطة</code>{' '}
        <code className="rounded border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] px-1 text-zinc-800 dark:text-zinc-200">^1</code> إحالة. الهوامش: سطر لكل مرجع بالترتيب.
      </Note>
    </PanelShell>
  );
}

export function insertInto(target: HTMLTextAreaElement, text: string) {
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  // استخدام setter الأصلي لإطلاق حدث input في React
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(target, target.value.slice(0, start) + text + target.value.slice(end));
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.focus();
  target.selectionStart = target.selectionEnd = start + text.length;
}

export function PageCard({ page, index, total, onFocusText }: { page: ResearchPage; index: number; total: number; onFocusText: (el: HTMLTextAreaElement) => void }) {
  const { updatePage, setPageText, removePage, splitPage, cleanPage } = useDocument();
  const { confirm, toast, focusPage } = useUI();
  const [text, setText] = useState(() => pageHtmlToText(page.content));
  const [fnText, setFnText] = useState(() => (page.footnotes || []).join('\n'));
  const ref = useRef<HTMLTextAreaElement>(null);

  const chips: { type: ChipType; label: string; icon: React.ReactNode }[] = [
    { type: 'p', label: 'فقرة', icon: <Pilcrow className="size-3 text-zinc-500 dark:text-zinc-400" /> },
    { type: 'h3', label: 'عنوان فرعي', icon: <Heading className="size-3 text-zinc-500 dark:text-zinc-400" /> },
    { type: 'ul', label: 'قائمة', icon: <List className="size-3 text-zinc-500 dark:text-zinc-400" /> },
    { type: 'fn', label: 'إحالة', icon: <Superscript className="size-3 text-zinc-500 dark:text-zinc-400" /> },
    { type: 'q', label: 'اقتباس', icon: <Quote className="size-3 text-zinc-500 dark:text-zinc-400" /> },
  ];

  return (
    <article className="group/card rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 shadow-sm transition focus-within:border-black/30 dark:focus-within:border-white/30 backdrop-blur-md">
      <header className="flex items-center justify-between gap-2 border-b border-black/10 dark:border-white/10 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06] text-[0.76rem] font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
            {index + 1}
          </span>
          <span className="truncate text-[0.8rem] font-semibold text-zinc-800 dark:text-zinc-200">{page.matlabTitle || page.mabhathTitle || 'صفحة تكميلية'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconBtn label="عرض في المعاينة" onClick={() => focusPage(`preview-page-${index}`)}>
            <Eye className="size-4" />
          </IconBtn>
          <IconBtn
            label="تقسيم الصفحة إلى صفحتين"
            onClick={() => {
              if (!splitPage(index)) toast('المحتوى قصير أو فقرة واحدة ولا يحتاج إلى تقسيم.', { tone: 'info' });
              else toast(`تم تقسيم الصفحة ${index + 1} إلى صفحتين متتاليتين`);
            }}
          >
            <Scissors className="size-4" />
          </IconBtn>
          {total > 1 && (
            <IconBtn label="حذف الصفحة" danger onClick={async () => (await confirm({ title: `حذف الصفحة رقم ${index + 1}؟`, confirmLabel: 'حذف', tone: 'danger' })) && removePage(index)}>
              <Trash2 className="size-4" />
            </IconBtn>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3 p-3.5">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[0.72rem] font-semibold text-zinc-500 dark:text-zinc-400">عنوان المبحث (أعلى الصفحة)</span>
            <input className="field py-2 text-[0.82rem]" value={page.mabhathTitle} placeholder="المبحث الأول: الإطار المفاهيمي..." onChange={(e) => updatePage(index, { mabhathTitle: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.72rem] font-semibold text-zinc-500 dark:text-zinc-400">عنوان المطلب أو الفرع</span>
            <input className="field py-2 text-[0.82rem]" value={page.matlabTitle} placeholder="المطلب الأول: مفهوم وأهمية..." onChange={(e) => updatePage(index, { matlabTitle: e.target.value })} />
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            {chips.map((c) => (
              <Chip key={c.type} icon={c.icon} onClick={() => ref.current && insertInto(ref.current, SNIPPETS[c.type])}>
                {c.label}
              </Chip>
            ))}
            <Chip icon={<Sparkle className="size-3 text-zinc-500 dark:text-zinc-400" />} title="إعادة توليد المتن من صيغة نظيفة" onClick={() => cleanPage(index)}>
              تنظيف
            </Chip>
          </div>
          <textarea
            ref={ref}
            data-page-text
            aria-label={`متن الصفحة ${index + 1}`}
            value={text}
            onFocus={(e) => onFocusText(e.currentTarget)}
            onChange={(e) => {
              setText(e.target.value);
              setPageText(index, e.target.value);
            }}
            className="field min-h-[150px] font-serif text-[0.95rem] leading-[1.85] scroll-thin"
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[0.72rem] font-semibold text-zinc-500 dark:text-zinc-400">الهوامش أسفل الصفحة (سطر لكل مرجع)</span>
          <textarea
            className="field min-h-[70px] text-[0.78rem] leading-relaxed scroll-thin"
            value={fnText}
            placeholder="اسم المؤلف، عنوان المرجع، دار النشر، السنة، ص..."
            onChange={(e) => {
              setFnText(e.target.value);
              updatePage(index, { footnotes: e.target.value.split('\n').filter((f) => f.trim() !== '') });
            }}
          />
        </label>
      </div>
    </article>
  );
}

function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-xl border border-transparent transition-all active:scale-90 cursor-pointer ${
        danger
          ? 'text-red-500 hover:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-950/30'
          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:border-black/10 dark:hover:border-white/10 hover:bg-black/5 dark:hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}
