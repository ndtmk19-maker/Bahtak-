import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppPrintPluginInterface {
  print(options?: { name?: string }): Promise<void>;
}

const AppPrint = registerPlugin<AppPrintPluginInterface>('AppPrint');

/**
 * فحص ما إذا كان الجهاز يعمل بنظام iOS (iPhone, iPad, iPod)
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAppleDevice = /iPad|iPhone|iPod/.test(ua);
  const isAppleTouch = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isAppleDevice || isAppleTouch;
}

/**
 * فحص ما إذا كان المستخدم يتصفح من داخل متصفح تطبيق محجوب
 * مثل إنستغرام أو تيك توك أو فيسبوك، حيث تُعطّل آبل أمر window.print() في الـ WebViews التابعة لهذه التطبيقات
 */
export function isInAppBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = (navigator.userAgent || navigator.vendor || (window as any).opera || '').toLowerCase();
  return (
    ua.includes('fban') ||
    ua.includes('fbav') ||
    ua.includes('instagram') ||
    ua.includes('tiktok') ||
    ua.includes('bytedance') ||
    ua.includes('snapchat') ||
    ua.includes('line/') ||
    ua.includes('twitter') ||
    ua.includes('micromessenger') ||
    ua.includes('musical_ly')
  );
}

export interface PrintResult {
  success: boolean;
  inAppBrowser?: boolean;
  error?: string;
}

/**
 * دالة طباعة وتصدير PDF متوافقة مع متصفحات الويب (بما فيها iOS Safari) وتطبيق أندرويد
 * ملاحظة حرجة لأجهزة iOS: يجب استدعاء هذه الدالة بشكل متزامن تماماً (Synchronous)
 * ضمن حدث تفاعل المستخدم (Click / Touch) بدون أي تأخير (setTimeout) لمنع سفاري من حجب نافذة الطباعة.
 */
export function triggerPrintDocument(docTitle?: string): PrintResult {
  const title = docTitle || (typeof document !== 'undefined' ? document.title : '') || 'بحث_جامعي_منسق';

  // 1. فحص واجهة أندرويد الأصلية المباشرة (JavascriptInterface في تطبيق الهاتف Bahtak)
  if (typeof window !== 'undefined' && (window as any).AndroidNativePrint?.print) {
    try {
      (window as any).AndroidNativePrint.print(title);
      return { success: true };
    } catch (err) {
      console.error('AndroidNativePrint error:', err);
    }
  }

  // 2. فحص إضافة Capacitor في تطبيق أندرويد
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    AppPrint.print({ name: title }).catch((err) => {
      console.warn('Capacitor AppPrint error:', err);
      try {
        window.print();
      } catch (e) {
        console.error('window.print fallback failed:', e);
      }
    });
    return { success: true };
  }

  // 3. فحص إذا كان المستخدم داخل متصفح تطبيق يمنع الطباعة (Instagram / TikTok / Facebook)
  if (isInAppBrowser()) {
    return { success: false, inAppBrowser: true };
  }

  // 4. ضبط عنوان الصفحة مؤقتاً ليكون هو اسم ملف PDF عند الحفظ في Safari أو Chrome
  let originalTitle = '';
  if (typeof document !== 'undefined') {
    originalTitle = document.title;
    document.title = title;
  }

  // 5. استدعاء أمر الطباعة المباشر للمتصفح بشكل متزامن تماماً للحفاظ على صلاحية نقرة المستخدم في سفاري iOS
  try {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
      return { success: true };
    } else {
      return { success: false, error: 'المتصفح الحالي لا يدعم ميزة الطباعة وتصدير PDF المباشر' };
    }
  } catch (err) {
    console.error('window.print error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (typeof document !== 'undefined' && originalTitle) {
      setTimeout(() => {
        document.title = originalTitle;
      }, 2000);
    }
  }
}
