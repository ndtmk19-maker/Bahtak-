import { FileText, GraduationCap, ListTree, SlidersHorizontal, Wand2, type LucideIcon } from 'lucide-react';
import type { SectionId } from '../state/UIContext';

export interface SectionMeta {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export const SECTIONS: SectionMeta[] = [
  {
    id: 'content',
    label: 'المحتوى',
    icon: Wand2,
    title: 'حوّل نصك إلى بحث منسق',
    description: 'الصق مسودة بحثك أو ولّده بالذكاء الاصطناعي، وسيُقسَّم تلقائياً إلى صفحات A4 مع الغلاف والخطة والهوامش.',
  },
  {
    id: 'cover',
    label: 'الغلاف',
    icon: GraduationCap,
    title: 'صفحة الغلاف الرسمية',
    description: 'اختر جامعتك ليظهر شعارها الرسمي، ثم أكمل بيانات البحث وفريق العمل.',
  },
  {
    id: 'plan',
    label: 'الخطة',
    icon: ListTree,
    title: 'خطة البحث والفهرس',
    description: 'نظّم شجرة المباحث والمطالب وأرقام صفحاتها، أو ولّدها آلياً من صفحات بحثك.',
  },
  {
    id: 'pages',
    label: 'الصفحات',
    icon: FileText,
    title: 'محرر الصفحات',
    description: 'عدّل عناوين كل صفحة ومتنها وهوامشها، وقسّم الصفحات الطويلة بنقرة واحدة.',
  },
  {
    id: 'style',
    label: 'التنسيق',
    icon: SlidersHorizontal,
    title: 'الخطوط والإطارات والمظهر',
    description: 'اضبط خط المتن وحجمه وتباعد الأسطر ونمط الإطار وشكل التخطيط.',
  },
];
