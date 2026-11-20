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
import { isIOS } from "../lib/printDocument";
import {
  analyzeStudentTopic,
  isStructuralTitleOnly,
  looksLikePlanLeak,
  sanitizeCoverTitleFromPlanLeak,
  type SectionProgress,
} from "../lib/aiGenerate";
import type { ResearchLanguage } from "../types";
import { detectTopicLanguage } from "../lib/detectLanguage";
import {
  DEFAULT_DECK_OPTIONS,
  DEFAULT_THEME_ID,
  buildDeckFromText,
  configureSlideImages,
  getTheme,
  layoutDeck,
  resolveDeckImages,
  suggestTheme,
  type CoverMeta,
  type DeckImages,
  type DeckOptions,
  type LaidSlide,
  type SlideDeck,
  type SlideTheme,
} from "../lib/slides";
import { generatePresentationDraft, type SlideAiSize } from "../lib/slides/ai";

// تفعيل نقطة البحث ووكيل الصور
configureSlideImages({
  searchEndpoint: "/api/slide-images",
  proxyImageUrl: (u) => `/api/image-proxy?url=${encodeURIComponent(u)}`,
});

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
  caseStudyCompany: string;
  language: ResearchLanguage;
  includeImages?: boolean;
}

export interface SlidesRun {
  running: boolean;
  stage: "idle" | "plan" | "writing" | "done";
  sections: SectionProgress[];
  words: number;
  model: string;
  startedAt?: number;
  duration?: number;
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
  setCaseStudyCompany: (c: string) => void;
  setLanguage: (lang: ResearchLanguage) => void;
  includeImages: boolean;
  setIncludeImages: (v: boolean) => void;
  loadingImages: boolean;
  imagesDuration?: number;
  images: DeckImages | undefined;
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
  completedVersion: number;
}

const KEY = "bahtak_presentation_v2";
const LEGACY_KEY = "bahtak_presentation_v1";

const DEFAULT_SUBTITLES: Record<ResearchLanguage, string> = {
  ar: "عرض تقديمي",
  fr: "Exposé académique",
  en: "Academic Presentation",
};

const KNOWN_DEFAULT_SUBTITLES = new Set([
  "",
  "عرض تقديمي",
  "عرض تقديمي لمقياس",
  "عرض تقديمي لمقياس...",
  "Exposé académique",
  "Exposé",
  "Présentation",
  "Présentation académique",
  "Academic Presentation",
  "Presentation",
]);

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

function createDefaultPersisted(lang: ResearchLanguage = "ar"): Persisted {
  return {
    mode: "draft",
    draftText: "",
    meta: { ...EMPTY_META, subtitle: DEFAULT_SUBTITLES[lang] },
    themeId: DEFAULT_THEME_ID,
    autoTheme: true,
    options: { ...DEFAULT_DECK_OPTIONS },
    aiTopic: "",
    aiSize: "standard",
    caseStudyCompany: "",
    language: lang,
    includeImages: true,
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
    const lang: ResearchLanguage = p.language || "ar";
    const rawMeta = { ...EMPTY_META, ...(p.meta || {}) };
    if (lang !== "ar" && (!rawMeta.subtitle || KNOWN_DEFAULT_SUBTITLES.has(rawMeta.subtitle.trim()))) {
      rawMeta.subtitle = DEFAULT_SUBTITLES[lang];
    }
    const aiTopic = p.aiTopic || "";
    const caseStudyCompany = p.caseStudyCompany || "";
    let cleanMetaTitle = rawMeta.title || "";
    if (cleanMetaTitle && (looksLikePlanLeak(cleanMetaTitle) || isStructuralTitleOnly(cleanMetaTitle))) {
      const draftHead =
        (p.draftText || "").match(
          /(?:بحث\s+بعنوان|عنوان\s+البحث|موضوع\s+البحث)\s*[:\-]?\s*["«]?([^"\n\r»]+)["»]?/i,
        )?.[1]?.trim() || "";
      const draftSan =
        draftHead && !looksLikePlanLeak(draftHead) && !isStructuralTitleOnly(draftHead)
          ? draftHead
          : "";
      const topicAnalysis = aiTopic ? analyzeStudentTopic(aiTopic, caseStudyCompany) : null;
      const san = sanitizeCoverTitleFromPlanLeak(
        cleanMetaTitle,
        topicAnalysis?.hasCustomPlan ? topicAnalysis.customMabahith : undefined,
      );
      cleanMetaTitle =
        draftSan ||
        (topicAnalysis &&
        !topicAnalysis.hasCustomPlan &&
        topicAnalysis.caseStudy.coverTitle &&
        !looksLikePlanLeak(topicAnalysis.caseStudy.coverTitle) &&
        !isStructuralTitleOnly(topicAnalysis.caseStudy.coverTitle)
          ? topicAnalysis.caseStudy.coverTitle
          : "") ||
        (san.cleaned && !looksLikePlanLeak(san.cleaned) && !isStructuralTitleOnly(san.cleaned)
          ? san.cleaned
          : "") ||
        (topicAnalysis?.cleanedTopic &&
        !looksLikePlanLeak(topicAnalysis.cleanedTopic) &&
        !isStructuralTitleOnly(topicAnalysis.cleanedTopic)
          ? topicAnalysis.cleanedTopic
          : "");
    }
    const next: Persisted = {
      mode: p.mode === "ai" ? "ai" : "draft",
      draftText: p.draftText || "",
      meta: { ...rawMeta, title: cleanMetaTitle },
      themeId: p.themeId || DEFAULT_THEME_ID,
      autoTheme: p.autoTheme ?? true,
      options: { ...DEFAULT_DECK_OPTIONS, ...(p.options || {}) },
      aiTopic,
      aiSize: p.aiSize || "standard",
      caseStudyCompany,
      language: p.language || "ar",
      includeImages: p.includeImages ?? true,
    };
    if (cleanMetaTitle !== (rawMeta.title || "")) {
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    }
    return next;
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
  const [completedVersion, setCompletedVersion] = useState(0);
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
  const manualLangRef = useRef(false);
  const setLanguage = useCallback((lang: ResearchLanguage) => {
    manualLangRef.current = true;
    hasUserEditedRef.current = true;
    setState((s) => {
      const curSub = (s.meta.subtitle || "").trim();
      const shouldUpdateSubtitle = KNOWN_DEFAULT_SUBTITLES.has(curSub);
      return {
        ...s,
        language: lang,
        meta: {
          ...s.meta,
          subtitle: shouldUpdateSubtitle ? DEFAULT_SUBTITLES[lang] : s.meta.subtitle,
        },
      };
    });
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
      language: state.language || "ar",
    }),
    [state.meta, state.language],
  );
  const { deck, error } = useMemo(() => {
    if (!draft.trim()) return { deck: null, error: "" };
    try {
      return { deck: buildDeckFromText(draft, coverMeta, state.options), error: "" };
    } catch (e) {
      console.error("buildDeckFromText failed:", e);
      return { deck: null, error: e instanceof Error ? e.message : "تعذر تحليل المسودة." };
    }
  }, [draft, coverMeta, state.options]);

  const cleanTopicHint = useMemo(() => {
    const a = analyzeStudentTopic(state.aiTopic, state.caseStudyCompany);
    return a.caseStudy.coverTitle || a.cleanedTopic || state.aiTopic;
  }, [state.aiTopic, state.caseStudyCompany]);

  const theme = useMemo(
    () =>
      state.autoTheme ? suggestTheme(deck?.title || cleanTopicHint, draft) : getTheme(state.themeId),
    [state.autoTheme, state.themeId, deck?.title, cleanTopicHint, draft],
  );

  const [images, setImages] = useState<DeckImages | undefined>(undefined);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imagesDuration, setImagesDuration] = useState<number | undefined>(undefined);
  const includeImages = state.includeImages ?? true;

  const setIncludeImages = useCallback(
    (val: boolean) => {
      patch({ includeImages: val });
    },
    [patch],
  );

  const themeRef = useRef(theme);
  themeRef.current = theme;

  const isAiGenerating = run.running || run.stage === "writing" || run.stage === "plan";

  // توقيع محتوى العرض: يُعاد البحث عن الصور فقط إذا تغيّر محتوى العرض أو خيار الصور، ولا يُعاد عند تغيير القالب
  const deckSig = useMemo(() => {
    if (!deck || !includeImages) return "";
    return `${deck.title}#${deck.slides.length}#${deck.language}#${deck.slides
      .map((s) => (s.kind === "content" ? `${s.title}:${s.points.length}` : s.kind))
      .join(";")}`;
  }, [deck, includeImages]);

  useEffect(() => {
    if (!deck || !includeImages || isAiGenerating) {
      if (!includeImages) {
        setImages(undefined);
        setImagesDuration(undefined);
      }
      setLoadingImages(false);
      return;
    }
    let cancelled = false;
    setLoadingImages(true);
    const startT = Date.now();
    const timer = setTimeout(() => {
      resolveDeckImages(deck, themeRef.current)
        .then((resolved) => {
          if (!cancelled) {
            setImages(resolved);
            setLoadingImages(false);
            setImagesDuration(Math.round((Date.now() - startT) / 100) / 10);
          }
        })
        .catch((err) => {
          console.warn("resolveDeckImages failed gracefully:", err);
          if (!cancelled) {
            setImages(undefined);
            setLoadingImages(false);
            setImagesDuration(Math.round((Date.now() - startT) / 100) / 10);
          }
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deckSig, isAiGenerating]);

  const laid = useMemo(() => {
    if (!deck) return [];
    try {
      return layoutDeck(deck, theme, state.options, includeImages ? images : undefined);
    } catch (e) {
      console.error("layoutDeck failed:", e);
      return [];
    }
  }, [deck, theme, state.options, includeImages, images]);

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
    const caseCompany = state.caseStudyCompany.trim();
    const analysis = analyzeStudentTopic(topic, caseCompany);
    const provisionalCandidate = analysis.hasExplicitTitle
      ? analysis.caseStudy.coverTitle || analysis.cleanedTopic
      : "";
    const provisionalLiveTitle =
      provisionalCandidate &&
      !looksLikePlanLeak(provisionalCandidate) &&
      !isStructuralTitleOnly(provisionalCandidate)
        ? provisionalCandidate
        : "";
    const myRunId = ++runIdRef.current;
    runningRef.current = true;
    hasUserEditedRef.current = true;
    setState((s) => ({ ...s, meta: { ...s.meta, title: provisionalLiveTitle } }));
    setRun({ running: true, stage: "plan", sections: [], words: 0, model: "", startedAt: Date.now(), duration: undefined });
    try {
      let resolvedPlanTitle = "";
      const detected = !manualLangRef.current ? detectTopicLanguage(topic) : null;
      const effectiveLang = detected || state.language || "ar";
      if (effectiveLang !== state.language) {
        setState((s) => {
          const curSub = (s.meta.subtitle || "").trim();
          const shouldUpdateSubtitle = KNOWN_DEFAULT_SUBTITLES.has(curSub);
          return {
            ...s,
            language: effectiveLang,
            meta: {
              ...s.meta,
              subtitle: shouldUpdateSubtitle ? DEFAULT_SUBTITLES[effectiveLang] : s.meta.subtitle,
            },
          };
        });
      }
      const text = await generatePresentationDraft({
        provider,
        apiKey: key,
        topic,
        caseStudyCompany: caseCompany,
        size: state.aiSize,
        language: effectiveLang,
        customUrl,
        customModel,
        onResolvedPlan: (resolvedPlan) => {
          if (runIdRef.current !== myRunId) return;
          if (resolvedPlan?.title) {
            resolvedPlanTitle = resolvedPlan.title;
            const liveSanitized = sanitizeCoverTitleFromPlanLeak(
              resolvedPlan.title,
              analysis.hasCustomPlan ? analysis.customMabahith : undefined,
            );
            const safeLiveTitle =
              liveSanitized.cleaned &&
              !looksLikePlanLeak(liveSanitized.cleaned) &&
              !isStructuralTitleOnly(liveSanitized.cleaned)
                ? liveSanitized.cleaned
                : "";
            if (safeLiveTitle) {
              setState((s) => ({ ...s, meta: { ...s.meta, title: safeLiveTitle } }));
            }
          }
        },
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
      const rawCandidateCoverTitle =
        resolvedPlanTitle || analysis.caseStudy.coverTitle || analysis.cleanedTopic;
      const sanitizedCover = sanitizeCoverTitleFromPlanLeak(
        rawCandidateCoverTitle,
        analysis.hasCustomPlan ? analysis.customMabahith : undefined,
      );
      const pickSafe = (v?: string) =>
        v && !looksLikePlanLeak(v) && !isStructuralTitleOnly(v) ? v : "";
      const fallbackCoverTitle =
        effectiveLang === "fr"
          ? "Exposé académique"
          : effectiveLang === "en"
          ? "Academic Presentation"
          : "عرض تقديمي أكاديمي";
      const cleanCoverTitle =
        pickSafe(sanitizedCover.cleaned) ||
        pickSafe(analysis.caseStudy.coverTitle) ||
        pickSafe(analysis.cleanedTopic) ||
        (looksLikePlanLeak(topic) || isStructuralTitleOnly(topic) ? fallbackCoverTitle : topic);
      hasUserEditedRef.current = true;
      setState((s) => {
        const curLang = s.language || effectiveLang || "ar";
        const curSub = (s.meta.subtitle || "").trim();
        const shouldUpdateSub = KNOWN_DEFAULT_SUBTITLES.has(curSub) || !curSub;
        return {
          ...s,
          language: curLang,
          draftText: text,
          meta: {
            ...s.meta,
            title: cleanCoverTitle,
            subtitle: shouldUpdateSub ? DEFAULT_SUBTITLES[curLang] : s.meta.subtitle,
          },
        };
      });
      setRun((r) => ({
        ...r,
        running: false,
        stage: "done",
        duration: r.startedAt ? Math.round((Date.now() - r.startedAt) / 100) / 10 : undefined,
      }));
      setCompletedVersion((v) => v + 1);
      ui.toast("اكتمل توليد محتوى العرض", {
        description: analysis.hasCustomPlan
          ? `نُظّم المحتوى وفق خطتك (${analysis.customMabahith.length} مباحث${
              !analysis.hasIntroInPlan || !analysis.hasConclusionInPlan
                ? " + المقدمة والخاتمة تلقائياً"
                : ""
            }${analysis.caseStudy.hasCaseStudy ? " + دراسة حالة" : ""}). راجعه في المعاينة ثم نزّل ملف PowerPoint.`
          : `نُظّم المحتوى في شرائح${analysis.caseStudy.hasCaseStudy ? " مع قسم دراسة الحالة" : ""}. راجعه في المعاينة أو عدّله في المسودة ثم نزّل ملف PowerPoint.`,
      });
      trackEvent({ event_type: "generate", topic: `[PPTX] ${cleanCoverTitle}` }).catch(() => {});
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
  }, [converter.apiKey, converter.form, state.aiSize, state.aiTopic, state.caseStudyCompany, state.language, ui]);

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
      const res = await downloadPptx(laid, theme, {
        title: deck.title,
        author: coverMeta.presenters.join("، "),
      });
      if (res.inAppBrowser) {
        ui.openIOSModal("inApp");
        return;
      }
      if (!res.success) {
        ui.toast("تعذر إنشاء ملف PowerPoint", {
          tone: "error",
          description: res.error,
        });
        return;
      }
      const fileName = res.fileName || "عرض_تقديمي.pptx";
      ui.toast("تم تنزيل ملف PowerPoint", {
        description: res.nativeAndroid
          ? `تم حفظ ${fileName} في التنزيلات ومشاركته (${laid.length} شريحة).`
          : isIOS()
            ? `${fileName} — افتح تطبيق «الملفات» ➔ «التنزيلات» أو اضغط سهم التنزيل (↓) في Safari.`
            : `${fileName} — ${laid.length} شريحة قابلة للتعديل بالكامل.`,
      });
      trackEvent({
        event_type: "export_pptx",
        topic: deck.title,
        pages_count: laid.length,
        university: coverMeta.institution || undefined,
      }).catch(() => {});
      setTimeout(() => ui.setFeedbackOpen(true), 1200);
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
      setAiTopic: (aiTopic) => {
        if (!aiTopic.trim()) {
          manualLangRef.current = false;
        }
        if (!manualLangRef.current) {
          const detected = detectTopicLanguage(aiTopic);
          if (detected && detected !== state.language) {
            setState((s) => {
              const curSub = (s.meta.subtitle || "").trim();
              const shouldUpdateSubtitle = KNOWN_DEFAULT_SUBTITLES.has(curSub);
              return {
                ...s,
                aiTopic,
                language: detected,
                meta: {
                  ...s.meta,
                  subtitle: shouldUpdateSubtitle ? DEFAULT_SUBTITLES[detected] : s.meta.subtitle,
                },
              };
            });
            return;
          }
        }
        patch({ aiTopic });
      },
      setAiSize: (aiSize) => patch({ aiSize }),
      setCaseStudyCompany: (caseStudyCompany) => patch({ caseStudyCompany }),
      setLanguage,
      includeImages,
      setIncludeImages,
      loadingImages,
      imagesDuration,
      images,
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
      completedVersion,
    }),
    [
      state,
      patch,
      setMeta,
      setOptions,
      setLanguage,
      includeImages,
      setIncludeImages,
      loadingImages,
      imagesDuration,
      images,
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
      completedVersion,
    ],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePresentation() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePresentation must be used inside PresentationProvider");
  return v;
}
