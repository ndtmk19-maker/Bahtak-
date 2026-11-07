import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function run() {
  const outputDir = path.resolve('demo-recordings');
  const shotsDir = path.join(outputDir, 'screenshots');
  const videoDir = path.join(outputDir, 'video');

  fs.mkdirSync(shotsDir, { recursive: true });
  fs.mkdirSync(videoDir, { recursive: true });

  console.log('🚀 تشغيل متصفح Playwright لتسجيل كامل خطوات الموقع والمحرر وورقة A4...');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // صور وفيديو بجودة فائقة الدقة 4K
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

  // -------------------------------------------------------------
  // المشهد 1: واجهة الموقع الرئيسية والكرة الأرضية والتقييمات
  // -------------------------------------------------------------
  console.log('📸 1. التقاط المشهد 1: صفحة الهبوط الرئيسية مع العنوان والأزرار...');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotsDir, '01_landing_hero.png') });

  console.log('📸 2. التقاط المشهد 2: الكرة الأرضية ثلاثية الأبعاد 3D Globe واستعراض التقييمات...');
  await page.evaluate(() => window.scrollBy({ top: 620, behavior: 'smooth' }));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(shotsDir, '02_landing_3d_globe_reviews.png') });

  console.log('📸 3. التقاط المشهد 3: نافذة إضافة التقييم والرأي (Review Modal)...');
  const addReviewBtn = page.locator('button:has-text("أضف تقييمك ورأيك"), button[title*="تقييم"]').first();
  if (await addReviewBtn.isVisible()) {
    await addReviewBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(shotsDir, '03_review_feedback_modal.png') });
    // إغلاق نافذة التقييم
    const closeBtn = page.locator('button[aria-label*="إغلاق"]').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // -------------------------------------------------------------
  // المشهد 2: الدخول في المعالج (4 خطوات)
  // -------------------------------------------------------------
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(800);

  console.log('📸 4. التقاط الخطوة 1: صفحة الغلاف والطلبة مع شعارات 58 ولاية...');
  const startBtn = page.locator('button:has-text("ابدأ إعداد بحثك الآن"), button:has-text("ابدأ الآن")').first();
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(shotsDir, '04_wizard_step1_cover.png') });

  console.log('📸 5. التقاط الخطوة 2: توليد البحث بالذكاء الاصطناعي وبث المحتوى...');
  const nextBtn1 = page.locator('button:has-text("التالي: توليد البحث"), button:has-text("التالي")').last();
  if (await nextBtn1.isVisible()) {
    await nextBtn1.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(shotsDir, '05_wizard_step2_ai_generation.png') });

  console.log('📸 6. التقاط الخطوة 3: التنسيق والمظهر والخطوط وهوامش A4...');
  const nextBtn2 = page.locator('button:has-text("التالي: التنسيق والمظهر"), button:has-text("التالي")').last();
  if (await nextBtn2.isVisible()) {
    await nextBtn2.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(shotsDir, '06_wizard_step3_styling.png') });

  console.log('📸 7. التقاط الخطوة 4: ملخص المعاينة والخيارات...');
  const nextBtn3 = page.locator('button:has-text("التالي: المعاينة والإنهاء"), button:has-text("التالي")').last();
  if (await nextBtn3.isVisible()) {
    await nextBtn3.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(shotsDir, '07_wizard_step4_summary.png') });

  // -------------------------------------------------------------
  // المشهد 3: الانتقال إلى المحرر الكامل (Classic Editor Mode)
  // -------------------------------------------------------------
  console.log('📸 8. الانتقال إلى المحرر الكامل المتقدم (Classic Full Editor)...');
  const fullEditorBtn = page.locator('button:has-text("المحرر الكامل"), button:has-text("الانتقال إلى المحرر الكامل")').first();
  if (await fullEditorBtn.isVisible()) {
    await fullEditorBtn.click();
    await page.waitForTimeout(1500);
  } else {
    // التبديل عبر القائمة العلوية
    await page.evaluate(() => {
      const btn = document.querySelector('button[title*="المحرر الكامل"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('المحرر الكامل'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(1500);
  }

  // لقطة لشاشة المحرر الكامل: لوحة التحرير على اليمين ومعاينة ورقة A4 على اليسار جنباً إلى جنب
  await page.screenshot({ path: path.join(shotsDir, '08_full_editor_split_view.png') });

  console.log('📸 9. استعراض تبويب تحرير الصفحات والهوامش في المحرر الكامل...');
  // التبديل لتبويب "الصفحات" في شريط أدوات المحرر
  const pagesTab = page.locator('button:has-text("الصفحات")').first();
  if (await pagesTab.isVisible()) {
    await pagesTab.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(shotsDir, '09_full_editor_pages_and_footnotes.png') });
  }

  console.log('📸 10. استعراض تبويب شجرة خطة البحث في المحرر الكامل...');
  // التبديل لتبويب "الخطة" في شريط أدوات المحرر
  const planTab = page.locator('button:has-text("الخطة")').first();
  if (await planTab.isVisible()) {
    await planTab.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(shotsDir, '10_full_editor_plan_tree.png') });
  }

  // -------------------------------------------------------------
  // المشهد 4: إيضاح ورقة الـ A4 الحقيقية وتوزيع الهوامش المنفصلة
  // -------------------------------------------------------------
  console.log('📸 11. إيضاح ورقة الـ A4 الحقيقية مع الهوامش المنفصلة أسفل كل صفحة...');
  // التمرير في نافذة المعاينة A4 لاستعراض الورقة بدقة
  const previewContainer = page.locator('.page-container, .preview-pane, main, .print-sheet, [id^="page-"]').first();
  if (await previewContainer.isVisible()) {
    await previewContainer.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotsDir, '11_realistic_a4_paper_preview.png') });

  // -------------------------------------------------------------
  // المشهد 5: خيارات التصدير (Word, PDF) وتحميل تطبيق الأندرويد الرسمي APK
  // -------------------------------------------------------------
  console.log('📸 12. إبراز بطاقة وخانة تحميل تطبيق الأندرويد الرسمي (APK) وأزرار التصدير...');
  // التبديل إلى تبويب الغلاف أو أسفل الصفحة لرؤية بطاقة APK
  await page.evaluate(() => {
    const el = document.querySelector('a[download="Bahtak.apk"]') || document.querySelector('.group\\/apk');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotsDir, '12_android_apk_download_card.png') });

  console.log('💾 إنهاء وحفظ ملف الفيديو عالي الدقة...');
  await page.waitForTimeout(1500);

  // إغلاق الصفحة والسياق لإنهاء ملف الفيديو
  await context.close();
  await browser.close();

  // الحصول على ملف الفيديو المسجل
  const videoFiles = fs.readdirSync(videoDir);
  const recordedVideo = videoFiles.find(f => f.endsWith('.webm'));
  if (recordedVideo) {
    const finalVideoPath = path.join(videoDir, 'bahtak_full_feature_demo.webm');
    if (fs.existsSync(finalVideoPath)) fs.unlinkSync(finalVideoPath);
    fs.renameSync(path.join(videoDir, recordedVideo), finalVideoPath);
    console.log(`\n🎉 تم تسجيل الفيديو الكامل بنجاح: ${finalVideoPath}`);
  }

  console.log(`🎉 تم حفظ 12 لقطة شاشة فائقة الدقة بنجاح في: ${shotsDir}`);
}

run().catch(err => {
  console.error('حدث خطأ أثناء التسجيل:', err);
  process.exit(1);
});
