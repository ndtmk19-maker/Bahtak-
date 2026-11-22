export type CoverTemplateId =
  | 'diagonal'
  | 'classic-ornate'
  | 'ribbon-diamond'
  | 'greek-key'
  | 'waves'
  | 'royal'
  | 'modern-slant'
  | 'framed-plaque'
  | 'quill'
  | 'laurel-temple'
  | 'ribbon-cap'
  | 'geometric'

export interface DocumentState {
  republic?: string
  ministry?: string
  university?: string
  faculty?: string
  department?: string
  /** Logo shown on the right of the header (and on the left when logoUrl2 is absent). */
  logoUrl?: string
  logoUrl2?: string
  /** e.g. "بحث أكاديمي حول" */
  researchType?: string
  title: string
  subtitle?: string
  students: string[]
  supervisor?: string
  group?: string
  academicYear?: string
  coverTemplate?: CoverTemplateId
}
