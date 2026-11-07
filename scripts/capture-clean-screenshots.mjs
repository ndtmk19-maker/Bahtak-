import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function run() {
  const outputDir = path.resolve('demo-recordings');
  const shotsDir = path.join(outputDir, 'screenshots');

  // التأكد من أن مجلد الصور فارغ ونظيف تماماً
  fs.mkdirSync(shotsDir, { recursive: true });
  const existing = fs.readdirSync(shotsDir);
  for (const f of existing) {
    fs.unlinkSync(path.join(shotsDir, f));
  }

  console.log('🚀 تشغيل Playwright لالتقاط لقطات الشاشة المرتبة فائقة الدقة (4K)...');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // صور فائقة الدقة والوضوح (Ultra HD)
    locale: 'ar-DZ',
  });

  const page = await context.newPage();

  // 1. الواجهة الرئيسية
  await page.goto('http://localhost:8443/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  console.log('📸 01: الواجهة الرئيسية');
  await page.screenshot({ path: path.join(shotsDir, '01_الواجهة_الرئيسية_Landing_Page.png') });

  // 2. الكرة الأرضية والتقييمات
  console.log('📸 02: الكرة الأرضية ثلاثية الأبعاد والتقييمات');
  await page.evaluate(() => window.scrollBy({ top: 620, behavior: 'smooth' }));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(shotsDir, '02_الكرة_الارضية_والتقييمات_3D_Globe.png') });

  // 3. نافذة إضافة التقييم بالـ 5 نجوم
  console.log('📸 03: نافذة إضافة التقييم والرأي (Review Modal)');
  const addReviewBtn = page.locator('button:has-text("أضف تقييمك ورأيك"), button[title*="تقييم"]').first();
  if (await addReviewBtn.isVisible()) {
    await addReviewBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(shotsDir, '03_نافذة_التقييمات_Review_Modal.png') });
    const closeBtn = page.locator('button[aria-label*="إغلاق"]').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // العودة للأعلى والدخول في المعالج
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(800);
  const startBtn = page.locator('button:has-text("ابدأ إعداد بحثك الآن"), button:has-text("ابدأ الآن")').first();
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await page.waitForTimeout(1200);
  }

  // 4. الخطوة 1: الغلاف والطلبة والشعار
  console.log('📸 04: الخطوة 1 - الغلاف والطلبة وشعارات الولايات');
  await page.screenshot({ path: path.join(shotsDir, '04_الخطوة1_الغلاف_وشعارات_الجامعات.png') });

  // 5. الخطوة 2: توليد البحث بالذكاء الاصطناعي
  console.log('📸 05: الخطوة 2 - توليد البحث بالذكاء الاصطناعي');
  const nextBtn1 = page.locator('button:has-text("التالي: توليد البحث"), button:has-text("التالي")').last();
  if (await nextBtn1.isVisible()) {
    await nextBtn1.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(shotsDir, '05_الخطوة2_توليد_البحث_بالذكاء_الاصطناعي.png') });

  // 6. الخطوة 3: التنسيق والمظهر
  console.log('📸 06: الخطوة 3 - التنسيق والمظهر والخطوط وهوامش A4');
  const nextBtn2 = page.locator('button:has-text("التالي: التنسيق والمظهر"), button:has-text("التالي")').last();
  if (await nextBtn2.isVisible()) {
    await nextBtn2.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(shotsDir, '06_الخطوة3_تنسيق_الخطوط_والهوامش.png') });

  // 7. الخطوة 4: المعاينة والإنهاء
  console.log('📸 07: الخطوة 4 - ملخص المعاينة والإنهاء');
  const nextBtn3 = page.locator('button:has-text("التالي: المعاينة والإنهاء"), button:has-text("التالي")').last();
  if (await nextBtn3.isVisible()) {
    await nextBtn3.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(shotsDir, '07_الخطوة4_المعاينة_والانهاء.png') });

  // 8. المحرر الكامل المتقدم (شاشة منقسمة)
  console.log('📸 08: المحرر الكامل المتقدم (لوحة التحرير + ورقة A4)');
  const fullEditorBtn = page.locator('button:has-text("المحرر الكامل"), button:has-text("الانتقال إلى المحرر الكامل")').first();
  if (await fullEditorBtn.isVisible()) {
    await fullEditorBtn.click();
    await page.waitForTimeout(1500);
  } else {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('المحرر الكامل'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(shotsDir, '08_المحرر_الكامل_شاشة_منقسمة.png') });

  // 9. تحرير الصفحات والهوامش
  console.log('📸 09: المحرر الكامل - تبويب تحرير الصفحات والهوامش');
  const pagesTab = page.locator('button:has-text("الصفحات")').first();
  if (await pagesTab.isVisible()) {
    await pagesTab.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(shotsDir, '09_المحرر_الكامل_تحرير_الصفحات_والهوامش.png') });
  }

  // 10. شجرة خطة البحث
  console.log('📸 10: المحرر الكامل - تبويب شجرة خطة البحث');
  const planTab = page.locator('button:has-text("الخطة")').first();
  if (await planTab.isVisible()) {
    await planTab.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(shotsDir, '10_المحرر_الكامل_شجرة_خطة_البحث.png') });
  }

  // 11. إيضاح ورقة A4 الحقيقية وفصل الهوامش
  console.log('📸 11: إيضاح ورقة الـ A4 الحقيقية وفصل الهوامش أسفل الصفحة');
  const previewContainer = page.locator('.page-container, .preview-pane, main, .print-sheet, [id^="page-"]').first();
  if (await previewContainer.isVisible()) {
    await previewContainer.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotsDir, '11_ايضاح_ورقة_A4_الحقيقية_وفصل_الهوامش.png') });

  // 12. بطاقة تحميل تطبيق الأندرويد الرسمي وتصدير Word
  console.log('📸 12: بطاقة وخانة تحميل تطبيق الأندرويد الرسمي (APK) وأزرار التصدير');
  await page.evaluate(() => {
    const el = document.querySelector('a[download="Bahtak.apk"]') || document.querySelector('.group\\/apk');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotsDir, '12_تحميل_تطبيق_الاندرويد_الرسمي_APK.png') });

  await context.close();
  await browser.close();

  console.log(`\n🎉 تم حفظ جميع الصور الـ 12 بنجاح وبأسماء مرتبة وواضحة في:\n📁 ${shotsDir}`);
}

run().catch(err => {
  console.error('حدث خطأ:', err);
  process.exit(1);
});
