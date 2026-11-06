import { useCallback } from 'react';
import { useDocument } from './DocumentContext';
import { useUI } from './UIContext';
import { useConverter } from './ConverterContext';

/** إعادة تعيين التطبيق ومسح البيانات المحفوظة لبدء بحث جديد */
export function useResetApp() {
  const { reset } = useDocument();
  const { confirm, toast, setSection, setViewMode, setWizardStep } = useUI();
  const { setRawText } = useConverter();
  return useCallback(async () => {
    const ok = await confirm({
      title: 'بدء بحث جديد؟',
      message: 'سيتم مسح البحث الحالي وجميع البيانات المحفوظة في هذا المتصفح (الغلاف، الخطة، الصفحات، والنص الخام). لا يمكن التراجع عن هذا الإجراء.',
      confirmLabel: 'إعادة التعيين',
      tone: 'danger',
    });
    if (!ok) return;
    reset();
    setRawText('');
    setSection('content');
    setViewMode('wizard');
    setWizardStep(1);
    toast('تمت إعادة ضبط التطبيق للبدء في بحث جديد');
  }, [confirm, reset, setRawText, setSection, setViewMode, setWizardStep, toast]);
}
