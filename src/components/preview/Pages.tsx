import type { CSSProperties } from 'react';
import type { BorderStyle, DocumentState, ResearchPage } from '../../types';
import { parsePlanRows } from '../../lib/plan';

const FALLBACK_LOGO = '/assets/univ_logos/MESRS.png';

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

export function CoverPage({ doc }: { doc: DocumentState }) {
  const cs = doc.coverState;
  const theme = cs.theme || 'black';
  const logo = cs.logoUrl || cs.logoBase64 || '';
  const pos = cs.logoPosition || 'both';
  const showRight = !!logo && (pos === 'both' || pos === 'right');
  const showLeft = !!logo && (pos === 'both' || pos === 'left');
  const students = cs.studentsText.split('\n').filter((s) => s.trim() !== '');
  const black = theme === 'black';

  return (
    <div className={`a4-page cover-theme-${theme}`} id="preview-cover">
      <div className={`page-border ${black ? 'cover-black-border' : 'cover-gold-border'}`}>
        <div className={`page-inner-border ${black ? 'cover-black-inner-border' : 'cover-gold-inner-border'}`}>
          <div className="cover-page-container">
            <div className="cover-header">
              <div className={`cover-header-wrap cover-logo-size-${cs.logoSize || 'large'}`}>
                <div className="cover-logo-box cover-logo-right">{showRight ? <Logo src={logo} /> : <div className="cover-logo-placeholder" />}</div>
                <div className="cover-header-center">
                  <div className="cover-country">{cs.country}</div>
                  <div className="cover-ministry">{cs.ministry}</div>
                  {cs.universityName && <div className="cover-university-line">{cs.universityName}</div>}
                  {cs.facultyName && <div className="cover-faculty-line">{cs.facultyName}</div>}
                  <div className="cover-top-line" />
                </div>
                <div className="cover-logo-box cover-logo-left">{showLeft ? <Logo src={logo} /> : <div className="cover-logo-placeholder" />}</div>
              </div>
            </div>

            <div className="cover-body">
              <div className="cover-type-label">{cs.workType}</div>
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
                  <div className="cover-info-heading">إعداد الطلبة:</div>
                  <div className="cover-info-names">
                    {students.map((s, i) => (
                      <span key={i}>{s.trim()}</span>
                    ))}
                  </div>
                </div>
                <div className="cover-info-box">
                  <div className="cover-info-heading">تحت إشراف الأستاذ(ة):</div>
                  <div className="cover-info-names">
                    <span>{cs.supervisor}</span>
                    <span style={{ marginTop: '3mm', fontWeight: 700 }}>{cs.group}</span>
                  </div>
                </div>
              </div>
              <div className="cover-academic-year">{cs.academicYear}</div>
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
  return (
    <div className="a4-page" id="preview-plan">
      <div className="page-border" style={b.outer}>
        <div className="page-inner-border" style={b.inner}>
          <div className="page-content">
            <div className="plan-header">
              <div className="plan-main-title">{ps.pageTitle}</div>
              {ps.researchTitle && <div className="plan-research-title">{ps.researchTitle}</div>}
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
            <div className="doc-page-number">- أ -</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContentPage({ doc, page, index }: { doc: DocumentState; page: ResearchPage; index: number }) {
  const b = borderStyles(doc.borderStyle);
  return (
    <div className={`a4-page ${doc.layoutMode === 'card' ? 'two-columns-mode' : ''}`} style={{ fontFamily: doc.fontFamily }} id={`preview-page-${index}`}>
      <div className="page-border" style={b.outer}>
        <div className="page-inner-border" style={b.inner}>
          {doc.showStudentInfo && (
            <div className="doc-student-info">
              <div>الاسم واللقب: {doc.studentName}</div>
              <div>الفوج: {doc.studentFawj}</div>
            </div>
          )}
          <div className="page-content" style={{ fontSize: `${doc.fontSize}pt`, lineHeight: doc.lineHeight }}>
            {page.mabhathTitle?.trim() && <div className="doc-mabhath-title">{page.mabhathTitle}</div>}
            {page.matlabTitle?.trim() && <div className="doc-matlab-title">{page.matlabTitle}</div>}
            {/* المحتوى HTML ناتج عن محرك التحويل المحلي من نص المستخدم نفسه */}
            <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: page.content }} />
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
