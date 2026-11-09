// تصدير البحث بصيغة Word (.doc) متوافقة تماماً مع Microsoft Word ومطابقة لتصميم PDF والأبعاد الأكاديمية
import type { BorderStyle, CoverTheme, DocumentState } from '../types';
import { escapeHtml } from './escape';
import { parsePlanRows } from './plan';
import { PLACEHOLDER_TITLE } from '../data/defaults';

const PAGE_BREAK = '<div style="page-break-before: always; mso-break-type: section-break; height: 0; line-height: 0; font-size: 0;"></div>';

function getWordBorderCss(style: BorderStyle, theme?: CoverTheme): string {
  if (style === 'none') return 'none';
  if (style === 'single') return '1.5pt solid #222222';
  if (style === 'gold' || theme === 'gold') return '4.5pt double #c5a059';
  return '4.5pt double #000000';
}

function getLogoDimensions(size?: string): { width: number; height: number } {
  switch (size) {
    case 'compact':
      return { width: 65, height: 65 };
    case 'medium':
      return { width: 75, height: 75 };
    case 'xlarge':
      return { width: 95, height: 95 };
    case 'large':
    default:
      return { width: 85, height: 85 };
  }
}

export function buildWordHtml(doc: DocumentState): { html: string; fileName: string } {
  const cs = doc.coverState;
  const docTitle = cs.title && cs.title !== PLACEHOLDER_TITLE ? cs.title.trim() : 'بحث_أكاديمي_منسق';
  const sections: string[] = [];

  // ==============================================================
  // 1. صفحة الغلاف الأكاديمية (Cover Page)
  // ==============================================================
  if (cs.enabled) {
    const isGoldTheme = cs.theme === 'gold';
    const themeColor = isGoldTheme ? '#c5a059' : '#000000';
    const titleColor = isGoldTheme ? '#0f2952' : '#000000';
    const subtitleColor = isGoldTheme ? '#334155' : '#000000';
    const coverBorderCss = getWordBorderCss(doc.borderStyle, cs.theme);
    const logoDims = getLogoDimensions(cs.logoSize);

    const logo = cs.logoBase64 || cs.logoUrl;
    const logoCell = (side: 'right' | 'left') => {
      if (!logo || (cs.logoPosition !== 'both' && cs.logoPosition !== side)) {
        return `<div style="width: ${logoDims.width}pt; height: ${logoDims.height}pt;"></div>`;
      }
      return `<img src="${logo}" width="${logoDims.width}" height="${logoDims.height}" style="max-width: ${logoDims.width}pt; max-height: ${logoDims.height}pt; object-fit: contain; vertical-align: middle;">`;
    };

    const studentsHtml = (cs.studentsText || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `<div style="font-family: 'Cairo', Arial, sans-serif; font-size: 11pt; font-weight: bold; color: #111; margin-bottom: 3pt;">${escapeHtml(s)}</div>`)
      .join('');

    const coverHtml = `
    <table dir="rtl" style="width: 100%; border-collapse: collapse; border: ${coverBorderCss}; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
      <tr>
        <td style="padding: 12pt 14pt; vertical-align: top;">
          
          <!-- الترويسة الجامعية الرسمية -->
          <table dir="rtl" style="width: 100%; border-collapse: collapse; margin-bottom: 6pt;">
            <tr>
              <td style="width: 25%; text-align: right; vertical-align: middle;">
                ${logoCell('right')}
              </td>
              <td style="width: 50%; text-align: center; vertical-align: middle;">
                <div style="font-family: 'Cairo', Arial, sans-serif; font-size: 13.5pt; font-weight: bold; color: ${themeColor}; margin-bottom: 2pt;">${escapeHtml(cs.country || '')}</div>
                <div style="font-family: 'Cairo', Arial, sans-serif; font-size: 11pt; font-weight: bold; color: ${isGoldTheme ? '#475569' : '#000000'}; margin-bottom: 2pt;">${escapeHtml(cs.ministry || '')}</div>
                ${cs.universityName ? `<div style="font-family: 'Cairo', Arial, sans-serif; font-size: 12pt; font-weight: bold; color: ${isGoldTheme ? '#0f172a' : '#000000'}; margin-bottom: 2pt;">${escapeHtml(cs.universityName)}</div>` : ''}
                ${cs.facultyName ? `<div style="font-family: 'Cairo', Arial, sans-serif; font-size: 10.5pt; font-weight: 600; color: ${isGoldTheme ? '#334155' : '#1e293b'};">${escapeHtml(cs.facultyName)}</div>` : ''}
              </td>
              <td style="width: 25%; text-align: left; vertical-align: middle;">
                ${logoCell('left')}
              </td>
            </tr>
          </table>

          <div style="text-align: center; margin: 4pt 0 10pt 0;">
            <hr style="width: 45%; border: none; border-top: 1.5pt solid ${themeColor}; margin: 0 auto;">
          </div>

          <!-- عنوان وموضوع البحث -->
          <div style="text-align: center; margin: 8pt 0 12pt 0;">
            <div style="font-family: 'Cairo', Arial, sans-serif; font-size: 12pt; font-weight: bold; color: ${isGoldTheme ? '#b48c36' : '#000000'}; margin-bottom: 8pt; letter-spacing: 0.5px;">${escapeHtml(cs.workType || 'بحث أكاديمي حول')}</div>
            
            <table dir="rtl" align="center" style="width: 90%; border: 2pt solid ${themeColor}; margin: 0 auto; text-align: center; border-collapse: collapse; background-color: #fafafa;">
              <tr>
                <td style="padding: 12pt 14pt; text-align: center;">
                  <div style="font-family: 'Cairo', Arial, sans-serif; font-size: 20pt; font-weight: bold; color: ${titleColor}; line-height: 1.35;">${escapeHtml(cs.title || 'عنوان البحث')}</div>
                  ${cs.subtitle ? `<div style="font-family: 'Amiri', serif; font-size: 13pt; font-style: italic; font-weight: bold; color: ${subtitleColor}; margin-top: 6pt;">${escapeHtml(cs.subtitle)}</div>` : ''}
                </td>
              </tr>
            </table>

            <div style="text-align: center; margin: 10pt auto; color: ${themeColor}; font-size: 11pt; letter-spacing: 2px;">
              ─── ◆ ───
            </div>
          </div>

          <!-- إعداد الطلبة وتحت إشراف الأستاذ -->
          <table dir="rtl" style="width: 100%; border-collapse: collapse; margin-top: 10pt; margin-bottom: 8pt;">
            <tr>
              <!-- إعداد الطلبة -->
              <td style="width: 48%; vertical-align: top; text-align: right;">
                <table dir="rtl" style="width: 100%; border-collapse: collapse; border: 1pt solid ${isGoldTheme ? '#e2e8f0' : '#cbd5e1'}; background-color: #ffffff;">
                  <tr>
                    <td style="padding: 8pt 10pt; text-align: right;">
                      <div style="font-family: 'Cairo', Arial, sans-serif; font-size: 11.5pt; font-weight: bold; color: ${themeColor}; border-bottom: 1.5pt solid ${themeColor}; padding-bottom: 3pt; margin-bottom: 6pt;">إعداد الطلبة:</div>
                      ${studentsHtml}
                    </td>
                  </tr>
                </table>
              </td>
              <td style="width: 4%;"></td>
              <!-- تحت إشراف الأستاذ -->
              <td style="width: 48%; vertical-align: top; text-align: right;">
                <table dir="rtl" style="width: 100%; border-collapse: collapse; border: 1pt solid ${isGoldTheme ? '#e2e8f0' : '#cbd5e1'}; background-color: #ffffff;">
                  <tr>
                    <td style="padding: 8pt 10pt; text-align: right;">
                      <div style="font-family: 'Cairo', Arial, sans-serif; font-size: 11.5pt; font-weight: bold; color: ${themeColor}; border-bottom: 1.5pt solid ${themeColor}; padding-bottom: 3pt; margin-bottom: 6pt;">تحت إشراف الأستاذ(ة):</div>
                      <div style="font-family: 'Cairo', Arial, sans-serif; font-size: 11pt; font-weight: bold; color: #111; margin-bottom: 3pt;">${escapeHtml(cs.supervisor || '')}</div>
                      ${cs.group ? `<div style="font-family: 'Cairo', Arial, sans-serif; font-size: 10.5pt; font-weight: bold; color: #334155;">${escapeHtml(cs.group)}</div>` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- السنة الجامعية -->
          <div style="text-align: center; margin-top: 12pt; padding-top: 5pt; border-top: 1.5pt solid ${themeColor}; font-family: 'Cairo', Arial, sans-serif; font-size: 12pt; font-weight: bold; color: ${themeColor};">
            ${escapeHtml(cs.academicYear || '')}
          </div>

        </td>
      </tr>
    </table>`;

    sections.push(coverHtml);
  }

  // ==============================================================
  // 2. صفحة خطة البحث / الفهرس (Plan Page)
  // ==============================================================
  const ps = doc.planState;
  if (ps.enabled) {
    const pageBorderCss = getWordBorderCss(doc.borderStyle);
    const rows = parsePlanRows(ps.itemsText)
      .map(({ title, page, isMain }) => {
        if (!ps.showPageNumbers) {
          return `<tr>
            <td style="text-align: right; padding: ${isMain ? '5pt 0' : '3pt 0'}; font-size: ${isMain ? '12.5pt' : '11pt'}; font-weight: ${isMain ? 'bold' : 'normal'}; ${isMain ? 'color: #000; border-bottom: 1pt dashed #cbd5e1;' : 'color: #1e293b; padding-right: 14pt;'}">
              ${isMain ? '' : '• '}${escapeHtml(title)}
            </td>
          </tr>`;
        }
        return `<tr>
          <td style="white-space: nowrap; text-align: right; vertical-align: bottom; padding: ${isMain ? '5pt 0' : '3pt 0'}; font-size: ${isMain ? '12.5pt' : '11pt'}; font-weight: ${isMain ? 'bold' : 'normal'}; ${isMain ? 'color: #000;' : 'color: #1e293b; padding-right: 14pt;'}">
            ${isMain ? '' : '• '}${escapeHtml(title)}
          </td>
          <td style="width: 95%; border-bottom: 1.5pt dotted #94a3b8; vertical-align: bottom; height: 1em; padding-bottom: 2pt;">
            &nbsp;
          </td>
          <td style="white-space: nowrap; text-align: left; vertical-align: bottom; padding: ${isMain ? '5pt 0 5pt 4pt' : '3pt 0 3pt 4pt'}; font-family: 'Cairo', Arial, sans-serif; font-size: 10.5pt; font-weight: bold; color: #1e293b;">
            ${escapeHtml(page)}
          </td>
        </tr>`;
      })
      .join('');

    const planHtml = `
    <table dir="rtl" style="width: 100%; border-collapse: collapse; border: ${pageBorderCss}; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
      <tr>
        <td style="padding: 14pt 16pt; vertical-align: top;">
          
          <div style="text-align: center; font-family: 'Cairo', Arial, sans-serif; font-size: 17pt; font-weight: bold; border-bottom: 2pt solid #222; padding-bottom: 6pt; margin-bottom: 14pt;">
            ${escapeHtml(ps.pageTitle || 'خـطّـة البـحـث')}
          </div>

          <table dir="rtl" style="width: 100%; border-collapse: collapse;">
            ${rows}
          </table>

          <div style="text-align: center; font-family: 'Cairo', Arial, sans-serif; font-size: 10.5pt; font-weight: bold; color: #475569; margin-top: 25pt;">
            - أ -
          </div>

        </td>
      </tr>
    </table>`;

    sections.push(planHtml);
  }

  // ==============================================================
  // 3. صفحات محتوى البحث (Content Pages)
  // ==============================================================
  const pageBorderCss = getWordBorderCss(doc.borderStyle);

  doc.pages.forEach((page, index) => {
    const studentHeader = doc.showStudentInfo
      ? `<table dir="rtl" style="width: 100%; border-collapse: collapse; border-bottom: 1pt solid #cbd5e1; margin-bottom: 8pt; padding-bottom: 3pt;">
          <tr>
            <td style="text-align: right; font-family: 'Cairo', Arial, sans-serif; font-size: 10pt; font-weight: bold; color: #334155;">
              الاسم واللقب: ${escapeHtml(doc.studentName || '')}
            </td>
            <td style="text-align: left; font-family: 'Cairo', Arial, sans-serif; font-size: 10pt; font-weight: bold; color: #334155;">
              الفوج: ${escapeHtml(doc.studentFawj || '')}
            </td>
          </tr>
        </table>`
      : '';

    const mabhath = page.mabhathTitle?.trim()
      ? `<div style="text-align: center; font-size: 15pt; font-weight: bold; border-bottom: 2pt solid #222; padding-bottom: 3pt; margin: 0 0 8pt 0; color: #000;">${escapeHtml(page.mabhathTitle)}</div>`
      : '';

    const matlab = page.matlabTitle?.trim()
      ? `<div style="text-align: right; font-size: 13pt; font-weight: bold; border-right: 3.5pt solid #222; padding-right: 6pt; margin: 6pt 0; color: #000; text-decoration: underline;">${escapeHtml(page.matlabTitle)}</div>`
      : '';

    const footnotes = page.footnotes?.length
      ? `<div style="margin-top: 12pt; padding-top: 4pt;">
          <hr style="width: 38%; border: none; border-top: 1.5pt solid #333; margin: 0 0 4pt 0;">
          ${page.footnotes.map((fn, i) => `
            <div style="margin: 2pt 0; font-size: 9.5pt; line-height: 1.4; text-indent: 0; text-align: justify; color: #222;">
              <sup style="font-weight: bold; color: #1e3a8a;">(${i + 1})</sup> ${escapeHtml(fn)}
            </div>
          `).join('')}
        </div>`
      : '';

    const pageHtml = `
    <table dir="rtl" style="width: 100%; border-collapse: collapse; border: ${pageBorderCss}; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
      <tr>
        <td style="padding: 14pt 16pt; vertical-align: top;">
          ${studentHeader}
          ${mabhath}
          ${matlab}
          <div class="doc-body" style="text-align: justify; text-justify: inter-word; font-size: ${doc.fontSize || 13.5}pt; line-height: ${doc.lineHeight || 1.6};">
            ${page.content || ''}
          </div>
          ${footnotes}
          <div style="text-align: center; font-family: 'Cairo', Arial, sans-serif; font-size: 10pt; font-weight: bold; color: #334155; margin-top: 10pt;">
            - ${index + 1} -
          </div>
        </td>
      </tr>
    </table>`;

    sections.push(pageHtml);
  });

  const fullBodyHtml = sections.join(`\n${PAGE_BREAK}\n`);

  const html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40' dir='rtl' lang='ar'>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>${escapeHtml(docTitle)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
@page Section1 {
  size: 210mm 297mm;
  margin: 15mm 15mm 15mm 15mm;
  mso-page-orientation: portrait;
  mso-header-margin: 18pt;
  mso-footer-margin: 18pt;
  mso-paper-source: 0;
}
div.Section1 {
  page: Section1;
  direction: rtl;
}
body {
  font-family: ${doc.fontFamily ? `'${doc.fontFamily}', ` : ''}'Amiri', 'Traditional Arabic', 'Simplified Arabic', Tahoma, Arial, serif;
  direction: rtl;
  text-align: justify;
  text-justify: inter-word;
  font-size: ${doc.fontSize || 13.5}pt;
  line-height: ${doc.lineHeight || 1.6};
  color: #000;
  background: #ffffff;
  margin: 0;
  padding: 0;
}
p, .doc-paragraph {
  margin-top: 0pt;
  margin-bottom: 4.5pt;
  text-indent: 1cm;
  text-align: justify;
  text-justify: inter-word;
  line-height: ${doc.lineHeight || 1.6};
  font-size: ${doc.fontSize || 13.5}pt;
}
.doc-subtitle {
  font-size: 13pt;
  font-weight: bold;
  margin-top: 8pt;
  margin-bottom: 3pt;
  text-align: right;
  text-indent: 0;
  text-decoration: underline;
}
.doc-matlab-title {
  font-size: 13pt;
  font-weight: bold;
  margin: 6pt 0;
  text-decoration: underline;
}
ul, .doc-ul {
  margin-right: 1.2cm;
  margin-top: 3pt;
  margin-bottom: 4.5pt;
}
li, .doc-li {
  margin-bottom: 2pt;
  text-align: justify;
  line-height: 1.5;
  font-size: 12.5pt;
}
sup {
  font-size: 9pt;
  vertical-align: super;
  color: #1e3a8a;
  font-weight: bold;
}
strong {
  font-weight: bold;
}
</style>
</head>
<body>
<div class="Section1">
${fullBodyHtml}
</div>
</body>
</html>`;

  return { html, fileName: `${docTitle.replace(/[\\/:*?"<>|]/g, '_')}.doc` };
}

export function downloadWordDocument(doc: DocumentState) {
  const { html, fileName } = buildWordHtml(doc);
  // علامة BOM حقيقية لضمان قراءة Word للنص العربي بترميز UTF-8
  const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
