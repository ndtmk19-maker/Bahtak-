// العناصر الأكاديمية غير النصية داخل صفحات البحث: الجداول (Markdown) والأشكال البيانية (Charts).
// هذه الوحدة نقية ولا تعتمد على DOM حتى تُستعمل في: المحلل (parser)، والتوزيع على الصفحات (paginator)،
// والمحرر النصي للصفحات (pageText)، وتصدير Word (wordExport) بالمنطق نفسه تماماً.
import { escapeHtml } from './escape';

// ===================== الأنواع =====================

/** محاذاة عمود الجدول بمصطلحات منطقية (start = يمين في RTL) */
export type CellAlign = 'start' | 'center' | 'end';

export interface TableData {
  /** عنوان الجدول دون «الجدول رقم (..)» */
  caption: string;
  /** خلايا الرأس بصيغة HTML سطرية آمنة (strong / sup فقط) */
  headers: string[];
  /** صفوف المتن بصيغة HTML سطرية آمنة */
  rows: string[][];
  aligns: CellAlign[];
  /** سطر المصدر دون كلمة «المصدر:» */
  source: string;
}

export type ChartKind = 'bar' | 'column' | 'pie';

export interface ChartDatum {
  label: string;
  value: number;
}

export interface ChartData {
  kind: ChartKind;
  title: string;
  unit: string;
  data: ChartDatum[];
  source: string;
}

// ===================== ثوابت التعرف =====================

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** تحويل الأرقام الهندية (٠-٩) إلى أرقام عربية غربية لتوحيد الحساب */
export function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/** «الجدول رقم (01): عنوان» أو «جدول 1 - عنوان» أو «تابع الجدول رقم (01): ...» */
export const TABLE_CAPTION_RE =
  /^(?:\*\*)?\s*(تابع\s+)?(?:ال)?جدول\s*(?:رقم)?\s*[([]?\s*([\d٠-٩]+)?\s*[)\]]?\s*[:\-–—.]\s*(.+?)\s*(?:\*\*)?$/;

/** «الشكل رقم (01): عنوان» أو «رسم بياني 2: عنوان» */
export const FIGURE_CAPTION_RE =
  /^(?:\*\*)?\s*(?:ال)?(?:شكل|رسم\s+بياني|مخطط)\s*(?:رقم)?\s*[([]?\s*([\d٠-٩]+)?\s*[)\]]?\s*[:\-–—.]\s*(.+?)\s*(?:\*\*)?$/;

/** «المصدر: ...» تحت الجدول أو الشكل */
export const SOURCE_LINE_RE = /^(?:\*\*)?\s*(?:ال)?مصدر\s*(?:\*\*)?\s*[:\-–—]\s*(.+?)\s*(?:\*\*)?$/;

/** وسم الشكل البياني في سطر واحد: [[CHART {...json...}]] */
export const CHART_MARKER_RE = /^\[\[\s*(?:CHART|chart|شكل|رسم)\s*(\{[\s\S]*\})\s*\]\]$/;

/** بداية كتلة شكل بياني مسيّجة ```chart (مقبولة احتياطياً من النماذج) */
export const CHART_FENCE_START_RE = /^```\s*(?:chart|json)\s*$/i;

/** أعمدة الترقيم الجاهزة التي تغني عن إضافة عمود «م» تلقائياً */
const INDEX_HEADER_RE = /^(?:م|ر|ت|#|الرقم|رقم|الترتيب|ر\.م|ت\.ر)$/;

/** أقصى عدد للأعمدة والصفوف حتى يبقى الجدول مقروءاً ضمن عرض A4 */
export const MAX_TABLE_COLUMNS = 7;
export const MAX_TABLE_ROWS = 40;

// ===================== أدوات عامة =====================

/** ترقيم بخانتين كما في البحوث الجزائرية: 1 → 01 */
export function padNumber(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function tableLabel(num: number, caption: string, continued = false): string {
  const title = caption.trim();
  return `${continued ? 'تابع ' : ''}الجدول رقم (${padNumber(num)})${title ? `: ${title}` : ''}`;
}

export function figureLabel(num: number, title: string): string {
  const t = title.trim();
  return `الشكل رقم (${padNumber(num)})${t ? `: ${t}` : ''}`;
}

/** تنسيق نص خلية/عنوان: ترميز HTML ثم دعم **غامق** والإحالات ^1 أو [1] */
export function formatInlineText(raw: string): string {
  const escaped = escapeHtml(raw.trim());
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\$?\^(\d+)\$?/g, '<sup>$1</sup>')
    .replace(/\[(\d+)\]/g, '<sup>$1</sup>');
}

/** إزالة الوسوم وفك ترميز الكيانات الأساسية للحصول على نص خام */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** عكس formatInlineText: HTML سطري → صيغة المحرر (**غامق** و ^1) */
export function inlineHtmlToMarkdown(html: string): string {
  const marked = html
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<sup>(\d+)<\/sup>/gi, '^$1');
  return htmlToPlain(marked);
}

function isNumericCell(html: string): boolean {
  const plain = normalizeDigits(htmlToPlain(html)).replace(/[\s%٪,،.+\-–]/g, '');
  return plain.length > 0 && /^\d+$/.test(plain);
}

// ===================== جداول Markdown =====================

/** تقسيم سطر جدول Markdown إلى خلايا مع احترام \| المهرّبة */
export function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

export function isTableRowLine(line: string): boolean {
  const t = line.trim();
  return /^\|.*\|$/.test(t) && splitTableRow(t).length >= 2;
}

export function isTableSeparatorLine(line: string): boolean {
  if (!isTableRowLine(line)) return false;
  return splitTableRow(line).every((c) => /^:?-{2,}:?$/.test(c.replace(/\s+/g, '')));
}

/**
 * تحويل أسطر جدول Markdown إلى بنية TableData.
 * يضيف عمود ترقيم «م» تلقائياً للجداول ذات 3 صفوف فأكثر إن لم يكن الترقيم موجوداً.
 */
export function parseMarkdownTable(lines: string[], caption = '', source = ''): TableData | null {
  const rowLines = lines.map((l) => l.trim()).filter((l) => isTableRowLine(l));
  if (rowLines.length < 2) return null;

  const headerCells = splitTableRow(rowLines[0]).slice(0, MAX_TABLE_COLUMNS);
  const colCount = headerCells.length;
  if (colCount < 2) return null;

  let separatorAligns: (CellAlign | null)[] = new Array<CellAlign | null>(colCount).fill(null);
  let bodyStart = 1;
  if (isTableSeparatorLine(rowLines[1])) {
    bodyStart = 2;
    separatorAligns = splitTableRow(rowLines[1])
      .slice(0, colCount)
      .map((c): CellAlign | null => {
        const t = c.replace(/\s+/g, '');
        if (t.startsWith(':') && t.endsWith(':')) return 'center';
        if (t.endsWith(':')) return 'end';
        return null;
      });
  }

  const body = rowLines
    .slice(bodyStart)
    .filter((l) => !isTableSeparatorLine(l))
    .slice(0, MAX_TABLE_ROWS)
    .map((l) => {
      const cells = splitTableRow(l).slice(0, colCount);
      while (cells.length < colCount) cells.push('');
      return cells.map((c) => formatInlineText(c));
    })
    .filter((r) => r.some((c) => htmlToPlain(c) !== ''));
  if (body.length === 0) return null;

  let headers = headerCells.map((c) => formatInlineText(c.replace(/^\*\*|\*\*$/g, '')));
  let rows = body;

  // المحاذاة: الأعمدة الرقمية في الوسط، والنصية إلى اليمين (start في RTL)
  let aligns: CellAlign[] = headers.map((_, ci) => {
    const fromSep = separatorAligns[ci];
    if (fromSep) return fromSep;
    const numeric = rows.filter((r) => isNumericCell(r[ci])).length;
    return numeric / rows.length >= 0.6 ? 'center' : 'start';
  });

  const firstHeader = htmlToPlain(headers[0]);
  if (rows.length >= 3 && !INDEX_HEADER_RE.test(firstHeader) && colCount < MAX_TABLE_COLUMNS) {
    headers = ['م', ...headers];
    rows = rows.map((r, i) => [String(i + 1), ...r]);
    aligns = ['center', ...aligns];
  }

  return { caption: caption.trim(), headers, rows, aligns, source: source.trim() };
}

/** هل العمود الأول عمود ترقيم (يُعطى عرضاً ضيقاً)؟ */
export function hasIndexColumn(table: TableData): boolean {
  return INDEX_HEADER_RE.test(htmlToPlain(table.headers[0] || ''));
}

/** أوزان عرض الأعمدة (مجموعها 1): عمود الترقيم ضيق والبقية بالتساوي مع مراعاة طول المحتوى */
export function tableColumnWeights(table: TableData): number[] {
  const n = table.headers.length;
  const indexed = hasIndexColumn(table);
  const lengths = table.headers.map((h, ci) => {
    if (indexed && ci === 0) return 0;
    const cellLens = table.rows.map((r) => htmlToPlain(r[ci] || '').length);
    const avg = cellLens.reduce((a, b) => a + b, 0) / Math.max(1, cellLens.length);
    return Math.max(htmlToPlain(h).length, avg);
  });
  const indexWeight = indexed ? Math.min(0.09, 1 / n) : 0;
  const rest = 1 - indexWeight;
  // تليين الفوارق حتى لا يختنق أي عمود: الجذر التربيعي للطول مع حد أدنى
  const soft = lengths.map((len, ci) => (indexed && ci === 0 ? 0 : Math.max(2.4, Math.sqrt(len + 1))));
  const total = soft.reduce((a, b) => a + b, 0) || 1;
  return soft.map((s, ci) => (indexed && ci === 0 ? indexWeight : (s / total) * rest));
}

export interface TableRenderOptions {
  /** نطاق صفوف المتن المعروض (لتقسيم الجداول الطويلة بين الصفحات) */
  rowStart?: number;
  rowEnd?: number;
  continued?: boolean;
  showSource?: boolean;
}

const ALIGN_CLASS: Record<CellAlign, string> = {
  start: 'is-start',
  center: 'is-center',
  end: 'is-end',
};

/** رندرة جدول أكاديمي RTL: العنوان أعلى الجدول والمصدر أسفله (الأعراف الأكاديمية) */
export function renderTableHtml(table: TableData, num: number, opts: TableRenderOptions = {}): string {
  const start = opts.rowStart ?? 0;
  const end = opts.rowEnd ?? table.rows.length;
  const weights = tableColumnWeights(table);
  const cols = weights.map((w) => `<col style="width:${(w * 100).toFixed(2)}%">`).join('');
  const head = table.headers
    .map((h, ci) => `<th class="${ci === 0 && hasIndexColumn(table) ? 'doc-table-index' : ''}">${h}</th>`)
    .join('');
  const body = table.rows
    .slice(start, end)
    .map(
      (r) =>
        `<tr>${r
          .map((c, ci) => {
            const cls = [ALIGN_CLASS[table.aligns[ci] || 'start']];
            if (ci === 0 && hasIndexColumn(table)) cls.push('doc-table-index');
            return `<td class="${cls.join(' ')}">${c}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');
  const caption = formatInlineText(tableLabel(num, table.caption, opts.continued));
  const showSource = opts.showSource ?? end >= table.rows.length;
  const source =
    showSource && table.source
      ? `<div class="doc-source"><strong>المصدر:</strong> ${formatInlineText(table.source)}</div>`
      : '';
  return (
    `<figure class="doc-table-block" data-table-number="${num}"${opts.continued ? ' data-continued="1"' : ''}>` +
    `<figcaption class="doc-caption">${caption}</figcaption>` +
    `<table class="doc-table" dir="rtl"><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` +
    `${source}</figure>`
  );
}

/** استخراج بنية الجدول من HTML المولّد بواسطة renderTableHtml (دون DOM، يعمل في التصدير أيضاً) */
export function parseTableHtml(html: string): { table: TableData; label: string; continued: boolean } | null {
  const tableMatch = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!tableMatch) return null;
  const captionMatch = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(html);
  const sourceMatch = /<div class="doc-source">([\s\S]*?)<\/div>/i.exec(html);
  const label = captionMatch ? htmlToPlain(captionMatch[1]) : '';
  const labelParsed = TABLE_CAPTION_RE.exec(label);

  const rowHtml = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  const cellsOf = (row: string) =>
    [...row.matchAll(/<t([hd])([^>]*)>([\s\S]*?)<\/t\1>/gi)].map((m) => ({
      header: m[1].toLowerCase() === 'h',
      attrs: m[2],
      html: m[3].trim(),
    }));
  const parsedRows = rowHtml.map(cellsOf).filter((r) => r.length > 0);
  if (parsedRows.length === 0) return null;

  const headerRow = parsedRows[0].every((c) => c.header) ? parsedRows[0] : null;
  const headers = headerRow ? headerRow.map((c) => c.html) : parsedRows[0].map(() => '');
  const bodyRows = (headerRow ? parsedRows.slice(1) : parsedRows).map((r) => r.map((c) => c.html));
  const alignRow = (headerRow ? parsedRows[1] : parsedRows[0]) || [];
  const aligns = headers.map((_, ci): CellAlign => {
    const attrs = alignRow[ci]?.attrs || '';
    if (attrs.includes('is-center')) return 'center';
    if (attrs.includes('is-end')) return 'end';
    return 'start';
  });

  return {
    table: {
      caption: labelParsed ? labelParsed[3] : label,
      headers,
      rows: bodyRows,
      aligns,
      source: sourceMatch ? htmlToPlain(sourceMatch[1]).replace(/^المصدر\s*:\s*/, '') : '',
    },
    label,
    continued: Boolean(labelParsed && labelParsed[1]),
  };
}

/** تحويل جدول إلى صيغة المحرر (Markdown) مع سطر العنوان والمصدر */
export function tableToMarkdown(table: TableData, label: string): string {
  const row = (cells: string[]) => `| ${cells.map((c) => inlineHtmlToMarkdown(c).replace(/\|/g, '\\|')).join(' | ')} |`;
  const sep = `| ${table.aligns.map((a) => (a === 'center' ? ':---:' : a === 'end' ? '---:' : '---')).join(' | ')} |`;
  const lines = [label, row(table.headers), sep, ...table.rows.map(row)];
  if (table.source) lines.push(`المصدر: ${table.source}`);
  return lines.join('\n');
}

// ===================== الأشكال البيانية =====================

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(normalizeDigits(v).replace(/[%٪\s,،]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
}

/** التحقق من مواصفات الشكل وتطبيعها (يقبل data كمصفوفة كائنات أو labels/values) */
export function normalizeChart(input: unknown): ChartData | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const rawKind = asText(o.type ?? o.kind).toLowerCase();
  const kind: ChartKind =
    rawKind === 'pie' || rawKind === 'donut' || rawKind === 'doughnut' || rawKind === 'دائري'
      ? 'pie'
      : rawKind === 'column' || rawKind === 'vertical' || rawKind === 'أعمدة'
        ? 'column'
        : 'bar';

  let data: ChartDatum[] = [];
  if (Array.isArray(o.data)) {
    data = o.data
      .map((d): ChartDatum | null => {
        if (!d || typeof d !== 'object') return null;
        const r = d as Record<string, unknown>;
        const value = toFiniteNumber(r.value ?? r.y ?? r.v);
        const label = asText(r.label ?? r.name ?? r.x);
        return value === null || !label ? null : { label, value };
      })
      .filter((d): d is ChartDatum => d !== null);
  } else if (Array.isArray(o.labels) && Array.isArray(o.values)) {
    const values = o.values as unknown[];
    data = (o.labels as unknown[])
      .map((l, i): ChartDatum | null => {
        const value = toFiniteNumber(values[i]);
        const label = asText(l);
        return value === null || !label ? null : { label, value };
      })
      .filter((d): d is ChartDatum => d !== null);
  }

  data = data.slice(0, 10);
  if (kind === 'pie') data = data.filter((d) => d.value > 0);
  if (data.length < 2) return null;

  return {
    kind,
    title: asText(o.title ?? o.caption),
    unit: asText(o.unit).slice(0, 12),
    data,
    source: asText(o.source),
  };
}

export function parseChartSpec(json: string): ChartData | null {
  try {
    return normalizeChart(JSON.parse(json));
  } catch {
    return null;
  }
}

/** ترميز مواصفات الشكل في سمة HTML آمنة لاسترجاعها في المحرر والتصدير */
export function encodeChartAttr(chart: ChartData): string {
  return encodeURIComponent(JSON.stringify(chart));
}

export function decodeChartAttr(attr: string): ChartData | null {
  try {
    return normalizeChart(JSON.parse(decodeURIComponent(attr)));
  } catch {
    return null;
  }
}

export function chartToMarker(chart: ChartData): string {
  return `[[CHART ${JSON.stringify(chart)}]]`;
}

/** تدرجات حبرية أكاديمية تبقى مقروءة في الطباعة بالأبيض والأسود */
const CHART_PALETTE = ['#1f2937', '#4b5563', '#6b7280', '#9ca3af', '#c4c9d1', '#374151', '#57606c', '#828a96', '#b0b6bf', '#e2e5e9'];
const CHART_FONT = "Amiri, 'Traditional Arabic', 'Times New Roman', serif";
export const CHART_VIEW_WIDTH = 600;

function fmtValue(v: number, unit: string): string {
  const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
  if (!unit) return n;
  return unit === '%' || unit === '٪' ? `${n}%` : `${n} ${unit}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** ارتفاع لوحة الرسم (viewBox) بوحدات SVG لعرض ثابت قدره 600 */
export function chartViewHeight(chart: ChartData): number {
  if (chart.kind === 'pie') return Math.max(250, chart.data.length * 30 + 50);
  if (chart.kind === 'column') return 300;
  return 24 + chart.data.length * 36;
}

function renderBarSvg(chart: ChartData, h: number): string {
  // أشرطة أفقية RTL: التسميات يميناً والأشرطة تمتد نحو اليسار
  const labelRight = CHART_VIEW_WIDTH - 8;
  const barRight = CHART_VIEW_WIDTH - 190;
  const barMaxLen = barRight - 70;
  const max = Math.max(...chart.data.map((d) => d.value), 0) || 1;
  const rows = chart.data
    .map((d, i) => {
      const y = 14 + i * 36;
      const len = Math.max(2, (Math.max(0, d.value) / max) * barMaxLen);
      const x = barRight - len;
      return (
        `<text x="${labelRight}" y="${y + 17}" text-anchor="end" font-size="15">${escapeHtml(truncate(d.label, 26))}</text>` +
        `<rect x="${x.toFixed(1)}" y="${y + 3}" width="${len.toFixed(1)}" height="20" fill="${CHART_PALETTE[i % 3]}" rx="1.5"/>` +
        `<text x="${(x - 6).toFixed(1)}" y="${y + 18}" text-anchor="end" font-size="14" font-weight="700">${escapeHtml(fmtValue(d.value, chart.unit))}</text>`
      );
    })
    .join('');
  return `<line x1="${barRight}" y1="8" x2="${barRight}" y2="${h - 6}" stroke="#111" stroke-width="1.2"/>${rows}`;
}

function renderColumnSvg(chart: ChartData, h: number): string {
  // أعمدة رأسية مرتبة من اليمين إلى اليسار (البيان الأول يميناً)
  const top = 28;
  const baseY = h - 58;
  const left = 40;
  const right = CHART_VIEW_WIDTH - 20;
  const n = chart.data.length;
  const slot = (right - left) / n;
  const barW = Math.min(64, slot * 0.6);
  const max = Math.max(...chart.data.map((d) => d.value), 0) || 1;
  const grid = [0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = baseY - f * (baseY - top);
      return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="#d1d5db" stroke-width="0.8" stroke-dasharray="3 3"/>`;
    })
    .join('');
  const bars = chart.data
    .map((d, i) => {
      const cx = right - slot * (i + 0.5);
      const bh = Math.max(2, (Math.max(0, d.value) / max) * (baseY - top));
      return (
        `<rect x="${(cx - barW / 2).toFixed(1)}" y="${(baseY - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${CHART_PALETTE[i % 3]}" rx="1.5"/>` +
        `<text x="${cx.toFixed(1)}" y="${(baseY - bh - 7).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="700">${escapeHtml(fmtValue(d.value, chart.unit))}</text>` +
        `<text x="${cx.toFixed(1)}" y="${baseY + 24}" text-anchor="middle" font-size="14">${escapeHtml(truncate(d.label, Math.max(8, Math.floor(slot / 8))))}</text>`
      );
    })
    .join('');
  return `${grid}<line x1="${left}" y1="${baseY}" x2="${right}" y2="${baseY}" stroke="#111" stroke-width="1.2"/>${bars}`;
}

function renderPieSvg(chart: ChartData, h: number): string {
  // حلقة دائرية يساراً ومفتاح الألوان يميناً (اتجاه القراءة العربي)
  const total = chart.data.reduce((a, d) => a + d.value, 0) || 1;
  const cx = 150;
  const cy = h / 2;
  const r = Math.min(105, h / 2 - 16);
  const inner = r * 0.52;
  let angle = -Math.PI / 2;
  const slices = chart.data
    .map((d, i) => {
      const sweep = (d.value / total) * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + sweep;
      angle = a1;
      const large = sweep > Math.PI ? 1 : 0;
      const p = (rad: number, rr: number) => `${(cx + rr * Math.cos(rad)).toFixed(2)} ${(cy + rr * Math.sin(rad)).toFixed(2)}`;
      const path =
        sweep >= Math.PI * 2 - 1e-6
          ? `M ${p(0, r)} A ${r} ${r} 0 1 1 ${p(Math.PI, r)} A ${r} ${r} 0 1 1 ${p(0, r)} Z`
          : `M ${p(a0, r)} A ${r} ${r} 0 ${large} 1 ${p(a1, r)} L ${p(a1, inner)} A ${inner} ${inner} 0 ${large} 0 ${p(a0, inner)} Z`;
      return `<path d="${path}" fill="${CHART_PALETTE[i % CHART_PALETTE.length]}" stroke="#fff" stroke-width="1.5"/>`;
    })
    .join('');
  const legendTop = cy - (chart.data.length * 30) / 2 + 8;
  const legend = chart.data
    .map((d, i) => {
      const y = legendTop + i * 30;
      const pct = ((d.value / total) * 100).toFixed(1);
      const valueText = chart.unit === '%' || chart.unit === '٪' ? `${pct}%` : `${fmtValue(d.value, chart.unit)} (${pct}%)`;
      return (
        `<rect x="${CHART_VIEW_WIDTH - 26}" y="${y - 12}" width="16" height="16" fill="${CHART_PALETTE[i % CHART_PALETTE.length]}" rx="2"/>` +
        `<text x="${CHART_VIEW_WIDTH - 34}" y="${y + 1}" text-anchor="end" font-size="15">${escapeHtml(truncate(d.label, 24))} — <tspan font-weight="700">${escapeHtml(valueText)}</tspan></text>`
      );
    })
    .join('');
  return `${slices}<circle cx="${cx}" cy="${cy}" r="${inner - 1}" fill="#fff"/>${legend}`;
}

/** SVG مستقل (مع xmlns) يصلح للمعاينة والطباعة وتحويله إلى صورة PNG لملف Word */
export function renderChartSvg(chart: ChartData): string {
  const h = chartViewHeight(chart);
  const inner =
    chart.kind === 'pie' ? renderPieSvg(chart, h) : chart.kind === 'column' ? renderColumnSvg(chart, h) : renderBarSvg(chart, h);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="doc-chart-svg" viewBox="0 0 ${CHART_VIEW_WIDTH} ${h}" ` +
    `width="${CHART_VIEW_WIDTH}" height="${h}" role="img" aria-label="${escapeHtml(chart.title)}" ` +
    `font-family="${escapeHtml(CHART_FONT)}" fill="#111">${inner}</svg>`
  );
}

/** رندرة الشكل التوضيحي: الرسم ثم العنوان أسفله ثم المصدر (الأعراف الأكاديمية للأشكال) */
export function renderFigureHtml(chart: ChartData, num: number): string {
  const source = chart.source
    ? `<div class="doc-source"><strong>المصدر:</strong> ${formatInlineText(chart.source)}</div>`
    : '';
  return (
    `<figure class="doc-figure" data-figure-number="${num}" data-chart="${encodeChartAttr(chart)}">` +
    `<div class="doc-chart">${renderChartSvg(chart)}</div>` +
    `<figcaption class="doc-caption">${formatInlineText(figureLabel(num, chart.title))}</figcaption>` +
    `${source}</figure>`
  );
}

/** نص مختصر يمثل الجدول/الشكل لأنظمة تعتمد على النص الخام (مثل العروض التقديمية) */
export function tableSummary(table: TableData, num: number): string {
  const rows = table.rows
    .slice(0, 6)
    .map((r) => r.map((c) => htmlToPlain(c)).filter(Boolean).join(' — '))
    .join('؛ ');
  return `${tableLabel(num, table.caption)}: ${rows}`;
}

export function chartSummary(chart: ChartData, num: number): string {
  return `${figureLabel(num, chart.title)}: ${chart.data.map((d) => `${d.label} ${fmtValue(d.value, chart.unit)}`).join('، ')}`;
}

/** استخراج كتل الجداول والأشكال من HTML الصفحة بالترتيب مع ما بينها من محتوى عادي */
export type ContentSegment =
  | { kind: 'html'; html: string }
  | { kind: 'table'; html: string }
  | { kind: 'figure'; html: string; chart: ChartData | null };

export function splitContentSegments(html: string): ContentSegment[] {
  const out: ContentSegment[] = [];
  const re = /<figure class="(doc-table-block|doc-figure)"[^>]*>[\s\S]*?<\/figure>/gi;
  let last = 0;
  for (const m of html.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: 'html', html: html.slice(last, idx) });
    if (m[1] === 'doc-table-block') {
      out.push({ kind: 'table', html: m[0] });
    } else {
      const attr = /data-chart="([^"]*)"/.exec(m[0]);
      out.push({ kind: 'figure', html: m[0], chart: attr ? decodeChartAttr(attr[1]) : null });
    }
    last = idx + m[0].length;
  }
  if (last < html.length) out.push({ kind: 'html', html: html.slice(last) });
  return out;
}
