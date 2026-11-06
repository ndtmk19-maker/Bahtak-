// أدوات بناء خطة البحث — منطق منقول من المشروع الأصلي في صورة دوال نقية تعمل على النص
import type { PlanItemType, ResearchPage } from '../types';

const ARABIC_ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
const WORD_ORD = '(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)';

export interface PlanRow {
  title: string;
  page: string;
  isMain: boolean;
}

export function parsePlanRows(itemsText: string): PlanRow[] {
  return itemsText
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((line) => {
      const parts = line.split('|');
      const title = parts[0].trim();
      const page = parts.length > 1 ? parts[1].trim() : '';
      const isMain =
        title.startsWith('المبحث') ||
        title.startsWith('مقدمة') ||
        title.includes('الخاتمة') ||
        title.includes('الخــاتـمـــة') ||
        title.includes('المصادر');
      return { title: title.replace(/^[-*]\s*/, ''), page, isMain };
    });
}

function splitLines(text: string): string[] {
  const v = text.trim();
  return v ? v.split('\n') : [];
}

/** إدراج العنصر في مكانه الأكاديمي الصحيح (قبل الخاتمة والمراجع) */
function insertSmart(lines: string[], formattedLine: string, type: PlanItemType): string[] {
  if (lines.length === 0) return [formattedLine];
  if (type === 'intro') return [formattedLine, ...lines];

  const findIdx = (pred: (t: string) => boolean) => lines.findIndex((l) => pred(l.trim()));
  if (type === 'mabhath' || type === 'matlab') {
    const idx = findIdx((t) => t.includes('الخاتمة') || t.includes('خاتمة') || t.includes('المصادر والمراجع') || t.includes('المراجع') || t.includes('الفهرس'));
    if (idx !== -1) lines.splice(idx, 0, formattedLine);
    else lines.push(formattedLine);
    return lines;
  }
  if (type === 'conclusion') {
    const idx = findIdx((t) => t.includes('المصادر والمراجع') || t.includes('المراجع') || t.includes('الفهرس'));
    if (idx !== -1) lines.splice(idx, 0, formattedLine);
    else lines.push(formattedLine);
    return lines;
  }
  lines.push(formattedLine);
  return lines;
}

function nextMabhathOrdinal(lines: string[]): string {
  const mabhathLines = lines.filter((l) => {
    const t = l.trim();
    return !t.startsWith('-') && !t.startsWith('*') && t.includes('المبحث');
  });
  const count = mabhathLines.length;
  const usesWords = mabhathLines.some((l) => new RegExp(`المبحث\\s*${WORD_ORD}`, 'i').test(l));
  if (usesWords) return ARABIC_ORDINALS[count] || `${count + 1}`;
  if (count > 0) return `${count + 1}`;
  return 'الأول';
}

function mabhathCount(lines: string[]): number {
  return lines.filter((l) => {
    const t = l.trim();
    return !t.startsWith('-') && !t.startsWith('*') && t.includes('المبحث');
  }).length;
}

function nextMatlabOrdinal(lines: string[]): string {
  let matCount = 0;
  const lastMatlabLines: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (!t.startsWith('-') && !t.startsWith('*') && t.includes('المبحث')) break;
    if (t.includes('المطلب')) {
      matCount++;
      lastMatlabLines.push(t);
    }
  }
  const usesWords = lastMatlabLines.some((l) => new RegExp(`المطلب\\s*${WORD_ORD}`, 'i').test(l));
  if (usesWords) return ARABIC_ORDINALS[matCount] || `${matCount + 1}`;
  if (matCount > 0) return `${matCount + 1}`;
  return 'الأول';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** إضافة سريعة بنقرة زر (نفس أرقام الصفحات التقديرية للنسخة الأصلية) */
export function quickInsertPlanItem(itemsText: string, type: PlanItemType): string {
  let lines = splitLines(itemsText);
  let formattedLine = '';
  if (type === 'mabhath') {
    formattedLine = `المبحث ${nextMabhathOrdinal(lines)}: [عنوان المبحث] | ص ${pad((mabhathCount(lines) + 1) * 2)}`;
  } else if (type === 'matlab') {
    formattedLine = `- المطلب ${nextMatlabOrdinal(lines)}: [عنوان المطلب] | ص ${pad(lines.length + 1)}`;
  } else if (type === 'intro') {
    formattedLine = 'المقدمة | ص 01';
  } else if (type === 'conclusion') {
    formattedLine = `الخاتمة | ص ${pad(lines.length + 2)}`;
  } else {
    formattedLine = `قائمة المصادر والمراجع | ص ${pad(lines.length + 3)}`;
  }
  lines = insertSmart(lines, formattedLine, type);
  return lines.join('\n');
}

/** إضافة عنصر مخصص بعنوان ورقم صفحة يدويين */
export function addCustomPlanItem(itemsText: string, type: PlanItemType, rawTitleIn: string, rawPageIn: string): string {
  let lines = splitLines(itemsText);
  let rawTitle = rawTitleIn.trim();
  const rawPage = rawPageIn.trim();

  let pageStr = 'ص 01';
  if (rawPage) {
    const cleanP = rawPage.replace(/^ص\s*/, '').trim();
    const numP = parseInt(cleanP, 10);
    pageStr = isNaN(numP) ? `ص ${cleanP}` : `ص ${pad(numP)}`;
  }

  let formattedLine = '';
  if (type === 'mabhath') {
    const ord = nextMabhathOrdinal(lines);
    if (!rawTitle) rawTitle = 'عنوان المبحث';
    if (/^المبحث\s*[:\s]/i.test(rawTitle)) {
      if (/^المبحث\s*:\s*/.test(rawTitle)) {
        const sub = rawTitle.replace(/^المبحث\s*:\s*/, '').trim() || 'عنوان المبحث';
        formattedLine = `المبحث ${ord}: ${sub} | ${pageStr}`;
      } else formattedLine = `${rawTitle} | ${pageStr}`;
    } else if (new RegExp(`^المبحث\\s+(${WORD_ORD.slice(1, -1)}|\\d+)`, 'i').test(rawTitle)) {
      formattedLine = `${rawTitle} | ${pageStr}`;
    } else {
      formattedLine = `المبحث ${ord}: ${rawTitle} | ${pageStr}`;
    }
  } else if (type === 'matlab') {
    const ord = nextMatlabOrdinal(lines);
    if (!rawTitle) rawTitle = 'عنوان المطلب';
    const cleanTitle = rawTitle.replace(/^[-*]\s*/, '').trim();
    if (/^المطلب\s*[:\s]/i.test(cleanTitle)) {
      if (/^المطلب\s*:\s*/.test(cleanTitle)) {
        const sub = cleanTitle.replace(/^المطلب\s*:\s*/, '').trim() || 'عنوان المطلب';
        formattedLine = `- المطلب ${ord}: ${sub} | ${pageStr}`;
      } else formattedLine = `- ${cleanTitle} | ${pageStr}`;
    } else if (/^المطلب\s+(الأول|الثاني|الثالث|الرابع|الخامس|\d+)/i.test(cleanTitle)) {
      formattedLine = `- ${cleanTitle} | ${pageStr}`;
    } else {
      formattedLine = `- المطلب ${ord}: ${cleanTitle} | ${pageStr}`;
    }
  } else if (type === 'intro') {
    formattedLine = `${rawTitle || 'المقدمة'} | ${pageStr}`;
  } else if (type === 'conclusion') {
    formattedLine = `${rawTitle || 'الخاتمة'} | ${pageStr}`;
  } else {
    formattedLine = `${rawTitle || 'قائمة المصادر والمراجع'} | ${pageStr}`;
  }
  lines = insertSmart(lines, formattedLine, type);
  return lines.join('\n');
}

/** إعادة ترقيم أرقام الصفحات بالتسلسل (المبحث يأخذ صفحتين) */
export function autoFixPlanPageNumbers(itemsText: string): string {
  const lines = itemsText.split('\n').filter((l) => l.trim() !== '');
  let cur = 1;
  return lines
    .map((line) => {
      const title = line.split('|')[0].trim();
      const pageStr = `ص ${pad(cur)}`;
      cur += title.startsWith('المبحث') ? 2 : 1;
      return `${title} | ${pageStr}`;
    })
    .join('\n');
}

/** توليد الخطة من عناوين صفحات البحث الحالية */
export function generatePlanFromPages(pages: ResearchPage[]): string {
  const items: string[] = [];
  let lastMabhath = '';
  pages.forEach((page, idx) => {
    const pageNumStr = `ص ${pad(idx + 1)}`;
    const mabhath = (page.mabhathTitle || '').trim();
    const matlab = (page.matlabTitle || '').trim();
    if (mabhath && mabhath !== lastMabhath) {
      lastMabhath = mabhath;
      items.push(`${mabhath} | ${pageNumStr}`);
    }
    if (matlab) items.push(`- ${matlab.replace(/^[-*]\s*/, '')} | ${pageNumStr}`);
  });
  return items.join('\n');
}
