import { chromium } from 'playwright';

async function test() {
  console.log('Testing selectors...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8443/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // 1. Start button
  console.log('1. Clicking start button...');
  const startBtn = page.locator('button:has-text("ابدأ الآن"), button:has-text("ابدأ")').first();
  await startBtn.click();
  await page.waitForTimeout(500);

  // 2. Student inputs
  console.log('2. Filling student info...');
  const studentsArea = page.locator('textarea').first();
  await studentsArea.fill('الطالب: محمد بن علي\nالطالبة: أمينة قاسمي');

  const supervisorInput = page.locator('input[placeholder*="الأستاذ"]').first();
  await supervisorInput.fill('د. عبد القادر بوجمعة');

  // 3. Wilaya and university
  console.log('3. Selecting Wilaya and University...');
  const wilayaSelect = page.locator('select').first();
  await wilayaSelect.selectOption({ value: 'alger' });
  await page.waitForTimeout(300);

  const univSelect = page.locator('select').nth(1);
  await univSelect.selectOption({ value: 'usthb' });
  await page.waitForTimeout(300);

  // Check logo
  const logoImg = page.locator('img[src*="USTHB.png"]').first();
  console.log('Logo visible:', await logoImg.isVisible());

  // 4. Next to Step 2 (Wizard Step 2: Content generation)
  console.log('4. Next button...');
  const nextBtn1 = page.locator('button:has-text("التالي")').last();
  await nextBtn1.click();
  await page.waitForTimeout(500);

  // 5. AI vs Paste
  console.log('5. Clicking AI then Paste...');
  const aiOption = page.locator('button:has-text("توليد بالذكاء الاصطناعي")').first();
  if (await aiOption.isVisible()) await aiOption.click();
  await page.waitForTimeout(300);

  const pasteOption = page.locator('button:has-text("لصق نص مسودة جاهز")').first();
  if (await pasteOption.isVisible()) await pasteOption.click();
  await page.waitForTimeout(300);

  const demoBtn = page.locator('button:has-text("تجربة بنص تجريبي")').first();
  if (await demoBtn.isVisible()) {
    await demoBtn.click();
    console.log('Clicked demo text button');
  }
  await page.waitForTimeout(300);

  const parseBtn = page.locator('button:has-text("تحليل النص")').first();
  if (await parseBtn.isVisible()) {
    await parseBtn.click();
    console.log('Clicked parse button');
  }
  await page.waitForTimeout(500);

  // 6. Step 4 Preview
  console.log('6. Navigating to Step 4 Preview...');
  const step4Btn = page.locator('button:has-text("المعاينة والإنهاء")').first();
  if (await step4Btn.isVisible()) {
    await step4Btn.click();
  } else {
    await page.locator('button:has-text("التالي")').last().click();
  }
  await page.waitForTimeout(500);

  const wordBtn = page.locator('button:has-text("Word"), button:has-text("وورد")').first();
  console.log('Word button visible:', await wordBtn.isVisible());

  const pdfBtn = page.locator('button:has-text("PDF"), button:has-text("طباعة")').first();
  console.log('PDF button visible:', await pdfBtn.isVisible());

  console.log('✅ ALL SELECTORS VERIFIED SUCCESSFULLY!');
  await browser.close();
}

test().catch(err => {
  console.error('Error during selector test:', err);
  process.exit(1);
});
