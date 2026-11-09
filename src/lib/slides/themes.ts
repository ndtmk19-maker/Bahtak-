// سجل قوالب العروض التقديمية. لإضافة قالب جديد يكفي إضافة كائن إلى المصفوفة SLIDE_THEMES.
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
  fonts: { head: string; body: string };
  /** ألوان شرائح الواجهة (الغلاف، فواصل المحاور، الختام). الافتراضي: اللون الأساسي */
  hero?: { bg: string; text: string; accent: string };
  motif: ThemeMotif;
  cover: CoverStyle;
  icons: [SlideIconName, SlideIconName, SlideIconName, SlideIconName];
}

export const SLIDE_THEMES: SlideTheme[] = [
  {
    id: "academic",
    name: "أكاديمي كلاسيكي",
    field: "عام",
    description: "أزرق جامعي هادئ مع خط Times، مناسب لكل التخصصات والمذكرات.",
    keywords: [],
    colors: {
      bg: "FFFFFF",
      surface: "F2F5F9",
      primary: "1F3A5F",
      secondary: "3E7CB1",
      accent: "B8893B",
      text: "1A2433",
      muted: "5E6B7D",
      onPrimary: "FFFFFF",
      line: "D5DDE8",
    },
    fonts: { head: "Times New Roman", body: "Arial" },
    motif: "rule",
    cover: "split",
    icons: ["GraduationCap", "BookOpen", "Lightbulb", "Target"],
  },
  {
    id: "economy",
    name: "اقتصاد",
    field: "العلوم الاقتصادية",
    description: "بترولي داكن وذهبي على خلفية عاجية مع أعمدة بيانية متصاعدة.",
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
    ],
    colors: {
      bg: "F7F3EA",
      surface: "FFFFFF",
      primary: "0F3D3E",
      secondary: "2E6B5E",
      accent: "C9A227",
      text: "1B2A2A",
      muted: "5B6B68",
      onPrimary: "FFFFFF",
      line: "E3DBC8",
    },
    fonts: { head: "Tahoma", body: "Tahoma" },
    motif: "bars",
    cover: "split",
    icons: ["TrendingUp", "Coins", "ChartColumn", "Landmark"],
  },
  {
    id: "management",
    name: "تسيير وإدارة",
    field: "علوم التسيير",
    description: "كحلي عميق مع لمسة مرجانية وزوايا قطرية ديناميكية.",
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
    ],
    colors: {
      bg: "F4F6F6",
      surface: "FFFFFF",
      primary: "1C2833",
      secondary: "2E4053",
      accent: "E07A5F",
      text: "1C2833",
      muted: "5D6D7E",
      onPrimary: "FFFFFF",
      line: "D6DCE0",
    },
    fonts: { head: "Arial", body: "Arial" },
    motif: "diagonal",
    cover: "band",
    icons: ["Briefcase", "Target", "Users", "Workflow"],
  },
  {
    id: "informatics",
    name: "إعلام آلي",
    field: "الإعلام الآلي والتقنية",
    description: "واجهة داكنة بلون سماوي وبنفسجي مع شبكة نقاط تقنية.",
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
    hero: { bg: "111A2E", text: "E6EDF7", accent: "22D3EE" },
    motif: "grid",
    cover: "full",
    icons: ["Cpu", "Network", "Code", "ShieldCheck"],
  },
  {
    id: "medicine",
    name: "طب وعلوم صحية",
    field: "الطب والصيدلة",
    description: "أبيض سريري مع أزرق مخضر وخط نبض أحمر.",
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
    ],
    colors: {
      bg: "FFFFFF",
      surface: "EEF7F7",
      primary: "0E7C86",
      secondary: "0B4F6C",
      accent: "E5484D",
      text: "102A33",
      muted: "557079",
      onPrimary: "FFFFFF",
      line: "CFE5E7",
    },
    fonts: { head: "Arial", body: "Arial" },
    motif: "pulse",
    cover: "split",
    icons: ["HeartPulse", "Stethoscope", "Pill", "Microscope"],
  },
  {
    id: "accounting",
    name: "محاسبة ومالية",
    field: "المحاسبة والمالية",
    description: "أخضر دفاتر المحاسبة مع خطوط السجل وهامش مزدوج.",
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
    ],
    colors: {
      bg: "FBFAF6",
      surface: "FFFFFF",
      primary: "1E5128",
      secondary: "4E9F3D",
      accent: "B23A48",
      text: "1F2A22",
      muted: "5F6B61",
      onPrimary: "FFFFFF",
      line: "DCE3D6",
    },
    fonts: { head: "Arial", body: "Arial" },
    motif: "ledger",
    cover: "band",
    icons: ["Calculator", "Receipt", "Wallet", "ChartPie"],
  },
  {
    id: "institutions",
    name: "مؤسسات وأعمال",
    field: "المؤسسات والشركات",
    description: "فحمي احترافي مع برتقالي نابض وكتل هندسية.",
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
    ],
    colors: {
      bg: "F2F2F2",
      surface: "FFFFFF",
      primary: "222831",
      secondary: "393E46",
      accent: "F96D00",
      text: "222831",
      muted: "5F6670",
      onPrimary: "FFFFFF",
      line: "DADADA",
    },
    fonts: { head: "Tahoma", body: "Tahoma" },
    motif: "blocks",
    cover: "full",
    icons: ["Building2", "Handshake", "ClipboardCheck", "Factory"],
  },
  {
    id: "law",
    name: "حقوق وعلوم سياسية",
    field: "الحقوق والعلوم السياسية",
    description: "عنابي رصين وذهبي عتيق مع أعمدة كلاسيكية.",
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
    ],
    colors: {
      bg: "FAF7F2",
      surface: "FFFFFF",
      primary: "5D1D2E",
      secondary: "951233",
      accent: "997929",
      text: "2A1A1F",
      muted: "6B5A5E",
      onPrimary: "FFFFFF",
      line: "E6DCD2",
    },
    fonts: { head: "Times New Roman", body: "Times New Roman" },
    motif: "columns",
    cover: "full",
    icons: ["Scale", "Gavel", "BookMarked", "Landmark"],
  },
  {
    id: "humanities",
    name: "علوم إنسانية واجتماعية",
    field: "العلوم الإنسانية والاجتماعية",
    description: "تراكوتا دافئ وأخضر مريمي على خلفية كريمية مع أقواس ناعمة.",
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
    ],
    colors: {
      bg: "F4F1DE",
      surface: "FFFDF5",
      primary: "A4492F",
      secondary: "5E7F4A",
      accent: "E07A5F",
      text: "2C2C2C",
      muted: "67625A",
      onPrimary: "FFFFFF",
      line: "E2DCC2",
    },
    fonts: { head: "Tahoma", body: "Arial" },
    motif: "arcs",
    cover: "band",
    icons: ["Users", "BookOpen", "Globe", "Lightbulb"],
  },
];

export const DEFAULT_THEME_ID = "academic";

export function heroColors(th: SlideTheme) {
  return th.hero || { bg: th.colors.primary, text: th.colors.onPrimary, accent: th.colors.accent };
}

export function getTheme(id: string): SlideTheme {
  return SLIDE_THEMES.find((t) => t.id === id) || SLIDE_THEMES[0];
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
