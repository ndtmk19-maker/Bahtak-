import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// قائمة الكابشن والنصوص المتزامنة بدقة بالمللي ثانية مع المقطع الصوتي الجزائري (138.84 ثانية)
const SCRIPT_TIMELINE = [
  // المقدمة (0.00s - 24.45s)
  { start: 0.0, end: 5.12, text: "كيفاش تقدر تنجز وتنسّق بحثك الجامعي في دقائق، وبكل سهولة؟", badge: "🌟 منصة بَحْثُك | إعداد وتنسيق البحوث في دقائق", step: 0 },
  { start: 5.12, end: 8.61, text: "مع منصة «بَحْثُك»، كل شيء ولى أسهل!", badge: "🌟 منصة بَحْثُك | كل شيء ولى أسهل", step: 0 },
  { start: 8.61, end: 15.50, text: "أول حاجة، ندخلو لموقع أو تطبيق بحثك، ومن الواجهة الرئيسية نبدأو رحلة إنشاء بحثنا الجامعي.", badge: "🚀 الواجهة الرئيسية | بدء إعداد البحث الجامعي", step: 0 },
  { start: 15.50, end: 21.47, text: "المنصة توفرلنا أربع خطوات بسيطة، من إدخال المعلومات حتى تحميل البحث النهائي.", badge: "⚡ 4 خطوات بسيطة من البداية حتى التحميل", step: 0 },
  { start: 21.47, end: 24.45, text: "خلّينا نشوفو كيفاش نخدمو بيها خطوة بخطوة!", badge: "🔍 جولة سريعة خطوة بخطوة", step: 0 },

  // الخطوة الأولى: معلومات الطلبة والمشرف (24.45s - 42.91s)
  { start: 24.45, end: 28.04, text: "الخطوة الأولى: معلومات الطلبة والأستاذ المشرف.", badge: "📋 الخطوة 1: معلومات الطلبة وفريق العمل والأستاذ المشرف", step: 1 },
  { start: 28.04, end: 32.93, text: "في البداية، ندخلو أسماء الطلبة المشاركين في البحث، واسم الأستاذ المشرف.", badge: "👥 إدخال أسماء الطلبة والأستاذ المشرف", step: 1 },
  { start: 32.93, end: 42.91, text: "تقدر تزيد أو تنقص عدد الطلبة حسب الحاجة، باش تكون جميع المعلومات جاهزة قبل ما ننتقلو للخطوة الموالية.", badge: "➕ مرونة تامة في ضبط عدد الطلبة والمشرف", step: 1 },

  // الخطوة الثانية: تصميم صفحة الغلاف (42.91s - 67.42s)
  { start: 42.91, end: 52.12, text: "الخطوة الثانية: تصميم صفحة الغلاف. هنا نختارو الولاية تاعنا من بين الولايات الجزائرية الثمانية والخمسين،", badge: "🏛️ الخطوة 2: تصميم الغلاف وشعارات 58 ولاية جزائرية", step: 2 },
  { start: 52.12, end: 57.69, text: "وبعدها تظهرلنا قائمة الجامعات التابعة لها، ونختارو الجامعة تاعنا.", badge: "🏫 قائمة جامعات ومدارس الولاية المختارة", step: 2 },
  { start: 57.69, end: 60.66, text: "بمجرد اختيار الجامعة، يظهر شعارها الرسمي تلقائيًا على الغلاف وبأعلى جودة.", badge: "✨ ظهور الشعار الرسمي تلقائياً بدقة فائقة", step: 2 },
  { start: 60.66, end: 64.73, text: "بعدها، ندخلو اسم الكلية والتخصص.", badge: "🎓 تحديد الكلية، المعهد والتخصص الأكاديمي", step: 2 },
  { start: 64.73, end: 67.42, text: "وتقدر كذلك تختار لون ونمط الإطار، باش تحصل على غلاف يتناسب مع الهوية الرسمية لجامعتك.", badge: "🎨 اختيار نمط ولون الإطار الأكاديمي للغلاف", step: 2 },

  // الخطوة الثالثة: إنشاء وتنسيق محتوى البحث (67.42s - 101.16s)
  { start: 67.42, end: 72.80, text: "الخطوة الثالثة: إنشاء وتنسيق محتوى البحث. هنا تبدأ الميزة الأهم!", badge: "⚡ الخطوة 3: إنشاء وتنسيق محتوى البحث", step: 3 },
  { start: 72.80, end: 80.17, text: "عندك زوج خيارات: إما تلصق مسودة بحثك الجاهزة، أو تستعمل خاصية التوليد التلقائي بالذكاء الاصطناعي.", badge: "🤖 خياران: لصق مسودة أو التوليد بالذكاء الاصطناعي", step: 3 },
  { start: 80.17, end: 92.34, text: "كل ما عليك هو كتابة عنوان موضوعك، وخلال ثوانٍ تبدأ المنصة في إنشاء خطة البحث، وصياغة المحتوى الأكاديمي، وإضافة الهوامش والإحالات، واستخراج قائمة المصادر والمراجع.", badge: "🧠 خطة بحث ذكية، محتوى أكاديمي، وهوامش تلقائية", step: 3 },
  { start: 92.34, end: 101.16, text: "والأجمل أنك تقدر تتابع عملية التوليد مباشرة، كلمة بكلمة!", badge: "✨ متابعة البث المباشر للمحتوى كلمة بكلمة", step: 3 },

  // الخطوة الرابعة: المعاينة وتحميل البحث (101.16s - 124.94s)
  { start: 101.16, end: 108.43, text: "الخطوة الرابعة والأخيرة: المعاينة وتحميل البحث. بعد ما نكملو إعداد البحث، نقدروا نعاينوه باستعمال محاكي صفحات إيه فور، ونشوفو كيفاش راح يظهر في شكله النهائي.", badge: "📄 الخطوة 4: محاكي صفحات A4 الحقيقية", step: 4 },
  { start: 108.43, end: 117.50, text: "نقدرو نتأكدو من ترقيم الصفحات، وتنظيم الهوامش والإحالات أسفل كل صفحة، دون أي تداخل في التنسيق.", badge: "🔢 ترقيم مستقل وتنظيم الهوامش أسفل كل صفحة", step: 4 },
  { start: 117.50, end: 124.94, text: "ومن بعد، بنقرة واحدة فقط، نقدروا نحملوا البحث بصيغة وورد، باش نواصلوا التعديل عليه، أو بصيغة بي دي إف، ونخليوه جاهز للطباعة والتسليم!", badge: "💾 تحميل فوري Word و PDF وتطبيق Android APK", step: 4 },

  // الخاتمة (124.94s - 138.84s)
  { start: 124.94, end: 130.81, text: "وهكذا، بأربع خطوات بسيطة، تقدر تنجز وتنسّق بحثك الجامعي بكل سهولة.", badge: "🎉 4 خطوات فقط لإنجاز بحثك الجامعي بأعلى جودة", step: 5 },
  { start: 130.81, end: 135.05, text: "بحثك... كل ما تحتاجه لإنجاز بحثك الجامعي، في مكان واحد!", badge: "🎓 «بَحْثُك»... كل ما تحتاجه في مكان واحد", step: 5 },
  { start: 135.05, end: 138.84, text: "جرّب منصة «بَحْثُك» الآن، وخلّي إنجاز بحوثك أسهل!", badge: "🚀 ابدأ الآن على منصة «بَحْثُك»", step: 5 },
];

async function run() {
  const outputDir = path.resolve('demo-recordings');
  const videoDir = path.join(outputDir, 'video');
  fs.mkdirSync(videoDir, { recursive: true });

  // تنظيف أي تسجيلات مؤقتة سابقة لتفادي تضارب الملفات
  const oldFiles = fs.readdirSync(videoDir);
  for (const f of oldFiles) {
    if (f.startsWith('page@') || f === 'bahtak_synced_recording.webm') {
      try { fs.unlinkSync(path.join(videoDir, f)); } catch {}
    }
  }

  console.log('🎬 بدء إعداد وتسجيل الفيديو المتزامن مع التعليق الصوتي الجزائري (138.84 ثانية)...');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
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
  await page.waitForTimeout(500);

  // حقن طبقة الـ Overlay التفاعلية الفاخرة + Heartbeat لضمان استمرار الرسم الحي بـ 60fps
  await page.evaluate((timeline) => {
    // 0. Heartbeat لمنع توقف متصفح كروميوم عن تصدير الإطارات
    const hb = document.createElement('div');
    hb.id = 'render-heartbeat';
    hb.style.cssText = 'position:fixed;bottom:0;right:0;width:3px;height:3px;background:red;opacity:0.01;pointer-events:none;z-index:999999999;';
    document.body.appendChild(hb);
    let hbCount = 0;
    function pulse() {
      hb.style.transform = `scale(${1 + (hbCount++ % 2) * 0.05})`;
      requestAnimationFrame(pulse);
    }
    requestAnimationFrame(pulse);

    // 1. مؤشر الماوس الافتراضي الفاخر
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.style.cssText = `
      position: fixed;
      top: 100px;
      left: 960px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.9);
      border: 2px solid #ffffff;
      box-shadow: 0 0 16px rgba(239, 68, 68, 0.8), 0 2px 8px rgba(0,0,0,0.4);
      pointer-events: none;
      z-index: 99999999;
      transform: translate(-50%, -50%);
      transition: transform 0.08s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s ease;
    `;

    // حلقة النقر (Ripple effect)
    const ripple = document.createElement('div');
    ripple.id = 'demo-cursor-ripple';
    ripple.style.cssText = `
      position: fixed;
      top: 100px;
      left: 960px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid rgba(239, 68, 68, 0.8);
      pointer-events: none;
      z-index: 99999998;
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
      transition: transform 0.4s ease-out, opacity 0.4s ease-out;
    `;
    document.body.appendChild(ripple);
    document.body.appendChild(cursor);

    window.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
      ripple.style.left = e.clientX + 'px';
      ripple.style.top = e.clientY + 'px';
    });

    window.addEventListener('mousedown', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(0.8)';
      cursor.style.background = 'rgba(16, 185, 129, 0.95)';
      ripple.style.transform = 'translate(-50%, -50%) scale(2.8)';
      ripple.style.opacity = '1';
    });

    window.addEventListener('mouseup', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      cursor.style.background = 'rgba(239, 68, 68, 0.9)';
      ripple.style.transform = 'translate(-50%, -50%) scale(3.5)';
      ripple.style.opacity = '0';
    });

    // 2. الحاوية العلوية للبادجات الذكية
    const topBar = document.createElement('div');
    topBar.id = 'demo-topbar';
    topBar.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999999;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 10px 24px;
      border-radius: 9999px;
      box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5), 0 0 20px rgba(16, 185, 129, 0.25);
      font-family: 'Tajawal', 'Cairo', system-ui, sans-serif;
      direction: rtl;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    topBar.innerHTML = `
      <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981; box-shadow:0 0 10px #10b981;"></span>
      <span id="demo-topbar-text" style="color: #ffffff; font-size: 15px; font-weight: 700; letter-spacing: 0.2px;">🌟 منصة «بَحْثُك» | إعداد وتنسيق البحوث في دقائق</span>
    `;
    document.body.appendChild(topBar);

    // 3. الحاوية السفلية للترجمة التوضيحية (الكابشن)
    const captionBox = document.createElement('div');
    captionBox.id = 'demo-caption';
    captionBox.style.cssText = `
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999999;
      pointer-events: none;
      max-width: 860px;
      width: 90%;
      background: rgba(10, 15, 29, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.24);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: 14px 28px;
      border-radius: 20px;
      box-shadow: 0 24px 50px -12px rgba(0,0,0,0.7), 0 0 30px rgba(0,0,0,0.3);
      font-family: 'Tajawal', 'Cairo', system-ui, sans-serif;
      direction: rtl;
      text-align: center;
      transition: all 0.25s ease-out;
    `;
    captionBox.innerHTML = `
      <div id="demo-caption-text" style="color: #ffffff; font-size: 18px; font-weight: 700; line-height: 1.6; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
        كيفاش تقدر تنجز وتنسّق بحثك الجامعي في دقائق، وبكل سهولة؟
      </div>
    `;
    document.body.appendChild(captionBox);

    // 4. بطاقة الخاتمة الفاخرة (Outro Card)
    const outroCard = document.createElement('div');
    outroCard.id = 'demo-outro';
    outroCard.style.cssText = `
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.97) 0%, rgba(3, 7, 18, 0.99) 100%);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      z-index: 99999990;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: 'Tajawal', 'Cairo', system-ui, sans-serif;
      direction: rtl;
      padding: 40px;
      text-align: center;
    `;
    outroCard.innerHTML = `
      <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); border-radius: 32px; padding: 48px 64px; max-width: 880px; box-shadow: 0 40px 80px rgba(0,0,0,0.7); display: flex; flex-direction: column; align-items: center; gap: 24px;">
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="width: 68px; height: 68px; border-radius: 22px; background: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(255,255,255,0.25);">
            <span style="font-size: 34px;">🎓</span>
          </div>
          <div style="text-align: right;">
            <h1 style="font-size: 44px; font-weight: 900; color: #ffffff; margin: 0; line-height: 1.1;">مَنَصّة بَحْثُك</h1>
            <p style="font-size: 17px; color: #94a3b8; margin: 4px 0 0 0; font-weight: 600;">المنصة الجزائرية الأولى لإعداد وتنسيق البحوث الجامعية</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; width: 100%; margin-top: 12px; text-align: right;">
          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 14px 20px; display: flex; align-items: center; gap: 12px;">
            <span style="color: #10b981; font-size: 22px; font-weight:bold;">✓</span>
            <span style="color: #f1f5f9; font-weight: 700; font-size: 15px;">الخطوة 1: فريق العمل والمشرف</span>
          </div>
          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 14px 20px; display: flex; align-items: center; gap: 12px;">
            <span style="color: #10b981; font-size: 22px; font-weight:bold;">✓</span>
            <span style="color: #f1f5f9; font-weight: 700; font-size: 15px;">الخطوة 2: شعارات جامعات 58 ولاية</span>
          </div>
          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 14px 20px; display: flex; align-items: center; gap: 12px;">
            <span style="color: #10b981; font-size: 22px; font-weight:bold;">✓</span>
            <span style="color: #f1f5f9; font-weight: 700; font-size: 15px;">الخطوة 3: التوليد بالذكاء الاصطناعي</span>
          </div>
          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 14px 20px; display: flex; align-items: center; gap: 12px;">
            <span style="color: #10b981; font-size: 22px; font-weight:bold;">✓</span>
            <span style="color: #f1f5f9; font-weight: 700; font-size: 15px;">الخطوة 4: محاكي A4 وتحميل Word & PDF</span>
          </div>
        </div>

        <div style="margin-top: 16px; background: linear-gradient(135deg, rgba(239,68,68,0.25), rgba(16,185,129,0.25)); border: 1px solid rgba(255,255,255,0.22); border-radius: 20px; padding: 18px 36px;">
          <p style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0;">
            بَحْثُك... كل ما تحتاجه لإنجاز بحثك الجامعي في مكان واحد! 🎯
          </p>
          <p style="font-size: 15px; color: #cbd5e1; margin: 6px 0 0 0; font-weight: 500;">
            تطبيق أندرويد APK متاح للتحميل • متوافق مع كافة الهواتف والحواسيب
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(outroCard);

    // مؤقت مزامنة الكابشن مع المقطع الصوتي
    window.__demoStartTime = performance.now();
    window.__demoTimeline = timeline;

    function updateCaptionLoop() {
      const nowSec = (performance.now() - window.__demoStartTime) / 1000;
      const current = window.__demoTimeline.find(item => nowSec >= item.start && nowSec < item.end);
      
      const topText = document.getElementById('demo-topbar-text');
      const capText = document.getElementById('demo-caption-text');
      const outro = document.getElementById('demo-outro');

      if (current) {
        if (topText && topText.textContent !== current.badge) topText.textContent = current.badge;
        if (capText && capText.textContent !== current.text) capText.textContent = current.text;
      }

      // إظهار شاشة الخاتمة في آخر مشهد
      if (nowSec >= 124.94 && outro) {
        outro.style.opacity = '1';
        outro.style.pointerEvents = 'auto';
      }

      requestAnimationFrame(updateCaptionLoop);
    }
    requestAnimationFrame(updateCaptionLoop);
  }, SCRIPT_TIMELINE);

  // دالة مساعدة لتحريك مؤشر الماوس بنعومة
  async function smoothMouseMove(targetX, targetY, steps = 25) {
    await page.mouse.move(targetX, targetY, { steps });
  }

  // ساعة البدء العالمية
  const globalStart = Date.now();
  async function waitUntilSecond(targetSec) {
    while ((Date.now() - globalStart) / 1000 < targetSec) {
      await page.waitForTimeout(100);
    }
  }

  // =========================================================================
  // المشهد 1: المقدمة والواجهة الرئيسية والكرة الأرضية (0.00s - 24.45s)
  // =========================================================================
  console.log('▶️ 00:00 - 00:24 | المشهد 1: الواجهة الرئيسية والكرة الأرضية والتقييمات...');
  
  await smoothMouseMove(960, 300, 25);
  await page.waitForTimeout(2000);
  await smoothMouseMove(600, 380, 25);
  await page.waitForTimeout(2000);

  // التمرير السلس نحو الأسفل لعرض الكرة الأرضية ثلاثية الأبعاد
  console.log('   استعراض الكرة الأرضية 3D والتقييمات...');
  await page.evaluate(() => window.scrollBy({ top: 620, behavior: 'smooth' }));
  await page.waitForTimeout(2000);
  await smoothMouseMove(960, 680, 30);
  await page.waitForTimeout(3500);
  await smoothMouseMove(720, 620, 25);
  await page.waitForTimeout(3500);

  // التمرير للعودة إلى أعلى الصفحة للاستعداد للنقر على زر البدء
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(2000);

  // تحريك الماوس نحو زر "ابدأ الآن"
  const startBtn = page.locator('button:has-text("ابدأ الآن"), button:has-text("ابدأ")').first();
  const startBtnBox = await startBtn.boundingBox();
  if (startBtnBox) {
    await smoothMouseMove(startBtnBox.x + startBtnBox.width / 2, startBtnBox.y + startBtnBox.height / 2, 30);
  }
  
  // الانتظار حتى ثانية البدء للخطوة 1 (24.0 ثانية)
  await waitUntilSecond(24.0);

  console.log('   النقر على زر بدء إعداد البحث...');
  await startBtn.click();
  await page.waitForTimeout(1000);

  // =========================================================================
  // المشهد 2: الخطوة 1 - معلومات الطلبة والأستاذ المشرف (24.45s - 42.91s)
  // =========================================================================
  console.log('▶️ 00:24 - 00:42 | المشهد 2: الخطوة 1 - معلومات الطلبة والأستاذ المشرف...');
  
  // التركيز على حقل أسماء الطلبة
  const studentsArea = page.locator('textarea').first();
  const studentsBox = await studentsArea.boundingBox();
  if (studentsBox) {
    await smoothMouseMove(studentsBox.x + studentsBox.width / 2, studentsBox.y + studentsBox.height / 2, 25);
  }
  await studentsArea.click();
  await studentsArea.fill('الطالب: محمد بن علي\nالطالبة: أمينة قاسمي');
  await page.waitForTimeout(3000);

  // الانتقال للأستاذ المشرف
  const supervisorInput = page.locator('input[placeholder*="الأستاذ"]').first();
  const supBox = await supervisorInput.boundingBox();
  if (supBox) {
    await smoothMouseMove(supBox.x + supBox.width / 2, supBox.y + supBox.height / 2, 25);
  }
  await supervisorInput.click();
  await supervisorInput.fill('د. عبد القادر بوجمعة');
  await page.waitForTimeout(3000);

  // توضيح مرونة إضافة أو إنقاص الطلبة
  await studentsArea.fill('الطالب: محمد بن علي\nالطالبة: أمينة قاسمي\nالطالب: يوسف بلحاج');
  await page.waitForTimeout(2500);
  await studentsArea.fill('الطالب: محمد بن علي\nالطالبة: أمينة قاسمي');
  
  // الانتظار حتى بداية الخطوة 2 (42.91s)
  await waitUntilSecond(42.91);

  // =========================================================================
  // المشهد 3: الخطوة 2 - تصميم صفحة الغلاف والـ 58 ولاية (42.91s - 67.42s)
  // =========================================================================
  console.log('▶️ 00:42 - 01:07 | المشهد 3: الخطوة 2 - صفحة الغلاف وشعارات الجامعات (58 ولاية)...');

  // التمرير نحو قسم الجامعة والشعار
  await page.evaluate(() => {
    const el = document.querySelector('select');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(1500);

  // اختيار الولاية (الجزائر العاصمة - alger)
  const wilayaSelect = page.locator('select').first();
  const wilayaBox = await wilayaSelect.boundingBox();
  if (wilayaBox) {
    await smoothMouseMove(wilayaBox.x + wilayaBox.width / 2, wilayaBox.y + wilayaBox.height / 2, 25);
  }
  await wilayaSelect.selectOption({ value: 'alger' });
  await page.waitForTimeout(3000);

  // اختيار الجامعة (جامعة العلوم والتكنولوجيا هواري بومدين USTHB)
  const univSelect = page.locator('select').nth(1);
  const univBox = await univSelect.boundingBox();
  if (univBox) {
    await smoothMouseMove(univBox.x + univBox.width / 2, univBox.y + univBox.height / 2, 25);
  }
  await univSelect.selectOption({ value: 'usthb' });
  await page.waitForTimeout(3500);

  // كتابة الكلية والتخصص
  const facultyInput = page.locator('input[placeholder*="كلية"], input[placeholder*="الحقوق"]').first();
  if (await facultyInput.isVisible()) {
    const facBox = await facultyInput.boundingBox();
    if (facBox) await smoothMouseMove(facBox.x + facBox.width / 2, facBox.y + facBox.height / 2, 25);
    await facultyInput.fill('كلية الإعلام الآلي والذكاء الاصطناعي');
  }
  await page.waitForTimeout(3000);

  // تجربة تبديل ثيم ونمط الإطار (ذهبي ملكي / كلاسيكي)
  const themeCard = page.locator('button:has-text("ذهبي"), button:has-text("ملكي")').first();
  if (await themeCard.isVisible()) {
    const tBox = await themeCard.boundingBox();
    if (tBox) await smoothMouseMove(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, 25);
    await themeCard.click();
    await page.waitForTimeout(2500);
  }

  // التمرير إلى زر التالي
  const nextBtn1 = page.locator('button:has-text("التالي")').last();
  const next1Box = await nextBtn1.boundingBox();
  if (next1Box) {
    await smoothMouseMove(next1Box.x + next1Box.width / 2, next1Box.y + next1Box.height / 2, 30);
  }
  
  // الانتظار حتى بداية الخطوة 3 (67.42s)
  await waitUntilSecond(67.0);
  await nextBtn1.click();
  await page.waitForTimeout(1000);

  // =========================================================================
  // المشهد 4: الخطوة 3 - إنشاء وتنسيق محتوى البحث بالذكاء الاصطناعي (67.42s - 101.16s)
  // =========================================================================
  console.log('▶️ 01:07 - 01:37 | المشهد 4: الخطوة 3 - إنشاء وتنسيق محتوى البحث بالذكاء الاصطناعي...');

  // إظهار خياري: لصق مسودة أو التوليد بالذكاء الاصطناعي
  await smoothMouseMove(500, 360, 25);
  await page.waitForTimeout(3000);

  // اختيار توليد بالذكاء الاصطناعي
  const aiOptionBtn = page.locator('button:has-text("توليد بالذكاء الاصطناعي")').first();
  if (await aiOptionBtn.isVisible()) {
    const aiBox = await aiOptionBtn.boundingBox();
    if (aiBox) await smoothMouseMove(aiBox.x + aiBox.width / 2, aiBox.y + aiBox.height / 2, 25);
    await aiOptionBtn.click();
    await page.waitForTimeout(3000);
  }

  // كتابة عنوان البحث
  const topicInput = page.locator('input[placeholder*="عنوان"], textarea[placeholder*="عنوان"], input[type="text"]').first();
  if (await topicInput.isVisible()) {
    const tBox = await topicInput.boundingBox();
    if (tBox) await smoothMouseMove(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, 25);
    await topicInput.fill('الذكاء الاصطناعي وتطبيقاته في البحث العلمي والتعليم العالي');
    await page.waitForTimeout(3500);
  }

  // التبديل لزر لصق نص مسودة جاهز وتطبيق النموذج الأكاديمي الشامل
  const pasteOptionBtn = page.locator('button:has-text("لصق نص مسودة جاهز")').first();
  if (await pasteOptionBtn.isVisible()) {
    const pBox = await pasteOptionBtn.boundingBox();
    if (pBox) await smoothMouseMove(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, 25);
    await pasteOptionBtn.click();
    await page.waitForTimeout(2000);
  }

  // تفعيل محتوى البحث الأكاديمي مع الهوامش التلقائية والمراجع
  console.log('   تفعيل محتوى البحث الأكاديمي مع الهوامش التلقائية والمراجع...');
  const demoTextBtn = page.locator('button:has-text("تجربة بنص تجريبي")').first();
  if (await demoTextBtn.isVisible()) {
    const dtBox = await demoTextBtn.boundingBox();
    if (dtBox) await smoothMouseMove(dtBox.x + dtBox.width / 2, dtBox.y + dtBox.height / 2, 25);
    await demoTextBtn.click();
    await page.waitForTimeout(2500);
  }

  // النقر على زر التحليل والتوليد الذكي
  const parseBtn = page.locator('button:has-text("تحليل النص")').first();
  if (await parseBtn.isVisible()) {
    const pBox = await parseBtn.boundingBox();
    if (pBox) await smoothMouseMove(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, 25);
    await parseBtn.click();
    await page.waitForTimeout(3500);
  }

  // تحريك الماوس لاستعراض بث وتوليد المحتوى مباشرة كلمة بكلمة
  await smoothMouseMove(1300, 480, 30);
  await page.waitForTimeout(4000);

  // الانتظار حتى ثانية الانتقال للخطوة 4 (100.5s)
  await waitUntilSecond(100.5);

  // الانتقال للخطوة 4: المعاينة والإنهاء
  console.log('   الانتقال المباشر والسلس إلى الخطوة 4: المعاينة والإنهاء...');
  
  // 1. التمرير للأعلى أولاً لضمان ظهور شريط التبويبات العلوي بالكامل
  await page.evaluate(() => {
    const main = document.querySelector('main[aria-label="معالج إعداد وتنسيق البحث"]') || document.documentElement;
    if (main.scrollTo) main.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  await page.waitForTimeout(400);

  // 2. النقر على تبويب الخطوة 4 (المعاينة والإنهاء)
  const stepTabs = page.locator('div[role="tablist"] button');
  const step4Btn = stepTabs.nth(3);
  if (await step4Btn.isVisible()) {
    const s4Box = await step4Btn.boundingBox();
    if (s4Box) await smoothMouseMove(s4Box.x + s4Box.width / 2, s4Box.y + s4Box.height / 2, 20);
    await step4Btn.click();
  } else {
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('div[role="tablist"] button');
      if (tabs[3]) tabs[3].click();
    });
  }
  await page.waitForTimeout(1000);

  // =========================================================================
  // المشهد 5: الخطوة 4 - المعاينة الحية لورقة A4 وتحميل Word و PDF و APK (101.16s - 124.94s)
  // =========================================================================
  console.log('▶️ 01:37 - 02:05 | المشهد 5: الخطوة 4 - محاكي A4 الحقيقي والهوامش والتصدير و APK...');

  // 1. التمرير في نافذة المعالج لإبراز مسرح ورقة A4
  await page.evaluate(() => {
    const stage = document.querySelector('.doc-stage');
    if (stage) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(1000);

  // تحريك الماوس إلى ورقة A4 وتكبير العرض قليلاً لإبراز جودة التنسيق
  await smoothMouseMove(1100, 480, 25);
  const zoomInBtn = page.locator('button[title="تكبير"]').first();
  if (await zoomInBtn.isVisible()) {
    const zBox = await zoomInBtn.boundingBox();
    if (zBox) await smoothMouseMove(zBox.x + zBox.width / 2, zBox.y + zBox.height / 2, 15);
    await zoomInBtn.click();
    await page.waitForTimeout(600);
  }

  // 2. التمرير داخل مسرح ورقة A4 لاستعراض الهوامش المنظمة وترقيم الصفحات
  console.log('   استعراض الهوامش المنظمة وترقيم الصفحات أسفل ورقة A4...');
  await page.evaluate(() => {
    const stageContainer = document.querySelector('.doc-stage')?.parentElement;
    if (stageContainer) stageContainer.scrollBy({ top: 480, behavior: 'smooth' });
  });
  await smoothMouseMove(1050, 680, 25);
  await page.waitForTimeout(3500);

  // 3. التمرير للأعلى للتركيز على أزرار التصدير والطباعة (Word و PDF)
  console.log('   التركيز على أزرار تصدير Word و PDF...');
  await page.evaluate(() => {
    const main = document.querySelector('main[aria-label="معالج إعداد وتنسيق البحث"]') || document.documentElement;
    if (main.scrollTo) main.scrollTo({ top: 80, behavior: 'smooth' });
  });
  await page.waitForTimeout(800);

  // تحريك الماوس إلى زر تحميل Word
  const wordBtn = page.locator('button:has-text("Word"), button:has-text("وورد")').first();
  if (await wordBtn.isVisible()) {
    const wBox = await wordBtn.boundingBox();
    if (wBox) await smoothMouseMove(wBox.x + wBox.width / 2, wBox.y + wBox.height / 2, 25);
  }
  await page.waitForTimeout(2500);

  // تحريك الماوس إلى زر حفظ وطباعة PDF
  const pdfBtn = page.locator('button:has-text("PDF"), button:has-text("طباعة")').first();
  if (await pdfBtn.isVisible()) {
    const pdfBox = await pdfBtn.boundingBox();
    if (pdfBox) await smoothMouseMove(pdfBox.x + pdfBox.width / 2, pdfBox.y + pdfBox.height / 2, 25);
  }
  await page.waitForTimeout(2500);

  // 4. استعراض بطاقة تطبيق الأندرويد الرسمي APK
  console.log('   التركيز على بطاقة تطبيق الأندرويد الرسمي APK...');
  await page.evaluate(() => {
    const apkCard = document.querySelector('a[download="Bahtak.apk"]');
    if (apkCard) apkCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(800);

  const apkBtn = page.locator('a[download="Bahtak.apk"]').first();
  if (await apkBtn.isVisible()) {
    const aBox = await apkBtn.boundingBox();
    if (aBox) await smoothMouseMove(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2, 25);
  }
  
  // الانتظار حتى بداية الخاتمة (124.94s)
  await waitUntilSecond(124.94);

  // =========================================================================
  // المشهد 6: الخاتمة والدعوة للتجربة (124.94s - 138.84s)
  // =========================================================================
  console.log('▶️ 02:05 - 02:18 | المشهد 6: بطاقة الخاتمة والخطوات الأربع وشعار المنصة...');
  await smoothMouseMove(960, 540, 40);
  
  // الانتظار حتى نهاية الصوت بالضبط (139.0s)
  await waitUntilSecond(139.0);

  console.log('💾 حفظ وإنهاء جلسة الفيديو...');
  await page.waitForTimeout(500);

  const videoPromise = page.video();
  const videoPath = videoPromise ? await videoPromise.path() : null;

  // إغلاق المتصفح لإنهاء ملف الفيديو المكتوب
  await context.close();
  await browser.close();

  const finalWebm = path.join(videoDir, 'bahtak_synced_recording.webm');
  if (videoPath && fs.existsSync(videoPath)) {
    if (fs.existsSync(finalWebm)) fs.unlinkSync(finalWebm);
    fs.renameSync(videoPath, finalWebm);
    console.log(`\n🎉 تم حفظ الفيديو المتزامن الخام بنجاح: ${finalWebm}`);
  } else {
    const files = fs.readdirSync(videoDir);
    const recorded = files.find(f => f.endsWith('.webm') && f !== 'bahtak_full_feature_demo.webm' && f !== 'bahtak_synced_recording.webm');
    if (recorded) {
      if (fs.existsSync(finalWebm)) fs.unlinkSync(finalWebm);
      fs.renameSync(path.join(videoDir, recorded), finalWebm);
      console.log(`\n🎉 تم حفظ الفيديو المتزامن الخام بنجاح: ${finalWebm}`);
    }
  }
}

run().catch(err => {
  console.error('حدث خطأ أثناء التسجيل المتزامن:', err);
  process.exit(1);
});
