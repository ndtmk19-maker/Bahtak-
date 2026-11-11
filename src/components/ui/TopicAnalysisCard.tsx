import { ListChecks, Sparkles } from 'lucide-react';
import type { StudentTopicAnalysis } from '../../lib/aiGenerate';
import { Badge } from './Controls';

export function TopicAnalysisCard({
  analysis,
  matlabCount,
}: {
  analysis: StudentTopicAnalysis;
  matlabCount: string;
}) {
  const cleanCoverTitle = analysis.caseStudy.coverTitle || analysis.cleanedTopic;

  if (!analysis.hasCustomPlan && !analysis.hadWrapperNoise) {
    return null;
  }

  if (!analysis.hasCustomPlan && analysis.hadWrapperNoise) {
    return (
      <div
        data-testid="cleaned-topic-preview"
        className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-50/70 px-3 py-2 text-[0.76rem] text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-950/25 dark:text-emerald-100"
      >
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="flex-1 leading-relaxed">
          <span className="font-semibold text-emerald-800 dark:text-emerald-300">العنوان المعتمد للغلاف: </span>
          <strong className="font-bold">«{cleanCoverTitle}»</strong>
          <span className="mr-1.5 text-[0.71rem] text-emerald-700/90 dark:text-emerald-300/80">
            (تم استبعاد العبارات الإضافية تلقائياً)
          </span>
        </div>
      </div>
    );
  }

  const missingIntro = !analysis.hasIntroInPlan;
  const missingConclusion = !analysis.hasConclusionInPlan;
  const autoFrameNote =
    missingIntro && missingConclusion
      ? 'لم تذكر «المقدمة» أو «الخاتمة» في خطتك — سيتم إنشاؤهما تلقائياً (المقدمة في البداية، والخاتمة وقائمة المراجع في النهاية) بما ينسجم مع مباحث خطتك.'
      : missingIntro
        ? 'لم تذكر «المقدمة» في خطتك — سيتم إنشاؤها تلقائياً في بداية البحث متضمنةً التمهيد والإشكالية الرئيسية.'
        : missingConclusion
          ? 'لم تذكر «الخاتمة» في خطتك — سيتم إنشاؤها تلقائياً في نهاية البحث مع قائمة المصادر والمراجع.'
          : '';

  const formatMabhathDisplayTitle = (rawTitle: string) =>
    /\[محور المبحث[^\]]*\]/.test(rawTitle)
      ? rawTitle.replace(/\[محور المبحث[^\]]*\]/, '(سيُصاغ عنوان مناسب تلقائياً لمطالبك)')
      : rawTitle;

  return (
    <div
      data-testid="custom-plan-preview"
      className="flex flex-col gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50/75 p-3 text-[0.76rem] text-zinc-900 dark:border-emerald-400/25 dark:bg-emerald-950/25 dark:text-zinc-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
          <ListChecks className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>تم رصد خطة بحث مخصصة — سيُبنى البحث وفق خطتك حرفياً</span>
        </div>
        <Badge tone="ok">
          {analysis.customMabahith.length === 1
            ? 'مبحث واحد'
            : analysis.customMabahith.length === 2
              ? 'مبحثان'
              : `${analysis.customMabahith.length} مباحث`}
        </Badge>
      </div>

      <div className="rounded-lg border border-emerald-500/15 bg-white/75 px-2.5 py-1.5 text-[0.74rem] leading-relaxed dark:border-emerald-400/15 dark:bg-zinc-900/50">
        {analysis.hasExplicitTitle ? (
          <>
            <span className="font-semibold text-zinc-600 dark:text-zinc-300">العنوان المعتمد للغلاف: </span>
            <strong className="font-bold text-zinc-900 dark:text-white">«{cleanCoverTitle}»</strong>
            {analysis.hadWrapperNoise && (
              <span className="mr-1.5 text-[0.7rem] text-emerald-700 dark:text-emerald-300">(منقّى تلقائياً)</span>
            )}
          </>
        ) : (
          <span className="font-semibold text-emerald-800 dark:text-emerald-300">
            لم يُكتب عنوان منفصل — سيُصاغ عنوان أكاديمي موجز ومعبّر لخطة بحثك تلقائياً على الغلاف.
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1.5 pr-0.5 text-[0.73rem]">
        <li className="flex items-center justify-between gap-2 text-[0.71rem]">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">المقدمة والإشكالية</span>
          <span
            className={
              missingIntro
                ? 'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.67rem] font-bold text-emerald-800 dark:text-emerald-300'
                : 'text-[0.68rem] font-medium text-zinc-500 dark:text-zinc-400'
            }
          >
            {missingIntro ? 'تُضاف تلقائياً' : 'من خطتك'}
          </span>
        </li>

        {analysis.customMabahith.map((mb, i) => (
          <li key={i} className="leading-snug">
            <div className="font-bold text-zinc-900 dark:text-zinc-100">{formatMabhathDisplayTitle(mb.title)}</div>
            {mb.matalib.length > 0 ? (
              <ul className="mt-0.5 flex flex-col gap-0.5 pr-4 text-[0.71rem] text-zinc-600 dark:text-zinc-300">
                {mb.matalib.map((mt, j) => (
                  <li key={j}>• {mt.title}</li>
                ))}
              </ul>
            ) : (
              <div className="pr-4 text-[0.7rem] text-emerald-700 dark:text-emerald-300">
                (سيتم توليد {matlabCount} مطالب تلقائياً لهذا المبحث)
              </div>
            )}
          </li>
        ))}

        {analysis.caseStudy.hasCaseStudy && (
          <li className="flex items-center justify-between gap-2 text-[0.71rem]">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              دراسة حالة{analysis.caseStudy.company ? `: ${analysis.caseStudy.company}` : ' تطبيقية (تُختار مؤسسة مناسبة)'}
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.67rem] font-bold text-emerald-800 dark:text-emerald-300">
              قبل الخاتمة
            </span>
          </li>
        )}

        <li className="flex items-center justify-between gap-2 text-[0.71rem]">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">الخاتمة وقائمة المصادر والمراجع</span>
          <span
            className={
              missingConclusion
                ? 'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.67rem] font-bold text-emerald-800 dark:text-emerald-300'
                : 'text-[0.68rem] font-medium text-zinc-500 dark:text-zinc-400'
            }
          >
            {missingConclusion ? 'تُضاف تلقائياً' : 'من خطتك + المراجع'}
          </span>
        </li>
      </ul>

      {autoFrameNote && (
        <div
          data-testid="auto-intro-conclusion-note"
          className="flex items-start gap-1.5 rounded-lg border border-emerald-500/20 bg-white/60 px-2.5 py-1.5 text-[0.71rem] font-medium text-emerald-900 dark:border-emerald-400/20 dark:bg-zinc-900/40 dark:text-emerald-200"
        >
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{autoFrameNote}</span>
        </div>
      )}

      {analysis.caseStudyInPlanMabhath && (
        <div className="text-[0.71rem] font-medium text-emerald-800 dark:text-emerald-300">
          تضمنت خطتك مبحثاً لدراسة الحالة؛ سيُحرَّر في موضعه دون تكرار قسم إضافي.
        </div>
      )}
    </div>
  );
}
