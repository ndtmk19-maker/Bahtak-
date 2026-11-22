export type LayoutMode = 'research' | 'card';
export type BorderStyle = 'double' | 'gold' | 'single' | 'none';
export type CoverTheme = 'black' | 'gold';
export type LogoPosition = 'both' | 'right' | 'left';
export type LogoSize = 'large' | 'xlarge' | 'medium' | 'compact';
export type ResearchLanguage = 'ar' | 'fr' | 'en';

export interface ResearchPage {
  mabhathTitle: string;
  matlabTitle: string;
  /** محتوى HTML مولد من المحرك (فقرات، عناوين فرعية، قوائم) */
  content: string;
  footnotes: string[];
}

import type { CoverTemplateId } from './types/document';
export type { CoverTemplateId };

export interface CoverState {
  enabled: boolean;
  theme: CoverTheme;
  country: string;
  ministry: string;
  selectedWilaya: string;
  selectedUnivId: string;
  universityName: string;
  facultyName: string;
  logoUrl: string;
  logoBase64: string;
  logoPosition: LogoPosition;
  logoSize: LogoSize;
  workType: string;
  title: string;
  subtitle: string;
  studentsText: string;
  supervisor: string;
  group: string;
  academicYear: string;
  useExperimentalDesign?: boolean;
  coverTemplate?: CoverTemplateId;
}

export interface PlanState {
  enabled: boolean;
  pageTitle: string;
  researchTitle: string;
  showPageNumbers: boolean;
  itemsText: string;
}

export interface DocumentState {
  language?: ResearchLanguage;
  layoutMode: LayoutMode;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  borderStyle: BorderStyle;
  showStudentInfo: boolean;
  studentName: string;
  studentFawj: string;
  coverState: CoverState;
  planState: PlanState;
  pages: ResearchPage[];
}

export interface University {
  id: string;
  name: string;
  logo: string;
}

export interface Wilaya {
  id: string;
  name: string;
  universities: University[];
}

export type PlanItemType = 'intro' | 'mabhath' | 'matlab' | 'conclusion' | 'references';
