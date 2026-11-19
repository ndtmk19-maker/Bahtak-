import type { ResearchLanguage } from '../types';

/** كلمات شائعة وحصرية تميز اللغة الفرنسية الأكاديمية */
const FR_MARKERS = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'dans', 'sur', 'pour',
  'par', 'avec', 'au', 'aux', 'ce', 'cette', 'ces', 'est', 'sont', 'qui', 'que', 'quoi',
  'dont', 'ou', 'où', 'mais', 'donc', 'or', 'ni', 'car', 'comme', 'sous', 'vers', 'chez',
  'recherche', 'titre', 'thèse', 'these', 'mémoire', 'memoire', 'étude', 'etude', 'impact',
  'rôle', 'role', 'gestion', 'développement', 'developpement', 'système', 'systeme',
  'performance', 'entreprise', 'organisation', 'numérique', 'numerique', 'stratégie',
  'strategie', 'analyse', 'évaluation', 'evaluation', 'chapitre', 'section', 'sommaire',
  'introduction', 'conclusion', 'problématique', 'problematique', 'décision', 'decision',
  'financier', 'financière', 'financiere', 'marché', 'marche', 'humain', 'humaine', 'social'
]);

/** كلمات شائعة وحصرية تميز اللغة الإنجليزية الأكاديمية */
const EN_MARKERS = new Set([
  'the', 'of', 'and', 'in', 'to', 'for', 'with', 'on', 'at', 'by', 'from', 'an', 'a',
  'is', 'are', 'was', 'were', 'as', 'that', 'this', 'these', 'those', 'it', 'its',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'or', 'so',
  'if', 'not', 'about', 'into', 'over', 'after', 'study', 'research', 'paper', 'role',
  'impact', 'management', 'development', 'system', 'performance', 'analysis', 'business',
  'digital', 'strategy', 'evaluation', 'chapter', 'section', 'contents', 'introduction',
  'conclusion', 'framework', 'overview', 'challenges', 'opportunities', 'financial', 'market'
]);

/**
 * اكتشاف تلقائي ذكي للغة موضوع أو خطة البحث (عربية، فرنسية، إنجليزية).
 * يُرجع null إذا كان النص قصيراً جداً أو غير واضح المعالم.
 */
export function detectTopicLanguage(raw: string): ResearchLanguage | null {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.trim();
  if (text.length < 3) return null;

  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinCount = (text.match(/[A-Za-z\u00C0-\u024F]/g) || []).length;

  // إذا كانت الأحرف العربية هي الغالبة
  if (arabicCount > latinCount) {
    return arabicCount >= 2 ? 'ar' : null;
  }

  // إذا لم يكن هناك حد أدنى من الأحرف اللاتينية
  if (latinCount < 3) return null;

  // الأحرف الخاصة بالفرنسية (Accents: é, è, ê, ë, à, â, î, ï, ô, ù, û, ç)
  const frenchAccents = (text.match(/[éèêëàâîïôùûçÉÈÊËÀÂÎÏÔÙÛÇ]/g) || []).length;
  if (frenchAccents >= 1) {
    return 'fr';
  }

  // علامات الاختصار الفرنسية المميزة: l', d', c', j', m', n', s', qu'
  if (/\b(?:l|d|c|j|m|n|s|qu)['’][a-z]/i.test(text)) {
    return 'fr';
  }

  // تحليل الكلمات
  const words = text
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  let frScore = 0;
  let enScore = 0;

  for (const w of words) {
    if (FR_MARKERS.has(w)) frScore++;
    if (EN_MARKERS.has(w)) enScore++;
  }

  if (frScore > enScore) return 'fr';
  if (enScore > frScore) return 'en';

  // إذا تعادلت الكلمات أو كانت المصطلحات تقنية بحتة (مثل Big Data, Blockchain):
  // في الجامعات والمؤسسات الجزائرية والمغاربية، البحوث المكتوبة باللاتينية فرنسية بالدرجة الأولى.
  return 'fr';
}
