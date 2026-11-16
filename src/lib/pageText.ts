// تحويل نص المحرر (صيغة مبسطة) إلى HTML الصفحة والعكس.
// الصيغة المبسطة:
//   ### عنوان مبحث داخل الصفحة   ## عنوان مطلب   # عنوان فرعي   - نقطة
//   الجدول رقم (01): عنوان  ثم أسطر | Markdown |  ثم «المصدر: ...»
//   الشكل رقم (01): عنوان   ثم [[CHART {...}]]   ثم «المصدر: ...»
import { escapeHtml } from './escape';
import {
  CHART_MARKER_RE,
  FIGURE_CAPTION_RE,
  SOURCE_LINE_RE,
  TABLE_CAPTION_RE,
  chartToMarker,
  figureLabel,
  isTableRowLine,
  normalizeDigits,
  parseChartSpec,
  parseMarkdownTable,
  parseTableHtml,
  renderFigureHtml,
  renderTableHtml,
  splitContentSegments,
  tableToMarkdown,
} from './docBlocks';

const ORDINAL_BULLET =
  /^(?:[-*•–—]\s*)?(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)\s*[:/\-–—.]/i;

function citations(text: string): string {
  return text.replace(/\$?[\^](\d+)\$?/g, '<sup>$1</sup>').replace(/\[(\d+)\]/g, '<sup>$1</sup>');
}

function captionNumber(raw: string | undefined, fallback: number): number {
  const n = raw ? parseInt(normalizeDigits(raw), 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function textToPageHtml(text: string): string {
  if (!text || !text.trim()) return '';
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let curParagraph: string[] = [];
  let tableCount = 0;
  let figureCount = 0;

  const flushParagraph = () => {
    if (curParagraph.length > 0) {
      const pText = curParagraph.join(' ').trim();
      if (pText) html += `<p class="doc-paragraph">${citations(pText)}</p>`;
      curParagraph = [];
    }
  };
  const flushList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flushAll();
      continue;
    }

    // جدول: عنوان اختياري ثم أسطر Markdown ثم مصدر اختياري
    const tableCap = TABLE_CAPTION_RE.exec(line);
    const tableStartsHere = isTableRowLine(line) || (tableCap && lines[i + 1] && isTableRowLine(lines[i + 1].trim()));
    if (tableStartsHere) {
      flushAll();
      let caption = '';
      let num = tableCount + 1;
      let continued = false;
      if (tableCap && !isTableRowLine(line)) {
        caption = tableCap[3];
        num = captionNumber(tableCap[2], num);
        continued = Boolean(tableCap[1]);
        i++;
      }
      const rows: string[] = [];
      while (i < lines.length && isTableRowLine(lines[i].trim())) rows.push(lines[i++].trim());
      let source = '';
      const sm = i < lines.length ? SOURCE_LINE_RE.exec(lines[i].trim()) : null;
      if (sm) source = sm[1];
      else i--;
      const table = parseMarkdownTable(rows, caption, source);
      if (table) {
        tableCount = Math.max(tableCount, num);
        html += renderTableHtml(table, num, { continued });
      } else {
        rows.forEach((r) => (html += `<p class="doc-paragraph">${escapeHtml(r)}</p>`));
      }
      continue;
    }

    // شكل بياني: عنوان اختياري ثم وسم [[CHART]] ثم مصدر اختياري
    const figCap = FIGURE_CAPTION_RE.exec(line);
    const markerLine = figCap && lines[i + 1] ? lines[i + 1].trim() : line;
    const marker = CHART_MARKER_RE.exec(markerLine);
    if (marker && (figCap || markerLine === line)) {
      flushAll();
      if (figCap) i++;
      const chart = parseChartSpec(marker[1]);
      if (chart) {
        const num = captionNumber(figCap?.[1], figureCount + 1);
        figureCount = Math.max(figureCount, num);
        const sm = lines[i + 1] ? SOURCE_LINE_RE.exec(lines[i + 1].trim()) : null;
        if (sm) i++;
        html += renderFigureHtml({ ...chart, title: figCap?.[2] || chart.title, source: sm?.[1] || chart.source }, num);
      }
      continue;
    }

    if (line.startsWith('### ')) {
      flushAll();
      html += `<div class="doc-mabhath-title doc-mabhath-title--inline">${escapeHtml(line.replace(/^###\s*/, ''))}</div>`;
    } else if (line.startsWith('## ')) {
      flushAll();
      html += `<div class="doc-matlab-title">${escapeHtml(line.replace(/^##\s*/, ''))}</div>`;
    } else if (line.startsWith('# ')) {
      flushAll();
      html += `<div class="doc-subtitle">${escapeHtml(line.replace(/^#+\s*/, ''))}</div>`;
    } else if (/^[-*•–—]\s+/.test(line) || ORDINAL_BULLET.test(line) || /^\(?\d+[\.\-\)/:]\s+/.test(line)) {
      flushParagraph();
      if (!inList) {
        html += '<ul class="doc-ul">';
        inList = true;
      }
      html += `<li class="doc-li">${citations(line.replace(/^[-*•–—]\s*/, ''))}</li>`;
    } else {
      flushList();
      curParagraph.push(line);
    }
  }

  flushAll();
  return html;
}

/** تحويل مقطع HTML نصي (دون جداول/أشكال) إلى صيغة المحرر */
function textualHtmlToText(html: string): string {
  let text = html || '';
  text = text.replace(/<div class="doc-mabhath-title[^"]*">([\s\S]*?)<\/div>/gi, '### $1\n\n');
  text = text.replace(/<div class="doc-matlab-title">([\s\S]*?)<\/div>/gi, '## $1\n\n');
  text = text.replace(/<div class="doc-subtitle">([\s\S]*?)<\/div>/gi, '# $1\n\n');
  text = text.replace(/<p class="doc-paragraph[^"]*">([\s\S]*?)<\/p>/gi, '$1\n\n');
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  text = text.replace(/<\/?ul[^>]*>/gi, '\n');
  text = text.replace(/<br\s*[/]?>/gi, '\n');
  // الحفاظ على أرقام الإحالات بصيغة ^1 بدلاً من فقدانها عند إزالة الوسوم
  text = text.replace(/<sup>(\d+)<\/sup>/gi, '^$1');
  text = text.replace(/&nbsp;/g, ' ');
  const temp = document.createElement('div');
  temp.innerHTML = text;
  return temp.textContent || text;
}

export function pageHtmlToText(html: string): string {
  const parts = splitContentSegments(html || '').map((seg) => {
    if (seg.kind === 'table') {
      const parsed = parseTableHtml(seg.html);
      return parsed ? `\n\n${tableToMarkdown(parsed.table, parsed.label)}\n\n` : '';
    }
    if (seg.kind === 'figure') {
      if (!seg.chart) return '';
      const num = /data-figure-number="(\d+)"/.exec(seg.html);
      const label = figureLabel(num ? parseInt(num[1], 10) : 1, seg.chart.title);
      const source = seg.chart.source ? `\nالمصدر: ${seg.chart.source}` : '';
      return `\n\n${label}\n${chartToMarker({ ...seg.chart, source: '' })}${source}\n\n`;
    }
    return textualHtmlToText(seg.html);
  });
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}
