// تصدير البحث بصيغة Word الرسمية (.docx / OpenXML) مطابقة لتصميم PDF والأبعاد الأكاديمية A4
import type { BorderStyle, DocumentState, LogoSize } from '../types';
import { PLACEHOLDER_TITLE } from '../data/defaults';
import { createDocxZip, type ZipEntryInput } from './docxZip';
import { imageToDataUrl } from './image';
import { parsePlanRows } from './plan';
import { isInAppBrowser } from './printDocument';

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FALLBACK_LOGO = '/assets/univ_logos/MESRS.png';

// ثوابت مقاسات A4 بوحدة twips (1pt = 20 dxa, 1mm = 56.6929 dxa) و EMU للصور (1mm = 36000 EMU)
const A4_W_DXA = 11906; // 210mm
const A4_H_DXA = 16838; // 297mm
const BORDER_SPACE_PT = 22; // ~7.76mm من حافة الورقة مثل .a4-page { padding: 8mm }
const MM_TO_DXA = 1440 / 25.4;
const mm = (v: number) => Math.round(v * MM_TO_DXA);

export interface WordExportResult {
  success: boolean;
  fileName?: string;
  inAppBrowser?: boolean;
  nativeAndroid?: boolean;
  error?: string;
}

interface LogoAsset {
  bytes: Uint8Array;
  ext: 'png' | 'jpg';
  mime: string;
  widthPx: number;
  heightPx: number;
}

type InlinePiece =
  | { kind: 'text'; text: string; bold: boolean; italic: boolean; underline: boolean }
  | { kind: 'br' }
  | { kind: 'sup'; text: string; bold: boolean; italic: boolean };

interface ParsedBlock {
  kind: 'mabhath' | 'matlab' | 'subtitle' | 'paragraph' | 'bullet' | 'numbered';
  inlines: InlinePiece[];
}

function xmlEscape(raw: string): string {
  // إزالة محارف التحكم غير الصالحة في XML 1.0 قبل الترميز
  const cleaned = (raw || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, '');
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&bull;/gi, '•')
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    });
}

function resolvePrimaryFont(fontFamily?: string): string {
  const f = (fontFamily || '').toLowerCase();
  if (f.includes('cairo')) return 'Cairo';
  if (f.includes('tajawal')) return 'Tajawal';
  return 'Amiri';
}

export function buildDocxFileName(title?: string): string {
  const clean =
    title && title !== PLACEHOLDER_TITLE && title.trim() ? title.trim() : 'بحث_أكاديمي_منسق';
  const base = clean
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\\/:*?"<>|#%&{}~$!'`=@+]+/g, '_')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 90)
    .replace(/[._]+$/g, '');
  return `${base || 'بحث_أكاديمي_منسق'}.docx`;
}

// ترتيب عناصر w:rPr مطابق لـ ECMA-376 CT_RPr:
// rFonts -> b/bCs -> i/iCs -> color -> sz/szCs -> u -> vertAlign -> rtl -> lang
function buildRunPr(opts: {
  font?: string;
  sizePt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  superscript?: boolean;
  rtl?: boolean;
}): string {
  const font = opts.font || 'Amiri';
  const rtl = opts.rtl !== false;
  const parts: string[] = [
    `<w:rFonts w:ascii="${xmlEscape(font)}" w:hAnsi="${xmlEscape(font)}" w:cs="${xmlEscape(font)}"/>`,
  ];
  if (opts.bold) parts.push('<w:b/><w:bCs/>');
  if (opts.italic) parts.push('<w:i/><w:iCs/>');
  if (opts.color) parts.push(`<w:color w:val="${opts.color.replace(/^#/, '')}"/>`);
  if (opts.sizePt) {
    const halfPts = Math.round(opts.sizePt * 2);
    parts.push(`<w:sz w:val="${halfPts}"/><w:szCs w:val="${halfPts}"/>`);
  }
  if (opts.underline) parts.push('<w:u w:val="single"/>');
  if (opts.superscript) parts.push('<w:vertAlign w:val="superscript"/>');
  if (rtl) parts.push('<w:rtl/>');
  return `<w:rPr>${parts.join('')}</w:rPr>`;
}

function buildTextRun(
  text: string,
  opts: {
    font?: string;
    sizePt?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    superscript?: boolean;
    rtl?: boolean;
  } = {},
): string {
  return `<w:r>${buildRunPr(opts)}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function buildPageBordersXml(
  style: BorderStyle,
  overrideColor?: string,
): string {
  if (style === 'none' && !overrideColor) return '';
  let val = 'double';
  let sz = 12; // 1.5pt per line
  let color = '222222';

  if (overrideColor) {
    val = 'double';
    sz = 12;
    color = overrideColor.replace(/^#/, '');
  } else if (style === 'gold') {
    val = 'double';
    sz = 12;
    color = 'C5A059';
  } else if (style === 'single') {
    val = 'single';
    sz = 12;
    color = '222222';
  }

  const attrs = `w:val="${val}" w:sz="${sz}" w:space="${BORDER_SPACE_PT}" w:color="${color}"`;
  return `<w:pgBorders w:offsetFrom="page"><w:top ${attrs}/><w:left ${attrs}/><w:bottom ${attrs}/><w:right ${attrs}/></w:pgBorders>`;
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const mime = (match[1] || 'image/png').toLowerCase();
  const b64 = match[2].replace(/\s+/g, '');
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return { bytes: new Uint8Array(Buffer.from(b64, 'base64')), mime };
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { bytes, mime };
}

function readPngDimensions(bytes: Uint8Array): { w: number; h: number } | null {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const w = view.getUint32(16, false);
    const h = view.getUint32(20, false);
    if (w > 0 && h > 0) return { w, h };
  }
  return null;
}

function readJpegDimensions(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 3 >= bytes.length) break;
    const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc &&
      i + 8 < bytes.length
    ) {
      const h = (bytes[i + 5] << 8) | bytes[i + 6];
      const w = (bytes[i + 7] << 8) | bytes[i + 8];
      if (w > 0 && h > 0) return { w, h };
      break;
    }
    i += 2 + segLen;
  }
  return null;
}

async function convertToPngInBrowser(
  dataUrl: string,
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return null;
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || 256;
        const h = img.naturalHeight || img.height || 256;
        const scale = Math.min(1, 1024 / Math.max(w, h)) || 1;
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * scale));
        c.height = Math.max(1, Math.round(h * scale));
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve({ dataUrl: c.toDataURL('image/png'), w: c.width, h: c.height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function loadLogoAsset(primarySrc?: string, fallbackSrc?: string): Promise<LogoAsset | null> {
  const candidates = [primarySrc, fallbackSrc].filter((s): s is string => !!s && s.trim() !== '');
  for (const rawSrc of candidates) {
    let dataUrl = rawSrc.trim();
    if (!dataUrl.startsWith('data:')) {
      if (typeof window === 'undefined') continue;
      dataUrl = await imageToDataUrl(dataUrl);
      if (!dataUrl.startsWith('data:') && !rawSrc.includes('MESRS.png')) {
        dataUrl = await imageToDataUrl(FALLBACK_LOGO);
      }
    }
    if (!dataUrl.startsWith('data:')) continue;

    let decoded = dataUrlToBytes(dataUrl);
    if (!decoded) continue;

    let widthPx = 0;
    let heightPx = 0;
    let ext: 'png' | 'jpg' = 'png';
    let mime = decoded.mime;

    if (mime.includes('png')) {
      const dims = readPngDimensions(decoded.bytes);
      if (dims) {
        widthPx = dims.w;
        heightPx = dims.h;
      }
      ext = 'png';
      mime = 'image/png';
    } else if (mime.includes('jpeg') || mime.includes('jpg')) {
      const dims = readJpegDimensions(decoded.bytes);
      if (dims) {
        widthPx = dims.w;
        heightPx = dims.h;
      }
      ext = 'jpg';
      mime = 'image/jpeg';
    } else {
      // تحويل SVG أو WebP إلى PNG متوافق تماماً مع كل إصدارات Word
      const converted = await convertToPngInBrowser(dataUrl);
      if (!converted) continue;
      const redecoded = dataUrlToBytes(converted.dataUrl);
      if (!redecoded) continue;
      decoded = redecoded;
      widthPx = converted.w;
      heightPx = converted.h;
      ext = 'png';
      mime = 'image/png';
    }

    if (widthPx <= 0 || heightPx <= 0) {
      const converted = await convertToPngInBrowser(dataUrl);
      if (converted) {
        widthPx = converted.w;
        heightPx = converted.h;
      } else {
        widthPx = 256;
        heightPx = 256;
      }
    }

    return {
      bytes: decoded.bytes,
      ext,
      mime,
      widthPx,
      heightPx,
    };
  }
  return null;
}

function getLogoBoxMm(size?: LogoSize): number {
  switch (size) {
    case 'compact':
      return 25;
    case 'medium':
      return 30;
    case 'xlarge':
      return 44;
    case 'large':
    default:
      return 36;
  }
}

function buildInlineLogoRun(
  rId: string,
  logo: LogoAsset,
  maxBoxMm: number,
  shapeId: number,
): string {
  const maxEmu = maxBoxMm * 36000;
  const k = Math.min(maxEmu / logo.widthPx, maxEmu / logo.heightPx);
  const cx = Math.max(360000, Math.round(logo.widthPx * k));
  const cy = Math.max(360000, Math.round(logo.heightPx * k));

  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${shapeId}" name="UniversityLogo${shapeId}" descr="شعار الجامعة"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${shapeId}" name="UniversityLogo${shapeId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

/** محلل خفيف لوسوم HTML المولدة داخل page.content دون الاعتماد على DOM خارجي */
function parseContentHtmlBlocks(html: string): ParsedBlock[] {
  const src = (html || '').trim();
  if (!src) return [];

  const blocks: ParsedBlock[] = [];
  let curBlock: ParsedBlock | null = null;
  let inList: 'ul' | 'ol' | null = null;

  let boldDepth = 0;
  let italicDepth = 0;
  let underlineDepth = 0;
  let supDepth = 0;
  let supBuffer = '';

  const ensureBlock = (kind: ParsedBlock['kind'] = 'paragraph') => {
    if (!curBlock) {
      curBlock = { kind, inlines: [] };
    }
    return curBlock;
  };

  const flushBlock = () => {
    if (supDepth > 0 && supBuffer.trim()) {
      ensureBlock('paragraph').inlines.push({
        kind: 'sup',
        text: supBuffer.trim(),
        bold: boldDepth > 0,
        italic: italicDepth > 0,
      });
      supBuffer = '';
      supDepth = 0;
    }
    if (curBlock && curBlock.inlines.length > 0) {
      const hasMeaningful = curBlock.inlines.some(
        (p) => p.kind !== 'text' || p.text.trim() !== '',
      );
      if (hasMeaningful) blocks.push(curBlock);
    }
    curBlock = null;
  };

  const pushText = (rawText: string) => {
    const decoded = decodeHtmlEntities(rawText).replace(/\r\n?/g, ' ').replace(/\n+/g, ' ');
    if (!decoded) return;
    if (supDepth > 0) {
      supBuffer += decoded;
      return;
    }
    // تجاهل الفراغات المحض قبل فتح أي كتلة بين الوسوم
    if (!curBlock && !decoded.trim()) return;
    ensureBlock('paragraph').inlines.push({
      kind: 'text',
      text: decoded,
      bold: boldDepth > 0,
      italic: italicDepth > 0,
      underline: underlineDepth > 0,
    });
  };

  const tokenRe = /<[^>]+>|[^<]+/g;
  const tokens = src.match(tokenRe) || [];

  for (const tok of tokens) {
    if (!tok.startsWith('<')) {
      pushText(tok);
      continue;
    }

    const inner = tok.slice(1, -1).trim();
    if (!inner || inner.startsWith('!')) continue;

    const isClosing = inner.startsWith('/');
    const tagPart = (isClosing ? inner.slice(1) : inner).trim();
    const spaceIdx = tagPart.search(/[\s/]/);
    const tag = (spaceIdx === -1 ? tagPart : tagPart.slice(0, spaceIdx)).toLowerCase();
    const attrs = spaceIdx === -1 ? '' : tagPart.slice(spaceIdx);

    if (tag === 'br') {
      if (curBlock) {
        curBlock.inlines.push({ kind: 'br' });
      }
      continue;
    }

    if (isClosing) {
      if (tag === 'strong' || tag === 'b') {
        boldDepth = Math.max(0, boldDepth - 1);
      } else if (tag === 'em' || tag === 'i') {
        italicDepth = Math.max(0, italicDepth - 1);
      } else if (tag === 'u') {
        underlineDepth = Math.max(0, underlineDepth - 1);
      } else if (tag === 'sup') {
        if (supDepth > 0) {
          supDepth = Math.max(0, supDepth - 1);
          if (supDepth === 0) {
            const supText = supBuffer.trim();
            supBuffer = '';
            if (supText) {
              ensureBlock('paragraph').inlines.push({
                kind: 'sup',
                text: supText,
                bold: boldDepth > 0,
                italic: italicDepth > 0,
              });
            }
          }
        }
      } else if (tag === 'ul' || tag === 'ol') {
        flushBlock();
        inList = null;
      } else if (
        tag === 'p' ||
        tag === 'div' ||
        tag === 'li' ||
        tag === 'h1' ||
        tag === 'h2' ||
        tag === 'h3' ||
        tag === 'h4' ||
        tag === 'h5' ||
        tag === 'h6' ||
        tag === 'blockquote'
      ) {
        flushBlock();
      }
      continue;
    }

    // وسوم الفتح
    if (tag === 'strong' || tag === 'b') {
      boldDepth++;
    } else if (tag === 'em' || tag === 'i') {
      italicDepth++;
    } else if (tag === 'u') {
      underlineDepth++;
    } else if (tag === 'sup') {
      supDepth++;
      if (supDepth === 1) supBuffer = '';
    } else if (tag === 'ul') {
      flushBlock();
      inList = 'ul';
    } else if (tag === 'ol') {
      flushBlock();
      inList = 'ol';
    } else if (tag === 'li') {
      flushBlock();
      curBlock = { kind: inList === 'ol' ? 'numbered' : 'bullet', inlines: [] };
    } else if (tag === 'p' || tag === 'blockquote') {
      flushBlock();
      curBlock = { kind: 'paragraph', inlines: [] };
    } else if (tag === 'h1' || tag === 'h2') {
      flushBlock();
      curBlock = { kind: 'matlab', inlines: [] };
    } else if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
      flushBlock();
      curBlock = { kind: 'subtitle', inlines: [] };
    } else if (tag === 'div') {
      const clsMatch = /\bclass\s*=\s*["']([^"']*)["']/i.exec(attrs);
      const cls = clsMatch ? clsMatch[1] : '';
      if (cls.includes('doc-mabhath-title')) {
        flushBlock();
        curBlock = { kind: 'mabhath', inlines: [] };
      } else if (cls.includes('doc-matlab-title')) {
        flushBlock();
        curBlock = { kind: 'matlab', inlines: [] };
      } else if (cls.includes('doc-subtitle')) {
        flushBlock();
        curBlock = { kind: 'subtitle', inlines: [] };
      } else if (curBlock && curBlock.inlines.length > 0) {
        flushBlock();
      }
    }
  }

  flushBlock();
  return blocks;
}

function buildCoverSectionXml(
  doc: DocumentState,
  logo: LogoAsset | null,
  logoRId: string | null,
  startShapeId: { val: number },
): { bodyXml: string; sectPrXml: string } {
  const cs = doc.coverState;
  const isGold = cs.theme === 'gold';
  const accentColor = isGold ? 'C5A059' : '000000';
  const titleColor = isGold ? '0F2952' : '000000';
  const countryColor = isGold ? '0F172A' : '000000';
  const ministryColor = isGold ? '475569' : '000000';
  const univColor = isGold ? '0F172A' : '000000';
  const facultyColor = isGold ? '334155' : '1E293B';
  const workTypeColor = isGold ? 'B48C36' : '000000';
  const subtitleColor = isGold ? '334155' : '000000';
  const infoHeadingColor = isGold ? '0F172A' : '000000';
  const infoBodyColor = isGold ? '334155' : '000000';
  const academicYearBorderColor = isGold ? 'E2E8F0' : '000000';

  const leftMargin = mm(21);
  const rightMargin = mm(21);
  const usableW = A4_W_DXA - leftMargin - rightMargin; // 9524 dxa (~168mm)

  const logoSize = cs.logoSize || 'large';
  const maxLogoMm = getLogoBoxMm(logoSize);
  const sideColW =
    logoSize === 'xlarge'
      ? 2550
      : logoSize === 'large'
        ? 2200
        : logoSize === 'medium'
          ? 1900
          : 1650;
  const centerColW = usableW - sideColW * 2;

  const pos = cs.logoPosition || 'both';
  const showRightLogo = !!(logo && logoRId && (pos === 'both' || pos === 'right'));
  const showLeftLogo = !!(logo && logoRId && (pos === 'both' || pos === 'left'));

  const rightLogoCellContent = showRightLogo
    ? `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr>${buildInlineLogoRun(logoRId!, logo!, maxLogoMm, startShapeId.val++)}</w:p>`
    : `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>`;

  const leftLogoCellContent = showLeftLogo
    ? `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>${buildInlineLogoRun(logoRId!, logo!, maxLogoMm, startShapeId.val++)}</w:p>`
    : `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>`;

  const headerLines: string[] = [];
  if (cs.country?.trim()) {
    headerLines.push(
      `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="35" w:line="260" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun(cs.country.trim(), { font: 'Cairo', sizePt: 15, bold: true, color: countryColor })}</w:p>`,
    );
  }
  if (cs.ministry?.trim()) {
    headerLines.push(
      `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="35" w:line="250" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun(cs.ministry.trim(), { font: 'Cairo', sizePt: 11.5, bold: !isGold, color: ministryColor })}</w:p>`,
    );
  }
  if (cs.universityName?.trim()) {
    headerLines.push(
      `<w:p><w:pPr><w:bidi/><w:spacing w:before="25" w:after="35" w:line="250" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun(cs.universityName.trim(), { font: 'Cairo', sizePt: 13, bold: true, color: univColor })}</w:p>`,
    );
  }
  if (cs.facultyName?.trim()) {
    headerLines.push(
      `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="20" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun(cs.facultyName.trim(), { font: 'Cairo', sizePt: 11, bold: true, color: facultyColor })}</w:p>`,
    );
  }
  if (headerLines.length === 0) {
    headerLines.push('<w:p><w:pPr><w:bidi/></w:pPr></w:p>');
  }

  const noBordersXml =
    '<w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>';
  const zeroCellMarXml =
    '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>';

  const headerNestedTable = `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${usableW}" w:type="dxa"/>${noBordersXml}<w:tblLayout w:type="fixed"/>${zeroCellMarXml}</w:tblPr><w:tblGrid><w:gridCol w:w="${sideColW}"/><w:gridCol w:w="${centerColW}"/><w:gridCol w:w="${sideColW}"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="${sideColW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${rightLogoCellContent}</w:tc><w:tc><w:tcPr><w:tcW w:w="${centerColW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${headerLines.join('')}</w:tc><w:tc><w:tcPr><w:tcW w:w="${sideColW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${leftLogoCellContent}</w:tc></w:tr></w:tbl>`;

  // الخط العلوي الصغير تحت الترويسة (.cover-top-line) — ينهي الخلية بـ <w:p> وفق متطلبات ECMA-376
  const topLineIndent = Math.round((usableW - 1800) / 2);
  const topAccentLineP = `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="10" w:space="4" w:color="${accentColor}"/></w:pBdr><w:bidi/><w:spacing w:before="20" w:after="0" w:line="80" w:lineRule="exact"/><w:ind w:left="${topLineIndent}" w:right="${topLineIndent}"/></w:pPr></w:p>`;

  // منتصف الغلاف: نوع البحث + العنوان الرئيسي الكبير + العنوان الفرعي + الفاصل الماسي
  const students = (cs.studentsText || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const titleText = (cs.title || 'عنوان البحث').trim();

  // ضبط ارتفاع الصف الأوسط ديناميكياً لكي يملأ الغلاف الورقة ولا ينزلق لصفحة ثانية عند تعدد أسطر الطلبة
  const row2Height = Math.max(
    5400,
    8000 -
      (students.length > 2 ? (students.length - 2) * 320 : 0) -
      (cs.subtitle?.trim() ? 450 : 0) -
      (titleText.length > 55 ? 550 : 0),
  );

  const bodyParagraphs: string[] = [
    `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="240" w:line="280" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun((cs.workType || 'بحث أكاديمي حول').trim(), { font: 'Cairo', sizePt: 13, bold: true, color: workTypeColor })}</w:p>`,
    `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="${cs.subtitle?.trim() ? 160 : 280}" w:line="324" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun(titleText, { font: 'Cairo', sizePt: titleText.length > 85 ? 20 : 24, bold: true, color: titleColor })}</w:p>`,
  ];
  if (cs.subtitle?.trim()) {
    bodyParagraphs.push(
      `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="280" w:line="280" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun(cs.subtitle.trim(), { font: 'Amiri', sizePt: 15, bold: true, italic: true, color: subtitleColor })}</w:p>`,
    );
  }
  bodyParagraphs.push(
    `<w:p><w:pPr><w:bidi/><w:spacing w:before="60" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun('───────   ◆   ───────', { font: 'Cairo', sizePt: 11, bold: true, color: accentColor })}</w:p>`,
  );

  // أسفل الغلاف: إعداد الطلبة (يمين) + تحت إشراف الأستاذ(ة) (يسار بنص محاذٍ لليمين) + خط + السنة الجامعية
  const studentColW = 4300;
  const spacerColW = 1624;
  const supColW = usableW - studentColW - spacerColW; // 3600

  const studentsCellParagraphs = [
    `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="130" w:line="240" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr>${buildTextRun('إعداد الطلبة:', { font: 'Cairo', sizePt: 12.5, bold: true, color: infoHeadingColor })}</w:p>`,
    ...(students.length > 0
      ? students.map(
          (st) =>
            `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="75" w:line="250" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr>${buildTextRun(st, { font: 'Cairo', sizePt: 10.8, bold: true, color: infoBodyColor })}</w:p>`,
        )
      : [`<w:p><w:pPr><w:bidi/></w:pPr></w:p>`]),
  ].join('');

  const supervisorCellParagraphs = [
    `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="130" w:line="240" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr>${buildTextRun('تحت إشراف الأستاذ(ة):', { font: 'Cairo', sizePt: 12.5, bold: true, color: infoHeadingColor })}</w:p>`,
    ...(cs.supervisor?.trim()
      ? [
          `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="140" w:line="250" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr>${buildTextRun(cs.supervisor.trim(), { font: 'Cairo', sizePt: 10.8, bold: true, color: infoBodyColor })}</w:p>`,
        ]
      : []),
    ...(cs.group?.trim()
      ? [
          `<w:p><w:pPr><w:bidi/><w:spacing w:before="40" w:after="60" w:line="250" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr>${buildTextRun(cs.group.trim(), { font: 'Cairo', sizePt: 10.8, bold: true, color: infoBodyColor })}</w:p>`,
        ]
      : []),
    ...(!cs.supervisor?.trim() && !cs.group?.trim() ? [`<w:p><w:pPr><w:bidi/></w:pPr></w:p>`] : []),
  ].join('');

  const footerGridTable = `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${usableW}" w:type="dxa"/>${noBordersXml}<w:tblLayout w:type="fixed"/>${zeroCellMarXml}</w:tblPr><w:tblGrid><w:gridCol w:w="${studentColW}"/><w:gridCol w:w="${spacerColW}"/><w:gridCol w:w="${supColW}"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="${studentColW}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${studentsCellParagraphs}</w:tc><w:tc><w:tcPr><w:tcW w:w="${spacerColW}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:bidi/></w:pPr></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="${supColW}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${supervisorCellParagraphs}</w:tc></w:tr></w:tbl>`;

  const academicYearP = `<w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="12" w:space="8" w:color="${academicYearBorderColor}"/></w:pBdr><w:bidi/><w:spacing w:before="280" w:after="0" w:line="260" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun((cs.academicYear || '').trim(), { font: 'Cairo', sizePt: 12.5, bold: true, color: titleColor })}</w:p>`;

  const outerCoverTable = `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${usableW}" w:type="dxa"/>${noBordersXml}<w:tblLayout w:type="fixed"/>${zeroCellMarXml}</w:tblPr><w:tblGrid><w:gridCol w:w="${usableW}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="2200" w:hRule="atLeast"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${usableW}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${headerNestedTable}${topAccentLineP}</w:tc></w:tr><w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${row2Height}" w:hRule="atLeast"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${usableW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${bodyParagraphs.join('')}</w:tc></w:tr><w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="3100" w:hRule="atLeast"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${usableW}" w:type="dxa"/><w:vAlign w:val="bottom"/></w:tcPr>${footerGridTable}${academicYearP}</w:tc></w:tr></w:tbl>`;

  // ترتيب عناصر CT_SectPr: pgSz -> pgMar -> pgBorders -> bidi
  const coverBorderXml = buildPageBordersXml('double', isGold ? 'C5A059' : '000000');
  const sectPrXml = `<w:sectPr><w:pgSz w:w="${A4_W_DXA}" w:h="${A4_H_DXA}"/><w:pgMar w:top="${mm(17)}" w:right="${rightMargin}" w:bottom="${mm(15)}" w:left="${leftMargin}" w:header="450" w:footer="450" w:gutter="0"/>${coverBorderXml}<w:bidi/></w:sectPr>`;

  return { bodyXml: outerCoverTable, sectPrXml };
}

function buildPlanSectionXml(
  doc: DocumentState,
  mainFont: string,
  footerRId: string,
  isFirstSection: boolean,
): { bodyXml: string; sectPrXml: string } {
  const ps = doc.planState;
  const sideM = mm(18);
  const usableW = A4_W_DXA - sideM * 2; // 9864 dxa (174mm)
  const parsedRows = parsePlanRows(ps.itemsText);
  const count = parsedRows.length;

  // ضغط طفيف للمسافات عند كثرة العناصر (مثل خطة 3 مباحث + دراسة حالة) لضمان بقائها في صفحة واحدة مثل PDF
  const dense = count > 22 ? 2 : count > 16 ? 1 : 0;
  const mainPt = dense === 2 ? 10.2 : dense === 1 ? 11 : 11.8;
  const subPt = dense === 2 ? 9.5 : dense === 1 ? 10 : 10.8;
  const mainBefore = dense === 2 ? 55 : dense === 1 ? 85 : 130;
  const mainAfter = dense === 2 ? 25 : dense === 1 ? 35 : 55;
  const subAfter = dense === 2 ? 14 : dense === 1 ? 22 : 38;
  const lineVal = dense === 2 ? 265 : dense === 1 ? 285 : 310;
  const subIndent = mm(7);

  const paragraphs: string[] = [
    `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="6" w:color="222222"/></w:pBdr><w:bidi/><w:spacing w:before="0" w:after="${dense === 2 ? 120 : 200}" w:line="280" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun((ps.pageTitle || 'خـطّـة البـحـث').trim(), { font: 'Cairo', sizePt: dense === 2 ? 16.5 : 18, bold: true, color: '000000' })}</w:p>`,
  ];

  for (const row of parsedRows) {
    const titleFont = row.isMain ? 'Cairo' : mainFont;
    const titlePt = row.isMain ? mainPt : subPt;
    const titleColor = row.isMain ? '000000' : '222222';
    const bdr = row.isMain
      ? `<w:pBdr><w:bottom w:val="dashed" w:sz="4" w:space="3" w:color="AAAAAA"/></w:pBdr>`
      : '';
    const tabs = ps.showPageNumbers
      ? `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${usableW}"/></w:tabs>`
      : '';
    const spacing = row.isMain
      ? `<w:spacing w:before="${mainBefore}" w:after="${mainAfter}" w:line="${lineVal}" w:lineRule="auto"/>`
      : `<w:spacing w:before="0" w:after="${subAfter}" w:line="${lineVal}" w:lineRule="auto"/>`;
    const ind = row.isMain ? '' : `<w:ind w:left="${subIndent}"/>`;

    const pageRuns = ps.showPageNumbers
      ? `<w:r><w:tab/></w:r>${buildTextRun(row.page, { font: 'Cairo', sizePt: dense === 2 ? 9.5 : 10, bold: true, color: '333333' })}`
      : '';

    const titleText = row.isMain ? row.title : `•  ${row.title}`;

    // ترتيب CT_PPrBase: pBdr -> tabs -> bidi -> spacing -> ind -> jc
    paragraphs.push(
      `<w:p><w:pPr>${bdr}${tabs}<w:bidi/>${spacing}${ind}<w:jc w:val="right"/></w:pPr>${buildTextRun(titleText, { font: titleFont, sizePt: titlePt, bold: row.isMain, color: titleColor })}${pageRuns}</w:p>`,
    );
  }

  // ترتيب CT_SectPr: footerReference -> type -> pgSz -> pgMar -> pgBorders -> bidi
  const nextPageXml = isFirstSection ? '' : '<w:type w:val="nextPage"/>';
  const borderXml = buildPageBordersXml(doc.borderStyle);
  const sectPrXml = `<w:sectPr><w:footerReference w:type="default" r:id="${footerRId}"/>${nextPageXml}<w:pgSz w:w="${A4_W_DXA}" w:h="${A4_H_DXA}"/><w:pgMar w:top="${mm(14)}" w:right="${sideM}" w:bottom="${mm(16.5)}" w:left="${sideM}" w:header="450" w:footer="${mm(10.8)}" w:gutter="0"/>${borderXml}<w:bidi/></w:sectPr>`;

  return { bodyXml: paragraphs.join(''), sectPrXml };
}

function buildFootnoteSeparatorTableXml(blockWidthDxa: number): string {
  // جدول RTL بدون حدود خارجية لعرض خط فاصل قصير (38% من عرض الصفحة يميناً) مثل تصميم PDF
  // متوافق كلياً مع Google Docs و Word Online و WPS Office و Microsoft Word
  const sepW = Math.max(1200, Math.round(blockWidthDxa * 0.38));
  const restW = Math.max(0, blockWidthDxa - sepW);
  const noBorder = 'w:val="none" w:sz="0" w:space="0" w:color="auto"';
  const emptyTblBorders = `<w:tblBorders><w:top ${noBorder}/><w:left ${noBorder}/><w:bottom ${noBorder}/><w:right ${noBorder}/><w:insideH ${noBorder}/><w:insideV ${noBorder}/></w:tblBorders>`;
  const sepCellBorders = `<w:tcBorders><w:top ${noBorder}/><w:left ${noBorder}/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="333333"/><w:right ${noBorder}/></w:tcBorders>`;
  const blankCellBorders = `<w:tcBorders><w:top ${noBorder}/><w:left ${noBorder}/><w:bottom ${noBorder}/><w:right ${noBorder}/></w:tcBorders>`;
  const tinyPara = `<w:p><w:pPr><w:keepNext/><w:bidi/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>`;

  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${blockWidthDxa}" w:type="dxa"/>${emptyTblBorders}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${sepW}"/><w:gridCol w:w="${restW}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="40" w:hRule="exact"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${sepW}" w:type="dxa"/>${sepCellBorders}</w:tcPr>${tinyPara}</w:tc><w:tc><w:tcPr><w:tcW w:w="${restW}" w:type="dxa"/>${blankCellBorders}</w:tcPr>${tinyPara}</w:tc></w:tr></w:tbl>`;
}

function buildContentSectionXml(
  doc: DocumentState,
  mainFont: string,
  footerRId: string,
  headerRId: string | null,
  isFirstSection: boolean,
): { bodyXml: string; sectPrXml: string } {
  const sideM = mm(17);
  const topM = doc.showStudentInfo ? mm(17.5) : mm(14);
  const bottomM = mm(16.5);
  const usableW = A4_W_DXA - sideM * 2;
  const fnBlockW =
    doc.layoutMode === 'card' ? Math.floor((usableW - mm(8)) / 2) : usableW;

  const fontSize = doc.fontSize || 12.3;
  const lineSpacing = Math.round((doc.lineHeight || 1.62) * 240);
  const bodyChunks: string[] = [];

  const pages =
    doc.pages.length > 0
      ? doc.pages
      : [{ mabhathTitle: '', matlabTitle: '', content: '', footnotes: [] }];

  pages.forEach((page, pageIndex) => {
    const pageBreakPending = { value: pageIndex > 0 };
    const pageFnList = Array.isArray(page.footnotes) ? page.footnotes : [];
    let pageParagraphCount = 0;

    const consumePageBreak = (): string => {
      if (pageBreakPending.value) {
        pageBreakPending.value = false;
        return '<w:pageBreakBefore/>';
      }
      return '';
    };

    const mabhath = page.mabhathTitle?.trim();
    if (mabhath) {
      const pb = consumePageBreak();
      bodyChunks.push(
        `<w:p><w:pPr><w:keepNext/>${pb}<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="222222"/></w:pBdr><w:bidi/><w:spacing w:before="0" w:after="${mm(4)}" w:line="280" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun(mabhath, { font: mainFont, sizePt: 15.5, bold: true, color: '000000' })}</w:p>`,
      );
      pageParagraphCount++;
    }

    const matlab = page.matlabTitle?.trim();
    if (matlab) {
      const pb = consumePageBreak();
      bodyChunks.push(
        `<w:p><w:pPr><w:keepNext/>${pb}<w:pBdr><w:right w:val="single" w:sz="24" w:space="6" w:color="222222"/></w:pBdr><w:bidi/><w:spacing w:before="${mabhath ? mm(2.5) : 0}" w:after="${mm(2.5)}" w:line="280" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr>${buildTextRun(matlab, { font: mainFont, sizePt: 13.5, bold: true, underline: true, color: '000000' })}</w:p>`,
      );
      pageParagraphCount++;
    }

    const parsedBlocks = parseContentHtmlBlocks(page.content || '');

    const renderInlines = (
      inlines: InlinePiece[],
      baseBold: boolean,
      baseSizePt: number,
      baseColor: string,
      baseUnderline: boolean,
    ): string => {
      return inlines
        .map((piece) => {
          if (piece.kind === 'br') {
            return '<w:r><w:br/></w:r>';
          }
          if (piece.kind === 'sup') {
            return buildTextRun(piece.text, {
              font: mainFont,
              sizePt: baseSizePt,
              bold: true,
              color: '1E3A8A',
              superscript: true,
            });
          }
          return buildTextRun(piece.text, {
            font: mainFont,
            sizePt: baseSizePt,
            bold: baseBold || piece.bold,
            italic: piece.italic,
            underline: baseUnderline || piece.underline,
            color: baseColor,
          });
        })
        .join('');
    };

    const trailingPageParagraphs: string[] = [];

    for (let bi = 0; bi < parsedBlocks.length; bi++) {
      const block = parsedBlocks[bi];
      const pb = consumePageBreak();

      if (block.kind === 'mabhath') {
        trailingPageParagraphs.push(
          `<w:p><w:pPr><w:keepNext/>${pb}<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="222222"/></w:pBdr><w:bidi/><w:spacing w:before="${mm(2)}" w:after="${mm(4)}" w:line="280" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${renderInlines(block.inlines, true, 15.5, '000000', false)}</w:p>`,
        );
      } else if (block.kind === 'matlab') {
        trailingPageParagraphs.push(
          `<w:p><w:pPr><w:keepNext/>${pb}<w:pBdr><w:right w:val="single" w:sz="24" w:space="6" w:color="222222"/></w:pBdr><w:bidi/><w:spacing w:before="${mm(3)}" w:after="${mm(2.5)}" w:line="280" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr>${renderInlines(block.inlines, true, 13.5, '000000', true)}</w:p>`,
        );
      } else if (block.kind === 'subtitle') {
        trailingPageParagraphs.push(
          `<w:p><w:pPr><w:keepNext/>${pb}<w:bidi/><w:spacing w:before="${mm(2.2)}" w:after="${mm(1.2)}" w:line="${lineSpacing}" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr>${renderInlines(block.inlines, true, Math.max(11.8, fontSize), '111111', true)}</w:p>`,
        );
      } else if (block.kind === 'bullet' || block.kind === 'numbered') {
        const numId = block.kind === 'numbered' ? '2' : '1';
        trailingPageParagraphs.push(
          `<w:p><w:pPr>${pb}<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr><w:bidi/><w:spacing w:before="0" w:after="${mm(1.8)}" w:line="${lineSpacing}" w:lineRule="auto"/><w:ind w:left="520" w:hanging="240"/><w:jc w:val="both"/></w:pPr>${renderInlines(block.inlines, false, fontSize, '111111', false)}</w:p>`,
        );
      } else {
        trailingPageParagraphs.push(
          `<w:p><w:pPr>${pb}<w:bidi/><w:spacing w:before="0" w:after="${mm(2.2)}" w:line="${lineSpacing}" w:lineRule="auto"/><w:ind w:firstLine="${mm(8)}"/><w:jc w:val="both"/></w:pPr>${renderInlines(block.inlines, false, fontSize, '111111', false)}</w:p>`,
        );
      }
    }

    // إظهار هوامش الصفحة مباشرة في محتوى الصفحة بتصميم مطابق لـ PDF (خط فاصل 38% + المراجع)
    // لضمان ظهورها في Google Docs و Word Online و WPS Office وكل تطبيقات الهاتف والكمبيوتر
    if (pageFnList.length > 0) {
      if (pageBreakPending.value) {
        const pb = consumePageBreak();
        trailingPageParagraphs.push(
          `<w:p><w:pPr>${pb}<w:bidi/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>`,
        );
      }
      trailingPageParagraphs.push(buildFootnoteSeparatorTableXml(fnBlockW));
      pageFnList.forEach((fnRaw, fnIdx) => {
        const fnText = (fnRaw || '').replace(/\r\n?/g, ' ').replace(/\n+/g, ' ').trim();
        const keepNext = fnIdx < pageFnList.length - 1 ? '<w:keepNext/>' : '';
        trailingPageParagraphs.push(
          `<w:p><w:pPr>${keepNext}<w:keepLines/><w:bidi/><w:spacing w:before="${fnIdx === 0 ? 75 : 0}" w:after="40" w:line="280" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr>${buildTextRun(String(fnIdx + 1), { font: mainFont, sizePt: 9, bold: true, color: '1E3A8A', superscript: true })}${buildTextRun(` ${fnText}`, { font: mainFont, sizePt: 9, color: '222222' })}</w:p>`,
        );
      });
    } else if (trailingPageParagraphs.length === 0 && pageParagraphCount === 0) {
      const pb = consumePageBreak();
      trailingPageParagraphs.push(`<w:p><w:pPr>${pb}<w:bidi/><w:jc w:val="both"/></w:pPr></w:p>`);
    }

    bodyChunks.push(...trailingPageParagraphs);
  });

  // ترتيب CT_SectPr: headerReference -> footerReference -> type -> pgSz -> pgMar -> pgBorders -> pgNumType -> cols -> bidi
  const headerRefXml = headerRId ? `<w:headerReference w:type="default" r:id="${headerRId}"/>` : '';
  const nextPageXml = isFirstSection ? '' : '<w:type w:val="nextPage"/>';
  const borderXml = buildPageBordersXml(doc.borderStyle);
  const colsXml =
    doc.layoutMode === 'card'
      ? `<w:cols w:num="2" w:space="${mm(8)}" w:sep="1" w:equalWidth="1"/>`
      : '';

  const sectPrXml = `<w:sectPr>${headerRefXml}<w:footerReference w:type="default" r:id="${footerRId}"/>${nextPageXml}<w:pgSz w:w="${A4_W_DXA}" w:h="${A4_H_DXA}"/><w:pgMar w:top="${topM}" w:right="${sideM}" w:bottom="${bottomM}" w:left="${sideM}" w:header="${doc.showStudentInfo ? mm(10) : 450}" w:footer="${mm(10.8)}" w:gutter="0"/>${borderXml}<w:pgNumType w:start="1"/>${colsXml}<w:bidi/></w:sectPr>`;

  return { bodyXml: bodyChunks.join(''), sectPrXml };
}

function buildPlanFooterXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun('- أ -', { font: 'Cairo', sizePt: 10, bold: true, color: '333333' })}</w:p></w:ftr>`;
}

function buildContentFooterXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${buildTextRun('- ', { font: 'Cairo', sizePt: 10, bold: true, color: '333333', rtl: false })}<w:r>${buildRunPr({ font: 'Cairo', sizePt: 10, bold: true, color: '333333', rtl: false })}<w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r>${buildRunPr({ font: 'Cairo', sizePt: 10, bold: true, color: '333333', rtl: false })}<w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>${buildTextRun(' -', { font: 'Cairo', sizePt: 10, bold: true, color: '333333', rtl: false })}</w:p></w:ftr>`;
}

function buildStudentHeaderXml(doc: DocumentState): string {
  const sideM = mm(17);
  const usableW = A4_W_DXA - sideM * 2;
  const colW = Math.floor(usableW / 2);
  const nameText = `الاسم واللقب: ${doc.studentName || ''}`;
  const fawjText = `الفوج: ${doc.studentFawj || ''}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${usableW}" w:type="dxa"/><w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="BBBBBB"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${colW}"/><w:gridCol w:w="${usableW - colW}"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0"/><w:jc w:val="right"/></w:pPr>${buildTextRun(nameText, { font: 'Cairo', sizePt: 10, bold: true, color: '333333' })}</w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="${usableW - colW}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0"/><w:jc w:val="left"/></w:pPr>${buildTextRun(fawjText, { font: 'Cairo', sizePt: 10, bold: true, color: '333333' })}</w:p></w:tc></w:tr></w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p></w:hdr>`;
}

function buildStylesXml(mainFont: string, fontSizePt: number, lineHeight: number): string {
  const halfPts = Math.round((fontSizePt || 12.3) * 2);
  const line = Math.round((lineHeight || 1.62) * 240);
  // ترتيب CT_RPr: rFonts -> sz -> szCs -> lang
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${xmlEscape(mainFont)}" w:hAnsi="${xmlEscape(mainFont)}" w:cs="${xmlEscape(mainFont)}"/><w:sz w:val="${halfPts}"/><w:szCs w:val="${halfPts}"/><w:lang w:val="en-US" w:bidi="ar-DZ"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="120" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:bidi/><w:jc w:val="both"/></w:pPr></w:style></w:styles>`;
}

function buildSettingsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word/2013/wordml" w:val="15"/></w:compat></w:settings>`;
}

function buildNumberingXml(mainFont: string, fontSizePt: number): string {
  const halfPts = Math.round((fontSizePt || 12.3) * 2);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="right"/><w:pPr><w:bidi/><w:ind w:left="520" w:hanging="240"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="1E293B"/><w:sz w:val="${halfPts}"/><w:szCs w:val="${halfPts}"/></w:rPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="right"/><w:pPr><w:bidi/><w:ind w:left="540" w:hanging="260"/></w:pPr><w:rPr><w:rFonts w:ascii="${xmlEscape(mainFont)}" w:hAnsi="${xmlEscape(mainFont)}" w:cs="${xmlEscape(mainFont)}"/><w:b/><w:bCs/><w:color w:val="111111"/><w:sz w:val="${halfPts}"/><w:szCs w:val="${halfPts}"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num></w:numbering>`;
}

export async function buildWordDocx(
  doc: DocumentState,
): Promise<{ buffer: ArrayBuffer; blob: Blob; fileName: string }> {
  const cs = doc.coverState;
  const ps = doc.planState;
  const mainFont = resolvePrimaryFont(doc.fontFamily);
  const fileName = buildDocxFileName(cs.title);

  // تحميل الشعار وتحويله إلى بيانات ثنائية مدمجة داخل ملف .docx
  const logo = cs.enabled ? await loadLogoAsset(cs.logoBase64, cs.logoUrl) : null;

  let nextRelId = 1;
  const allocRel = () => `rId${nextRelId++}`;

  const rels: { id: string; type: string; target: string }[] = [];
  const entries: ZipEntryInput[] = [];
  const overrides: { partName: string; contentType: string }[] = [];

  const rIdStyles = allocRel();
  rels.push({
    id: rIdStyles,
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
    target: 'styles.xml',
  });
  overrides.push({
    partName: '/word/styles.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml',
  });

  const rIdSettings = allocRel();
  rels.push({
    id: rIdSettings,
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings',
    target: 'settings.xml',
  });
  overrides.push({
    partName: '/word/settings.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml',
  });

  const rIdNumbering = allocRel();
  rels.push({
    id: rIdNumbering,
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
    target: 'numbering.xml',
  });
  overrides.push({
    partName: '/word/numbering.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
  });

  let logoRId: string | null = null;
  if (logo) {
    logoRId = allocRel();
    const logoPath = `media/logo.${logo.ext}`;
    rels.push({
      id: logoRId,
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
      target: logoPath,
    });
    entries.push({ name: `word/${logoPath}`, data: logo.bytes, store: true });
  }

  let footerPlanRId: string | null = null;
  if (ps.enabled) {
    footerPlanRId = allocRel();
    rels.push({
      id: footerPlanRId,
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
      target: 'footer_plan.xml',
    });
    overrides.push({
      partName: '/word/footer_plan.xml',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml',
    });
    entries.push({ name: 'word/footer_plan.xml', data: buildPlanFooterXml() });
  }

  const footerContentRId = allocRel();
  rels.push({
    id: footerContentRId,
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
    target: 'footer_content.xml',
  });
  overrides.push({
    partName: '/word/footer_content.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml',
  });
  entries.push({ name: 'word/footer_content.xml', data: buildContentFooterXml() });

  let headerContentRId: string | null = null;
  if (doc.showStudentInfo) {
    headerContentRId = allocRel();
    rels.push({
      id: headerContentRId,
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
      target: 'header_content.xml',
    });
    overrides.push({
      partName: '/word/header_content.xml',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml',
    });
    entries.push({ name: 'word/header_content.xml', data: buildStudentHeaderXml(doc) });
  }

  const shapeCounter = { val: 1 };
  const builtSections: { bodyXml: string; sectPrXml: string }[] = [];

  if (cs.enabled) {
    builtSections.push(buildCoverSectionXml(doc, logo, logoRId, shapeCounter));
  }
  if (ps.enabled && footerPlanRId) {
    builtSections.push(
      buildPlanSectionXml(doc, mainFont, footerPlanRId, builtSections.length === 0),
    );
  }

  const contentResult = buildContentSectionXml(
    doc,
    mainFont,
    footerContentRId,
    headerContentRId,
    builtSections.length === 0,
  );
  builtSections.push({ bodyXml: contentResult.bodyXml, sectPrXml: contentResult.sectPrXml });

  // تجميع جسم المستند: كل قسم غير أخير ينتهي بـ <w:p><w:pPr><w:sectPr/></w:pPr></w:p> والأخير بـ <w:sectPr/> مباشرة
  const bodyParts: string[] = [];
  for (let i = 0; i < builtSections.length; i++) {
    const sec = builtSections[i];
    bodyParts.push(sec.bodyXml);
    if (i < builtSections.length - 1) {
      bodyParts.push(
        `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>${sec.sectPrXml}</w:pPr></w:p>`,
      );
    } else {
      bodyParts.push(sec.sectPrXml);
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${bodyParts.join('')}</w:body></w:document>`;

  overrides.unshift({
    partName: '/word/document.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  });

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/>${overrides.map((o) => `<Override PartName="${o.partName}" ContentType="${o.contentType}"/>`).join('')}</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`).join('')}</Relationships>`;

  entries.push(
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'word/_rels/document.xml.rels', data: docRelsXml },
    { name: 'word/document.xml', data: documentXml },
    {
      name: 'word/styles.xml',
      data: buildStylesXml(mainFont, doc.fontSize || 12.3, doc.lineHeight || 1.62),
    },
    { name: 'word/settings.xml', data: buildSettingsXml() },
    { name: 'word/numbering.xml', data: buildNumberingXml(mainFont, doc.fontSize || 12.3) },
  );

  const zipBytes = await createDocxZip(entries);
  const buffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength,
  ) as ArrayBuffer;

  let blob: Blob;
  if (typeof File === 'function') {
    try {
      blob = new File([buffer], fileName, { type: DOCX_MIME });
    } catch {
      blob = new Blob([buffer], { type: DOCX_MIME });
    }
  } else {
    blob = new Blob([buffer], { type: DOCX_MIME });
  }

  return { buffer, blob, fileName };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(parts.join(''));
}

export async function downloadWordDocument(doc: DocumentState): Promise<WordExportResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { success: false, error: 'التصدير غير مدعوم خارج بيئة المتصفح' };
  }

  if (isInAppBrowser()) {
    return { success: false, inAppBrowser: true };
  }

  try {
    const { buffer, blob, fileName } = await buildWordDocx(doc);

    const nativeBridge = (
      window as unknown as {
        AndroidNativeFile?: {
          saveBase64File?: (b64: string, name: string, mime: string) => boolean;
        };
      }
    ).AndroidNativeFile;
    if (nativeBridge && typeof nativeBridge.saveBase64File === 'function') {
      const base64 = arrayBufferToBase64(buffer);
      if (nativeBridge.saveBase64File(base64, fileName, DOCX_MIME)) {
        return { success: true, fileName, nativeAndroid: true };
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.type = DOCX_MIME;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 60000);

    return { success: true, fileName };
  } catch (err) {
    console.error('Word export failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
