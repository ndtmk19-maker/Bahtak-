// تصدير البحث بصيغة Word (.doc) متوافقة مع Microsoft Word — منقول من المشروع الأصلي
import type { DocumentState } from '../types';
import { escapeHtml } from './escape';
import { parsePlanRows } from './plan';
import { PLACEHOLDER_TITLE } from '../data/defaults';

const PAGE_BREAK = '<br clear="all" style="page-break-before: always; mso-special-character: line-break;">';

export function buildWordHtml(doc: DocumentState): { html: string; fileName: string } {
  const cs = doc.coverState;
  const docTitle = cs.title && cs.title !== PLACEHOLDER_TITLE ? cs.title.trim() : 'بحث_أكاديمي_منسق';
  let bodyHtml = '';

  if (cs.enabled) {
    const logo = cs.logoBase64 || cs.logoUrl;
    const studentsHtml = (cs.studentsText || '')
      .split('\n')
      .filter((s) => s.trim() !== '')
      .map((s) => `<div style="font-size: 13pt; margin-bottom: 4pt; font-weight: 600;">${escapeHtml(s.trim())}</div>`)
      .join('');
    const logoCell = (side: 'right' | 'left') =>
      logo && (cs.logoPosition === 'both' || cs.logoPosition === side) ? `<img src="${logo}" width="80" height="80" style="object-fit: contain;">` : '';

    bodyHtml += `
    <div style="text-align: center; margin-bottom: 20pt;">
      <table dir="rtl" style="width: 100%; border-collapse: collapse; margin-bottom: 10pt;"><tr>
        <td style="width: 25%; text-align: right; vertical-align: middle;">${logoCell('right')}</td>
        <td style="width: 50%; text-align: center; vertical-align: middle;">
          <div style="font-size: 13.5pt; font-weight: bold; margin-bottom: 4pt;">${escapeHtml(cs.country)}</div>
          <div style="font-size: 12pt; font-weight: bold; margin-bottom: 4pt;">${escapeHtml(cs.ministry)}</div>
          ${cs.universityName ? `<div style="font-size: 12.5pt; font-weight: bold; margin-bottom: 3pt;">${escapeHtml(cs.universityName)}</div>` : ''}
          ${cs.facultyName ? `<div style="font-size: 11pt; margin-bottom: 3pt;">${escapeHtml(cs.facultyName)}</div>` : ''}
        </td>
        <td style="width: 25%; text-align: left; vertical-align: middle;">${logoCell('left')}</td>
      </tr></table>
      <hr style="width: 55%; border: none; border-top: 1.5px solid #000; margin: 15pt auto 30pt auto;">
      <div style="margin: 40pt auto 30pt auto;">
        <div style="font-size: 13pt; color: #334155; margin-bottom: 12pt; font-weight: bold;">${escapeHtml(cs.workType || 'بحث أكاديمي حول')}</div>
        <table dir="rtl" align="center" style="width: 88%; border: 2.5px solid #000; margin: 0 auto; text-align: center; border-collapse: collapse;"><tr>
          <td style="padding: 20pt 14pt;">
            <div style="font-size: 21pt; font-weight: bold; color: #000; line-height: 1.4;">${escapeHtml(cs.title || 'عنوان البحث')}</div>
            ${cs.subtitle ? `<div style="font-size: 14pt; margin-top: 10pt; color: #333333; font-weight: bold;">${escapeHtml(cs.subtitle)}</div>` : ''}
          </td>
        </tr></table>
      </div>
      <table dir="rtl" style="width: 100%; margin-top: 60pt; border-collapse: collapse;"><tr>
        <td style="width: 50%; vertical-align: top; text-align: right; padding-right: 15pt;">
          <div style="font-size: 13pt; font-weight: bold; text-decoration: underline; margin-bottom: 8pt;">إعداد الطلبة:</div>
          ${studentsHtml}
        </td>
        <td style="width: 50%; vertical-align: top; text-align: left; padding-left: 15pt;">
          <div style="font-size: 13pt; font-weight: bold; text-decoration: underline; margin-bottom: 8pt;">تحت إشراف الأستاذ(ة):</div>
          <div style="font-size: 13pt; font-weight: 600;">${escapeHtml(cs.supervisor)}</div>
          <div style="font-size: 12.5pt; font-weight: bold; margin-top: 5pt;">${escapeHtml(cs.group)}</div>
        </td>
      </tr></table>
      <div style="text-align: center; margin-top: 75pt; font-size: 13pt; font-weight: bold;">${escapeHtml(cs.academicYear)}</div>
    </div>
    ${PAGE_BREAK}`;
  }

  const ps = doc.planState;
  if (ps.enabled) {
    const rows = parsePlanRows(ps.itemsText)
      .map(({ title, page, isMain }) => {
        const border = isMain ? 'border-bottom: 1.5px solid #334155;' : 'border-bottom: 1px dotted #cbd5e1;';
        return `<tr>
          <td style="text-align: right; padding: 7pt 6pt; font-size: ${isMain ? '14pt' : '12.5pt'}; font-weight: ${isMain ? 'bold' : 'normal'}; ${border}">${isMain ? '' : '&nbsp;&nbsp;&nbsp;&nbsp;• '}${escapeHtml(title)}</td>
          ${ps.showPageNumbers ? `<td style="text-align: left; width: 65pt; padding: 7pt 6pt; font-size: 12pt; font-weight: bold; color: #1e293b; ${border}">${escapeHtml(page)}</td>` : ''}
        </tr>`;
      })
      .join('');
    bodyHtml += `
    <div style="margin-bottom: 20pt;">
      <div style="text-align: center; font-size: 18pt; font-weight: bold; text-decoration: underline; margin-bottom: 8pt;">${escapeHtml(ps.pageTitle || 'خـطّـة البـحـث')}</div>
      ${ps.researchTitle ? `<div style="text-align: center; font-size: 13pt; font-weight: bold; color: #475569; margin-bottom: 22pt;">${escapeHtml(ps.researchTitle)}</div>` : ''}
      <table dir="rtl" style="width: 100%; border-collapse: collapse; margin-top: 15pt;">${rows}</table>
      <div style="text-align: center; font-size: 11pt; margin-top: 35pt; color: #475569;">- أ -</div>
    </div>
    ${PAGE_BREAK}`;
  }

  doc.pages.forEach((page, index) => {
    const studentHeader = doc.showStudentInfo
      ? `<table dir="rtl" style="width: 100%; border-bottom: 1px solid #94a3b8; margin-bottom: 12pt; font-size: 11pt; color: #334155;"><tr>
          <td style="text-align: right; padding-bottom: 4pt;">الاسم واللقب: ${escapeHtml(doc.studentName)}</td>
          <td style="text-align: left; padding-bottom: 4pt;">الفوج: ${escapeHtml(doc.studentFawj)}</td>
        </tr></table>`
      : '';
    const mabhath = page.mabhathTitle?.trim()
      ? `<div style="text-align: center; font-size: 16pt; font-weight: bold; margin: 10pt 0 12pt 0; text-decoration: underline;">${escapeHtml(page.mabhathTitle)}</div>`
      : '';
    const matlab = page.matlabTitle?.trim()
      ? `<div style="text-align: right; font-size: 14pt; font-weight: bold; margin: 8pt 0 10pt 0; text-decoration: underline;">${escapeHtml(page.matlabTitle)}</div>`
      : '';
    const footnotes = page.footnotes?.length
      ? `<div style="margin-top: 25pt; padding-top: 6pt; border-top: 1.5px solid #000; width: 45%;">
          ${page.footnotes.map((fn, i) => `<p style="margin: 3pt 0; font-size: 11pt; line-height: 1.35; text-indent: 0; text-align: justify;"><sup style="font-weight: bold; color: #1e3a8a;">(${i + 1})</sup> ${escapeHtml(fn)}</p>`).join('')}
        </div>`
      : '';
    bodyHtml += `
    <div style="margin-bottom: 20pt;">
      ${studentHeader}${mabhath}${matlab}
      <div style="text-align: justify; text-justify: inter-word; font-size: 13.5pt; line-height: 1.6;">${page.content || ''}</div>
      ${footnotes}
      <div style="text-align: center; font-size: 11pt; margin-top: 18pt; color: #475569;">- ${index + 1} -</div>
    </div>
    ${index < doc.pages.length - 1 ? PAGE_BREAK : ''}`;
  });

  const html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40' dir='rtl' lang='ar'>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>${escapeHtml(docTitle)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
@page { size: 210mm 297mm; margin: 25mm 20mm 20mm 25mm; mso-page-orientation: portrait; mso-header-margin: 36pt; mso-footer-margin: 36pt; }
body { font-family: 'Amiri', 'Traditional Arabic', 'Simplified Arabic', Tahoma, Arial, serif; direction: rtl; text-align: justify; text-justify: inter-word; font-size: 13.5pt; line-height: 1.6; color: #000; background: #fff; margin: 0; padding: 0; }
p, .doc-paragraph { margin-top: 0pt; margin-bottom: 6pt; text-indent: 1cm; text-align: justify; text-justify: inter-word; line-height: 1.6; font-size: 13.5pt; }
.doc-subtitle { font-size: 14pt; font-weight: bold; margin-top: 10pt; margin-bottom: 5pt; text-align: right; text-indent: 0; }
.doc-matlab-title { font-size: 14pt; font-weight: bold; margin: 8pt 0 10pt 0; text-decoration: underline; }
ul, .doc-ul { margin-right: 1.2cm; margin-top: 4pt; margin-bottom: 6pt; }
li, .doc-li { margin-bottom: 3pt; text-align: justify; line-height: 1.5; font-size: 13pt; }
sup { font-size: 9.5pt; vertical-align: super; color: #1e3a8a; font-weight: bold; }
strong { font-weight: bold; }
</style>
</head>
<body><div class="Section1">${bodyHtml}</div></body>
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
