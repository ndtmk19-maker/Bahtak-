import { useCallback } from 'react';
import { useDocument } from './DocumentContext';
import { useUI } from './UIContext';
import { useConverter } from './ConverterContext';
import { usePresentation } from './PresentationContext';

/** إعادة تعيين الوضع النشط حالياً (البحث أو العرض التقديمي) ومسح بياناته المحفوظة بشكل مستقل */
export function useResetApp() {
  const { reset: resetResearch } = useDocument();
  const { product, confirm, toast, setSection, setViewMode, setWizardStep } = useUI();
  const { setRawText } = useConverter();
  const { reset: resetSlides } = usePresentation();

  return useCallback(async () => {
    if (product === 'slides') {
      const ok = await confirm({
        title: 'بدء عرض تقديمي جديد؟',
        message: 'سيتم مسح العرض الحالي، مسودة الشرائح، وبيانات شريحة الغلاف من هذا المتصفح (دون المساس ببحث A4). لا يمكن التراجع عن هذا الإجراء.',
        confirmLabel: 'إعادة التعيين',
        tone: 'danger',
      });
      if (!ok) return;
      resetSlides();
      toast('تمت إعادة تعيين العرض التقديمي للبدء من جديد');
      return;
    }

    const ok = await confirm({
      title: 'بدء بحث جديد؟',
      message: 'سيتم مسح البحث الحالي وجميع البيانات المحفوظة في هذا المتصفح (الغلاف، الخطة، الصفحات، والنص الخام) دون المساس بعروض PowerPoint. لا يمكن التراجع عن هذا الإجراء.',
      confirmLabel: 'إعادة التعيين',
      tone: 'danger',
    });
    if (!ok) return;
    resetResearch();
    setRawText('');
    setSection('content');
    setViewMode('wizard');
    setWizardStep(1);
    toast('تمت إعادة ضبط التطبيق للبدء في بحث جديد');
  }, [confirm, product, resetResearch, resetSlides, setRawText, setSection, setViewMode, setWizardStep, toast]);
}
