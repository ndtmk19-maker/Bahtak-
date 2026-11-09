// تكييف محرك التوليد الأكاديمي الموجود (generateResearch) لإنتاج محتوى مناسب للشرائح.
// نفس المراحل: خطة JSON ← مقدمة ومباحث وخاتمة بالتوازي ← نص بنفس الصيغة الأكاديمية يقرؤه المحلل المشترك.
import { generateResearch, type AiLength, type AiPlan, type GenerateOptions } from "../aiGenerate";
import { buildFallbackPlan } from "../aiEngine";

export type SlideAiSize = "brief" | "standard" | "extended";

/** هيكل العرض ثابت دائماً: 3 مباحث، في كل مبحث 3 مطالب. الحجم يتحكم في عمق الصياغة فقط. */
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

const ORD = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"];
const stripPrefix = (t: string, word: string) =>
  (t || "")
    .replace(new RegExp(`^\\s*(?:ال)?${word}\\s+[^:：\\-–—]{1,20}?\\s*[:：\\-–—]\\s*`), "")
    .trim();

/** فرض هيكل 3 × 3 على الخطة المولدة: يُكمَّل الناقص من الخطة المنهجية البديلة ويُحذف الزائد، مع إعادة الترقيم */
export function enforceSlidePlan(plan: AiPlan, topic: string): AiPlan {
  const fb = buildFallbackPlan(topic, SLIDE_MABHATH_COUNT, SLIDE_MATLAB_COUNT, "short") as AiPlan;
  const mabahith = Array.from({ length: SLIDE_MABHATH_COUNT }, (_, i) => {
    const src = plan.mabahith?.[i] || fb.mabahith[i];
    const title = stripPrefix(src.title, "مبحث") || stripPrefix(fb.mabahith[i].title, "مبحث");
    const matalib = Array.from({ length: SLIDE_MATLAB_COUNT }, (_, j) => {
      const m = src.matalib?.[j] || fb.mabahith[i].matalib?.[j] || { title: "" };
      const mt =
        stripPrefix(m.title, "مطلب") ||
        stripPrefix(fb.mabahith[i].matalib?.[j]?.title || "", "مطلب");
      return { title: `المطلب ${ORD[j]}: ${mt}` };
    });
    return { title: `المبحث ${ORD[i]}: ${title}`, matalib };
  });
  return { ...plan, mabahith };
}

export const SLIDE_PROMPT_ADDENDUM = [
  "تنبيه مهم بخصوص الصياغة: سيُحوَّل هذا النص آلياً إلى شرائح عرض تقديمي (PowerPoint)، لذلك التزم بما يلي:",
  "- حافظ حرفياً على صيغة العناوين المطلوبة أعلاه (المقدمة، المبحث، المطلب، الخاتمة، قائمة المصادر والمراجع، الهوامش).",
  "- اكتب فقرات قصيرة ومركزة (جملتان إلى ثلاث جمل في الفقرة الواحدة) بلغة أكاديمية واضحة.",
  "- قدّم أغلب الأفكار في قوائم نقطية كل نقطة في سطر مستقل يبدأ بشرطة (-) بصيغة: «فكرة رئيسية: شرح موجز في جملة واحدة».",
  "- اجعل كل قائمة بين 3 و5 نقاط، ومهّد لكل قائمة بجملة قصيرة تنتهي بنقطتين (:).",
  "- في الخاتمة استعمل عنوانين فرعيين مستقلين: «أبرز النتائج:» ثم «التوصيات:» وتحت كل منهما نقاط موجزة.",
  "- تجنب الحشو والتكرار والجمل الطويلة جداً، ولا تحذف المعلومات الجوهرية أو الهوامش التوثيقية.",
].join("\n");

export type SlideAiOptions = Omit<
  GenerateOptions,
  "length" | "mabhathCount" | "matlabCount" | "promptAddendum" | "normalizePlan"
> & { size: SlideAiSize };

export function generatePresentationDraft({ size, ...rest }: SlideAiOptions): Promise<string> {
  return generateResearch({
    ...rest,
    length: SLIDE_AI_SIZES[size].length,
    mabhathCount: String(SLIDE_MABHATH_COUNT),
    matlabCount: String(SLIDE_MATLAB_COUNT),
    promptAddendum: SLIDE_PROMPT_ADDENDUM,
    normalizePlan: (plan) => enforceSlidePlan(plan, rest.topic),
  });
}
