import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDocument } from "./DocumentContext";
import { useConverter } from "./ConverterContext";
import { useUI } from "./UIContext";
import { ParseError } from "../lib/parser";
import { getEffectiveGeminiKey } from "../lib/aiKeys";
import { trackEvent } from "../lib/analytics";
import type { SectionProgress } from "../lib/aiGenerate";
import { PLACEHOLDER_TITLE } from "../data/defaults";
import {
  DEFAULT_DECK_OPTIONS,
  DEFAULT_THEME_ID,
  buildDeckFromText,
  getTheme,
  layoutDeck,
  suggestTheme,
  type CoverMeta,
  type DeckOptions,
  type LaidSlide,
  type SlideDeck,
  type SlideTheme,
} from "../lib/slides";
import { generatePresentationDraft, type SlideAiSize } from "../lib/slides/ai";

export type PresentationMode = "draft" | "ai";

export interface PresentationMeta {
  title: string;
  subtitle: string;
  institution: string;
  faculty: string;
  presentersText: string;
  supervisor: string;
  year: string;
  /** شعار الجامعة: من قائمة الجامعات الجزائرية (نفس قاعدة بيانات غلاف البحث) أو مرفوع من الجهاز */
  selectedWilaya: string;
  selectedUnivId: string;
  logoUrl: string;
}

interface Persisted {
  mode: PresentationMode;
  draftText: string;
  meta: PresentationMeta;
  themeId: string;
  autoTheme: boolean;
  options: DeckOptions;
  aiTopic: string;
  aiSize: SlideAiSize;
}

export interface SlidesRun {
  running: boolean;
  stage: "idle" | "plan" | "writing" | "done";
  sections: SectionProgress[];
  words: number;
  model: string;
}

interface PresentationApi extends Persisted {
  setMode: (m: PresentationMode) => void;
  setDraftText: (t: string) => void;
  setMeta: (p: Partial<PresentationMeta>) => void;
  setThemeId: (id: string) => void;
  setAutoTheme: (v: boolean) => void;
  setOptions: (p: Partial<DeckOptions>) => void;
  setAiTopic: (t: string) => void;
  setAiSize: (s: SlideAiSize) => void;
  deck: SlideDeck | null;
  laid: LaidSlide[];
  theme: SlideTheme;
  error: string;
  run: SlidesRun;
  generate: () => Promise<void>;
  exportPptx: () => Promise<void>;
  exporting: boolean;
  importFromResearch: () => void;
  importCover: () => void;
  hasResearchDraft: boolean;
}

const KEY = "bahtak_presentation_v1";
const EMPTY_META: PresentationMeta = {
  title: "",
  subtitle: "عرض تقديمي",
  institution: "",
  faculty: "",
  presentersText: "",
  supervisor: "",
  year: "",
  selectedWilaya: "",
  selectedUnivId: "",
  logoUrl: "",
};

const isPlaceholder = (v: string) => !v.trim() || /الاسم واللقب|أستاذ\(ة\) المقياس|\[عنوان/.test(v);

/** نقل بيانات غلاف البحث إلى بيانات شريحة الغلاف (إعادة استعمال لما أدخله الطالب في نظام البحوث) */
function metaFromCover(
  cs: ReturnType<typeof useDocument>["doc"]["coverState"],
): Partial<PresentationMeta> {
  const presenters = cs.studentsText
    .split("\n")
    .map((l) => l.replace(/^\s*(?:الطالب\(ة\)|الطالبة|الطالب|الطلبة|إعداد)\s*[:：]\s*/, "").trim())
    .filter((l) => l && !isPlaceholder(l));
  const out: Partial<PresentationMeta> = {};
  if (cs.universityName.trim()) out.institution = cs.universityName.trim();
  if (cs.facultyName.trim()) out.faculty = cs.facultyName.trim();
  if (presenters.length) out.presentersText = presenters.join("\n");
  if (!isPlaceholder(cs.supervisor)) out.supervisor = cs.supervisor.trim();
  if (cs.academicYear.trim()) out.year = cs.academicYear.trim();
  if (cs.logoUrl) {
    out.logoUrl = cs.logoUrl;
    out.selectedWilaya = cs.selectedWilaya;
    out.selectedUnivId = cs.selectedUnivId;
  }
  if (cs.title && cs.title !== PLACEHOLDER_TITLE && !isPlaceholder(cs.title))
    out.title = cs.title.trim();
  return out;
}

function load(): Persisted | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      mode: p.mode === "ai" ? "ai" : "draft",
      draftText: p.draftText || "",
      meta: { ...EMPTY_META, ...(p.meta || {}) },
      themeId: p.themeId || DEFAULT_THEME_ID,
      autoTheme: p.autoTheme ?? true,
      options: { ...DEFAULT_DECK_OPTIONS, ...(p.options || {}) },
      aiTopic: p.aiTopic || "",
      aiSize: p.aiSize || "standard",
    };
  } catch {
    return null;
  }
}

const Ctx = createContext<PresentationApi | null>(null);

export function PresentationProvider({ children }: { children: ReactNode }) {
  const { doc } = useDocument();
  const converter = useConverter();
  const ui = useUI();
  const [state, setState] = useState<Persisted>(() => {
    const saved = load();
    if (saved) return saved;
    return {
      mode: "draft",
      draftText: "",
      meta: { ...EMPTY_META, ...metaFromCover(doc.coverState) },
      themeId: DEFAULT_THEME_ID,
      autoTheme: true,
      options: DEFAULT_DECK_OPTIONS,
      aiTopic: "",
      aiSize: "standard",
    };
  });
  const [run, setRun] = useState<SlidesRun>({
    running: false,
    stage: "idle",
    sections: [],
    words: 0,
    model: "",
  });
  const [exporting, setExporting] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* المساحة ممتلئة */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  const patch = useCallback((p: Partial<Persisted>) => setState((s) => ({ ...s, ...p })), []);
  const setMeta = useCallback(
    (p: Partial<PresentationMeta>) => setState((s) => ({ ...s, meta: { ...s.meta, ...p } })),
    [],
  );
  const setOptions = useCallback(
    (p: Partial<DeckOptions>) => setState((s) => ({ ...s, options: { ...s.options, ...p } })),
    [],
  );

  // التحليل البنيوي المشترك ← خطة الشرائح (يُعاد حسابه مع كل تعديل على المسودة)
  const draft = useDeferredValue(state.draftText);
  const coverMeta = useMemo<CoverMeta>(
    () => ({
      title: state.meta.title,
      subtitle: state.meta.subtitle,
      institution: state.meta.institution,
      faculty: state.meta.faculty,
      presenters: state.meta.presentersText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      supervisor: state.meta.supervisor,
      year: state.meta.year,
      logo: state.meta.logoUrl,
    }),
    [state.meta],
  );
  const { deck, error } = useMemo(() => {
    if (!draft.trim()) return { deck: null, error: "" };
    try {
      return { deck: buildDeckFromText(draft, coverMeta, state.options), error: "" };
    } catch (e) {
      return { deck: null, error: e instanceof ParseError ? e.message : "تعذر تحليل المسودة." };
    }
  }, [draft, coverMeta, state.options]);

  const theme = useMemo(
    () =>
      state.autoTheme ? suggestTheme(deck?.title || state.aiTopic, draft) : getTheme(state.themeId),
    [state.autoTheme, state.themeId, deck?.title, state.aiTopic, draft],
  );
  const laid = useMemo(
    () => (deck ? layoutDeck(deck, theme, state.options) : []),
    [deck, theme, state.options],
  );

  const importFromResearch = useCallback(() => {
    const text = converter.rawText.trim();
    if (!text) {
      ui.toast("لا توجد مسودة بحث محفوظة بعد", {
        tone: "info",
        description: "أنشئ بحثاً أولاً من قسم البحوث، أو الصق مسودة العرض مباشرة.",
      });
      return;
    }
    setState((s) => ({
      ...s,
      draftText: text,
      mode: "draft",
      meta: { ...s.meta, ...metaFromCover(doc.coverState) },
    }));
    ui.toast("تم استيراد مسودة البحث الحالية", {
      description: "حُوّلت المقدمة والمباحث والمطالب والخاتمة والمراجع إلى شرائح مرتبة.",
    });
  }, [converter.rawText, doc.coverState, ui]);

  const importCover = useCallback(() => {
    setMeta(metaFromCover(doc.coverState));
    ui.toast("تم نسخ بيانات الغلاف من البحث", { tone: "info" });
  }, [doc.coverState, setMeta, ui]);

  const generate = useCallback(async () => {
    if (runningRef.current) return;
    const { provider, customUrl, customModel } = converter.form;
    const key =
      provider === "gemini" ? getEffectiveGeminiKey(converter.apiKey) : converter.apiKey.trim();
    if (!key) {
      ui.openKeyGuide(
        provider === "gemini"
          ? "فعّل رمزك المجاني من Google لمرة واحدة لتتمكن من التوليد."
          : "يرجى إدخال رمز API الخاص بهذا المزود للمتابعة.",
      );
      return;
    }
    const topic = state.aiTopic.trim();
    if (!topic) {
      ui.toast("اكتب موضوع العرض أولاً", { tone: "error" });
      document.getElementById("slides-ai-topic")?.focus();
      return;
    }
    runningRef.current = true;
    setRun({ running: true, stage: "plan", sections: [], words: 0, model: "" });
    try {
      const text = await generatePresentationDraft({
        provider,
        apiKey: key,
        topic,
        size: state.aiSize,
        customUrl,
        customModel,
        onSections: (sections) => setRun((r) => ({ ...r, sections })),
        onDraft: (t, words) => {
          setState((s) => ({ ...s, draftText: t }));
          setRun((r) => ({ ...r, words }));
        },
        onModel: (model) => setRun((r) => ({ ...r, model })),
        onStage: (stage) => setRun((r) => ({ ...r, stage })),
      });
      setState((s) => ({ ...s, draftText: text, meta: { ...s.meta, title: topic } }));
      setRun((r) => ({ ...r, running: false, stage: "done" }));
      ui.toast("اكتمل توليد محتوى العرض", {
        description:
          "نُظّم المحتوى في شرائح. راجعه في المعاينة أو عدّله في المسودة ثم نزّل ملف PowerPoint.",
      });
      trackEvent({ event_type: "generate", topic: `[PPTX] ${topic}` }).catch(() => {});
    } catch (err) {
      setRun((r) => ({ ...r, running: false, stage: "idle" }));
      ui.toast("تعذر إكمال التوليد", {
        tone: "error",
        description: `${err instanceof Error ? err.message : String(err)} — تأكد من المفتاح واتصالك بالإنترنت.`,
      });
    } finally {
      runningRef.current = false;
    }
  }, [converter.apiKey, converter.form, state.aiSize, state.aiTopic, ui]);

  const exportPptx = useCallback(async () => {
    if (!deck || !laid.length) {
      ui.toast("لا توجد شرائح للتصدير بعد", {
        tone: "error",
        description: "أضف مسودة العرض أو ولّدها بالذكاء الاصطناعي أولاً.",
      });
      return;
    }
    setExporting(true);
    try {
      // تحميل مكتبة PowerPoint عند الحاجة فقط حتى لا تثقل الواجهة
      const { downloadPptx } = await import("../lib/slides/pptxExport");
      const fileName = await downloadPptx(laid, theme, {
        title: deck.title,
        author: coverMeta.presenters.join("، "),
      });
      ui.toast("تم تنزيل ملف PowerPoint", {
        description: `${fileName} — ${laid.length} شريحة قابلة للتعديل بالكامل.`,
      });
      trackEvent({
        event_type: "export_pptx",
        topic: deck.title,
        pages_count: laid.length,
        university: coverMeta.institution || undefined,
      }).catch(() => {});
    } catch (err) {
      ui.toast("تعذر إنشاء ملف PowerPoint", {
        tone: "error",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  }, [coverMeta, deck, laid, theme, ui]);

  const api = useMemo<PresentationApi>(
    () => ({
      ...state,
      setMode: (mode) => patch({ mode }),
      setDraftText: (draftText) => patch({ draftText }),
      setMeta,
      setThemeId: (themeId) => patch({ themeId, autoTheme: false }),
      setAutoTheme: (autoTheme) => patch({ autoTheme }),
      setOptions,
      setAiTopic: (aiTopic) => patch({ aiTopic }),
      setAiSize: (aiSize) => patch({ aiSize }),
      deck,
      laid,
      theme,
      error,
      run,
      generate,
      exportPptx,
      exporting,
      importFromResearch,
      importCover,
      hasResearchDraft: !!converter.rawText.trim(),
    }),
    [
      state,
      patch,
      setMeta,
      setOptions,
      deck,
      laid,
      theme,
      error,
      run,
      generate,
      exportPptx,
      exporting,
      importFromResearch,
      importCover,
      converter.rawText,
    ],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePresentation() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePresentation must be used inside PresentationProvider");
  return v;
}
