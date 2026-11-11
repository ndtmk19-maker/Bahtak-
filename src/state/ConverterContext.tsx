import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useDocument } from './DocumentContext';
import { useUI } from './UIContext';
import { parseRawText, ParseError } from '../lib/parser';
import { AI_LENGTHS, generateResearch, resolveCaseStudySpec, type AiLength, type AiProvider, type SectionProgress } from '../lib/aiGenerate';
import { loadApiKey, loadRawText, saveApiKey, saveRawText } from '../lib/storage';
import { getEffectiveGeminiKey } from '../lib/aiKeys';
import { trackEvent } from '../lib/analytics';

export type ConverterMode = 'paste' | 'ai';

export interface AiForm {
  provider: AiProvider;
  topic: string;
  length: AiLength;
  mabhathCount: string;
  matlabCount: string;
  caseStudyCompany: string;
  customUrl: string;
  customModel: string;
}

export interface AiRun {
  running: boolean;
  stage: 'idle' | 'plan' | 'writing' | 'done';
  sections: SectionProgress[];
  words: number;
  model: string;
  startedAt: number;
  duration: number | null;
}

interface ConverterApi {
  mode: ConverterMode;
  setMode: (m: ConverterMode) => void;
  rawText: string;
  setRawText: (t: string) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  form: AiForm;
  setForm: (p: Partial<AiForm>) => void;
  run: AiRun;
  parse: (opts?: { silent?: boolean; text?: string; overrideTitle?: string }) => number | null;
  generate: () => Promise<void>;
}

const Ctx = createContext<ConverterApi | null>(null);
const isMobile = () => window.matchMedia('(max-width: 1023px)').matches;

export function ConverterProvider({ children }: { children: ReactNode }) {
  const { applyParsed, doc } = useDocument();
  const ui = useUI();
  const [mode, setMode] = useState<ConverterMode>('paste');
  const [rawText, setRawTextState] = useState(loadRawText);
  const [apiKey, setApiKeyState] = useState(loadApiKey);
  const [form, setFormState] = useState<AiForm>({ provider: 'gemini', topic: '', length: 'medium', mabhathCount: '2', matlabCount: '2', caseStudyCompany: '', customUrl: '', customModel: '' });
  const [run, setRun] = useState<AiRun>({ running: false, stage: 'idle', sections: [], words: 0, model: 'Gemini 2.5 Flash', startedAt: 0, duration: null });
  const runningRef = useRef(false);

  useEffect(() => {
    if (runningRef.current) return;
    const t = setTimeout(() => saveRawText(rawText), 400);
    return () => clearTimeout(t);
  }, [rawText]);

  const setApiKey = useCallback((k: string) => {
    setApiKeyState(k);
    saveApiKey(k);
  }, []);

  const setForm = useCallback((p: Partial<AiForm>) => {
    setFormState((f) => {
      const next = { ...f, ...p };
      // تغيير حجم البحث يضبط عدد المباحث والمطالب الافتراضي كما في النسخة الأصلية
      if (p.length && p.length !== f.length) {
        next.mabhathCount = AI_LENGTHS[p.length].mabhath;
        next.matlabCount = AI_LENGTHS[p.length].matlab;
      }
      return next;
    });
  }, []);

  const parse = useCallback(
    (opts?: { silent?: boolean; text?: string; overrideTitle?: string }) => {
      try {
        const result = parseRawText(opts?.text ?? rawText);
        if (opts?.overrideTitle) {
          result.detectedTitle = opts.overrideTitle;
        }
        applyParsed(result);
        ui.setSection('pages');
        if (isMobile()) ui.setMobileView('preview');
        if (!opts?.silent) {
          ui.toast(`تم تنسيق البحث في ${result.pages.length} صفحة`, {
            description: 'تم تحديث الغلاف والخطة، وتوزيع الهوامش وإعادة ترقيمها في أسفل كل صفحة.',
          });
        }
        return result.pages.length;
      } catch (err) {
        ui.toast(err instanceof ParseError ? err.message : 'تعذر تحليل النص.', { tone: 'error' });
        return null;
      }
    },
    [rawText, applyParsed, ui],
  );

  const generate = useCallback(async () => {
    if (runningRef.current) return;
    const effectiveKey = form.provider === 'gemini' ? getEffectiveGeminiKey(apiKey) : apiKey.trim();
    if (!effectiveKey) {
      ui.openKeyGuide(
        form.provider === 'gemini'
          ? 'خطوة واحدة متبقية فقط: فعّل رمزك المجاني من Google في 30 ثانية لمرة واحدة لتتمكن من التوليد فوراً.'
          : 'يرجى إدخال رمز API الخاص بهذا المزود للمتابعة.',
      );
      return;
    }
    const exactUserTopic = form.topic.trim();
    if (!exactUserTopic) {
      ui.toast('يرجى كتابة عنوان أو موضوع البحث المراد توليده.', { tone: 'error' });
      document.getElementById('ai-topic-input')?.focus();
      return;
    }
    runningRef.current = true;
    const startedAt = Date.now();
    setRun((r) => ({ ...r, running: true, stage: 'plan', sections: [], words: 0, startedAt, duration: null }));
    try {
      const finalText = await generateResearch({
        provider: form.provider,
        apiKey: effectiveKey,
        topic: exactUserTopic,
        length: form.length,
        mabhathCount: form.mabhathCount,
        matlabCount: form.matlabCount,
        caseStudyCompany: form.caseStudyCompany.trim(),
        customUrl: form.customUrl,
        customModel: form.customModel,
        onSections: (sections) => setRun((r) => ({ ...r, sections })),
        onDraft: (text, words) => {
          setRawTextState(text);
          setRun((r) => ({ ...r, words }));
        },
        onModel: (model) => setRun((r) => ({ ...r, model })),
        onStage: (stage) => setRun((r) => ({ ...r, stage })),
      });
      const duration = Math.round((Date.now() - startedAt) / 100) / 10;
      setRun((r) => ({ ...r, running: false, stage: 'done', duration }));
      saveRawText(finalText);
      const count = parse({ silent: true, text: finalText, overrideTitle: exactUserTopic });
      if (count) {
        const hasCs = resolveCaseStudySpec(exactUserTopic, form.caseStudyCompany).hasCaseStudy;
        ui.toast(`اكتمل توليد البحث في ${duration} ثانية`, {
          description: `${count} صفحة A4 منسقة (الهدف الأساسي: ${AI_LENGTHS[form.length].target}${hasCs ? ' + 1 إلى 3 صفحات لدراسة الحالة' : ''}). جاري الانتقال إلى المحرر الكامل وورقة A4...`,
        });
      }

      // تسجيل عملية التوليد في الإحصائيات وسحابة Supabase بأمان
      try {
        trackEvent({
          event_type: 'generate',
          topic: form.topic.trim(),
          pages_count: count || undefined,
          university: doc?.coverState?.universityName || undefined,
        });
      } catch (trackErr) {
        console.warn('Analytics tracking error:', trackErr);
      }

      // الانتقال التلقائي إلى المحرر الكامل وورقة A4
      setTimeout(() => {
        ui.setViewMode('classic');
      }, 700);
    } catch (err) {
      setRun((r) => ({ ...r, running: false, stage: 'idle' }));
      const msg = err instanceof Error ? err.message : String(err);
      ui.toast('تعذر إكمال التوليد', { tone: 'error', description: `${msg} — تأكد من صحة المفتاح واتصالك بالإنترنت.` });
    } finally {
      runningRef.current = false;
    }
  }, [apiKey, doc, form, parse, ui]);

  const api = useMemo<ConverterApi>(
    () => ({ mode, setMode, rawText, setRawText: setRawTextState, apiKey, setApiKey, form, setForm, run, parse, generate }),
    [mode, rawText, apiKey, setApiKey, form, setForm, run, parse, generate],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useConverter() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useConverter must be used inside ConverterProvider');
  return v;
}
