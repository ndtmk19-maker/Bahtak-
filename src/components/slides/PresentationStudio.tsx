import { useEffect, useMemo, useRef, useState } from "react";
import { ALGERIAN_WILAYAS } from "../../data/universities";
import { readFileAsDataUrl } from "../../lib/image";
import {
  ArrowLeftRight,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardPaste,
  Download,
  FileInput,
  FlaskConical,
  GraduationCap,
  ImageUp,
  Landmark,
  ListTree,
  LayoutTemplate,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Palette,
  Presentation,
  Rows3,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge, Chip, Segmented, Switch } from "../ui/Controls";
import { SelectInput, TextArea, TextInput } from "../ui/Form";
import { Note, Section } from "../ui/Section";
import { SlideCanvas } from "./SlideCanvas";
import { usePresentation } from "../../state/PresentationContext";
import { useUI } from "../../state/UIContext";
import { DEMO_RAW_TEXT, QUICK_AI_TOPICS } from "../../data/defaults";
import { SLIDE_THEMES, type Slide, type SlideTheme } from "../../lib/slides";
import { SLIDE_AI_SIZES, type SlideAiSize } from "../../lib/slides/ai";

const KIND_LABEL: Record<Slide["kind"], string> = {
  cover: "الغلاف",
  agenda: "خطة العرض",
  section: "فاصل محور",
  question: "الإشكالية",
  content: "محتوى",
  references: "المراجع",
  closing: "الختام",
};

export function PresentationStudio({ isDesktop }: { isDesktop: boolean }) {
  const [view, setView] = useState<"editor" | "preview">("editor");
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950 lg:flex-row">
      {!isDesktop && (
        <div className="no-print border-b border-black/10 dark:border-white/10 px-4 py-2.5">
          <Segmented
            label="عرض الاستوديو"
            value={view}
            onChange={setView}
            options={[
              { value: "editor", label: "الإعداد والمحتوى", icon: <Wand2 className="size-4" /> },
              {
                value: "preview",
                label: "معاينة الشرائح",
                icon: <Presentation className="size-4" />,
              },
            ]}
          />
        </div>
      )}
      <aside
        aria-label="إعداد العرض التقديمي"
        className={`min-h-0 w-full flex-1 overflow-y-auto lg:flex-none lg:shrink-0 border-l border-black/10 dark:border-white/10 px-4 pt-5 pb-16 scroll-thin sm:px-6 lg:block lg:w-[460px] lg:pt-7 xl:w-[500px] ${isDesktop || view === "editor" ? "block" : "hidden"}`}
      >
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <EditorIntro />
          <MethodPicker />
          <ContentInput />
          <CoverFields />
          <ThemePicker />
          <StructureOptions />
        </div>
      </aside>
      <Stage className={isDesktop || view === "preview" ? "flex" : "hidden"} />
    </div>
  );
}

function EditorIntro() {
  return (
    <div className="animate-rise">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1 text-[0.72rem] font-bold text-zinc-700 dark:text-zinc-300">
        <Presentation className="size-3.5" /> نظام العروض التقديمية
      </span>
      <h1 className="mt-3 font-serif text-[1.65rem] leading-snug font-bold text-zinc-900 dark:text-zinc-100">
        حوّل بحثك إلى عرض PowerPoint
      </h1>
      <p className="mt-1.5 text-[0.86rem] leading-relaxed text-zinc-600 dark:text-zinc-400">
        يعتمد العرض على نفس محرك تحليل البحوث: يتعرف على المقدمة والمباحث والمطالب والخاتمة
        والمراجع، ثم يوزعها على شرائح متوازنة قابلة للتعديل بالكامل.
      </p>
    </div>
  );
}

function MethodPicker() {
  const { mode, setMode } = usePresentation();
  const card = (active: boolean) =>
    `group flex flex-col items-start gap-2 rounded-2xl border p-4 text-right transition-all duration-200 cursor-pointer ${
      active
        ? "border-neutral-900 bg-neutral-100/90 dark:border-white dark:bg-white/10 ring-2 ring-neutral-900/10 dark:ring-white/20"
        : "border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 hover:border-black/25 dark:hover:border-white/25"
    }`;
  return (
    <div role="radiogroup" aria-label="طريقة إنشاء العرض" className="grid grid-cols-2 gap-3">
      <button
        type="button"
        role="radio"
        aria-checked={mode === "draft"}
        onClick={() => setMode("draft")}
        className={card(mode === "draft")}
      >
        <span className="grid size-9 place-items-center rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
          <ClipboardPaste className="size-4.5" />
        </span>
        <span className="text-[0.92rem] font-bold text-neutral-900 dark:text-neutral-100">
          من المسودة
        </span>
        <span className="text-[0.74rem] leading-relaxed text-neutral-600 dark:text-neutral-400">
          الصق محتوى العرض أو استورد مسودة بحثك الحالية.
        </span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "ai"}
        onClick={() => setMode("ai")}
        className={card(mode === "ai")}
      >
        <span className="grid size-9 place-items-center rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
          <Sparkles className="size-4.5" />
        </span>
        <span className="text-[0.92rem] font-bold text-neutral-900 dark:text-neutral-100">
          بالذكاء الاصطناعي
        </span>
        <span className="text-[0.74rem] leading-relaxed text-neutral-600 dark:text-neutral-400">
          اكتب الموضوع ليُولَّد محتوى مركز مناسب للشرائح.
        </span>
      </button>
    </div>
  );
}

function ContentInput() {
  const p = usePresentation();
  const { confirm } = useUI();
  const words = p.draftText.trim() ? p.draftText.trim().split(/\s+/).length : 0;

  if (p.mode === "ai") return <AiFields />;
  return (
    <Section
      title="مسودة العرض"
      icon={<ClipboardPaste />}
      description="نفس صيغة مسودة البحث: المقدمة، المبحث، المطلب، الخاتمة، المراجع، والهوامش ^1."
      actions={
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="size-3.5" />}
          onClick={async () =>
            p.draftText &&
            (await confirm({ title: "مسح مسودة العرض؟", confirmLabel: "مسح" })) &&
            p.setDraftText("")
          }
        >
          مسح
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={<FileInput className="size-3.5" />}
          onClick={p.importFromResearch}
          disabled={!p.hasResearchDraft}
          title={
            p.hasResearchDraft
              ? "استيراد نص البحث الذي أنشأته في قسم البحوث"
              : "لا توجد مسودة بحث محفوظة بعد"
          }
        >
          استيراد مسودة البحث الحالية
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<FlaskConical className="size-3.5" />}
          onClick={() => p.setDraftText(DEMO_RAW_TEXT)}
        >
          نص تجريبي
        </Button>
      </div>
      <textarea
        aria-label="مسودة العرض"
        value={p.draftText}
        onChange={(e) => p.setDraftText(e.target.value)}
        placeholder={
          "عنوان العرض في السطر الأول\n\nالمقدمة:\n...\n\nالمبحث الأول: ...\nالمطلب الأول: ...\n- فكرة رئيسية: شرح موجز\n\nالخاتمة:\n...\n\nقائمة المصادر والمراجع:\n[1] ..."
        }
        className="field min-h-[260px] resize-y font-serif text-[0.95rem] leading-[1.85] scroll-thin"
      />
      <div className="-mt-2 flex items-center justify-between text-[0.72rem] text-zinc-500 dark:text-zinc-400">
        <span>
          {p.deck
            ? `${p.deck.slides.length} شريحة مولدة تلقائياً`
            : "تتحدث المعاينة مباشرة أثناء الكتابة"}
        </span>
        <span className="tabular-nums">{words.toLocaleString("ar")} كلمة</span>
      </div>
      {p.deck && !(p.deck.structure.length === 3 && p.deck.structure.every((n) => n === 3)) && (
        <Note icon={<ListTree />} tone="warn">
          الهيكل المعتمد للعرض: 3 مباحث × 3 مطالب. مسودتك الحالية فيها {p.deck.structure.length}{" "}
          مباحث ({p.deck.structure.map((n) => `${n} مطالب`).join("، ") || "دون مطالب"}). أكمل
          المسودة، أو ولّد العرض بالذكاء الاصطناعي ليُبنى بهذا الهيكل تلقائياً.
        </Note>
      )}
      {p.error && (
        <Note icon={<CircleAlert />} tone="warn">
          {p.error}
        </Note>
      )}
    </Section>
  );
}

function AiFields() {
  const p = usePresentation();
  return (
    <Section
      title="موضوع العرض"
      icon={<BookOpenCheck />}
      description="يُستعمل محرك التوليد الأكاديمي نفسه (خطة ← مقدمة ومباحث وخاتمة بالتوازي) مع توجيه الصياغة لتناسب الشرائح."
    >
      <TextArea
        id="slides-ai-topic"
        label="عنوان أو موضوع العرض"
        value={p.aiTopic}
        onChange={(e) => p.setAiTopic(e.target.value)}
        placeholder="مثال: أثر التحول الرقمي على أداء المؤسسات الجامعية"
        className="min-h-[84px]"
      />
      <div className="-mt-1 flex flex-wrap gap-1.5">
        <span className="ml-1 self-center text-[0.72rem] font-semibold text-zinc-500 dark:text-zinc-400">
          أمثلة:
        </span>
        {QUICK_AI_TOPICS.map((q) => (
          <Chip
            key={q.label}
            onClick={() => p.setAiTopic(q.topic)}
            icon={<Lightbulb className="size-3" />}
          >
            {q.label}
          </Chip>
        ))}
      </div>
      <Note icon={<ListTree />} tone="brand">
        هيكل ثابت في كل عرض: <strong>3 مباحث، في كل مبحث 3 مطالب</strong>، إضافة إلى المقدمة
        والإشكالية والخاتمة والمراجع.
      </Note>
      <SelectInput
        label="عمق الصياغة"
        value={p.aiSize}
        onChange={(e) => p.setAiSize(e.target.value as SlideAiSize)}
        hint={SLIDE_AI_SIZES[p.aiSize].hint}
      >
        {(Object.keys(SLIDE_AI_SIZES) as SlideAiSize[]).map((k) => (
          <option key={k} value={k}>
            {SLIDE_AI_SIZES[k].label}
          </option>
        ))}
      </SelectInput>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50/30 p-3 sm:px-3.5 dark:from-emerald-950/25 dark:via-teal-950/20 dark:to-emerald-950/10">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="text-[0.8rem] font-bold text-emerald-950 dark:text-emerald-100">
              التوليد بالذكاء الاصطناعي مفعّل وجاهز مجاناً
            </div>
            <div className="text-[0.7rem] text-emerald-700 dark:text-emerald-300">
              اكتب موضوع العرض واضغط توليد مباشرة دون الحاجة لأي رمز.
            </div>
          </div>
        </div>
        <div className="hidden sm:flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-white/80 dark:bg-neutral-900/80 px-2.5 py-1 text-[0.7rem] font-bold text-emerald-700 dark:text-emerald-300">
          <CircleCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Gemini
        </div>
      </div>
      <Note icon={<CircleAlert />} tone="warn">
        قد يقترح الذكاء الاصطناعي مراجع غير دقيقة. <strong>تحقق من كل مرجع</strong> قبل عرضه.
      </Note>
      <Button
        variant="magic"
        size="lg"
        block
        loading={p.run.running}
        icon={<Wand2 className="size-4.5" />}
        onClick={p.generate}
      >
        {p.run.running ? "جاري توليد محتوى الشرائح..." : "توليد محتوى العرض"}
      </Button>
      {(p.run.running || p.run.stage === "done") && <AiProgress />}
    </Section>
  );
}

function AiProgress() {
  const { run, deck, setMode } = usePresentation();
  const stage =
    run.stage === "plan"
      ? "صياغة خطة العرض..."
      : run.stage === "writing"
        ? "كتابة المحاور بالتوازي وتوزيعها على الشرائح..."
        : "اكتمل التوليد.";
  return (
    <div
      className="animate-rise rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 px-3.5 py-2.5 text-[0.8rem] font-semibold text-zinc-900 dark:text-zinc-100">
        <span className="flex items-center gap-2">
          {run.running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CircleCheck className="size-4 text-emerald-500" />
          )}
          {stage}
        </span>
        {deck && <Badge tone="ok">{deck.slides.length} شريحة</Badge>}
      </div>
      <ul className="grid grid-cols-2 gap-1.5 p-2.5">
        {run.sections.map((s) => (
          <li
            key={s.id}
            className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[0.74rem] ${s.status === "done" ? "border-emerald-500/20 bg-emerald-500/10" : s.status === "error" ? "border-red-500/20 bg-red-500/10" : "border-black/10 dark:border-white/10"}`}
          >
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{s.label}</span>
            <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
              {s.status === "error" ? "تعذر" : s.words ? `${s.words} كلمة` : "..."}
            </span>
          </li>
        ))}
      </ul>
      {!run.running && (
        <div className="border-t border-black/10 dark:border-white/10 px-3.5 py-2 text-[0.74rem] text-zinc-600 dark:text-zinc-400">
          المحتوى المولد محفوظ كمسودة.{" "}
          <button
            type="button"
            className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100 cursor-pointer"
            onClick={() => setMode("draft")}
          >
            افتح المسودة لتعديله
          </button>
        </div>
      )}
    </div>
  );
}

/** شعار الجامعة على الغلاف: نفس قاعدة بيانات الولايات والجامعات المستعملة في غلاف البحث */
function LogoPicker() {
  const { meta, setMeta } = usePresentation();
  const { toast } = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const wilaya = ALGERIAN_WILAYAS.find((w) => w.id === meta.selectedWilaya);
  const univ = wilaya?.universities.find((u) => u.id === meta.selectedUnivId);
  const onUniversity = (id: string) => {
    const u = wilaya?.universities.find((x) => x.id === id);
    if (!u) return setMeta({ selectedUnivId: "", logoUrl: "" });
    setMeta({ selectedUnivId: id, logoUrl: u.logo, institution: u.name });
  };
  const onUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("الملف المختار ليس صورة.", { tone: "error" });
    setMeta({ logoUrl: await readFileAsDataUrl(file), selectedUnivId: "custom" });
    toast("تمت إضافة الشعار إلى الغلاف");
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/10 dark:border-white/10 p-3">
      <div className="flex items-center gap-2 text-[0.8rem] font-semibold text-zinc-800 dark:text-zinc-200">
        <Landmark className="size-4" /> شعار الجامعة
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectInput
          label="الولاية"
          value={meta.selectedWilaya}
          onChange={(e) =>
            setMeta({
              selectedWilaya: e.target.value,
              selectedUnivId: meta.selectedUnivId === "custom" ? "custom" : "",
              logoUrl: meta.selectedUnivId === "custom" ? meta.logoUrl : "",
            })
          }
        >
          <option value="">— اختر الولاية —</option>
          {ALGERIAN_WILAYAS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          label="الجامعة"
          value={meta.selectedUnivId === "custom" ? "" : meta.selectedUnivId}
          onChange={(e) => onUniversity(e.target.value)}
          disabled={!wilaya}
        >
          <option value="">{wilaya ? "— اختر المؤسسة —" : "— اختر الولاية أولاً —"}</option>
          {wilaya?.universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </SelectInput>
      </div>
      {meta.logoUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-black/10 bg-white p-1">
            <img src={meta.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.8rem] font-bold text-zinc-900 dark:text-zinc-100">
              {meta.selectedUnivId === "custom"
                ? "شعار مرفوع من جهازك"
                : univ?.name || meta.institution || "شعار الجامعة"}
            </div>
            <div className="text-[0.72rem] font-semibold text-ok">يظهر في ترويسة شريحة الغلاف</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon={<X className="size-3.5" />}
            onClick={() => setMeta({ logoUrl: "", selectedUnivId: "" })}
          >
            إزالة
          </Button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.74rem] text-zinc-500 dark:text-zinc-400">
          جامعتك غير مدرجة أو لديك شعار الكلية؟
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onUpload(e.target.files?.[0]).finally(() => (e.target.value = ""))}
        />
        <Button
          size="sm"
          variant="secondary"
          icon={<ImageUp className="size-3.5" />}
          onClick={() => fileRef.current?.click()}
        >
          رفع شعار
        </Button>
      </div>
    </div>
  );
}

function CoverFields() {
  const { meta, setMeta, importCover, deck } = usePresentation();
  return (
    <Section
      title="شريحة الغلاف"
      icon={<GraduationCap />}
      actions={
        <Button
          size="sm"
          variant="ghost"
          icon={<ArrowLeftRight className="size-3.5" />}
          onClick={importCover}
        >
          من غلاف البحث
        </Button>
      }
    >
      <TextInput
        label="عنوان العرض"
        value={meta.title}
        onChange={(e) => setMeta({ title: e.target.value })}
        placeholder={deck?.title || "يُستخرج تلقائياً من المسودة"}
        hint="اتركه فارغاً لاستعمال العنوان المكتشف في المسودة."
      />
      <TextInput
        label="نوع العمل"
        value={meta.subtitle}
        onChange={(e) => setMeta({ subtitle: e.target.value })}
        placeholder="عرض تقديمي لمقياس..."
      />
      <LogoPicker />
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label="الجامعة / المؤسسة"
          value={meta.institution}
          onChange={(e) => setMeta({ institution: e.target.value })}
        />
        <TextInput
          label="الكلية / القسم"
          value={meta.faculty}
          onChange={(e) => setMeta({ faculty: e.target.value })}
        />
      </div>
      <TextArea
        label="إعداد"
        hint="اسم كل مقدم في سطر."
        rows={2}
        value={meta.presentersText}
        onChange={(e) => setMeta({ presentersText: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label="إشراف"
          value={meta.supervisor}
          onChange={(e) => setMeta({ supervisor: e.target.value })}
        />
        <TextInput
          label="السنة"
          value={meta.year}
          onChange={(e) => setMeta({ year: e.target.value })}
        />
      </div>
    </Section>
  );
}

function ThemeSwatch({ th }: { th: SlideTheme }) {
  const c = th.colors;
  return (
    <span
      className="relative block aspect-video w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
      style={{ background: `#${c.bg}` }}
    >
      <span className="absolute inset-y-0 right-0 w-[5%]" style={{ background: `#${c.primary}` }} />
      <span
        className="absolute top-[22%] right-[12%] h-[9%] w-[52%] rounded-sm"
        style={{ background: `#${c.text}` }}
      />
      <span
        className="absolute top-[38%] right-[12%] h-[5%] w-[16%] rounded-sm"
        style={{ background: `#${c.accent}` }}
      />
      <span
        className="absolute top-[54%] right-[12%] h-[5%] w-[62%] rounded-sm opacity-40"
        style={{ background: `#${c.muted}` }}
      />
      <span
        className="absolute top-[66%] right-[12%] h-[5%] w-[48%] rounded-sm opacity-40"
        style={{ background: `#${c.muted}` }}
      />
      <span
        className="absolute bottom-[12%] left-[7%] size-[22%] rounded-full"
        style={{ background: `#${c.primary}`, opacity: 0.85 }}
      />
    </span>
  );
}

function ThemePicker() {
  const { theme, autoTheme, setAutoTheme, setThemeId } = usePresentation();
  return (
    <Section
      title="القالب والتصميم"
      icon={<Palette />}
      description="قوالب حسب التخصص بألوان وخطوط وأيقونات وزخارف متناسقة. كل العناصر أشكال ونصوص قابلة للتعديل."
    >
      <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 dark:border-white/10 px-3 py-2.5">
        <div>
          <div className="text-[0.82rem] font-bold text-zinc-900 dark:text-zinc-100">
            اختيار تلقائي حسب الموضوع
          </div>
          <div className="text-[0.72rem] text-zinc-500 dark:text-zinc-400">
            {autoTheme ? `المقترح الآن: ${theme.name}` : "اختر قالباً يدوياً من القائمة"}
          </div>
        </div>
        <Switch checked={autoTheme} onChange={setAutoTheme} label="اختيار القالب تلقائياً" />
      </div>
      <div
        role="radiogroup"
        aria-label="قوالب العرض"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
      >
        {SLIDE_THEMES.map((th) => {
          const active = th.id === theme.id;
          return (
            <button
              key={th.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={th.description}
              onClick={() => setThemeId(th.id)}
              className={`flex flex-col gap-1.5 rounded-xl border p-2 text-right transition cursor-pointer ${
                active
                  ? "border-neutral-900 ring-2 ring-neutral-900/10 dark:border-white dark:ring-white/20"
                  : "border-black/10 dark:border-white/10 hover:border-black/25 dark:hover:border-white/25"
              }`}
            >
              <ThemeSwatch th={th} />
              <span className="text-[0.78rem] leading-tight font-bold text-zinc-900 dark:text-zinc-100">
                {th.name}
              </span>
              <span className="-mt-1 text-[0.68rem] leading-tight text-zinc-500 dark:text-zinc-400">
                {th.field}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function StructureOptions() {
  const { options, setOptions } = usePresentation();
  const rows: {
    key:
      | "includeAgenda"
      | "includeSectionDividers"
      | "includeReferences"
      | "includeClosing"
      | "includeNotes";
    title: string;
    desc: string;
  }[] = [
    { key: "includeAgenda", title: "شريحة خطة العرض", desc: "تُبنى من شجرة المباحث والمطالب." },
    {
      key: "includeSectionDividers",
      title: "فواصل المحاور",
      desc: "شريحة افتتاحية لكل مبحث مع مطالبه.",
    },
    {
      key: "includeReferences",
      title: "المصادر والمراجع",
      desc: "من قائمة المراجع، أو من الهوامش إن غابت.",
    },
    { key: "includeClosing", title: "شريحة الختام", desc: "شكر وتذكير بعنوان العرض." },
    {
      key: "includeNotes",
      title: "ملاحظات المتحدث",
      desc: "النص الكامل لكل قسم أسفل الشريحة في PowerPoint.",
    },
  ];
  return (
    <Section title="بنية الشرائح" icon={<LayoutTemplate />}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.8rem] font-semibold text-zinc-800 dark:text-zinc-200">
          كثافة النص في الشريحة
        </span>
        <Segmented
          label="كثافة النص"
          value={options.density}
          onChange={(density) => setOptions({ density })}
          options={[
            { value: "airy", label: "مريحة" },
            { value: "balanced", label: "متوازنة" },
            { value: "detailed", label: "مفصلة" },
          ]}
        />
        <span className="text-[0.72rem] text-zinc-500 dark:text-zinc-400">
          الكثافة المريحة تكبّر الخط وتوزع المحتوى على شرائح أكثر دون حذف أي معلومة.
        </span>
      </div>
      <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <div className="text-[0.82rem] font-semibold text-zinc-900 dark:text-zinc-100">
                {r.title}
              </div>
              <div className="text-[0.72rem] text-zinc-500 dark:text-zinc-400">{r.desc}</div>
            </div>
            <Switch
              checked={options[r.key]}
              onChange={(v) => setOptions({ [r.key]: v })}
              label={r.title}
            />
          </div>
        ))}
      </div>
    </Section>
  );
}

function Stage({ className }: { className: string }) {
  const { deck, laid, theme, exportPptx, exporting, mode, setMode } = usePresentation();
  const [sel, setSel] = useState(0);
  const count = laid.length;
  useEffect(() => {
    if (sel > count - 1) setSel(Math.max(0, count - 1));
  }, [count, sel]);
  const current = laid[sel];
  const slide = deck?.slides[sel];
  const stats = useMemo(() => {
    if (!deck) return null;
    const k = (kind: Slide["kind"]) => deck.slides.filter((s) => s.kind === kind).length;
    return { content: k("content"), sections: k("section"), refs: k("references") };
  }, [deck]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft") setSel((s) => Math.min(count - 1, s + 1));
      if (e.key === "ArrowRight") setSel((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  return (
    <main
      aria-label="معاينة الشرائح"
      className={`min-h-0 flex-1 flex-col bg-zinc-100 dark:bg-zinc-900 ${className}`}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-950/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[0.8rem] text-zinc-600 dark:text-zinc-400">
          <span className="font-bold text-zinc-900 dark:text-zinc-100">
            {count ? `${count} شريحة` : "لا توجد شرائح بعد"}
          </span>
          {stats && (
            <>
              <Badge>{stats.sections} محاور</Badge>
              <Badge>{stats.content} شرائح محتوى</Badge>
              {!!stats.refs && <Badge>{stats.refs} مراجع</Badge>}
            </>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 rounded-full border border-black/10"
              style={{ background: `#${theme.colors.primary}` }}
            />
            {theme.name}
          </span>
        </div>
        <Button
          variant="primary"
          icon={<Download className="size-4" />}
          loading={exporting}
          onClick={exportPptx}
          disabled={!count}
        >
          تحميل PowerPoint
        </Button>
      </div>

      {!current ? (
        <div className="grid flex-1 place-items-center p-8">
          <div className="max-w-sm text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-xs">
              <Presentation className="size-7 text-zinc-700 dark:text-zinc-300" />
            </div>
            <h2 className="mt-4 font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">
              ستظهر شرائحك هنا
            </h2>
            <p className="mt-1.5 text-[0.84rem] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {mode === "draft"
                ? "الصق مسودة العرض أو استورد مسودة بحثك لتتكون الشرائح فوراً."
                : "اكتب موضوع العرض واضغط توليد، وستُبنى الشرائح أثناء الكتابة."}
            </p>
            {mode === "ai" && (
              <Button
                className="mt-4"
                size="sm"
                variant="secondary"
                icon={<ClipboardPaste className="size-3.5" />}
                onClick={() => setMode("draft")}
              >
                لدي مسودة جاهزة
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
            <div className="relative">
              <SlideCanvas
                slide={current}
                className="rounded-xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/10 dark:ring-white/10"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ChevronRight className="size-4" />}
                    onClick={() => setSel((s) => Math.max(0, s - 1))}
                    disabled={sel === 0}
                    aria-label="الشريحة السابقة"
                  />
                  <span className="min-w-16 text-center text-[0.8rem] font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
                    {sel + 1} / {count}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ChevronLeft className="size-4" />}
                    onClick={() => setSel((s) => Math.min(count - 1, s + 1))}
                    disabled={sel >= count - 1}
                    aria-label="الشريحة التالية"
                  />
                </div>
                {slide && (
                  <Badge tone="brand">
                    {KIND_LABEL[slide.kind]}
                    {slide.kind === "content"
                      ? ` · ${slide.layout === "cards" ? "بطاقات" : slide.layout === "statement" ? "فكرة محورية" : "نقاط"}`
                      : ""}
                  </Badge>
                )}
              </div>
            </div>

            {slide?.notes && (
              <details className="group rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[0.8rem] font-semibold text-zinc-800 dark:text-zinc-200">
                  <MessageSquareText className="size-4" /> ملاحظات المتحدث (النص الكامل للقسم)
                </summary>
                <p className="max-h-48 overflow-y-auto whitespace-pre-line border-t border-black/5 dark:border-white/5 px-4 py-3 font-serif text-[0.86rem] leading-relaxed text-zinc-700 dark:text-zinc-300 scroll-thin">
                  {slide.notes}
                </p>
              </details>
            )}

            <div>
              <div className="mb-2 flex items-center gap-2 text-[0.78rem] font-semibold text-zinc-600 dark:text-zinc-400">
                <Rows3 className="size-4" /> كل الشرائح
              </div>
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {laid.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setSel(i)}
                      aria-label={`الشريحة ${i + 1}`}
                      aria-current={i === sel}
                      className={`block w-full overflow-hidden rounded-lg text-right transition cursor-pointer ${i === sel ? "ring-2 ring-zinc-900 dark:ring-white" : "ring-1 ring-black/10 dark:ring-white/10 hover:ring-black/30"}`}
                    >
                      <SlideCanvas slide={s} />
                    </button>
                    <div className="mt-1 flex items-center justify-between px-0.5 text-[0.7rem] text-zinc-500 dark:text-zinc-400">
                      <span className="tabular-nums font-bold">{i + 1}</span>
                      <span>{deck ? KIND_LABEL[deck.slides[i].kind] : ""}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
