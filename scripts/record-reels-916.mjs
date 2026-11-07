import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// جدول التوقيت الدقيق المتطابق مع التعليق الصوتي الجزائري (138.84 ثانية)
const SCRIPT_TIMELINE = [
  // المقدمة (0.00s - 24.45s)
  { start: 0.00, end: 5.48, text: "كيفاش تقدر تنجز وتنسّق بحثك الجامعي في دقائق، وبكل سهولة؟", badge: "🎓 منصة «بَحْثُك» | إنجاز البحوث في دقائق", step: 0 },
  { start: 5.48, end: 9.38, text: "مع منصة «بَحْثُك»، كل شيء ولى أسهل!", badge: "🇩🇿 المنصة الجزائرية الأولى للبحوث الجامعية", step: 0 },
  { start: 9.38, end: 15.65, text: "أول حاجة، ندخلو لموقع أو تطبيق بحثك، ومن الواجهة الرئيسية نبدأو رحلة إنشاء بحثنا الجامعي.", badge: "🚀 الواجهة الرئيسية لتطبيق «بَحْثُك»", step: 0 },
  { start: 15.65, end: 21.05, text: "المنصة توفرلنا أربع خطوات بسيطة، من إدخال المعلومات حتى تحميل البحث النهائي.", badge: "📋 4 خطوات ذكية من الفكرة حتى الطباعة", step: 0 },
  { start: 21.05, end: 24.45, text: "خلّينا نشوفو كيفاش نخدمو بيها خطوة بخطوة!", badge: "✨ استعراض خطوات العمل خطوة بخطوة", step: 0 },

  // الخطوة الأولى: معلومات الطلبة والأستاذ المشرف (24.45s - 42.91s)
  { start: 24.45, end: 29.56, text: "الخطوة الأولى: معلومات الطلبة والأستاذ المشرف.", badge: "👥 الخطوة 1: بيانات الطلبة والمشرف", step: 1 },
  { start: 29.56, end: 35.04, text: "في البداية، ندخلو أسماء الطلبة المشاركين في البحث، واسم الأستاذ المشرف.", badge: "✍️ إدخال أسماء فريق العمل والأستاذ المشرف", step: 1 },
  { start: 35.04, end: 42.91, text: "تقدر تزيد أو تنقص عدد الطلبة حسب الحاجة، باش تكون جميع المعلومات جاهزة قبل ما ننتقلو للخطوة الموالية.", badge: "🔄 مرونة تامة في إضافة وتعديل الطلبة", step: 1 },

  // الخطوة الثانية: تصميم صفحة الغلاف وشعارات 58 ولاية (42.91s - 67.42s)
  { start: 42.91, end: 52.12, text: "الخطوة الثانية: تصميم صفحة الغلاف. هنا نختارو الولاية تاعنا من بين الولايات الجزائرية الثمانية والخمسين،", badge: "🏛️ الخطوة 2: تصميم الغلاف وشعارات 58 ولاية", step: 2 },
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

  // تنظيف أي تسجيلات رأسية مؤقتة سابقة
  const oldFiles = fs.readdirSync(videoDir);
  for (const f of oldFiles) {
    if (f.startsWith('reels_raw') || f === 'bahtak_reels_synced.webm') {
      try { fs.unlinkSync(path.join(videoDir, f)); } catch {}
    }
  }

  console.log('📱🎬 بدء تسجيل فيديو ريلز إنستغرام عمودي (9:16) متزامن مع الصوت الجزائري...');

  const browser = await chromium.launch({
    headless: true,
  });

  // إعداد سياق الهاتف الذكي بمقاس 9:16 (540x960) مع ملء الشاشة بالكامل
  const context = await browser.newContext({
    viewport: { width: 540, height: 960 },
    locale: 'ar-DZ',
    recordVideo: {
      dir: videoDir,
      size: { width: 540, height: 960 },
    },
  });

  const page = await context.newPage();
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  // تنظيف localStorage لتبدأ الجلسة نظيفة من صفحة الهبوط
  await page.goto('http://localhost:8443/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // حقن طبقة الـ Overlay الخاصة بإنستغرام ريلز + مؤشر اللمس التفاعلي
  await page.evaluate((timeline) => {
    // 0. Heartbeat لمنع توقف المحرك عن التصدير
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

    // 1. مؤشر اللمس الافتراضي للهواتف الذكية (Touch Finger Ring)
    const cursor = document.createElement('div');
    cursor.id = 'demo-touch-cursor';
    cursor.style.cssText = `
      position: fixed;
      top: 150px;
      left: 270px;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.8) 100%);
      border: 2.5px solid #ffffff;
      box-shadow: 0 0 16px rgba(239, 68, 68, 0.9), 0 4px 12px rgba(0,0,0,0.5);
      pointer-events: none;
      z-index: 99999999;
      transform: translate(-50%, -50%);
      transition: transform 0.08s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
    `;

    // حلقة النقر اللمسي (Touch Ripple)
    const ripple = document.createElement('div');
    ripple.id = 'demo-touch-ripple';
    ripple.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 14px rgba(239, 68, 68, 0.8);
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.35s ease-out, opacity 0.35s ease-out;
    `;
    cursor.appendChild(ripple);
    document.body.appendChild(cursor);

    // مزامنة حركة المؤشر والنقر
    window.__moveCursor = (x, y) => {
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
    };

    window.__touchTap = () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(0.85)';
      ripple.style.transition = 'none';
      ripple.style.transform = 'translate(-50%, -50%) scale(1)';
      ripple.style.opacity = '1';
      setTimeout(() => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        ripple.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
        ripple.style.transform = 'translate(-50%, -50%) scale(2.2)';
        ripple.style.opacity = '0';
      }, 70);
    };

    document.addEventListener('mousemove', (e) => window.__moveCursor(e.clientX, e.clientY));
    document.addEventListener('mousedown', () => window.__touchTap());

    // 2. الشريط العلوي الذكي لريلز إنستغرام
    const topBar = document.createElement('div');
    topBar.id = 'demo-topbar-reels';
    topBar.style.cssText = `
      position: fixed;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999999;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(10, 15, 29, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.22);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 7px 18px;
      border-radius: 9999px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 15px rgba(16, 185, 129, 0.25);
      font-family: 'Tajawal', 'Cairo', system-ui, sans-serif;
      direction: rtl;
      max-width: 92%;
      white-space: nowrap;
    `;
    topBar.innerHTML = `
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981;"></span>
      <span id="demo-topbar-text" style="color: #ffffff; font-size: 12.5px; font-weight: 800;">🇩🇿 منصة «بَحْثُك» | إعداد البحوث في دقائق</span>
    `;
    document.body.appendChild(topBar);

    // 3. كابشن ريلز إنستغرام الاحترافي (Reels Caption Pill)
    // موضوع في المنطقة الآمنة فوق شريط إنستغرام السفلي (bottom: 110px)
    const captionBox = document.createElement('div');
    captionBox.id = 'demo-caption-reels';
    captionBox.style.cssText = `
      position: fixed;
      bottom: 95px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999999;
      pointer-events: none;
      width: 90%;
      max-width: 480px;
      background: rgba(8, 12, 24, 0.95);
      border: 1.5px solid rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: 12px 18px;
      border-radius: 20px;
      box-shadow: 0 15px 40px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.4);
      font-family: 'Tajawal', 'Cairo', system-ui, sans-serif;
      direction: rtl;
      text-align: center;
      transition: all 0.2s ease-out;
    `;
    captionBox.innerHTML = `
      <div id="demo-caption-text" style="color: #ffffff; font-size: 14.5px; font-weight: 800; line-height: 1.5; text-shadow: 0 2px 4px rgba(0,0,0,0.6);">
        كيفاش تقدر تنجز وتنسّق بحثك الجامعي في دقائق، وبكل سهولة؟
      </div>
    `;
    document.body.appendChild(captionBox);

    // 4. بطاقة الخاتمة لريلز إنستغرام (Outro Reels Card)
    const outroCard = document.createElement('div');
    outroCard.id = 'demo-outro-reels';
    outroCard.style.cssText = `
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.98) 0%, rgba(3, 7, 18, 0.99) 100%);
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
      padding: 24px;
      text-align: center;
    `;
    outroCard.innerHTML = `
      <div style="background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.2); border-radius: 28px; padding: 32px 24px; width: 100%; max-width: 440px; box-shadow: 0 30px 60px rgba(0,0,0,0.8); display: flex; flex-direction: column; align-items: center; gap: 20px;">
        <div style="width: 72px; height: 72px; border-radius: 22px; background: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(255,255,255,0.25);">
          <span style="font-size: 38px;">🎓</span>
        </div>
        
        <div>
          <h1 style="font-size: 36px; font-weight: 900; color: #ffffff; margin: 0; line-height: 1.2;">مَنَصّة بَحْثُك</h1>
          <p style="font-size: 15px; color: #94a3b8; margin: 6px 0 0 0; font-weight: 600;">المنصة الجزائرية الأولى لإعداد وتنسيق البحوث</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; text-align: right;">
          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
            <span style="color: #10b981; font-size: 18px; font-weight:bold;">✓</span>
            <span style="color: #f1f5f9; font-weight: 700; font-size: 13.5px;">الخطوة 1: فريق العمل والمشرف</span>
          </div>
          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
            <span style="color: #10b981; font-size: 18px; font-weight:bold;">✓</span>
            <span style="color: #f1f5f9; font-weight: 700; font-size: 13.5px;">الخطوة 2: شعارات جامعات 58 ولاية</span>
          </div>
          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
            <span style="color: #10b981; font-size: 18px; font-weight:bold;">✓</span>
            <span style="color: #f1f5f9; font-weight: 700; font-size: 13.5px;">الخطوة 3: التوليد بالذكاء الاصطناعي</span>
          </div>
          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
            <span style="color: #10b981; font-size: 18px; font-weight:bold;">✓</span>
            <span style="color: #f1f5f9; font-weight: 700; font-size: 13.5px;">الخطوة 4: محاكي A4 وتحميل Word & PDF</span>
          </div>
        </div>

        <div style="width: 100%; background: linear-gradient(135deg, rgba(239,68,68,0.3), rgba(16,185,129,0.3)); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 18px; padding: 14px 20px;">
          <p style="font-size: 17px; font-weight: 800; color: #ffffff; margin: 0;">
            بَحْثُك... كل ما تحتاجه في مكان واحد! 🎯
          </p>
          <p style="font-size: 13px; color: #38bdf8; margin: 4px 0 0 0; font-weight: 700;">
            🔗 الرابط في البايو • تطبيق Android APK متاح
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
      const outro = document.getElementById('demo-outro-reels');

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

  // دالة مساعدة لتحريك مؤشر اللمس بنعومة
  async function smoothTouchMove(targetX, targetY, steps = 20) {
    await page.mouse.move(targetX, targetY, { steps });
  }

  // ساعة البدء العالمية
  const globalStart = Date.now();
  async function waitUntilSecond(targetSec) {
    while ((Date.now() - globalStart) / 1000 < targetSec) {
      await page.waitForTimeout(80);
    }
  }

  // =========================================================================
  // المشهد 1: المقدمة والواجهة الرئيسية (0.00s - 24.45s)
  // =========================================================================
  console.log('▶️ 00:00 - 00:24 | المشهد 1 (ريلز): الواجهة الرئيسية والتقييمات...');
  
  await smoothTouchMove(270, 320, 20);
  await page.waitForTimeout(2000);
  await smoothTouchMove(200, 420, 20);
  await page.waitForTimeout(2000);

  // التمرير السلس للأسفل لعرض التقييمات
  console.log('   استعراض التقييمات وآراء الطلبة...');
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(2000);
  await smoothTouchMove(270, 520, 20);
  await page.waitForTimeout(3500);

  // التمرير للعودة إلى زر "ابدأ الآن"
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(2000);

  const startBtn = page.locator('button:has-text("ابدأ الآن"), button:has-text("ابدأ")').first();
  const startBox = await startBtn.boundingBox();
  if (startBox) {
    await smoothTouchMove(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2, 20);
  }

  // الانتظار حتى ثانية البدء للخطوة 1 (24.0 ثانية)
  await waitUntilSecond(24.0);

  console.log('   النقر على زر ابدأ الآن...');
  await startBtn.click();
  await page.waitForTimeout(1000);

  // =========================================================================
  // المشهد 2: الخطوة 1 - معلومات الطلبة والأستاذ المشرف (24.45s - 42.91s)
  // =========================================================================
  console.log('▶️ 00:24 - 00:42 | المشهد 2 (ريلز): الخطوة 1 - معلومات الطلبة والمشرف...');

  // إدخال أسماء الطلبة
  const studentsArea = page.locator('textarea').first();
  const sBox = await studentsArea.boundingBox();
  if (sBox) await smoothTouchMove(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2, 20);
  await studentsArea.click();
  await studentsArea.fill('الطالب: محمد بن علي\nالطالبة: أمينة قاسمي');
  await page.waitForTimeout(3000);

  // إدخال اسم الأستاذ المشرف
  const supInput = page.locator('input[placeholder*="الأستاذ"]').first();
  const supBox = await supInput.boundingBox();
  if (supBox) await smoothTouchMove(supBox.x + supBox.width / 2, supBox.y + supBox.height / 2, 20);
  await supInput.click();
  await supInput.fill('د. عبد القادر بوجمعة');
  await page.waitForTimeout(3000);

  // إبراز مرونة الإضافة
  await studentsArea.fill('الطالب: محمد بن علي\nالطالبة: أمينة قاسمي\nالطالب: يوسف بلحاج');
  await page.waitForTimeout(2500);
  await studentsArea.fill('الطالب: محمد بن علي\nالطالبة: أمينة قاسمي');

  // الانتظار حتى بداية الخطوة 2 (42.91s)
  await waitUntilSecond(42.91);

  // =========================================================================
  // المشهد 3: الخطوة 2 - صفحة الغلاف والـ 58 ولاية (42.91s - 67.42s)
  // =========================================================================
  console.log('▶️ 00:42 - 01:07 | المشهد 3 (ريلز): الخطوة 2 - صفحة الغلاف و 58 ولاية وشعار USTHB...');

  // التمرير نحو قسم الجامعة والشعار
  await page.evaluate(() => {
    const el = document.querySelector('select');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(1500);

  // اختيار الولاية (الجزائر العاصمة)
  const wilayaSelect = page.locator('select').first();
  const wBox = await wilayaSelect.boundingBox();
  if (wBox) await smoothTouchMove(wBox.x + wBox.width / 2, wBox.y + wBox.height / 2, 20);
  await wilayaSelect.selectOption({ value: 'alger' });
  await page.waitForTimeout(3000);

  // اختيار الجامعة (جامعة العلوم والتكنولوجيا هواري بومدين USTHB)
  const univSelect = page.locator('select').nth(1);
  const uBox = await univSelect.boundingBox();
  if (uBox) await smoothTouchMove(uBox.x + uBox.width / 2, uBox.y + uBox.height / 2, 20);
  await univSelect.selectOption({ value: 'usthb' });
  await page.waitForTimeout(3500);

  // كتابة الكلية والتخصص
  const facultyInput = page.locator('input[placeholder*="كلية"], input[placeholder*="الحقوق"]').first();
  if (await facultyInput.isVisible()) {
    const fBox = await facultyInput.boundingBox();
    if (fBox) await smoothTouchMove(fBox.x + fBox.width / 2, fBox.y + fBox.height / 2, 20);
    await facultyInput.fill('كلية الإعلام الآلي والذكاء الاصطناعي');
  }
  await page.waitForTimeout(2500);

  // اختيار النمط الذهبي الملكي
  const themeCard = page.locator('button:has-text("ذهبي"), button:has-text("ملكي")').first();
  if (await themeCard.isVisible()) {
    const tBox = await themeCard.boundingBox();
    if (tBox) await smoothTouchMove(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, 20);
    await themeCard.click();
    await page.waitForTimeout(2500);
  }

  // التمرير إلى زر التالي
  const nextBtn1 = page.locator('button:has-text("التالي")').last();
  const next1Box = await nextBtn1.boundingBox();
  if (next1Box) {
    await smoothTouchMove(next1Box.x + next1Box.width / 2, next1Box.y + next1Box.height / 2, 25);
  }

  // الانتظار حتى بداية الخطوة 3 (67.42s)
  await waitUntilSecond(67.0);
  await nextBtn1.click();
  await page.waitForTimeout(1000);

  // =========================================================================
  // المشهد 4: الخطوة 3 - إنشاء وتنسيق محتوى البحث (67.42s - 101.16s)
  // =========================================================================
  console.log('▶️ 01:07 - 01:37 | المشهد 4 (ريلز): الخطوة 3 - التوليد بالذكاء الاصطناعي والمحتوى...');

  // تجربة خيار الذكاء الاصطناعي
  const aiOption = page.locator('button:has-text("توليد بالذكاء الاصطناعي")').first();
  if (await aiOption.isVisible()) {
    const aiBox = await aiOption.boundingBox();
    if (aiBox) await smoothTouchMove(aiBox.x + aiBox.width / 2, aiBox.y + aiBox.height / 2, 20);
    await aiOption.click();
    await page.waitForTimeout(2500);
  }

  // كتابة عنوان البحث
  const topicInput = page.locator('input[placeholder*="عنوان"], textarea[placeholder*="عنوان"], input[type="text"]').first();
  if (await topicInput.isVisible()) {
    const tBox = await topicInput.boundingBox();
    if (tBox) await smoothTouchMove(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, 20);
    await topicInput.fill('الذكاء الاصطناعي وتطبيقاته في البحث العلمي والتعليم العالي');
    await page.waitForTimeout(3000);
  }

  // التبديل إلى خيار لصق مسودة وتحليل النص بنموذج تجريبي
  const pasteOption = page.locator('button:has-text("لصق نص مسودة جاهز")').first();
  if (await pasteOption.isVisible()) {
    const pBox = await pasteOption.boundingBox();
    if (pBox) await smoothTouchMove(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, 20);
    await pasteOption.click();
    await page.waitForTimeout(2000);
  }

  const demoBtn = page.locator('button:has-text("تجربة بنص تجريبي")').first();
  if (await demoBtn.isVisible()) {
    const dBox = await demoBtn.boundingBox();
    if (dBox) await smoothTouchMove(dBox.x + dBox.width / 2, dBox.y + dBox.height / 2, 20);
    await demoBtn.click();
    await page.waitForTimeout(2500);
  }

  const parseBtn = page.locator('button:has-text("تحليل النص")').first();
  if (await parseBtn.isVisible()) {
    const pbBox = await parseBtn.boundingBox();
    if (pbBox) await smoothTouchMove(pbBox.x + pbBox.width / 2, pbBox.y + pbBox.height / 2, 20);
    await parseBtn.click();
    await page.waitForTimeout(3500);
  }

  // إخفاء أي تنبيهات Toasts بنعومة عبر opacity دون مس شجرة React
  await page.evaluate(() => {
    document.querySelectorAll('[role="status"]').forEach(t => {
      t.style.opacity = '0';
      t.style.pointerEvents = 'none';
    });
  });

  // الانتظار حتى ثانية الانتقال للخطوة 4 (100.5s)
  await waitUntilSecond(100.5);

  // =========================================================================
  // المشهد 5: الخطوة 4 - المعاينة الحية لورقة A4 وتحميل Word و PDF و APK (101.16s - 124.94s)
  // =========================================================================
  console.log('▶️ 01:37 - 02:05 | المشهد 5 (ريلز): الخطوة 4 - محاكي A4 الحقيقي والهوامش والتصدير...');

  // التمرير السريع للأعلى للانتقال إلى التبويب الرابع (المعاينة والإنهاء)
  await page.evaluate(() => {
    const main = document.querySelector('main[aria-label="معالج إعداد وتنسيق البحث"]') || document.documentElement;
    if (main.scrollTo) main.scrollTo({ top: 0, behavior: 'smooth' });
    const tabs = document.querySelectorAll('div[role="tablist"] button');
    if (tabs[3]) tabs[3].click();
  });
  await page.waitForTimeout(1000);

  // ضبط تكبير محاكي A4 ليتناسب تماماً وبدقة فائقة مع شاشة الهاتف 9:16
  await page.evaluate(() => {
    const stage = document.querySelector('.doc-stage');
    if (stage) stage.style.zoom = '0.52';
    // التمرير لإبراز الورقة مباشرة في المنتصف
    const stageContainer = document.querySelector('.doc-stage')?.parentElement;
    if (stageContainer) stageContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(1500);

  // تحريك المؤشر لاستعراض الورقة وترقيم الصفحات
  await smoothTouchMove(270, 480, 25);
  await page.waitForTimeout(3000);

  // التمرير داخل مسرح الورقة لإظهار الهوامش المنظمة أسفل الصفحة
  console.log('   استعراض الهوامش المنظمة أسفل ورقة A4...');
  await page.evaluate(() => {
    const stageContainer = document.querySelector('.doc-stage')?.parentElement;
    if (stageContainer) stageContainer.scrollBy({ top: 400, behavior: 'smooth' });
  });
  await smoothTouchMove(270, 580, 25);
  await page.waitForTimeout(3500);

  // التمرير للأعلى للتركيز على أزرار التصدير والطباعة (Word و PDF)
  console.log('   التركيز على أزرار تصدير Word و PDF...');
  await page.evaluate(() => {
    const main = document.querySelector('main[aria-label="معالج إعداد وتنسيق البحث"]') || document.documentElement;
    if (main.scrollTo) main.scrollTo({ top: 120, behavior: 'smooth' });
  });
  await page.waitForTimeout(1000);

  const wordBtn = page.locator('button:has-text("Word"), button:has-text("وورد")').first();
  if (await wordBtn.isVisible()) {
    const wBox = await wordBtn.boundingBox();
    if (wBox) await smoothTouchMove(wBox.x + wBox.width / 2, wBox.y + wBox.height / 2, 20);
  }
  await page.waitForTimeout(2500);

  const pdfBtn = page.locator('button:has-text("PDF"), button:has-text("طباعة")').first();
  if (await pdfBtn.isVisible()) {
    const pBox = await pdfBtn.boundingBox();
    if (pBox) await smoothTouchMove(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, 20);
  }
  await page.waitForTimeout(2500);

  // التمرير نحو بطاقة تطبيق الأندرويد الرسمي APK
  console.log('   استعراض بطاقة تطبيق الأندرويد الرسمي APK...');
  await page.evaluate(() => {
    const apkCard = document.querySelector('a[download="Bahtak.apk"]');
    if (apkCard) apkCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(800);

  const apkBtn = page.locator('a[download="Bahtak.apk"]').first();
  if (await apkBtn.isVisible()) {
    const aBox = await apkBtn.boundingBox();
    if (aBox) await smoothTouchMove(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2, 20);
  }

  // الانتظار حتى بداية الخاتمة (124.94s)
  await waitUntilSecond(124.94);

  // =========================================================================
  // المشهد 6: الخاتمة والدعوة للتجربة (124.94s - 138.84s)
  // =========================================================================
  console.log('▶️ 02:05 - 02:18 | المشهد 6 (ريلز): بطاقة الخاتمة والخطوات الأربع وشعار المنصة...');
  await smoothTouchMove(270, 480, 25);

  // الانتظار حتى نهاية الصوت بالضبط (139.0s)
  await waitUntilSecond(139.0);

  console.log('💾 حفظ وإنهاء جلسة فيديو ريلز 9:16...');
  await page.waitForTimeout(500);

  const videoPromise = page.video();
  const videoPath = videoPromise ? await videoPromise.path() : null;

  await context.close();
  await browser.close();

  const finalWebm = path.join(videoDir, 'bahtak_reels_synced.webm');
  if (videoPath && fs.existsSync(videoPath)) {
    if (fs.existsSync(finalWebm)) fs.unlinkSync(finalWebm);
    fs.renameSync(videoPath, finalWebm);
    console.log(`\n🎉 تم حفظ فيديو ريلز المتزامن الخام بنجاح: ${finalWebm}`);
  } else {
    const files = fs.readdirSync(videoDir);
    const recorded = files.find(f => f.endsWith('.webm') && f.includes('page@'));
    if (recorded) {
      if (fs.existsSync(finalWebm)) fs.unlinkSync(finalWebm);
      fs.renameSync(path.join(videoDir, recorded), finalWebm);
      console.log(`\n🎉 تم حفظ فيديو ريلز المتزامن الخام بنجاح: ${finalWebm}`);
    }
  }
}

run().catch(err => {
  console.error('حدث خطأ أثناء تسجيل ريلز إنستغرام:', err);
  process.exit(1);
});
