import type { DocumentState } from '../types';
import { createDefaultDocument } from '../data/defaults';

// نفس مفاتيح التخزين المستخدمة في النسخة الأصلية للحفاظ على التوافق
const DOC_KEY = 'saved_baht_document';
const LEGACY_DOC_KEY = 'baht_editor_state_v1';
const AI_KEY = 'bahtak_ai_api_key';
const AI_KEY_LEGACY = 'bahthi_ai_api_key';
const RAW_TEXT_KEY = 'bahtak_raw_text';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* المساحة ممتلئة أو التخزين معطل */
  }
}
function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* تجاهل */
  }
}

/** استرجاع البحث المحفوظ مع دمجه بالقيم الافتراضية لتفادي الحقول الناقصة */
export function loadSavedDocument(): DocumentState | null {
  const raw = safeGet(DOC_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Partial<DocumentState>;
    const base = createDefaultDocument();
    return {
      ...base,
      ...saved,
      coverState: { ...base.coverState, ...(saved.coverState || {}) },
      planState: { ...base.planState, ...(saved.planState || {}) },
      pages: Array.isArray(saved.pages) ? saved.pages : base.pages,
    };
  } catch {
    return null;
  }
}

export function saveDocument(doc: DocumentState) {
  // لا نخزن نسخة Base64 لشعار الجامعة المدرج (يعاد توليدها) لتقليل الحجم
  const isCustom = doc.coverState.selectedUnivId === 'custom';
  const slim = isCustom ? doc : { ...doc, coverState: { ...doc.coverState, logoBase64: '' } };
  safeSet(DOC_KEY, JSON.stringify(slim));
}

export function clearSavedDocument() {
  safeRemove(DOC_KEY);
  safeRemove(LEGACY_DOC_KEY);
  safeRemove(RAW_TEXT_KEY);
}

export function loadRawText(): string {
  return safeGet(RAW_TEXT_KEY) || '';
}
export function saveRawText(text: string) {
  if (text) safeSet(RAW_TEXT_KEY, text);
  else safeRemove(RAW_TEXT_KEY);
}

export function loadApiKey(): string {
  return (safeGet(AI_KEY) || safeGet(AI_KEY_LEGACY) || '').trim();
}
export function saveApiKey(key: string) {
  const k = key.trim();
  if (k) {
    safeSet(AI_KEY, k);
    safeSet(AI_KEY_LEGACY, k);
  } else {
    safeRemove(AI_KEY);
    safeRemove(AI_KEY_LEGACY);
  }
}

export const session = {
  get(key: string) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* تجاهل */
    }
  },
};
