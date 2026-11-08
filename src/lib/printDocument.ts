import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppPrintPluginInterface {
  print(options?: { name?: string }): Promise<void>;
}

const AppPrint = registerPlugin<AppPrintPluginInterface>('AppPrint');

/**
 * دالة طباعة البحث وتصدير PDF متوافقة مع متصفحات الويب وتطبيق أندرويد
 */
export async function triggerPrintDocument(docTitle?: string): Promise<void> {
  const title = docTitle || document.title || 'بحث_جامعي_منسق';

  // 1. فحص واجهة أندرويد الأصلية المباشرة (JavascriptInterface)
  if (typeof window !== 'undefined' && (window as any).AndroidNativePrint?.print) {
    (window as any).AndroidNativePrint.print(title);
    return;
  }

  // 2. فحص إضافة Capacitor الأصلية في أندرويد
  if (Capacitor.isNativePlatform()) {
    try {
      await AppPrint.print({ name: title });
      return;
    } catch (e) {
      console.warn('Capacitor AppPrint failed, falling back to window.print:', e);
    }
  }

  // 3. في المتصفح العادي
  window.print();
}
