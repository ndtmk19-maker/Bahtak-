import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function run() {
  const outputDir = path.resolve('demo-recordings');
  const shotsDir = path.join(outputDir, 'screenshots');
  const videoDir = path.join(outputDir, 'video');

  fs.mkdirSync(shotsDir, { recursive: true });
  fs.mkdirSync(videoDir, { recursive: true });

  console.log('🚀 تشغيل متصفح Playwright لبدء التسجيل والتقاط الصور...');

  const browser = await chromium.launch({
    headless: true, // headless mode for fast and reliable recording
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // صور فائقة الدقة 4K
    locale: 'ar-DZ',
    recordVideo: {
      dir: videoDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  // تنظيف localStorage لتبدأ الجلسة نظيفة من صفحة الهبوط
  await page.goto('http://localhost:8443/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle' });

  console.log('📸 1. التقاط المشهد 1: صفحة الهبوط الرئيسية والكرة الأرضية 3D...');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotsDir, '01_landing_hero.png') });

  // التمرير للأسفل لاستعراض الكرة الأرضية 3D
  await page.evaluate(() => window.scrollBy({ top: 600, behavior: 'smooth' }));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(shotsDir, '02_landing_3d_globe.png') });

  // العودة للأعلى والضغط على زر "ابدأ إعداد بحثك الآن"
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(800);

  console.log('📸 2. التقاط المشهد 2: الخطوة 1 - الغلاف والطلبة والشعار الرسمي...');
  const startBtn = page.locator('button:has-text("ابدأ إعداد بحثك الآن"), button:has-text("ابدأ الآن")').first();
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await page.waitForTimeout(1200);
  }

  // التقاط الخطوة 1: الغلاف والطلبة
  await page.screenshot({ path: path.join(shotsDir, '03_step1_cover_and_students.png') });

  console.log('📸 3. التقاط المشهد 3: الخطوة 2 - توليد البحث والذكاء الاصطناعي...');
  // الضغط على زر "التالي" للانتقال للخطوة 2
  const nextBtn1 = page.locator('button:has-text("التالي: توليد البحث"), button:has-text("التالي")').last();
  if (await nextBtn1.isVisible()) {
    await nextBtn1.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(shotsDir, '04_step2_ai_generation.png') });

  console.log('📸 4. التقاط المشهد 4: الخطوة 3 - التنسيق والمظهر والخطوط...');
  // الضغط على زر "التالي" للانتقال للخطوة 3
  const nextBtn2 = page.locator('button:has-text("التالي: التنسيق والمظهر"), button:has-text("التالي")').last();
  if (await nextBtn2.isVisible()) {
    await nextBtn2.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(shotsDir, '05_step3_typography_and_style.png') });

  console.log('📸 5. التقاط المشهد 5: الخطوة 4 - المعاينة الحية لصفحات A4 والهوامش وتصدير Word/APK...');
  // الضغط على زر "التالي" للانتقال للخطوة 4
  const nextBtn3 = page.locator('button:has-text("التالي: المعاينة والإنهاء"), button:has-text("التالي")').last();
  if (await nextBtn3.isVisible()) {
    await nextBtn3.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(shotsDir, '06_step4_live_a4_preview.png') });

  // التمرير في المعاينة لرؤية بطاقة التحميل وحقوق الـ APK
  await page.evaluate(() => window.scrollBy({ top: 800, behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotsDir, '07_download_options_and_apk.png') });

  console.log('💾 حفظ الفيديو النهائي وإغلاق المتصفح...');
  await page.waitForTimeout(1000);

  // إغلاق الصفحة والسياق لإنهاء ملف الفيديو
  await context.close();
  await browser.close();

  // الحصول على ملف الفيديو المحفوظ وإعادة تسميته باسم واضح
  const videoFiles = fs.readdirSync(videoDir);
  const recordedVideo = videoFiles.find(f => f.endsWith('.webm'));
  if (recordedVideo) {
    const finalVideoPath = path.join(videoDir, 'bahtak_demo_video.webm');
    fs.renameSync(path.join(videoDir, recordedVideo), finalVideoPath);
    console.log(`\n🎉 تم تسجيل الفيديو بنجاح: ${finalVideoPath}`);
  }

  console.log(`🎉 تم حفظ جميع لقطات الشاشة بنجاح في: ${shotsDir}`);
}

run().catch(err => {
  console.error('حدث خطأ أثناء التسجيل:', err);
  process.exit(1);
});
