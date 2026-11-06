import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CoverState, DocumentState, PlanState, ResearchPage } from '../types';
import { createDefaultDocument } from '../data/defaults';
import { clearSavedDocument, loadSavedDocument, saveDocument } from '../lib/storage';
import { imageToDataUrl } from '../lib/image';
import { pageHtmlToText, textToPageHtml } from '../lib/pageText';
import type { ParseResult } from '../lib/parser';

export type SaveStatus = 'idle' | 'saving' | 'saved';

interface DocumentApi {
  doc: DocumentState;
  /** يزداد عند التغييرات البنيوية لإعادة تهيئة محررات الصفحات */
  pagesVersion: number;
  saveStatus: SaveStatus;
  restored: boolean;
  update: (patch: Partial<DocumentState>) => void;
  updateCover: (patch: Partial<CoverState>) => void;
  updateCoverWith: (fn: (c: CoverState) => Partial<CoverState>) => void;
  updatePlan: (patch: Partial<PlanState>) => void;
  updatePage: (index: number, patch: Partial<ResearchPage>) => void;
  setPageText: (index: number, text: string) => void;
  cleanPage: (index: number) => void;
  addPage: () => void;
  removePage: (index: number) => void;
  splitPage: (index: number) => boolean;
  applyParsed: (result: ParseResult) => void;
  reset: () => void;
}

const Ctx = createContext<DocumentApi | null>(null);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const initial = useRef<{ doc: DocumentState; restored: boolean } | null>(null);
  if (!initial.current) {
    const saved = loadSavedDocument();
    initial.current = { doc: saved || createDefaultDocument(), restored: !!saved };
  }
  const [doc, setDoc] = useState<DocumentState>(initial.current.doc);
  const [pagesVersion, setPagesVersion] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const bump = () => setPagesVersion((v) => v + 1);

  // الحفظ التلقائي الفعلي (النسخة الأصلية كانت تحفظ عند الإغلاق فقط ولا تسترجع أبداً)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveStatus('saving');
    const t = setTimeout(() => {
      saveDocument(doc);
      setSaveStatus('saved');
    }, 500);
    return () => clearTimeout(t);
  }, [doc]);

  // إعادة توليد نسخة Base64 لشعار الجامعة المسترجع لدعم تصدير Word
  useEffect(() => {
    const cs = initial.current?.doc.coverState;
    if (cs && cs.logoUrl && !cs.logoBase64 && !cs.logoUrl.startsWith('data:')) {
      const url = cs.logoUrl;
      imageToDataUrl(url).then((b64) =>
        setDoc((d) => (d.coverState.logoUrl === url ? { ...d, coverState: { ...d.coverState, logoBase64: b64 } } : d)),
      );
    }
  }, []);

  const update = useCallback((patch: Partial<DocumentState>) => setDoc((d) => ({ ...d, ...patch })), []);
  const updateCover = useCallback((patch: Partial<CoverState>) => setDoc((d) => ({ ...d, coverState: { ...d.coverState, ...patch } })), []);
  const updateCoverWith = useCallback(
    (fn: (c: CoverState) => Partial<CoverState>) => setDoc((d) => ({ ...d, coverState: { ...d.coverState, ...fn(d.coverState) } })),
    [],
  );
  const updatePlan = useCallback((patch: Partial<PlanState>) => setDoc((d) => ({ ...d, planState: { ...d.planState, ...patch } })), []);
  const updatePage = useCallback(
    (index: number, patch: Partial<ResearchPage>) =>
      setDoc((d) => ({ ...d, pages: d.pages.map((p, i) => (i === index ? { ...p, ...patch } : p)) })),
    [],
  );
  const setPageText = useCallback((index: number, text: string) => updatePage(index, { content: textToPageHtml(text) }), [updatePage]);

  const cleanPage = useCallback((index: number) => {
    setDoc((d) => ({
      ...d,
      pages: d.pages.map((p, i) => (i === index ? { ...p, content: textToPageHtml(pageHtmlToText(p.content)) } : p)),
    }));
    bump();
  }, []);

  const addPage = useCallback(() => {
    setDoc((d) => {
      const n = d.pages.length + 1;
      return {
        ...d,
        pages: [
          ...d.pages,
          { mabhathTitle: n === 1 ? 'المبحث الأول' : '', matlabTitle: `المطلب ${n}`, content: '<p class="doc-paragraph">اكتب هنا محتوى وفقرات البحث...</p>', footnotes: [] },
        ],
      };
    });
    bump();
  }, []);

  const removePage = useCallback((index: number) => {
    setDoc((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== index) }));
    bump();
  }, []);

  // تقسيم صفحة طويلة إلى صفحتين مع توزيع الهوامش بالتساوي
  const splitPage = useCallback(
    (index: number) => {
      const page = doc.pages[index];
      if (!page) return false;
      const paragraphs = pageHtmlToText(page.content)
        .split('\n\n')
        .filter((p) => p.trim() !== '');
      if (paragraphs.length <= 1) return false;
      const mid = Math.ceil(paragraphs.length / 2);
      const fns = page.footnotes || [];
      const fnMid = Math.ceil(fns.length / 2);
      const first: ResearchPage = { ...page, content: textToPageHtml(paragraphs.slice(0, mid).join('\n\n')), footnotes: fns.slice(0, fnMid) };
      const second: ResearchPage = { mabhathTitle: '', matlabTitle: '', content: textToPageHtml(paragraphs.slice(mid).join('\n\n')), footnotes: fns.slice(fnMid) };
      setDoc((d) => {
        const pages = [...d.pages];
        pages.splice(index, 1, first, second);
        return { ...d, pages };
      });
      bump();
      return true;
    },
    [doc.pages],
  );

  const applyParsed = useCallback((r: ParseResult) => {
    setDoc((d) => ({
      ...d,
      pages: r.pages,
      coverState: { ...d.coverState, subtitle: '', ...(r.detectedTitle ? { title: r.detectedTitle } : {}) },
      planState: { ...d.planState, itemsText: r.planText, ...(r.detectedTitle ? { researchTitle: r.detectedTitle } : {}) },
    }));
    bump();
  }, []);

  const reset = useCallback(() => {
    clearSavedDocument();
    setDoc(createDefaultDocument());
    bump();
  }, []);

  const api = useMemo<DocumentApi>(
    () => ({
      doc,
      pagesVersion,
      saveStatus,
      restored: initial.current!.restored,
      update,
      updateCover,
      updateCoverWith,
      updatePlan,
      updatePage,
      setPageText,
      cleanPage,
      addPage,
      removePage,
      splitPage,
      applyParsed,
      reset,
    }),
    [doc, pagesVersion, saveStatus, update, updateCover, updateCoverWith, updatePlan, updatePage, setPageText, cleanPage, addPage, removePage, splitPage, applyParsed, reset],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useDocument() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDocument must be used inside DocumentProvider');
  return v;
}
