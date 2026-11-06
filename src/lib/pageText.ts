// تحويل نص المحرر (صيغة مبسطة) إلى HTML الصفحة والعكس — منقول من المشروع الأصلي
import { escapeHtml } from './escape';

const ORDINAL_BULLET =
  /^(?:[-*•–—]\s*)?(?:أولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|ثامناً|ثامنا|تاسعاً|تاسعا|عاشراً|عاشرا)\s*[:/\-–—.]/i;

function citations(text: string): string {
  return text.replace(/\$?[\^](\d+)\$?/g, '<sup>$1</sup>').replace(/\[(\d+)\]/g, '<sup>$1</sup>');
}

export function textToPageHtml(text: string): string {
  if (!text || !text.trim()) return '';
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let curParagraph: string[] = [];

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

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      html += `<div class="doc-matlab-title">${escapeHtml(line.replace(/^##\s*/, ''))}</div>`;
    } else if (line.startsWith('# ')) {
      flushParagraph();
      flushList();
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
  });

  flushParagraph();
  flushList();
  return html;
}

export function pageHtmlToText(html: string): string {
  let text = html || '';
  text = text.replace(/<div class="doc-matlab-title">([\s\S]*?)<\/div>/gi, '## $1\n\n');
  text = text.replace(/<div class="doc-subtitle">([\s\S]*?)<\/div>/gi, '# $1\n\n');
  text = text.replace(/<p class="doc-paragraph">([\s\S]*?)<\/p>/gi, '$1\n\n');
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  text = text.replace(/<\/?ul[^>]*>/gi, '\n');
  text = text.replace(/<br\s*[/]?>/gi, '\n');
  // الحفاظ على أرقام الإحالات بصيغة ^1 بدلاً من فقدانها عند إزالة الوسوم
  text = text.replace(/<sup>(\d+)<\/sup>/gi, '^$1');
  text = text.replace(/&nbsp;/g, ' ');
  const temp = document.createElement('div');
  temp.innerHTML = text;
  return (temp.textContent || text).replace(/\n{3,}/g, '\n\n').trim();
}
