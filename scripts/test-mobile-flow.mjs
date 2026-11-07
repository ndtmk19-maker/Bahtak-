import { chromium } from 'playwright';

async function testMobileFlow() {
  console.log('Testing mobile flow on 540x960 (9:16)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 2,
    locale: 'ar-DZ',
  });

  const page = await context.newPage();
  await page.goto('http://localhost:8443', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // 1. Landing -> Start
  console.log('1. Landing page...');
  const startBtn = page.locator('button:has-text("ابدأ")').first();
  await startBtn.scrollIntoViewIfNeeded();
  await startBtn.click();
  await page.waitForTimeout(500);

  // 2. Step 1 (Students)
  console.log('2. Step 1 (Students & Supervisor)...');
  const studentsArea = page.locator('textarea').first();
  await studentsArea.fill('الطالب: محمد بن علي\nالطالبة: أمينة قاسمي');

  const supervisorInput = page.locator('input[placeholder*="الأستاذ"]').first();
  await supervisorInput.fill('د. عبد القادر بوجمعة');

  // 3. Step 2 (Cover & Wilayas)
  console.log('3. Selecting Wilaya & Univ...');
  const wilayaSelect = page.locator('select').first();
  await wilayaSelect.selectOption({ value: 'alger' });
  await page.waitForTimeout(400);

  const univSelect = page.locator('select').nth(1);
  await univSelect.selectOption({ value: 'usthb' });
  await page.waitForTimeout(400);

  console.log('Checking logo visibility...');
  const logoBadge = page.locator('text=الشعار مفعّل في ترويسة الغلاف');
  console.log('Logo badge visible:', await logoBadge.isVisible());

  // Next button to Content Step
  console.log('4. Navigating to Content Generation (Step 2 in wizard)...');
  const nextBtn = page.locator('nav[aria-label="أزرار التنقل بين الخطوات"] button:has-text("التالي")').first();
  await nextBtn.click();
  await page.waitForTimeout(500);

  // 5. AI vs Demo Text
  console.log('5. Clicking demo text & parse...');
  const pasteOption = page.locator('button:has-text("لصق نص مسودة جاهز")').first();
  if (await pasteOption.isVisible()) await pasteOption.click();
  await page.waitForTimeout(300);

  const demoBtn = page.locator('button:has-text("تجربة بنص تجريبي")').first();
  if (await demoBtn.isVisible()) await demoBtn.click();
  await page.waitForTimeout(300);

  const parseBtn = page.locator('button:has-text("تحليل النص")').first();
  if (await parseBtn.isVisible()) await parseBtn.click();
  await page.waitForTimeout(600);

  // 6. Navigate to Step 4 Preview
  console.log('6. Navigating to Step 4 Preview...');
  await page.evaluate(() => {
    const main = document.querySelector('main[aria-label="معالج إعداد وتنسيق البحث"]') || document.documentElement;
    if (main.scrollTo) main.scrollTo({ top: 0, behavior: 'instant' });
    const tabs = document.querySelectorAll('div[role="tablist"] button');
    if (tabs[3]) tabs[3].click();
  });
  await page.waitForTimeout(800);

  // Verify Preview elements
  const wordBtn = page.locator('button:has-text("Word")').first();
  console.log('Word button visible:', await wordBtn.isVisible());

  const a4Stage = page.locator('.doc-stage').first();
  console.log('A4 Stage visible:', await a4Stage.isVisible());

  const apkBtn = page.locator('a[download="Bahtak.apk"]').first();
  console.log('APK download button visible:', await apkBtn.isVisible());

  await page.evaluate(() => {
    const main = document.querySelector('main[aria-label="معالج إعداد وتنسيق البحث"]') || document.documentElement;
    if (main.scrollBy) main.scrollBy({ top: 450, behavior: 'instant' });
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'demo-recordings/screenshots/mobile_test_a4.png' });
  console.log('Screenshot of mobile A4 stage saved!');

  await browser.close();
}

testMobileFlow().catch(console.error);
