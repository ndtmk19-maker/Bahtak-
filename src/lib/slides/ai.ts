// تكييف محرك التوليد الأكاديمي الموجود (generateResearch) لإنتاج محتوى مناسب للشرائح.
// نفس المراحل: خطة JSON ← مقدمة ومباحث وخاتمة بالتوازي ← نص بنفس الصيغة الأكاديمية يقرؤه المحلل المشترك.
import {
  analyzeStudentTopic,
  generateResearch,
  isStructuralTitleOnly,
  looksLikePlanLeak,
  sanitizeCoverTitleFromPlanLeak,
  stripStructuralPrefix,
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
    hint: "3 مباحث × 3 مطالب بصياغة مركزة — نحو 20 إلى 24 شريحة",
    length: "short",
  },
  standard: {
    label: "عرض قياسي",
    hint: "3 مباحث × 3 مطالب بتفصيل متوازن — نحو 26 إلى 30 شريحة",
    length: "medium",
  },
  extended: {
    label: "عرض موسع",
    hint: "3 مباحث × 3 مطالب بتفصيل معمق — نحو 32 إلى 36 شريحة",
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
    const rawMbTitle = src?.title || fb.mabahith[i]?.title || "";
    const title = stripStructuralPrefix(rawMbTitle);

    const matalib = Array.from({ length: SLIDE_MATLAB_COUNT }, (_, j) => {
      const m = src.matalib?.[j] || fb.mabahith[i].matalib?.[j] || { title: "" };
      const rawMtTitle = m.title || fb.mabahith[i].matalib?.[j]?.title || "";
      const mt = stripStructuralPrefix(rawMtTitle);
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
    "تنبيه حاسم لضبط عدد شرائح العرض التقديمي (العرض القياسي المستهدف حوالي 28 إلى 30 شريحة كحد أقصى):",
    "- التزم تماماً بالإيجاز الشديد: هذا نص لشرائح PowerPoint وليس بحثاً مقالياً مطولاً.",
    "- لكل مطلب اكتب جملة تمهيدية واحدة قصيرة (تنتهي بنقطتين :)، متبوعة بـ 3 إلى 4 نقاط مركزة فقط كل نقطة تبدأ بشرطة (-) بصيغة: «فكرة رئيسية: شرح موجز في جملة واحدة».",
    "- الحد الأقصى للنص في المطلب الواحد هو 90 إلى 120 كلمة فقط (لتجنب تشتت الشريحة إلى عدة شرائح).",
    "- حافظ حرفياً على صيغة العناوين: المقدمة، المبحث، المطلب، الخاتمة، قائمة المصادر والمراجع.",
    "- في الخاتمة استعمل عنوانين فرعيين مستقلين: «أبرز النتائج:» (3 نقاط) ثم «التوصيات:» (3 نقاط).",
    "- تجنب الحشو وتكرار المعاني أو الجمل المعقدة الطويلة نهائياً.",
  ].join("\n"),
  fr: [
    "Consigne stricte pour respecter le format PowerPoint (cible : environ 28 à 30 diapositives au total) :",
    "- Soyez très concis : ce texte est destiné à des diapositives PowerPoint professionnelles et synthétiques (ce n'est pas un mémoire écrit).",
    "- Pour chaque section : une seule phrase courte d'amorce se terminant par (:), suivie de 3 à 4 puces clés (-) au format : « Idée clé : explication concise en une seule phrase ».",
    "- Limite stricte : environ 90 à 120 mots maximum par section (pour éviter que la section ne s'étale sur plusieurs diapositives).",
    "- Conservez rigoureusement les intitulés : Introduction, Chapitre I, Section 1, Conclusion, Bibliographie.",
    "- Dans la conclusion, séparez clairement : « Principaux résultats : » (3 puces) et « Recommandations : » (3 puces).",
    "- Évitez le remplissage inutile, les digressions et les phrases trop denses.",
  ].join("\n"),
  en: [
    "Strict presentation length requirement (Target: ~28 to 30 slides total):",
    "- Be extremely concise: this text is for PowerPoint presentation slides (not an essay).",
    "- For each section: exactly one brief introductory lead-in sentence ending with (:), followed by 3 to 4 key bullet points (-) formatted as: 'Key concept: brief single-sentence explanation'.",
    "- Strict limit: approximately 90 to 120 words maximum per section (preventing sections from expanding into multiple slides).",
    "- Strictly maintain headers: Introduction, Chapter 1, Section 1, Conclusion, References.",
    "- In conclusion: clearly separate 'Key Findings:' (3 bullets) and 'Recommendations:' (3 bullets).",
    "- Strictly avoid filler words, redundancy, and complex long paragraphs.",
  ].join("\n"),
};

const SLIDE_CONFIG_OVERRIDES: Record<
  SlideAiSize,
  NonNullable<GenerateOptions["configOverrides"]>
> = {
  brief: {
    introWords: 130,
    mabahithWords: 720,
    minMatlabWords: 75,
    matlabParagraphs: "فقرة تمهيدية موجزة جداً تليها 3 إلى 4 نقاط مركزة بصيغة رؤوس أقلام للشرائح",
    conclusionWords: 120,
    introMaxTokens: 750,
    mabhathMaxTokens: 1600,
    conclusionMaxTokens: 750,
  },
  standard: {
    introWords: 160,
    mabahithWords: 1050,
    minMatlabWords: 95,
    matlabParagraphs: "فقرة تمهيدية من سطرين تليها 3 إلى 4 نقاط أساسية واضحة بصيغة رؤوس أقلام للشرائح",
    conclusionWords: 150,
    introMaxTokens: 950,
    mabhathMaxTokens: 2000,
    conclusionMaxTokens: 950,
  },
  extended: {
    introWords: 200,
    mabahithWords: 1400,
    minMatlabWords: 125,
    matlabParagraphs: "فقرة تمهيدية تليها 4 إلى 5 نقاط تفصيلية للشرائح",
    conclusionWords: 180,
    introMaxTokens: 1100,
    mabhathMaxTokens: 2500,
    conclusionMaxTokens: 1100,
  },
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
    configOverrides: SLIDE_CONFIG_OVERRIDES[size],
    promptAddendum: SLIDE_PROMPT_ADDENDUM_BY_LANG[language] || SLIDE_PROMPT_ADDENDUM_BY_LANG.ar,
    normalizePlan: hasCustomPlan ? undefined : (plan) => enforceSlidePlan(plan, cleanFallbackTopic, language),
  });
}
