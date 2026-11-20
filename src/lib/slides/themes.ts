// سجل قوالب العروض التقديمية. لإضافة قالب جديد يكفي إضافة كائن إلى المصفوفة SLIDE_THEMES.
// أسلوب التصميم الجديد (تحريري/تنفيذي): خلفيات هادئة، لون داكن عميق لشرائح الواجهة، لون إبراز واحد
// يتكرر كخيط بصري (شريط قصير، أرقام كبيرة، خطوط رفيعة)، وصور فوتوغرافية كاملة النزف عند توفرها.
import type { SlideIconName } from "./icons";

export type ThemeMotif =
  | "bars"
  | "grid"
  | "pulse"
  | "ledger"
  | "diagonal"
  | "blocks"
  | "columns"
  | "arcs"
  | "rule";
export type CoverStyle = "split" | "band" | "full";

export interface SlideTheme {
  id: string;
  name: string;
  field: string;
  description: string;
  /** كلمات مفتاحية لاقتراح القالب آلياً حسب موضوع العرض */
  keywords: string[];
  colors: {
    bg: string;
    surface: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    muted: string;
    onPrimary: string;
    line: string;
  };
  /** خطوط العروض العربية (يجب أن تدعم الحروف العربية) */
  fonts: { head: string; body: string };
  /** خطوط العروض الفرنسية والإنجليزية (اختيارية؛ الافتراضي fonts) */
  latinFonts?: { head: string; body: string };
  /** ألوان شرائح الواجهة (الغلاف، فواصل المباحث، الإشكالية، الختام). الافتراضي: اللون الأساسي */
  hero?: { bg: string; text: string; accent: string };
  motif: ThemeMotif;
  /** يُستعمل فقط حين لا تتوفر صورة للغلاف */
  cover: CoverStyle;
  icons: [SlideIconName, SlideIconName, SlideIconName, SlideIconName];
  /** كلمات بحث إنجليزية احتياطية لمكتبات الصور حين لا يُستخرج من الشريحة موضوع واضح */
  photo?: { queries: string[] };
}

const SERIF_LATIN = { head: "Georgia", body: "Calibri" };

export const SLIDE_THEMES: SlideTheme[] = [
  {
    id: "academic",
    name: "أكاديمي كلاسيكي",
    field: "عام",
    description: "كحلي جامعي عميق مع ذهبي هادئ وعناوين بخط مرجعي، مناسب لكل التخصصات والمذكرات.",
    keywords: [],
    colors: {
      bg: "F8F7F3",
      surface: "FFFFFF",
      primary: "1B2F4B",
      secondary: "3E6A9A",
      accent: "B8893B",
      text: "1A2433",
      muted: "5E6B7D",
      onPrimary: "FFFFFF",
      line: "DDD8CC",
    },
    fonts: { head: "Times New Roman", body: "Arial" },
    latinFonts: SERIF_LATIN,
    hero: { bg: "0F1E33", text: "FFFFFF", accent: "C9A227" },
    motif: "rule",
    cover: "split",
    icons: ["GraduationCap", "BookOpen", "Lightbulb", "Target"],
    photo: { queries: ["university library", "academic research books", "students lecture hall", "modern campus architecture"] },
  },
  {
    id: "executive",
    name: "تنفيذي للأعمال",
    field: "المشاريع والاستثمار",
    description: "كحلي ليلي وذهبي على خلفية عاجية بأسلوب عروض المستثمرين ومجالس الإدارة.",
    keywords: [
      "مشروع",
      "مشاريع",
      "استثمار",
      "مستثمر",
      "عقار",
      "عقارات",
      "سكن",
      "سكنات",
      "بناء",
      "دراسة جدوى",
      "جدوى",
      "ريادة",
      "تمويل المشاريع",
      "projet",
      "investissement",
      "immobilier",
      "investment",
      "real estate",
    ],
    colors: {
      bg: "F6F4EF",
      surface: "FFFFFF",
      primary: "0B1F33",
      secondary: "13304D",
      accent: "C9A227",
      text: "1D2733",
      muted: "5B6B7A",
      onPrimary: "FFFFFF",
      line: "D9D4C7",
    },
    fonts: { head: "Times New Roman", body: "Arial" },
    latinFonts: SERIF_LATIN,
    hero: { bg: "0B1F33", text: "FFFFFF", accent: "C9A227" },
    motif: "rule",
    cover: "full",
    icons: ["Building2", "TrendingUp", "Handshake", "Target"],
    photo: { queries: ["modern architecture skyline", "business meeting boardroom", "construction site cranes", "city aerial view"] },
  },
  {
    id: "economy",
    name: "اقتصاد",
    field: "العلوم الاقتصادية",
    description: "بترولي عميق وذهبي على خلفية عاجية مع أعمدة بيانية متصاعدة.",
    keywords: [
      "اقتصاد",
      "اقتصادي",
      "نقد",
      "نقدية",
      "تضخم",
      "نمو",
      "بطالة",
      "استثمار",
      "تجارة",
      "صادرات",
      "بنك",
      "بنوك",
      "أسعار",
      "سوق",
      "ناتج",
      "تنمية",
      "محروقات",
      "économie",
      "economy",
    ],
    colors: {
      bg: "F7F3EA",
      surface: "FFFFFF",
      primary: "0F3D3E",
      secondary: "2E6B5E",
      accent: "B8902A",
      text: "1B2A2A",
      muted: "5B6B68",
      onPrimary: "FFFFFF",
      line: "E3DBC8",
    },
    fonts: { head: "Times New Roman", body: "Tahoma" },
    latinFonts: SERIF_LATIN,
    hero: { bg: "0A2C2D", text: "FFFFFF", accent: "D4AF37" },
    motif: "bars",
    cover: "split",
    icons: ["TrendingUp", "Coins", "ChartColumn", "Landmark"],
    photo: { queries: ["financial district skyline", "global economy trade port", "stock market charts", "currency coins finance"] },
  },
  {
    id: "management",
    name: "تسيير وإدارة",
    field: "علوم التسيير",
    description: "فحمي كحلي مع لمسة مرجانية دافئة، بأسلوب تقارير الاستشارات الإدارية.",
    keywords: [
      "تسيير",
      "إدارة",
      "ادارة",
      "موارد بشرية",
      "تسويق",
      "قيادة",
      "استراتيجية",
      "استراتيجي",
      "تنظيم",
      "أداء",
      "جودة",
      "تخطيط",
      "حوكمة",
      "مقاولاتية",
      "management",
      "gestion",
      "marketing",
    ],
    colors: {
      bg: "F5F6F6",
      surface: "FFFFFF",
      primary: "1C2833",
      secondary: "2E4053",
      accent: "D9694C",
      text: "1C2833",
      muted: "5D6D7E",
      onPrimary: "FFFFFF",
      line: "D6DCE0",
    },
    fonts: { head: "Arial", body: "Arial" },
    latinFonts: SERIF_LATIN,
    hero: { bg: "17212B", text: "FFFFFF", accent: "E07A5F" },
    motif: "diagonal",
    cover: "band",
    icons: ["Briefcase", "Target", "Users", "Workflow"],
    photo: { queries: ["team strategy meeting", "modern office workspace", "business leadership", "teamwork collaboration"] },
  },
  {
    id: "informatics",
    name: "إعلام آلي",
    field: "الإعلام الآلي والتقنية",
    description: "واجهة ليلية داكنة بلون سماوي ولمسة ليمونية، مع صور تقنية كاملة النزف.",
    keywords: [
      "إعلام آلي",
      "اعلام آلي",
      "برمجة",
      "شبكات",
      "شبكة",
      "ذكاء اصطناعي",
      "خوارزمية",
      "خوارزميات",
      "بيانات",
      "قواعد البيانات",
      "حاسوب",
      "رقمي",
      "رقمنة",
      "سيبراني",
      "معلوماتية",
      "تطبيقات",
      "برمجيات",
      "تعلم آلي",
      "أمن المعلومات",
      "التحول الرقمي",
      "informatique",
      "numérique",
      "software",
      "digital",
    ],
    colors: {
      bg: "0B1221",
      surface: "131D33",
      primary: "22D3EE",
      secondary: "8B5CF6",
      accent: "A3E635",
      text: "E6EDF7",
      muted: "94A3B8",
      onPrimary: "0B1221",
      line: "24324F",
    },
    fonts: { head: "Tahoma", body: "Tahoma" },
    latinFonts: { head: "Segoe UI Semibold", body: "Segoe UI" },
    hero: { bg: "070D19", text: "E6EDF7", accent: "22D3EE" },
    motif: "grid",
    cover: "full",
    icons: ["Cpu", "Network", "Code", "ShieldCheck"],
    photo: { queries: ["data center servers", "circuit board technology", "programming code screen", "network technology abstract"] },
  },
  {
    id: "medicine",
    name: "طب وعلوم صحية",
    field: "الطب والصيدلة",
    description: "أبيض سريري مع أزرق مخضر عميق ولمسة حمراء، وصور طبية هادئة.",
    keywords: [
      "طب",
      "طبي",
      "صحة",
      "صحية",
      "مرض",
      "أمراض",
      "داء",
      "علاج",
      "دواء",
      "أدوية",
      "صيدلة",
      "مستشفى",
      "تمريض",
      "سكري",
      "سرطان",
      "وباء",
      "جراحة",
      "فيروس",
      "تغذية",
      "santé",
      "médecine",
      "health",
    ],
    colors: {
      bg: "FFFFFF",
      surface: "EEF6F6",
      primary: "0B5F68",
      secondary: "0B4F6C",
      accent: "D9434A",
      text: "102A33",
      muted: "557079",
      onPrimary: "FFFFFF",
      line: "CFE3E5",
    },
    fonts: { head: "Arial", body: "Arial" },
    latinFonts: { head: "Georgia", body: "Calibri" },
    hero: { bg: "083F46", text: "FFFFFF", accent: "5ED3C9" },
    motif: "pulse",
    cover: "split",
    icons: ["HeartPulse", "Stethoscope", "Pill", "Microscope"],
    photo: { queries: ["medical laboratory research", "hospital doctor", "healthcare technology", "microscope science"] },
  },
  {
    id: "accounting",
    name: "محاسبة ومالية",
    field: "المحاسبة والمالية",
    description: "أخضر دفاتر عميق مع خطوط السجل ولمسة عنابية، بأسلوب التقارير المالية السنوية.",
    keywords: [
      "محاسبة",
      "محاسبي",
      "تدقيق",
      "مراجعة",
      "مالية",
      "مالي",
      "ميزانية",
      "جباية",
      "ضرائب",
      "ضريبة",
      "قوائم مالية",
      "تكاليف",
      "خزينة",
      "تمويل",
      "بورصة",
      "إفصاح",
      "comptabilité",
      "finance",
      "audit",
    ],
    colors: {
      bg: "FBFAF6",
      surface: "FFFFFF",
      primary: "1E4D2B",
      secondary: "3D7A4A",
      accent: "A8323E",
      text: "1F2A22",
      muted: "5F6B61",
      onPrimary: "FFFFFF",
      line: "DCE3D6",
    },
    fonts: { head: "Times New Roman", body: "Arial" },
    latinFonts: SERIF_LATIN,
    hero: { bg: "16351F", text: "FFFFFF", accent: "C9A227" },
    motif: "ledger",
    cover: "band",
    icons: ["Calculator", "Receipt", "Wallet", "ChartPie"],
    photo: { queries: ["financial report calculator", "accounting documents desk", "audit finance office", "bank finance analysis"] },
  },
  {
    id: "institutions",
    name: "مؤسسات وأعمال",
    field: "المؤسسات والشركات",
    description: "فحمي احترافي مع برتقالي نابض وصور صناعية ومؤسساتية.",
    keywords: [
      "مؤسسة",
      "مؤسسات",
      "شركة",
      "شركات",
      "مقاولة",
      "أعمال",
      "صناعة",
      "صناعية",
      "إنتاج",
      "تنافسية",
      "مسؤولية اجتماعية",
      "اتصال مؤسساتي",
      "منظمة",
      "entreprise",
      "company",
    ],
    colors: {
      bg: "F3F3F2",
      surface: "FFFFFF",
      primary: "222831",
      secondary: "393E46",
      accent: "E8650A",
      text: "222831",
      muted: "5F6670",
      onPrimary: "FFFFFF",
      line: "DADADA",
    },
    fonts: { head: "Tahoma", body: "Tahoma" },
    latinFonts: { head: "Georgia", body: "Calibri" },
    hero: { bg: "1A1F26", text: "FFFFFF", accent: "F97316" },
    motif: "blocks",
    cover: "full",
    icons: ["Building2", "Handshake", "ClipboardCheck", "Factory"],
    photo: { queries: ["corporate office building", "industrial factory production", "business handshake", "logistics warehouse"] },
  },
  {
    id: "law",
    name: "حقوق وعلوم سياسية",
    field: "الحقوق والعلوم السياسية",
    description: "عنابي رصين وذهبي عتيق مع عناوين بخط مرجعي وصور مؤسسات العدالة.",
    keywords: [
      "قانون",
      "قانوني",
      "حقوق",
      "تشريع",
      "دستور",
      "دستوري",
      "قضاء",
      "جريمة",
      "جنائي",
      "عقد",
      "عقود",
      "سياسة",
      "سياسية",
      "دولة",
      "دولي",
      "إداري",
      "مدني",
      "أحوال شخصية",
      "droit",
      "juridique",
      "law",
    ],
    colors: {
      bg: "FAF7F2",
      surface: "FFFFFF",
      primary: "5D1D2E",
      secondary: "8A1E37",
      accent: "997929",
      text: "2A1A1F",
      muted: "6B5A5E",
      onPrimary: "FFFFFF",
      line: "E6DCD2",
    },
    fonts: { head: "Times New Roman", body: "Times New Roman" },
    latinFonts: { head: "Georgia", body: "Georgia" },
    hero: { bg: "3E1220", text: "FFFFFF", accent: "C9A45C" },
    motif: "columns",
    cover: "full",
    icons: ["Scale", "Gavel", "BookMarked", "Landmark"],
    photo: { queries: ["courthouse columns", "justice scales law", "parliament building", "law books library"] },
  },
  {
    id: "humanities",
    name: "علوم إنسانية واجتماعية",
    field: "العلوم الإنسانية والاجتماعية",
    description: "تراكوتا دافئ وأخضر مريمي على خلفية كريمية مع صور إنسانية.",
    keywords: [
      "اجتماع",
      "اجتماعي",
      "نفس",
      "نفسي",
      "تربية",
      "تربوي",
      "تعليم",
      "إعلام",
      "اتصال",
      "تاريخ",
      "فلسفة",
      "أدب",
      "لغة",
      "ثقافة",
      "أسرة",
      "شباب",
      "مجتمع",
      "sociologie",
      "psychologie",
      "society",
    ],
    colors: {
      bg: "F5F1E4",
      surface: "FFFDF5",
      primary: "8E3E28",
      secondary: "5E7F4A",
      accent: "C8694F",
      text: "2C2C2C",
      muted: "67625A",
      onPrimary: "FFFFFF",
      line: "E2DCC2",
    },
    fonts: { head: "Tahoma", body: "Arial" },
    latinFonts: SERIF_LATIN,
    hero: { bg: "3B2A22", text: "FFFFFF", accent: "E4A47C" },
    motif: "arcs",
    cover: "band",
    icons: ["Users", "BookOpen", "Globe", "Lightbulb"],
    photo: { queries: ["people community city", "family together", "classroom education", "culture heritage"] },
  },
];

export const DEFAULT_THEME_ID = "academic";

export function heroColors(th: SlideTheme) {
  return th.hero || { bg: th.colors.primary, text: th.colors.onPrimary, accent: th.colors.accent };
}

export function getTheme(id: string): SlideTheme {
  return SLIDE_THEMES.find((t) => t.id === id) || SLIDE_THEMES[0];
}

/** الخطوط الفعلية حسب لغة العرض (اللاتينية تستعمل latinFonts إن وُجدت) */
export function themeFonts(th: SlideTheme, lang?: string): { head: string; body: string } {
  return lang && lang !== "ar" && th.latinFonts ? th.latinFonts : th.fonts;
}

/** اقتراح القالب الأنسب: العنوان يُحسب بوزن مضاعف، ثم بقية النص */
export function suggestTheme(title: string, body = ""): SlideTheme {
  const t = title.toLowerCase();
  const b = body.slice(0, 6000).toLowerCase();
  let best = SLIDE_THEMES[0];
  let bestScore = 0;
  SLIDE_THEMES.forEach((th) => {
    const score = th.keywords.reduce(
      (s, k) =>
        s +
        (t.includes(k) ? 3 : 0) +
        (b.split(k).length - 1 > 0 ? Math.min(3, b.split(k).length - 1) * 0.5 : 0),
      0,
    );
    if (score > bestScore) {
      best = th;
      bestScore = score;
    }
  });
  return best;
}
