import { Columns2, FileText, Frame, IdCard, RotateCcw, Type } from 'lucide-react';
import { PanelShell } from './PanelShell';
import { AppCredits } from './AppCredits';
import { Button } from '../ui/Button';
import { ChoiceCards, Segmented } from '../ui/Controls';
import { TextInput } from '../ui/Form';
import { Section } from '../ui/Section';
import { useDocument } from '../../state/DocumentContext';
import { useResetApp } from '../../state/useResetApp';
import type { BorderStyle, LayoutMode } from '../../types';

const FONTS = [
  { value: "'Amiri', serif", title: 'الأميري', desc: 'Amiri — الموصى به رسمياً', family: 'Amiri' },
  { value: "'Cairo', sans-serif", title: 'القاهرة', desc: 'Cairo — عصري', family: 'Cairo' },
  { value: "'Tajawal', sans-serif", title: 'تجوال', desc: 'Tajawal — هادئ', family: 'Tajawal' },
];

export function StylePanel() {
  const { doc, update } = useDocument();
  const resetApp = useResetApp();
  const font = FONTS.find((f) => f.value === doc.fontFamily) || FONTS[0];

  return (
    <PanelShell id="style">
      <Section title="الخطوط وتنسيق النصوص" icon={<Type />}>
        <ChoiceCards
          label="خط المتن"
          cols={3}
          value={doc.fontFamily}
          onChange={(v) => update({ fontFamily: v })}
          options={FONTS.map((f) => ({
            value: f.value,
            title: f.title,
            desc: f.desc,
            preview: (
              <span className="block rounded-lg bg-black/[0.04] dark:bg-white/[0.06] py-2 text-center text-[1.35rem] leading-none text-zinc-900 dark:text-white" style={{ fontFamily: f.value }}>
                بحث
              </span>
            ),
          }))}
        />

        <Range label="حجم خط الفقرات" value={doc.fontSize} min={10} max={15} step={0.1} display={`${doc.fontSize}pt`} onChange={(v) => update({ fontSize: v })} />
        <Range label="تباعد الأسطر" value={doc.lineHeight} min={1.3} max={2} step={0.02} display={doc.lineHeight.toFixed(2)} onChange={(v) => update({ lineHeight: v })} />

        <figure className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xs">
          <figcaption className="flex items-center justify-between border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] px-3.5 py-2 text-[0.7rem] font-semibold text-zinc-500 dark:text-zinc-400">
            <span>معاينة حية</span>
            <span className="tabular-nums">
              {font.title} | {doc.fontSize}pt | سطر {doc.lineHeight.toFixed(2)}
            </span>
          </figcaption>
          <p className="bg-white dark:bg-zinc-900/60 px-4 py-3 text-justify text-zinc-900 dark:text-zinc-100" style={{ fontFamily: doc.fontFamily, fontSize: `${doc.fontSize}pt`, lineHeight: doc.lineHeight, textIndent: '8mm' }}>
            تعتبر تكنولوجيا المعلومات والاتصال من أهم الركائز التي تقوم عليها المجتمعات المعاصرة، حيث ساهمت في إحداث ثورة علمية وتقنية غير مسبوقة.
          </p>
        </figure>
      </Section>

      <Section title="إطار صفحات المحتوى" icon={<Frame />}>
        <ChoiceCards<BorderStyle>
          label="نمط الإطار"
          cols={4}
          value={doc.borderStyle}
          onChange={(v) => update({ borderStyle: v })}
          options={[
            { value: 'double', title: 'مزدوج أنيق', preview: <FrameSwatch shadow="inset 0 0 0 1px #222, inset 0 0 0 3px #fff, inset 0 0 0 5px #222" /> },
            { value: 'gold', title: 'ذهبي ملكي', preview: <FrameSwatch shadow="inset 0 0 0 1px #c5a059, inset 0 0 0 3px #fff, inset 0 0 0 4.5px #c5a059" /> },
            { value: 'single', title: 'بسيط مفرد', preview: <FrameSwatch shadow="inset 0 0 0 1.5px #222" /> },
            { value: 'none', title: 'بدون إطار', preview: <FrameSwatch shadow="inset 0 0 0 1px #eee" /> },
          ]}
        />
      </Section>

      <Section title="نمط العرض وترويسة الطالب" icon={<FileText />}>
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-semibold text-zinc-800 dark:text-zinc-200">التخطيط العام</span>
          <Segmented<LayoutMode>
            label="نمط التخطيط"
            value={doc.layoutMode}
            onChange={(v) => update({ layoutMode: v })}
            options={[
              { value: 'research', label: 'بحث كامل (عمود واحد)', icon: <FileText className="size-3.5 text-zinc-600 dark:text-zinc-400" /> },
              { value: 'card', label: 'بطاقة قراءة (عمودان)', icon: <Columns2 className="size-3.5 text-zinc-600 dark:text-zinc-400" /> },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-semibold text-zinc-800 dark:text-zinc-200">شريط معلومات الطالب أعلى صفحات المحتوى</span>
          <Segmented
            label="شريط معلومات الطالب"
            value={doc.showStudentInfo ? 'show' : 'hide'}
            onChange={(v) => update({ showStudentInfo: v === 'show' })}
            options={[
              { value: 'hide', label: 'إخفاء (بحث جامعي رسمي)' },
              { value: 'show', label: 'إظهار (بطاقة قراءة)', icon: <IdCard className="size-3.5 text-zinc-600 dark:text-zinc-400" /> },
            ]}
          />
        </div>
        {doc.showStudentInfo && (
          <div className="grid animate-rise grid-cols-[1fr_6rem] gap-3">
            <TextInput label="اسم الطالب واللقب" value={doc.studentName} onChange={(e) => update({ studentName: e.target.value })} />
            <TextInput label="الفوج" value={doc.studentFawj} onChange={(e) => update({ studentFawj: e.target.value })} />
          </div>
        )}
      </Section>

      <Section title="بدء بحث جديد" icon={<RotateCcw />} description="يحفظ التطبيق بحثك تلقائياً في هذا المتصفح لمنع ضياع مجهودك. إعادة التعيين تمسح المحتوى المحفوظ وتبدأ ببحث فارغ.">
        <Button variant="secondary" block icon={<RotateCcw className="size-4" />} onClick={resetApp} className="!text-red-600 dark:!text-red-400 !border-red-500/20 hover:!bg-red-500/10">
          إعادة تعيين التطبيق ومسح البيانات المحفوظة
        </Button>
      </Section>

      <AppCredits />
    </PanelShell>
  );
}

function Range({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between">
        <span className="text-[0.8rem] font-semibold text-zinc-800 dark:text-zinc-200">{label}</span>
        <span className="rounded-md border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 font-mono text-[0.74rem] font-bold text-zinc-900 dark:text-white tabular-nums">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full cursor-pointer" />
    </label>
  );
}

function FrameSwatch({ shadow }: { shadow: string }) {
  return (
    <span className="block rounded-lg bg-black/[0.03] dark:bg-white/[0.04] p-2">
      <span className="mx-auto block h-12 w-9 rounded-[2px] bg-white dark:bg-zinc-800 p-1.5" style={{ boxShadow: shadow }}>
        <span className="mb-1 block h-0.5 w-full bg-zinc-300 dark:bg-zinc-600" />
        <span className="mb-1 block h-0.5 w-4/5 bg-zinc-300 dark:bg-zinc-600" />
        <span className="block h-0.5 w-full bg-zinc-300 dark:bg-zinc-600" />
      </span>
    </span>
  );
}
