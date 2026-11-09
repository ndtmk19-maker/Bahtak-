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
import { useConverter } from "./ConverterContext";
import { useUI } from "./UIContext";
import { ParseError } from "../lib/parser";
import { getEffectiveGeminiKey } from "../lib/aiKeys";
import { trackEvent } from "../lib/analytics";
import type { SectionProgress } from "../lib/aiGenerate";
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
  reset: () => void;
  resetVersion: number;
}

const KEY = "bahtak_presentation_v2";
const LEGACY_KEY = "bahtak_presentation_v1";
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

function createDefaultPersisted(): Persisted {
  return {
    mode: "draft",
    draftText: "",
    meta: { ...EMPTY_META },
    themeId: DEFAULT_THEME_ID,
    autoTheme: true,
    options: { ...DEFAULT_DECK_OPTIONS },
    aiTopic: "",
    aiSize: "standard",
  };
}

function load(): Persisted | null {
  try {
    // تنظيف التخزين القديم الذي كان يستورد بيانات غلاف A4 تلقائياً لضمان الفصل التام
    if (localStorage.getItem(LEGACY_KEY) !== null) {
      localStorage.removeItem(LEGACY_KEY);
    }
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
  const converter = useConverter();
  const ui = useUI();
  const [state, setState] = useState<Persisted>(() => load() ?? createDefaultPersisted());
  const [run, setRun] = useState<SlidesRun>({
    running: false,
    stage: "idle",
    sections: [],
    words: 0,
    model: "",
  });
  const [exporting, setExporting] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const runningRef = useRef(false);
  const runIdRef = useRef(0);
  const hasUserEditedRef = useRef(false);

  useEffect(() => {
    if (!hasUserEditedRef.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* المساحة ممتلئة */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  const patch = useCallback((p: Partial<Persisted>) => {
    hasUserEditedRef.current = true;
    setState((s) => ({ ...s, ...p }));
  }, []);
  const setMeta = useCallback((p: Partial<PresentationMeta>) => {
    hasUserEditedRef.current = true;
    setState((s) => ({ ...s, meta: { ...s.meta, ...p } }));
  }, []);
  const setOptions = useCallback((p: Partial<DeckOptions>) => {
    hasUserEditedRef.current = true;
    setState((s) => ({ ...s, options: { ...s.options, ...p } }));
  }, []);

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

  const reset = useCallback(() => {
    runIdRef.current += 1;
    runningRef.current = false;
    hasUserEditedRef.current = false;
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
    setState(createDefaultPersisted());
    setRun({
      running: false,
      stage: "idle",
      sections: [],
      words: 0,
      model: "",
    });
    setResetVersion((v) => v + 1);
  }, []);

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
    const myRunId = ++runIdRef.current;
    runningRef.current = true;
    hasUserEditedRef.current = true;
    setRun({ running: true, stage: "plan", sections: [], words: 0, model: "" });
    try {
      const text = await generatePresentationDraft({
        provider,
        apiKey: key,
        topic,
        size: state.aiSize,
        customUrl,
        customModel,
        onSections: (sections) => {
          if (runIdRef.current === myRunId) setRun((r) => ({ ...r, sections }));
        },
        onDraft: (t, words) => {
          if (runIdRef.current !== myRunId) return;
          hasUserEditedRef.current = true;
          setState((s) => ({ ...s, draftText: t }));
          setRun((r) => ({ ...r, words }));
        },
        onModel: (model) => {
          if (runIdRef.current === myRunId) setRun((r) => ({ ...r, model }));
        },
        onStage: (stage) => {
          if (runIdRef.current === myRunId) setRun((r) => ({ ...r, stage }));
        },
      });
      if (runIdRef.current !== myRunId) return;
      hasUserEditedRef.current = true;
      setState((s) => ({ ...s, draftText: text, meta: { ...s.meta, title: topic } }));
      setRun((r) => ({ ...r, running: false, stage: "done" }));
      ui.toast("اكتمل توليد محتوى العرض", {
        description:
          "نُظّم المحتوى في شرائح. راجعه في المعاينة أو عدّله في المسودة ثم نزّل ملف PowerPoint.",
      });
      trackEvent({ event_type: "generate", topic: `[PPTX] ${topic}` }).catch(() => {});
    } catch (err) {
      if (runIdRef.current !== myRunId) return;
      setRun((r) => ({ ...r, running: false, stage: "idle" }));
      ui.toast("تعذر إكمال التوليد", {
        tone: "error",
        description: `${err instanceof Error ? err.message : String(err)} — تأكد من المفتاح واتصالك بالإنترنت.`,
      });
    } finally {
      if (runIdRef.current === myRunId) {
        runningRef.current = false;
      }
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
      reset,
      resetVersion,
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
      reset,
      resetVersion,
    ],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePresentation() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePresentation must be used inside PresentationProvider");
  return v;
}
