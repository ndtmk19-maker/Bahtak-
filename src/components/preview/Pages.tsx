import { useMemo, type CSSProperties } from 'react';
import type { BorderStyle, CoverTemplateId, DocumentState, ResearchPage } from '../../types';
import { parsePlanRows } from '../../lib/plan';
import { getLocalizedCoverState, getLocalizedPlanTitle } from '../../data/defaults';
import { DiamondRule } from './cover/art';
import { getCoverTemplate } from './cover/templates';

const FALLBACK_LOGO = '/assets/univ_logos/MESRS.png';

/** وسوم لا مكان لها في متن البحث (قد تتسرب من مخرجات الذكاء الاصطناعي أو اللصق) */
const BLOCKED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'foreignobject']);
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction']);

/**
 * تنقية HTML الصفحة قبل حقنه: يبقي الفقرات والقوائم والجداول ورسوم SVG البيانية،
 * ويزيل الوسوم التنفيذية ومعالجات الأحداث (on*) والروابط من نوع javascript:.
 */
function sanitizePageHtml(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html || '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (BLOCKED_TAGS.has(child.tagName.toLowerCase())) {
        child.remove();
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.replace(/\s+/g, '').toLowerCase();
        if (name.startsWith('on') || (URL_ATTRS.has(name) && /^(?:javascript|vbscript|data:text\/html)/.test(value))) {
          child.removeAttribute(attr.name);
        }
      }
      walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

function borderStyles(style: BorderStyle): { outer: CSSProperties; inner: CSSProperties } {
  switch (style) {
    case 'gold':
      return { outer: { border: '1px solid var(--gold)' }, inner: { border: '1.5px solid var(--gold)' } };
    case 'single':
      return { outer: { border: 'none', padding: 0 }, inner: { border: '1.5px solid #222' } };
    case 'none':
      return { outer: { border: 'none', padding: 0 }, inner: { border: 'none', padding: 0 } };
    default:
      return { outer: { border: '1px solid #222' }, inner: { border: '2px solid #222' } };
  }
}

function Logo({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt="شعار الجامعة"
      className="cover-univ-logo"
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.src.includes('MESRS.png')) img.src = FALLBACK_LOGO;
      }}
    />
  );
}

function UniversityCoverLogo({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="flex size-[22mm] shrink-0 items-center justify-center rounded-full border-[1.5px] border-gray-900 p-[3px]">
      <div className="flex size-full items-center justify-center overflow-hidden rounded-full border border-gray-300 bg-white">
        {src ? (
          <img
            src={src}
            alt={alt}
            className="size-full object-contain p-1"
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.src.includes('MESRS.png')) img.src = FALLBACK_LOGO;
            }}
          />
        ) : (
          <svg viewBox="0 0 64 64" className="size-9 text-gray-800" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M32 12 L58 24 L32 36 L6 24 Z" />
            <path d="M16 29 V40 C16 47 48 47 48 40 V29" />
            <path d="M58 24 V38" />
          </svg>
        )}
      </div>
    </div>
  );
}

export function ExperimentalCoverPage({ doc, templateId }: { doc: DocumentState; templateId?: CoverTemplateId }) {
  const cs = doc.coverState;
  const lang = doc.language || 'ar';
  const isLatin = lang === 'fr' || lang === 'en';
  const isFr = lang === 'fr';
  const isEn = lang === 'en';
  const students = cs.studentsText.split('\n').filter((s) => s.trim() !== '');

  const loc = getLocalizedCoverState(cs, lang);
  const republic = loc.country || cs.country || 'الجمهورية الجزائرية الديمقراطية الشعبية';
  const ministry = loc.ministry || cs.ministry || 'وزارة التعليم العالي والبحث العلمي';
  const university = cs.universityName;
  const faculty = cs.facultyName;
  const logo = cs.logoUrl || cs.logoBase64 || '';
  const researchType = loc.workType || cs.workType || 'بحث أكاديمي حول';
  const title = cs.title;
  const subtitle = cs.subtitle;
  const supervisor = loc.supervisor || cs.supervisor;
  const group = loc.group || cs.group;
  const academicYear = loc.academicYear || cs.academicYear;

  const pos = cs.logoPosition || 'both';
  const showRight = !!logo && (pos === 'both' || pos === 'right');
  const showLeft = !!logo && (pos === 'both' || pos === 'left');

  const selectedTplId = templateId || cs.coverTemplate || 'classic-ornate';
  const tpl = getCoverTemplate(selectedTplId);
  const { Title } = tpl;

  const studentsHeading = isFr ? 'Préparé par :' : isEn ? 'Prepared by:' : 'إعداد الطلبة:';
  const supervisorHeading = isFr ? 'Sous la direction de :' : isEn ? 'Supervised by:' : 'تحت إشراف الأستاذ(ة):';

  return (
    <div
      className={`a4-page cover-experimental-page ${isLatin ? 'lang-ltr' : ''}`}
      dir={isLatin ? 'ltr' : 'rtl'}
      id="preview-cover"
      data-template={tpl.id}
    >
      <div
        className="relative mx-auto h-[297mm] w-[210mm] shrink-0 overflow-hidden bg-white text-gray-900 shadow-sm"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        {tpl.art}
        {tpl.overlay}

        <div className="relative flex h-full flex-col justify-between" style={tpl.padding}>
          {/* Official header: logo | institution | logo */}
          <div>
            <header className="flex items-center justify-between gap-3">
              <div className="size-[22mm] shrink-0 flex items-center justify-center">
                {showRight ? (
                  <UniversityCoverLogo src={logo} alt={university || 'شعار الجامعة'} />
                ) : (
                  <div className="size-[22mm]" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-center">
                <p className="mx-auto max-w-[95mm] text-[15pt] leading-[1.45] font-extrabold text-balance">{republic}</p>
                <p className="mt-1 text-[11pt] font-bold">{ministry}</p>
                {university && <p className="text-[11.5pt] font-bold text-balance">{university}</p>}
                {faculty && <p className="text-[10.5pt] font-semibold text-gray-700">{faculty}</p>}
              </div>
              <div className="size-[22mm] shrink-0 flex items-center justify-center">
                {showLeft ? (
                  <UniversityCoverLogo src={logo} alt={university || 'شعار الجامعة'} />
                ) : (
                  <div className="size-[22mm]" />
                )}
              </div>
            </header>
            <div className="mx-auto mt-4 h-[1.5px] w-[90mm] bg-gradient-to-l from-transparent via-gray-900 to-transparent" />
          </div>

          {/* Title block */}
          <main className="flex flex-1 flex-col items-center justify-center py-4 text-center">
            <Title researchType={researchType} title={title} subtitle={subtitle} />
          </main>

          {/* Footer block: Students, Supervisor, Year */}
          <div>
            <div className="grid grid-cols-2 gap-8 text-[12pt] leading-relaxed">
              <div>
                <h2 className="mb-1.5 text-[13pt] font-extrabold">{studentsHeading}</h2>
                <ul className="space-y-0.5 font-semibold">
                  {(students.length ? students : ['—']).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="justify-self-end text-left rtl:text-right">
                <h2 className="mb-1.5 text-[13pt] font-extrabold">{supervisorHeading}</h2>
                <p className="font-semibold">{supervisor || '—'}</p>
                {group && (
                  <p className="mt-1.5 font-semibold">
                    <span className="font-extrabold">{isFr ? 'Groupe : ' : isEn ? 'Group: ' : 'الفوج: '}</span>
                    {group}
                  </p>
                )}
              </div>
            </div>

            {/* Academic year */}
            <footer className="mt-6 text-center">
              <DiamondRule className="w-full" />
              <p className="mt-3 text-[12.5pt] font-extrabold">
                {isFr ? 'Année universitaire : ' : isEn ? 'Academic year: ' : 'السنة الجامعية: '}{' '}
                <span dir="ltr" className="tabular-nums">{academicYear || '2026 / 2027'}</span>
              </p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CoverPage({ doc }: { doc: DocumentState }) {
  if (doc.coverState.useExperimentalDesign) {
    return <ExperimentalCoverPage doc={doc} />;
  }

  const cs = doc.coverState;
  const theme = cs.theme || 'black';
  const logo = cs.logoUrl || cs.logoBase64 || '';
  const pos = cs.logoPosition || 'both';
  const showRight = !!logo && (pos === 'both' || pos === 'right');
  const showLeft = !!logo && (pos === 'both' || pos === 'left');
  const students = cs.studentsText.split('\n').filter((s) => s.trim() !== '');
  const black = theme === 'black';
  const lang = doc.language || 'ar';
  const isLatin = lang === 'fr' || lang === 'en';
  const isFr = lang === 'fr';
  const isEn = lang === 'en';
  const studentsHeading = isFr ? 'Préparé par :' : isEn ? 'Prepared by:' : 'إعداد الطلبة:';
  const supervisorHeading = isFr ? 'Sous la direction de :' : isEn ? 'Supervised by:' : 'تحت إشراف الأستاذ(ة):';

  const loc = getLocalizedCoverState(cs, lang);
  const country = loc.country || cs.country;
  const ministry = loc.ministry || cs.ministry;
  const workType = loc.workType || cs.workType;
  const supervisor = loc.supervisor || cs.supervisor;
  const group = loc.group || cs.group;
  const academicYear = loc.academicYear || cs.academicYear;

  return (
    <div className={`a4-page cover-theme-${theme} ${isLatin ? 'lang-ltr' : ''}`} dir={isLatin ? 'ltr' : 'rtl'} id="preview-cover">
      <div className={`page-border ${black ? 'cover-black-border' : 'cover-gold-border'}`}>
        <div className={`page-inner-border ${black ? 'cover-black-inner-border' : 'cover-gold-inner-border'}`}>
          <div className="cover-page-container">
            <div className="cover-header">
              <div className={`cover-header-wrap cover-logo-size-${cs.logoSize || 'large'}`}>
                <div className="cover-logo-box cover-logo-right">{showRight ? <Logo src={logo} /> : <div className="cover-logo-placeholder" />}</div>
                <div className="cover-header-center">
                  <div className="cover-country">{country}</div>
                  <div className="cover-ministry">{ministry}</div>
                  {cs.universityName && <div className="cover-university-line">{cs.universityName}</div>}
                  {cs.facultyName && <div className="cover-faculty-line">{cs.facultyName}</div>}
                  <div className="cover-top-line" />
                </div>
                <div className="cover-logo-box cover-logo-left">{showLeft ? <Logo src={logo} /> : <div className="cover-logo-placeholder" />}</div>
              </div>
            </div>

            <div className="cover-body">
              <div className="cover-type-label">{workType}</div>
              <div className="cover-main-title">{cs.title}</div>
              {cs.subtitle && <div className="cover-subtitle">{cs.subtitle}</div>}
              <div className="cover-diamond-divider">
                <div className="cover-diamond-line" />
                <div className="cover-diamond-icon">◆</div>
                <div className="cover-diamond-line" />
              </div>
            </div>

            <div className="cover-footer">
              <div className="cover-info-grid">
                <div className="cover-info-box">
                  <div className="cover-info-heading">{studentsHeading}</div>
                  <div className="cover-info-names">
                    {students.map((s, i) => (
                      <span key={i}>{s.trim()}</span>
                    ))}
                  </div>
                </div>
                <div className="cover-info-box">
                  <div className="cover-info-heading">{supervisorHeading}</div>
                  <div className="cover-info-names">
                    <span>{supervisor}</span>
                    <span style={{ marginTop: '3mm', fontWeight: 700 }}>{group}</span>
                  </div>
                </div>
              </div>
              <div className="cover-academic-year">{academicYear}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlanPage({ doc }: { doc: DocumentState }) {
  const ps = doc.planState;
  const b = borderStyles(doc.borderStyle);
  const lang = doc.language || 'ar';
  const isLatin = lang === 'fr' || lang === 'en';
  const displayedTitle = getLocalizedPlanTitle(ps.pageTitle, lang);

  return (
    <div className={`a4-page ${isLatin ? 'lang-ltr' : ''}`} dir={isLatin ? 'ltr' : 'rtl'} id="preview-plan">
      <div className="page-border" style={b.outer}>
        <div className="page-inner-border" style={b.inner}>
          <div className="page-content">
            <div className="plan-header">
              <div className="plan-main-title">{displayedTitle}</div>
            </div>
            <div className="plan-items-container">
              {parsePlanRows(ps.itemsText).map((row, i) => (
                <div key={i} className={`plan-row ${row.isMain ? 'main-row' : 'sub-row'}`}>
                  <span className="plan-row-title">{row.title}</span>
                  {ps.showPageNumbers && (
                    <>
                      <span className="plan-row-dots" />
                      <span className="plan-row-page">{row.page}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="doc-footer">
            <div className="doc-page-number">- {isLatin ? 'i' : 'أ'} -</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContentPage({ doc, page, index }: { doc: DocumentState; page: ResearchPage; index: number }) {
  const b = borderStyles(doc.borderStyle);
  const safeContent = useMemo(() => sanitizePageHtml(page.content), [page.content]);
  const isLatin = doc.language === 'fr' || doc.language === 'en';
  const nameLabel = doc.language === 'fr' ? 'Nom et Prénom :' : doc.language === 'en' ? 'Name:' : 'الاسم واللقب:';
  const fawjLabel = doc.language === 'fr' ? 'Groupe :' : doc.language === 'en' ? 'Group:' : 'الفوج:';

  return (
    <div
      className={`a4-page ${isLatin ? 'lang-ltr' : ''} ${doc.layoutMode === 'card' ? 'two-columns-mode' : ''}`}
      dir={isLatin ? 'ltr' : 'rtl'}
      style={{ fontFamily: doc.fontFamily }}
      id={`preview-page-${index}`}
    >
      <div className="page-border" style={b.outer}>
        <div className="page-inner-border" style={b.inner}>
          {doc.showStudentInfo && (
            <div className="doc-student-info">
              <div>{nameLabel} {doc.studentName}</div>
              <div>{fawjLabel} {doc.studentFawj}</div>
            </div>
          )}
          <div className="page-content" style={{ fontSize: `${doc.fontSize}pt`, lineHeight: doc.lineHeight }}>
            {page.mabhathTitle?.trim() && <div className="doc-mabhath-title">{page.mabhathTitle}</div>}
            {page.matlabTitle?.trim() && <div className="doc-matlab-title">{page.matlabTitle}</div>}
            {/* المحتوى HTML ناتج عن محرك التحويل المحلي (فقرات، قوائم، جداول doc-table، أشكال SVG) بعد تنقيته */}
            <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: safeContent }} />
          </div>
          <div className="doc-footer">
            {page.footnotes?.length > 0 && (
              <>
                <hr className="doc-separator" />
                <div className="doc-footnotes">
                  {page.footnotes.map((fn, i) => (
                    <p key={i}>
                      <sup>{i + 1}</sup> {fn}
                    </p>
                  ))}
                </div>
              </>
            )}
            <div className="doc-page-number">- {index + 1} -</div>
          </div>
        </div>
      </div>
    </div>
  );
}
