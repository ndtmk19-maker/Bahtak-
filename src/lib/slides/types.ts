// نموذج العرض التقديمي الدلالي (مستقل عن صيغة الإخراج وعن التصميم)

export interface Run {
  text: string;
  bold?: boolean;
}

/** سطر داخل الشريحة: نقطة قائمة، أو جملة تمهيدية، أو عنوان فرعي */
export interface Point {
  kind: "bullet" | "lead" | "sub";
  /** عنوان قصير بخط عريض يسبق الشرح (مثل: «البنية التحتية: ...») */
  label?: string;
  text: string;
  /** النص لغته لاتينية في الغالب (مراجع أجنبية) */
  ltr?: boolean;
  /** جملة مقتطعة من فقرة نثرية (وليست عنصر قائمة في الأصل) */
  prose?: boolean;
}

export interface CoverMeta {
  title: string;
  subtitle: string;
  institution: string;
  faculty: string;
  presenters: string[];
  supervisor: string;
  year: string;
  /** شعار الجامعة (رابط أو data URL)، فارغ إن لم يُحدد */
  logo: string;
}

export interface AgendaEntry {
  title: string;
  children: string[];
}

export type ContentLayout = "list" | "cards" | "statement";

export type Slide =
  | { kind: "cover"; meta: CoverMeta; notes?: string }
  | {
      kind: "agenda";
      title: string;
      entries: AgendaEntry[];
      startIndex: number;
      part: number;
      parts: number;
      notes?: string;
    }
  | {
      kind: "section";
      number: number;
      kicker: string;
      title: string;
      children: string[];
      notes?: string;
    }
  | { kind: "question"; kicker: string; text: string; notes?: string }
  | {
      kind: "content";
      kicker: string;
      title: string;
      points: Point[];
      layout: ContentLayout;
      part: number;
      parts: number;
      /** رقم المبحث الذي تنتمي إليه الشريحة (0 للمقدمة والخاتمة) */
      sectionNumber: number;
      notes?: string;
    }
  | {
      kind: "references";
      title: string;
      points: Point[];
      startIndex: number;
      part: number;
      parts: number;
      notes?: string;
    }
  | { kind: "closing"; title: string; subtitle: string; notes?: string };

export type SlideDensity = "airy" | "balanced" | "detailed";

export interface DeckOptions {
  density: SlideDensity;
  includeAgenda: boolean;
  includeSectionDividers: boolean;
  includeReferences: boolean;
  includeClosing: boolean;
  includeNotes: boolean;
}

export interface SlideDeck {
  title: string;
  /** عدد المطالب في كل مبحث كما اكتُشف في المحتوى */
  structure: number[];
  slides: Slide[];
}
