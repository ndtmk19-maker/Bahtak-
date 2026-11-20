import { chromium } from 'playwright';

async function runTestSuite() {
  console.log('=== STARTING BAHTAK SLIDES VERIFICATION SUITE ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Capture console logs from browser
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[Browser Error]', msg.text());
  });

  await page.goto('http://localhost:8443/', { waitUntil: 'networkidle' });

  // Run comprehensive programmatic tests inside the browser context
  const testResults = await page.evaluate(async () => {
    // Import slides modules directly from the running app's bundle/modules
    const slidesMod = await import('/src/lib/slides/index.ts');
    const {
      buildDeckFromText,
      layoutDeck,
      getTheme,
      SLIDE_THEMES,
      resolveDeckImages,
      configureSlideImages
    } = slidesMod;
    const { downloadPptx } = await import('/src/lib/slides/pptxExport.ts');

    const results = {};

    const baseMeta = {
      title: "أثر التحول الرقمي على أداء المؤسسات الاقتصادية",
      subtitle: "عرض تقديمي أكاديمي",
      institution: "جامعة الجزائر 1 - بن يوسف بن خدة",
      faculty: "كلية العلوم الاقتصادية والتسيير",
      presenters: ["محمد الأمين", "ياسين بن علي"],
      supervisor: "د. عبد القادر مرابط",
      year: "2024 / 2025",
      logo: "",
      language: "ar"
    };

    const baseOptions = {
      density: "balanced",
      includeAgenda: true,
      includeSectionDividers: true,
      includeReferences: true,
      includeClosing: true,
      includeNotes: true,
    };

    // --- TEST 1: 3 Languages with 3 Mabaheth x 3 Matalib ---
    const arabicDraft = `
مقدمة
يشهد العالم المعاصر ثورة رقمية كبرى أثرت على كفاءة المؤسسات.
- تسارع وتيرة الرقمنة في العقد الأخير
- الحاجة الملحة لعصرنة التسيير المالي والإداري

الإشكالية
كيف يساهم التحول الرقمي في تحسين الأداء المالي والتشغيلي للمؤسسات الاقتصادية؟

المبحث الأول: الإطار المفاهيمي للتحول الرقمي
المطلب الأول: مفهوم ورقمنة المعاملات
- تعريف التحول الرقمي وأبعاده الاستراتيجية
- الفارق بين المكننة والتحول الشامل
المطلب الثاني: متطلبات البنية التحتية التكنولوجية
- شبكات الاتصال وقواعد البيانات السحابية
- برمجيات إدارة المؤسسات ERP
المطلب الثالث: الأبعاد التنظيمية والبشرية
- تأهيل الكوادر البشرية وتغيير ثقافة العمل
- القيادة الرقمية وإدارة التغيير

المبحث الثاني: آليات تطبيق التحول الرقمي في المؤسسة
المطلب الأول: رقمنة العمليات التشغيلية
- أتمتة خطوط الإنتاج والخدمات اللوجستية
- تقليص زمن الاستجابة لطلبات العملاء
المطلب الثاني: التسويق الرقمي وإدارة علاقات الزبائن
- منصات التجارة الإلكترونية وأنظمة CRM
- تحليل سلوك المستهلك وتخصيص العروض
المطلب الثالث: الدفع الإلكتروني والفوترة الرقمية
- اعتماد بوابات الدفع الرقمية الآمنة
- تحسين السيولة وتسريع دورة التحصيل

المبحث الثالث: أثر التحول الرقمي على مؤشرات الأداء
المطلب الأول: تحسين الإنتاجية وتخفيض التكاليف
- خفض النفقات العامة وتكاليف المعاملات الورقية
- رفع جودة المنتجات وتقليل الأخطاء البشرية
المطلب الثاني: الابتكار وخلق القيمة التنافسية
- ابتكار نماذج أعمال وخدمات جديدة
- تعزيز التموضع في السوق المحلي والدولي
المطلب الثالث: تحديات ومخاطر الرقمنة
- مخاطر الأمن السيبراني وتسريب البيانات
- تكاليف الاستثمار الأولي ومقاومة التغيير

الخاتمة
يعد التحول الرقمي خياراً حتمياً لضمان استدامة المؤسسة وتنافسيتها.
- ضرورة وضع استراتيجية وطنية لدعم الرقمنة
- الاستثمار المستمر في تأهيل رأس المال البشري

المراجع
1. عبد الله، أحمد (2023)، الاقتصاد الرقمي واستراتيجيات التغيير، دار المعرفة، الجزائر.
2. بن ناصر، سمير (2022)، نظم المعلومات الإدارية، ديوان المطبوعات الجامعية.
`;

    const deckAr = buildDeckFromText(arabicDraft, baseMeta, baseOptions);
    results.test1_arabic = {
      success: deckAr.structure.length === 3 && deckAr.structure.every(n => n === 3),
      structure: deckAr.structure,
      totalSlides: deckAr.slides.length,
      kinds: deckAr.slides.map(s => s.kind)
    };

    // French 3x3
    const frenchDraft = `
Introduction
La transformation numérique constitue un levier stratégique majeur pour les organisations contemporaines.
- Évolution rapide des technologies numériques
- Nécessité d'adapter les processus managériaux

Problématique
Dans quelle mesure la transformation numérique améliore-t-elle la performance globale des entreprises ?

Axe 1: Cadre théorique et conceptuel
Section 1: Définition de la transformation numérique
- Origines et fondements de la digitalisation
- Distinction entre numérisation et transformation
Section 2: Infrastructures technologiques requises
- Systèmes d'information et cloud computing
- Intégration des progiciels de gestion intégrés
Section 3: Dimension humaine et managériale
- Conduite du changement et culture digitale
- Développement des compétences des collaborateurs

Axe 2: Processus de déploiement opérationnel
Section 1: Digitalisation des opérations internes
- Automatisation des processus métiers
- Optimisation des flux logistiques
Section 2: Relation client et marketing digital
- Outils CRM et analyse des données clients
- Omnicanalité et expérience utilisateur
Section 3: Paiement et transactions électroniques
- Dématérialisation des factures
- Sécurisation des flux financiers

Axe 3: Impact sur les performances de l'entreprise
Section 1: Efficience et réduction des coûts
- Diminution des coûts de transaction
- Gains de productivité mesurables
Section 2: Innovation et avantage concurrentiel
- Création de nouveaux modèles d'affaires
- Flexibilité et réactivité face au marché
Section 3: Risques et cybermenaces
- Sécurité des données sensibles
- Dépendance technologique accrue

Conclusion
La transformation numérique est une condition sine qua non de la survie des entreprises.
- Nécessité d'un investissement continu
- Importance de la gouvernance des données

Bibliographie
1. Dupont, J. (2023), Management stratégique à l'ère numérique, Paris.
2. Martin, P. (2022), Systèmes d'information et performance, Alger.
`;
    const deckFr = buildDeckFromText(frenchDraft, { ...baseMeta, language: "fr", subtitle: "Exposé académique" }, baseOptions);
    results.test1_french = {
      success: deckFr.structure.length === 3 && deckFr.structure.every(n => n === 3),
      structure: deckFr.structure,
      totalSlides: deckFr.slides.length,
      language: deckFr.language
    };

    // English 3x3
    const englishDraft = `
Introduction
Digital transformation has fundamentally reshaped modern corporate landscapes and competitiveness.
- Rapid acceleration of technological change
- Imperative for business process reengineering

Problem Statement
How does digital transformation influence the financial and operational efficiency of modern firms?

Chapter 1: Theoretical Foundations
Section 1: Concepts and Core Dimensions
- Definition of digital business transformation
- Distinction between digitization and transformation
Section 2: Technological Infrastructure
- Cloud architectures and enterprise systems
- Data storage and distributed computing
Section 3: Human and Organizational Capital
- Change management and agile culture
- Workforce reskilling and leadership

Chapter 2: Implementation Mechanisms
Section 1: Operations Automation
- Business process automation and robotics
- Supply chain traceability
Section 2: Customer Centricity and Marketing
- CRM analytics and behavioral tracking
- Multichannel customer engagement
Section 3: Electronic Invoicing and Transactions
- Secure digital payment gateways
- Real-time liquidity management

Chapter 3: Impact on Firm Performance
Section 1: Cost Reduction and Productivity
- Lower transactional overhead
- Higher resource utilization
Section 2: Competitive Advantage and Innovation
- Emergence of digital business models
- Agile market positioning
Section 3: Strategic Risks and Cybersecurity
- Data protection and cybersecurity vulnerabilities
- Initial capital expenditure hurdles

Conclusion
Strategic digitalization represents an indispensable foundation for sustained organizational excellence.
- Aligning technology with core goals
- Sustained investment in digital talent

References
1. Smith, R. (2023), Digital Enterprise Strategy, New York.
2. Brown, T. (2022), Information Systems Management, London.
`;
    const deckEn = buildDeckFromText(englishDraft, { ...baseMeta, language: "en", subtitle: "Academic Presentation" }, baseOptions);
    results.test1_english = {
      success: deckEn.structure.length === 3 && deckEn.structure.every(n => n === 3),
      structure: deckEn.structure,
      totalSlides: deckEn.slides.length,
      language: deckEn.language
    };

    // --- TEST 2: Case Study Placement & Variant ---
    const caseStudyDraft = arabicDraft.replace('الخاتمة', `
دراسة حالة: مجمع سوناطراك
المطلب الأول: تشخيص واقع الرقمنة في المجمع
- تدشين نظام ERP الشامل في مختلف الفروع
- رقمنة آبار الاستكشاف وإدارة البيانات النفطية
المطلب الثاني: النتائج المحققة والتحديات القائمة
- توفير 25% من تكاليف الصيانة التنبؤية
- تدريب أكثر من 1200 إطار مهندس

الخاتمة
`);
    const deckCaseStudy = buildDeckFromText(caseStudyDraft, baseMeta, baseOptions);
    const caseSectionIndex = deckCaseStudy.slides.findIndex(s => s.kind === "section" && s.variant === "case-study");
    const mabhath3Index = deckCaseStudy.slides.findIndex(s => s.kind === "section" && s.number === 3);
    const conclusionIndex = deckCaseStudy.slides.findIndex(s => s.kind === "closing" || (s.kind === "content" && s.title.includes("خاتمة")));
    results.test2_case_study = {
      found: caseSectionIndex !== -1,
      variant: deckCaseStudy.slides[caseSectionIndex]?.variant,
      title: deckCaseStudy.slides[caseSectionIndex]?.title,
      isAfterMabhath3: caseSectionIndex > mabhath3Index,
      isBeforeConclusion: caseSectionIndex < conclusionIndex,
      success: caseSectionIndex !== -1 && caseSectionIndex > mabhath3Index && caseSectionIndex < conclusionIndex
    };

    // --- TEST 3: Layouts Selection in layout.ts (Stats, Timeline, Comparison) ---
    const richLayoutDraft = `
الإشكالية
كيف نطور الأداء المؤسسي عبر الرقمنة؟

المبحث الأول: المؤشرات والخطط والمقارنات
المطلب الأول: المؤشرات الرقمية للقطاع
- 78% نسبة انتشار المعاملات الرقمية
- 150 مليار دينار حجم الاستثمارات الموجهة
- 42% زيادة سنوية في مستخدمي التطبيقات
المطلب الثاني: المراحل الزمنية للتحول
- المرحلة الأولى: مرحلة التخطيط والتشخيص الأولي
- المرحلة الثانية: مرحلة إرساء البنية والتجهيز
- المرحلة الثالثة: مرحلة الإطلاق والتدريب والتفعيل
المطلب الثالث: المقارنة بين النظامين
- النظام التقليدي: بطء في الإجراءات وتكاليف ورقية مرتفعة
- مقابل النظام الرقمي: سرعة فائقة في التنفيذ وتكاليف منخفضة
`;
    const richDeck = buildDeckFromText(richLayoutDraft, baseMeta, { ...baseOptions, includeAgenda: false, includeSectionDividers: true });
    const theme = getTheme("executive");
    const laidRich = layoutDeck(richDeck, theme, baseOptions);

    // Analyze laid slides for prim patterns
    results.test3_layouts = {
      slideCount: laidRich.length,
      executiveThemeUsed: theme.name === "تنفيذي للأعمال",
      hasNumberPrims: laidRich.some(s => s.prims.some(p => p.t === "text" && p.paras.some(pa => /78%|150|42%/.test(pa.runs.map(r => r.text).join(""))))),
      hasTimelinePrims: laidRich.some(s => s.prims.some(p => p.t === "ellipse" && p.line)),
      hasGhostDecorations: laidRich.some(s => s.prims.some(p => p.t === "text" && p.role === "ghost"))
    };

    // --- TEST 4: Images ON vs OFF ---
    const laidNoImages = layoutDeck(deckAr, theme, baseOptions, undefined);
    const mockImages = {
      0: { src: "https://images.unsplash.com/photo-mock", credit: "Photo: Test / Unsplash", alt: "Tech" },
      2: { src: "https://images.unsplash.com/photo-mock-2", credit: "Photo: Test2 / Unsplash", alt: "Business" }
    };
    const laidWithImages = layoutDeck(deckAr, theme, baseOptions, mockImages);

    const noImagesHasCoverPhoto = laidNoImages[0].prims.some(p => p.t === "image" && p.src.includes("unsplash"));
    const withImagesHasCoverPhoto = laidWithImages[0].prims.some(p => p.t === "image" && p.src.includes("unsplash") && p.fit === "cover");

    results.test4_images_toggle = {
      noImagesCleanGeometric: !noImagesHasCoverPhoto,
      withImagesIncludesCoverFit: withImagesHasCoverPhoto,
      success: !noImagesHasCoverPhoto && withImagesHasCoverPhoto
    };

    // --- TEST 5: PPTX Export Execution & Buffer Check ---
    let pptxSuccess = false;
    let pptxError = null;
    try {
      const exportRes = await downloadPptx(laidWithImages, theme, {
        title: deckAr.title,
        author: "محمد الأمين"
      });
      pptxSuccess = exportRes.success;
      pptxError = exportRes.error;
    } catch (e) {
      pptxError = e.message;
    }

    results.test5_pptx_export = {
      success: pptxSuccess,
      error: pptxError
    };

    // --- TEST 6: SLIDE_THEMES Executive Theme Check ---
    const executiveTheme = SLIDE_THEMES.find(t => t.id === "executive");
    results.test6_themes = {
      totalThemes: SLIDE_THEMES.length,
      executiveFound: !!executiveTheme,
      executiveIndex: SLIDE_THEMES.findIndex(t => t.id === "executive"),
      executiveName: executiveTheme?.name
    };

    return results;
  });

  console.log('=== TEST RESULTS SUMMARY ===');
  console.log(JSON.stringify(testResults, null, 2));

  // --- TEST 7: Mobile APK Check ---
  console.log('Checking Bahtak.apk download endpoint...');
  const apkRes = await page.request.get('http://localhost:8443/Bahtak.apk');
  const apkStatus = apkRes.status();
  const apkLength = Number(apkRes.headers()['content-length'] || 0);
  console.log(`Bahtak.apk Status: ${apkStatus}, Content-Length: ${(apkLength / (1024 * 1024)).toFixed(2)} MB`);

  await browser.close();

  return {
    ...testResults,
    test7_apk: {
      status: apkStatus,
      sizeBytes: apkLength,
      sizeMB: (apkLength / (1024 * 1024)).toFixed(2),
      success: apkStatus === 200 && apkLength > 1000000
    }
  };
}

runTestSuite().then((res) => {
  console.log('ALL TESTS EXECUTED SUCCESSFULLY!');
  process.exit(0);
}).catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
