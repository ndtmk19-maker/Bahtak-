import { useRef } from 'react';
import { Building2, ImageUp, Landmark, Palette, ScrollText, Users, X } from 'lucide-react';
import { PanelShell } from './PanelShell';
import { Button } from '../ui/Button';
import { ChoiceCards, Segmented, Switch } from '../ui/Controls';
import { SelectInput, TextArea, TextInput } from '../ui/Form';
import { Note, Section, ToggleRow } from '../ui/Section';
import { useDocument } from '../../state/DocumentContext';
import { useUI } from '../../state/UIContext';
import { ALGERIAN_WILAYAS } from '../../data/universities';
import { imageToDataUrl, readFileAsDataUrl } from '../../lib/image';
import type { CoverTheme, LogoPosition, LogoSize } from '../../types';

export function CoverPanel() {
  const { doc, updateCover, updateCoverWith, updatePlan } = useDocument();
  const { toast } = useUI();
  const cs = doc.coverState;
  const fileRef = useRef<HTMLInputElement>(null);
  const wilaya = ALGERIAN_WILAYAS.find((w) => w.id === cs.selectedWilaya);

  const clearLogo = () => updateCover({ logoUrl: '', logoBase64: '', selectedUnivId: '' });

  const onWilaya = (id: string) => updateCover({ selectedWilaya: id, selectedUnivId: '', logoUrl: '', logoBase64: '' });

  const onUniversity = (id: string) => {
    if (!id || !wilaya) return clearLogo();
    const u = wilaya.universities.find((x) => x.id === id);
    if (!u) return;
    updateCover({ selectedUnivId: id, universityName: u.name, logoUrl: u.logo, logoBase64: '' });
    // تحويل الشعار إلى Base64 في الخلفية لدعم تصدير Word
    if (u.logo) {
      // نتحقق من أحدث حالة أن المستخدم لم يغيّر الجامعة أثناء التحويل
      imageToDataUrl(u.logo).then((b64) => updateCoverWith((c) => (c.selectedUnivId === id ? { logoBase64: b64 } : {})));
    }
  };

  const onUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('الملف المختار ليس صورة.', { tone: 'error' });
    const dataUrl = await readFileAsDataUrl(file);
    updateCover({ logoUrl: dataUrl, logoBase64: dataUrl, selectedUnivId: 'custom' });
    toast('تم تحميل وتفعيل الشعار المخصص');
  };

  const univName = cs.selectedUnivId === 'custom' ? 'شعار مخصص من جهازك' : wilaya?.universities.find((u) => u.id === cs.selectedUnivId)?.name || cs.universityName || 'شعار الجامعة';

  return (
    <PanelShell id="cover">
      <ToggleRow title="تفعيل صفحة الغلاف الرسمية" description="تظهر كأول صفحة للبحث بإطار أكاديمي معتمد" control={<Switch label="تفعيل صفحة الغلاف" checked={cs.enabled} onChange={(v) => updateCover({ enabled: v })} />} />

      <div className={`flex flex-col gap-3.5 transition-opacity ${cs.enabled ? '' : 'pointer-events-none opacity-45'}`} aria-disabled={!cs.enabled}>
        <Section title="مظهر الغلاف" icon={<Palette />}>
          <ChoiceCards<CoverTheme>
            label="ثيم الغلاف"
            value={cs.theme}
            onChange={(v) => updateCover({ theme: v })}
            options={[
              { value: 'black', title: 'أسود كلاسيكي رسمي', desc: 'إطار مزدوج وخط أسود', preview: <ThemeSwatch frame="#111" title="#111" /> },
              { value: 'gold', title: 'ذهبي ملكي فاخر', desc: 'إطار ذهبي وعناوين كحلية', preview: <ThemeSwatch frame="#c5a059" title="#0f2952" /> },
            ]}
          />
        </Section>

        <Section title="شعار الجامعة" icon={<Landmark />} description="اختر ولايتك ثم جامعتك ليظهر الشعار الرسمي في ترويسة الغلاف.">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput label="1. الولاية" value={cs.selectedWilaya} onChange={(e) => onWilaya(e.target.value)}>
              <option value="">— اختر الولاية —</option>
              {ALGERIAN_WILAYAS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </SelectInput>
            <SelectInput label="2. الجامعة / المدرسة العليا" value={cs.selectedUnivId === 'custom' ? '' : cs.selectedUnivId} onChange={(e) => onUniversity(e.target.value)} disabled={!wilaya}>
              <option value="">{wilaya ? '— اختر المؤسسة —' : '— اختر الولاية أولاً —'}</option>
              {wilaya?.universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.logo.includes('MESRS.png') ? ' (شعار الوزارة)' : ''}
                </option>
              ))}
            </SelectInput>
          </div>

          {cs.logoUrl ? (
            <div className="flex animate-rise items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
              <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-white dark:bg-zinc-800 p-1 shadow-card border border-black/10 dark:border-white/10">
                <img src={cs.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.82rem] font-bold text-zinc-900 dark:text-zinc-100">{univName}</div>
                <div className="text-[0.72rem] font-semibold text-ok">الشعار مفعّل في ترويسة الغلاف</div>
              </div>
              <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={clearLogo}>
                إزالة
              </Button>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[0.8rem] font-semibold text-zinc-800 dark:text-zinc-200">موضع الشعار</span>
              <Segmented<LogoPosition>
                label="موضع الشعار"
                size="sm"
                value={cs.logoPosition}
                onChange={(v) => updateCover({ logoPosition: v })}
                options={[
                  { value: 'both', label: 'الجانبين' },
                  { value: 'right', label: 'يمين' },
                  { value: 'left', label: 'يسار' },
                ]}
              />
            </div>
            <SelectInput label="حجم الشعار" value={cs.logoSize} onChange={(e) => updateCover({ logoSize: e.target.value as LogoSize })}>
              <option value="large">كبير وبارز (38mm - موصى به)</option>
              <option value="xlarge">عريض جداً (46mm)</option>
              <option value="medium">قياسي (32mm)</option>
              <option value="compact">مدمج صغير (26mm)</option>
            </SelectInput>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-black/15 dark:border-white/15 px-3 py-2.5">
            <span className="text-[0.78rem] text-zinc-600 dark:text-zinc-400">شعار كليتك مخصص أو غير مدرج؟</span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
            <Button size="sm" variant="secondary" icon={<ImageUp className="size-3.5" />} onClick={() => fileRef.current?.click()}>
              رفع شعار من جهازك
            </Button>
          </div>
        </Section>

        <Section title="بيانات الهيئة والكلية" icon={<Building2 />}>
          <TextInput label="الدولة والجمهورية" value={cs.country} onChange={(e) => updateCover({ country: e.target.value })} />
          <TextInput label="الوزارة الوصية" value={cs.ministry} onChange={(e) => updateCover({ ministry: e.target.value })} />
          <TextInput label="اسم الجامعة" hint="يُحدَّث تلقائياً عند اختيار الجامعة، ويمكنك تعديله." value={cs.universityName} placeholder="مثال: جامعة الجزائر 1 - بن يوسف بن خدة" onChange={(e) => updateCover({ universityName: e.target.value })} />
          <TextInput label="الكلية / المعهد / القسم (اختياري)" value={cs.facultyName} placeholder="مثال: كلية الحقوق والعلوم السياسية - قسم القانون العام" onChange={(e) => updateCover({ facultyName: e.target.value })} />
          <TextInput label="نوع العمل الأكاديمي" value={cs.workType} placeholder="بحث أكاديمي حول / بطاقة قراءة في مقياس..." onChange={(e) => updateCover({ workType: e.target.value })} />
        </Section>

        <Section title="موضوع وعنوان البحث" icon={<ScrollText />}>
          <Note>يُمرَّر العنوان تلقائياً إلى صفحة خطة البحث أيضاً.</Note>
          <TextInput
            label="عنوان البحث الرئيسي"
            value={cs.title}
            placeholder="اكتب عنوان البحث الرئيسي..."
            className="font-serif text-base font-bold"
            onChange={(e) => {
              updateCover({ title: e.target.value });
              if (e.target.value) updatePlan({ researchTitle: e.target.value });
            }}
          />
          <TextInput label="العنوان الفرعي (اختياري)" value={cs.subtitle} placeholder="اكتب العنوان الفرعي إن وجد..." onChange={(e) => updateCover({ subtitle: e.target.value })} />
        </Section>

        <Section title="فريق العمل والإشراف" icon={<Users />}>
          <TextArea label="إعداد الطلبة" hint="كل طالب في سطر مستقل." rows={3} value={cs.studentsText} onChange={(e) => updateCover({ studentsText: e.target.value })} placeholder="الطالب: الاسم واللقب..." />
          <TextInput label="تحت إشراف الأستاذ(ة)" value={cs.supervisor} onChange={(e) => updateCover({ supervisor: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="الفوج / الفصيلة" value={cs.group} onChange={(e) => updateCover({ group: e.target.value })} />
            <TextInput label="السنة الجامعية" value={cs.academicYear} onChange={(e) => updateCover({ academicYear: e.target.value })} />
          </div>
        </Section>
      </div>
    </PanelShell>
  );
}

function ThemeSwatch({ frame, title }: { frame: string; title: string }) {
  return (
    <span className="block rounded-md bg-white p-1.5 shadow-[inset_0_0_0_1px_#eee]">
      <span className="flex h-16 flex-col items-center justify-center gap-1 rounded-[3px] p-1" style={{ boxShadow: `inset 0 0 0 1px ${frame}, inset 0 0 0 3px #fff, inset 0 0 0 4.5px ${frame}` }}>
        <span className="h-1 w-8 rounded-full" style={{ background: title }} />
        <span className="h-1.5 w-12 rounded-full" style={{ background: title }} />
        <span className="h-0.5 w-6 rounded-full" style={{ background: frame }} />
      </span>
    </span>
  );
}

