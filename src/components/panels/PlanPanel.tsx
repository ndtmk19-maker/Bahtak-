import { useState } from 'react';
import { Eraser, Hash, LayoutTemplate, ListOrdered, ListTree, Plus, RefreshCw, Settings2, Zap } from 'lucide-react';
import { PanelShell } from './PanelShell';
import { Button } from '../ui/Button';
import { Chip, Segmented, Switch } from '../ui/Controls';
import { TextInput } from '../ui/Form';
import { Section, ToggleRow } from '../ui/Section';
import { useDocument } from '../../state/DocumentContext';
import { useUI } from '../../state/UIContext';
import { PLAN_TEMPLATES, type PlanTemplateName } from '../../data/defaults';
import { addCustomPlanItem, autoFixPlanPageNumbers, generatePlanFromPages, parsePlanRows, quickInsertPlanItem } from '../../lib/plan';
import type { PlanItemType } from '../../types';

const QUICK: { type: PlanItemType; label: string }[] = [
  { type: 'intro', label: 'مقدمة' },
  { type: 'mabhath', label: 'مبحث رئيسي' },
  { type: 'matlab', label: 'مطلب فرعي' },
  { type: 'conclusion', label: 'خاتمة' },
  { type: 'references', label: 'مراجع' },
];

const TEMPLATES: { id: PlanTemplateName; label: string; desc: string }[] = [
  { id: 'standard', label: '3 مباحث × 3 مطالب', desc: 'خطة نموذجية' },
  { id: 'twosections', label: 'مبحثان × مطلبان', desc: 'خطة قصيرة' },
  { id: 'readingcard', label: 'بطاقة قراءة', desc: 'محاور الكتاب' },
];

export function PlanPanel() {
  const { doc, updatePlan } = useDocument();
  const { confirm, toast } = useUI();
  const ps = doc.planState;
  const [custom, setCustom] = useState<{ type: PlanItemType; title: string; page: string }>({ type: 'mabhath', title: '', page: '' });
  const rows = parsePlanRows(ps.itemsText);
  const setItems = (itemsText: string) => updatePlan({ itemsText });

  const fromPages = () => {
    if (!doc.pages.length) return toast('لا توجد صفحات حالية لاستخراج الخطة منها.', { tone: 'error' });
    const text = generatePlanFromPages(doc.pages);
    if (!text) return toast('لم يتم العثور على عناوين مباحث أو مطالب في الصفحات الحالية.', { tone: 'error' });
    setItems(text);
    toast('تم توليد الخطة من صفحات البحث الحالية', { description: `${text.split('\n').length} عنصراً مع أرقام صفحاتها الفعلية.` });
  };

  const addCustom = () => {
    setItems(addCustomPlanItem(ps.itemsText, custom.type, custom.title, custom.page));
    setCustom((c) => ({ ...c, title: '', page: '' }));
  };

  return (
    <PanelShell id="plan">
      <ToggleRow
        title="تفعيل صفحة خطة البحث"
        description="تظهر بعد الغلاف مباشرة بشجرة المباحث والمطالب ونقاط التوصيل"
        control={<Switch label="تفعيل صفحة الخطة" checked={ps.enabled} onChange={(v) => updatePlan({ enabled: v })} />}
      />

      <div className={`flex flex-col gap-3.5 transition-opacity ${ps.enabled ? '' : 'pointer-events-none opacity-45'}`} aria-disabled={!ps.enabled}>
        <Section title="إعدادات العرض" icon={<Settings2 />}>
          <TextInput label="عنوان صفحة الخطة" value={ps.pageTitle} onChange={(e) => updatePlan({ pageTitle: e.target.value })} />
          <TextInput label="عنوان البحث العام (أسفل عنوان الخطة)" value={ps.researchTitle} placeholder="عنوان البحث العام..." onChange={(e) => updatePlan({ researchTitle: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <span className="text-[0.8rem] font-semibold text-zinc-800 dark:text-zinc-200">نمط العرض</span>
            <Segmented
              label="نمط أرقام الصفحات"
              value={ps.showPageNumbers ? 'show' : 'hide'}
              onChange={(v) => updatePlan({ showPageNumbers: v === 'show' })}
              options={[
                { value: 'show', label: 'أرقام الصفحات ونقاط التوصيل', icon: <Hash className="size-3.5" /> },
                { value: 'hide', label: 'شجرة عناوين فقط', icon: <ListTree className="size-3.5" /> },
              ]}
            />
          </div>
        </Section>

        <Section
          title="شجرة عناصر البحث"
          icon={<ListTree />}
          description={`${rows.length} عنصراً، منها ${rows.filter((r) => r.isMain).length} رئيسية`}
          actions={
            <>
              <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} title="إعادة الخطة للشكل النموذجي" onClick={() => setItems(PLAN_TEMPLATES.standard)}>
                استعادة
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Eraser className="size-3.5" />}
                title="مسح محتوى الخطة"
                onClick={async () => (await confirm({ title: 'تفريغ عناصر خطة البحث؟', confirmLabel: 'تفريغ', tone: 'danger' })) && setItems('')}
              >
                تفريغ
              </Button>
            </>
          }
        >
          <Button variant="primary" block icon={<Zap className="size-4" />} onClick={fromPages}>
            توليد ومزامنة الخطة آلياً من صفحات البحث
          </Button>

          <div className="flex flex-col gap-2">
            <span className="text-[0.76rem] font-semibold text-zinc-500 dark:text-zinc-400">إضافة سريعة بنقرة</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <Chip key={q.type} icon={<Plus className="size-3" />} onClick={() => setItems(quickInsertPlanItem(ps.itemsText, q.type))}>
                  {q.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-2.5">
            <span className="text-[0.76rem] font-semibold text-zinc-500 dark:text-zinc-400">أو أضف عنصراً مخصصاً مباشرة</span>
            <div className="flex flex-wrap gap-2">
              <select aria-label="نوع العنصر" className="field w-auto flex-none py-2 text-[0.8rem] [color-scheme:dark]" style={{ colorScheme: 'dark' }} value={custom.type} onChange={(e) => setCustom({ ...custom, type: e.target.value as PlanItemType })}>
                <option value="mabhath">مبحث رئيسي</option>
                <option value="matlab">مطلب فرعي</option>
                <option value="intro">مقدمة</option>
                <option value="conclusion">خاتمة</option>
                <option value="references">مصادر ومراجع</option>
              </select>
              <input
                aria-label="عنوان العنصر"
                className="field min-w-[8rem] flex-1 py-2 text-[0.8rem]"
                placeholder="عنوان العنصر..."
                value={custom.title}
                onChange={(e) => setCustom({ ...custom, title: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              />
              <input
                aria-label="رقم الصفحة"
                className="field w-16 flex-none py-2 text-center text-[0.8rem]"
                placeholder="ص 01"
                value={custom.page}
                onChange={(e) => setCustom({ ...custom, page: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              />
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={addCustom}>
                أضف
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-[0.76rem] font-semibold text-zinc-500 dark:text-zinc-400">
              <LayoutTemplate className="size-3.5" /> نماذج جاهزة
            </span>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setItems(PLAN_TEMPLATES[t.id])}
                  className="rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-2 text-center transition hover:border-black/25 dark:hover:border-white/25 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span className="block text-[0.76rem] font-bold text-zinc-900 dark:text-zinc-100">{t.label}</span>
                  <span className="block text-[0.68rem] text-zinc-500 dark:text-zinc-400">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <textarea
              aria-label="نص عناصر الخطة"
              value={ps.itemsText}
              onChange={(e) => setItems(e.target.value)}
              placeholder={'المقدمة | ص 01\nالمبحث الأول: [عنوان المبحث] | ص 02\n- المطلب الأول: [عنوان المطلب] | ص 03'}
              className="field min-h-[240px] font-mono text-[0.8rem] leading-[1.9] scroll-thin"
              spellCheck={false}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.72rem] text-zinc-500 dark:text-zinc-400">
                الصيغة: <code className="rounded border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] px-1 text-zinc-800 dark:text-zinc-200">المبحث | ص 01</code> أو <code className="rounded border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.08] px-1 text-zinc-800 dark:text-zinc-200">- المطلب | ص 02</code>
              </span>
              <Button size="sm" variant="secondary" icon={<ListOrdered className="size-3.5" />} onClick={() => setItems(autoFixPlanPageNumbers(ps.itemsText))}>
                ترقيم تسلسلي
              </Button>
            </div>
          </div>
        </Section>
      </div>
    </PanelShell>
  );
}
