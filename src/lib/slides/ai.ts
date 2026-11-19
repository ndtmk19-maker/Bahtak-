// تكييف محرك التوليد الأكاديمي الموجود (generateResearch) لإنتاج محتوى مناسب للشرائح.
// نفس المراحل: خطة JSON ← مقدمة ومباحث وخاتمة بالتوازي ← نص بنفس الصيغة الأكاديمية يقرؤه المحلل المشترك.
import {
  analyzeStudentTopic,
  generateResearch,
  isStructuralTitleOnly,
  looksLikePlanLeak,
  sanitizeCoverTitleFromPlanLeak,
  type AiLength,
  type AiPlan,
  type GenerateOptions,
} from "../aiGenerate";
import { buildFallbackPlan } from "../aiEngine";
import type { ResearchLanguage } from "../../types";

export type SlideAiSize = "brief" | "standard" | "extended";

/** هيكل العرض القياسي (عند عدم لصق خطة مخصصة): 3 مباحث، في كل مبحث 3 مطالب. الحجم يتحكم في عمق الصياغة فقط. */
export const SLIDE_MABHATH_COUNT = 3;
export const SLIDE_MATLAB_COUNT = 3;

export const SLIDE_AI_SIZES: Record<
  SlideAiSize,
  { label: string; hint: string; length: AiLength }
> = {
  brief: {
    label: "عرض موجز",
    hint: "3 مباحث × 3 مطالب بصياغة مركزة — نحو 22 إلى 28 شريحة",
    length: "short",
  },
  standard: {
    label: "عرض قياسي",
    hint: "3 مباحث × 3 مطالب بتفصيل متوازن — نحو 26 إلى 34 شريحة",
    length: "medium",
  },
  extended: {
    label: "عرض موسع",
    hint: "3 مباحث × 3 مطالب بتفصيل معمق — نحو 30 إلى 40 شريحة",
    length: "giant",
  },
};

const ORD_AR = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

const stripPrefix = (t: string, word: string) =>
  (t || "")
    .replace(new RegExp(`^\\s*(?:ال)?${word}\\s+[^:：\\-–—]{1,25}?\\s*[:：\\-–—]\\s*`, "i"), "")
    .trim();

/** فرض هيكل 3 × 3 على الخطة المولدة للمواضيع العادية: تُحترم خطة الطالب المخصصة إن وُجدت، ويُبنى البديل من العنوان المنقّى لا النص الخام */
export function enforceSlidePlan(plan: AiPlan, topic: string, lang: ResearchLanguage = "ar"): AiPlan {
  const analysis = analyzeStudentTopic(topic);
  if (analysis.hasCustomPlan && analysis.customMabahith.length > 0) {
    return plan;
  }
  const candidateTopic =
    analysis.caseStudy.coreTopic ||
    analysis.caseStudy.coverTitle ||
    analysis.cleanedTopic ||
    sanitizeCoverTitleFromPlanLeak(plan.title || topic).cleaned;
  const cleanFallbackTopic =
    candidateTopic && !looksLikePlanLeak(candidateTopic) && !isStructuralTitleOnly(candidateTopic)
      ? candidateTopic
      : lang === "fr"
        ? "Sujet de l'exposé"
        : lang === "en"
          ? "Presentation Topic"
          : "موضوع العرض";

  const fb = buildFallbackPlan(cleanFallbackTopic, SLIDE_MABHATH_COUNT, SLIDE_MATLAB_COUNT, "short", lang) as AiPlan;
  const mabahith = Array.from({ length: SLIDE_MABHATH_COUNT }, (_, i) => {
    const src = plan.mabahith?.[i] || fb.mabahith[i];
    const prefixWord = lang === "fr" ? "chapitre" : lang === "en" ? "chapter" : "مبحث";
    const subPrefixWord = lang === "fr" ? "section" : lang === "en" ? "section" : "مطلب";

    const title = stripPrefix(src.title, prefixWord) || stripPrefix(fb.mabahith[i].title, prefixWord);
    const matalib = Array.from({ length: SLIDE_MATLAB_COUNT }, (_, j) => {
      const m = src.matalib?.[j] || fb.mabahith[i].matalib?.[j] || { title: "" };
      const mt =
        stripPrefix(m.title, subPrefixWord) ||
        stripPrefix(fb.mabahith[i].matalib?.[j]?.title || "", subPrefixWord);
      const subTitle =
        lang === "fr"
          ? `Section ${j + 1} : ${mt}`
          : lang === "en"
            ? `Section ${j + 1}: ${mt}`
            : `المطلب ${ORD_AR[j]}: ${mt}`;
      return { title: subTitle };
    });

    const mainTitle =
      lang === "fr"
        ? `Chapitre ${ROMAN[i]} : ${title}`
        : lang === "en"
          ? `Chapter ${i + 1}: ${title}`
          : `المبحث ${ORD_AR[i]}: ${title}`;
    return { title: mainTitle, matalib };
  });
  return { ...plan, mabahith };
}

export const SLIDE_PROMPT_ADDENDUM_BY_LANG: Record<ResearchLanguage, string> = {
  ar: [
    "تنبيه مهم بخصوص الصياغة: سيُحوَّل هذا النص آلياً إلى شرائح عرض تقديمي (PowerPoint)، لذلك التزم بما يلي:",
    "- حافظ حرفياً على صيغة العناوين المطلوبة أعلاه (المقدمة، المبحث، المطلب، الخاتمة، قائمة المصادر والمراجع، الهوامش).",
    "- اكتب فقرات قصيرة ومركزة (جملتان إلى ثلاث جمل في الفقرة الواحدة) بلغة أكاديمية واضحة.",
    "- قدّم أغلب الأفكار في قوائم نقطية كل نقطة في سطر مستقل يبدأ بشرطة (-) بصيغة: «فكرة رئيسية: شرح موجز في جملة واحدة».",
    "- اجعل كل قائمة بين 3 و5 نقاط، ومهّد لكل قائمة بجملة قصيرة تنتهي بنقطتين (:).",
    "- في الخاتمة استعمل عنوانين فرعيين مستقلين: «أبرز النتائج:» ثم «التوصيات:» وتحت كل منهما نقاط موجزة.",
    "- تجنب الحشو والتكرار والجمل الطويلة جداً، ولا تحذف المعلومات الجوهرية أو الهوامش التوثيقية.",
  ].join("\n"),
  fr: [
    "Remarque importante de rédaction : Ce texte sera automatiquement transformé en diapositives PowerPoint professionnelles :",
    "- Conservez rigoureusement les intitulés standards : Introduction, Chapitre I, Section 1, Conclusion, Bibliographie.",
    "- Rédigez des paragraphes courts et percutants (2 à 3 phrases maximum par paragraphe).",
    "- Présentez la majorité des idées sous forme de puces (-), format : « Idée clé : explication concise en une phrase ».",
    "- 3 à 5 puces par liste, précédées d'une brève phrase d'amorce se terminant par deux-points (:).",
    "- Dans la conclusion, séparez clairement : « Principaux résultats : » et « Recommandations : ».",
    "- Évitez le remplissage inutile et les phrases trop denses.",
  ].join("\n"),
  en: [
    "Important formatting notice: This text will be automatically converted into professional PowerPoint slides:",
    "- Strictly maintain standard academic headers: Introduction, Chapter 1, Section 1, Conclusion, References.",
    "- Write concise, impactful paragraphs (2 to 3 sentences per paragraph maximum).",
    "- Present key ideas as bullet points (-), formatted as: 'Key concept: brief single-sentence explanation'.",
    "- 3 to 5 bullets per list, preceded by a brief lead-in sentence ending with a colon (:).",
    "- In the conclusion, clearly separate: 'Key Findings:' and 'Recommendations:'.",
    "- Avoid filler words, redundancy, and overly long sentences.",
  ].join("\n"),
};

export const SLIDE_PROMPT_ADDENDUM = SLIDE_PROMPT_ADDENDUM_BY_LANG.ar;

export type SlideAiOptions = Omit<
  GenerateOptions,
  "length" | "mabhathCount" | "matlabCount" | "promptAddendum" | "normalizePlan"
> & { size: SlideAiSize; language?: ResearchLanguage };

export function generatePresentationDraft({ size, language = "ar", ...rest }: SlideAiOptions): Promise<string> {
  const analysis = analyzeStudentTopic(rest.topic, rest.caseStudyCompany);
  const hasCustomPlan = analysis.hasCustomPlan && analysis.customMabahith.length > 0;
  const fallbackCandidate =
    analysis.caseStudy.coreTopic ||
    analysis.caseStudy.coverTitle ||
    analysis.cleanedTopic ||
    sanitizeCoverTitleFromPlanLeak(rest.topic).cleaned;
  const cleanFallbackTopic =
    fallbackCandidate &&
    !looksLikePlanLeak(fallbackCandidate) &&
    !isStructuralTitleOnly(fallbackCandidate)
      ? fallbackCandidate
      : language === "fr"
        ? "Sujet de l'exposé"
        : language === "en"
          ? "Presentation Topic"
          : "موضوع العرض";

  return generateResearch({
    ...rest,
    language,
    length: SLIDE_AI_SIZES[size].length,
    mabhathCount: hasCustomPlan
      ? String(analysis.customMabahith.length)
      : String(SLIDE_MABHATH_COUNT),
    matlabCount: String(SLIDE_MATLAB_COUNT),
    promptAddendum: SLIDE_PROMPT_ADDENDUM_BY_LANG[language] || SLIDE_PROMPT_ADDENDUM_BY_LANG.ar,
    normalizePlan: hasCustomPlan ? undefined : (plan) => enforceSlidePlan(plan, cleanFallbackTopic, language),
  });
}
