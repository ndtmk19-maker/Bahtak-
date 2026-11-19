import type { CoverState, DocumentState, ResearchLanguage, ResearchPage } from '../types';

export const PLACEHOLDER_TITLE = '[عنوان البحث هنا]';
export const DEFAULT_STUDENTS_TEXT = '\n\n\n';
export const LEGACY_STUDENTS_TEXT = 'الطالب(ة): الاسم واللقب\nالطالب(ة): الاسم واللقب';

export const DEFAULT_LOCALIZED_COVER = {
  ar: {
    country: 'الجمهورية الجزائرية الديمقراطية الشعبية',
    ministry: 'وزارة التعليم العالي والبحث العلمي',
    workType: 'بحث أكاديمي منسق',
    supervisor: 'د. / أستاذ(ة) المقياس المحترم(ة)',
    group: 'الفوج: 01',
    academicYear: 'السنة الجامعية: 2024 / 2025',
    planTitle: 'خـطّـة البـحـث',
  },
  fr: {
    country: 'République Algérienne Démocratique et Populaire',
    ministry: "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique",
    workType: 'Travail de recherche académique',
    supervisor: 'Dr. / Enseignant(e) du module',
    group: 'Groupe : 01',
    academicYear: 'Année universitaire : 2024 / 2025',
    planTitle: 'Sommaire',
  },
  en: {
    country: "People's Democratic Republic of Algeria",
    ministry: 'Ministry of Higher Education and Scientific Research',
    workType: 'Academic Research Paper',
    supervisor: 'Dr. / Course Instructor',
    group: 'Group: 01',
    academicYear: 'Academic Year: 2024 / 2025',
    planTitle: 'Table of Contents',
  },
} as const;

export const KNOWN_COUNTRIES = new Set([
  'الجمهورية الجزائرية الديمقراطية الشعبية',
  'République Algérienne Démocratique et Populaire',
  "People's Democratic Republic of Algeria",
]);

export const KNOWN_MINISTRIES = new Set([
  'وزارة التعليم العالي والبحث العلمي',
  "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique",
  'Ministry of Higher Education and Scientific Research',
]);

export const KNOWN_WORK_TYPES = new Set([
  'بحث أكاديمي منسق',
  'بحث أكاديمي حول',
  'Travail de recherche académique',
  'Academic Research Paper',
]);

export const KNOWN_SUPERVISORS = new Set([
  'د. / أستاذ(ة) المقياس المحترم(ة)',
  'Dr. / Enseignant(e) du module',
  'Dr. / Course Instructor',
]);

export const KNOWN_PLAN_TITLES = new Set([
  'خـطّـة البـحـث',
  'خطة البحث',
  'Sommaire',
  'Table of Contents',
  'Table des matières',
]);

export function getLocalizedCoverDefaults(lang?: ResearchLanguage): Partial<CoverState> {
  const l = lang || 'ar';
  return {
    country: DEFAULT_LOCALIZED_COVER[l].country,
    ministry: DEFAULT_LOCALIZED_COVER[l].ministry,
    workType: DEFAULT_LOCALIZED_COVER[l].workType,
    supervisor: DEFAULT_LOCALIZED_COVER[l].supervisor,
    group: DEFAULT_LOCALIZED_COVER[l].group,
    academicYear: DEFAULT_LOCALIZED_COVER[l].academicYear,
  };
}

export function getLocalizedPlanTitle(currentTitle: string | undefined, lang?: ResearchLanguage): string {
  const l = lang || 'ar';
  if (!currentTitle || KNOWN_PLAN_TITLES.has(currentTitle.trim())) {
    return DEFAULT_LOCALIZED_COVER[l].planTitle;
  }
  return currentTitle;
}

export function getLocalizedCoverState(cs: CoverState, lang?: ResearchLanguage): Partial<CoverState> {
  const l = lang || 'ar';
  const def = DEFAULT_LOCALIZED_COVER[l];
  const patch: Partial<CoverState> = {};

  if (!cs.country || KNOWN_COUNTRIES.has(cs.country.trim())) {
    patch.country = def.country;
  } else {
    patch.country = cs.country;
  }

  if (!cs.ministry || KNOWN_MINISTRIES.has(cs.ministry.trim())) {
    patch.ministry = def.ministry;
  } else {
    patch.ministry = cs.ministry;
  }

  if (!cs.workType || KNOWN_WORK_TYPES.has(cs.workType.trim())) {
    patch.workType = def.workType;
  } else {
    patch.workType = cs.workType;
  }

  if (!cs.supervisor || KNOWN_SUPERVISORS.has(cs.supervisor.trim()) || cs.supervisor.includes('أستاذ(ة) المقياس')) {
    patch.supervisor = def.supervisor;
  } else {
    patch.supervisor = cs.supervisor;
  }

  if (cs.group) {
    const rawNum = cs.group.replace(/^(?:الفوج|Groupe|Group)\s*[:：]?\s*/i, '').trim();
    if (l === 'fr') {
      patch.group = rawNum ? `Groupe : ${rawNum}` : def.group;
    } else if (l === 'en') {
      patch.group = rawNum ? `Group: ${rawNum}` : def.group;
    } else {
      patch.group = rawNum ? `الفوج: ${rawNum}` : def.group;
    }
  } else {
    patch.group = def.group;
  }

  if (cs.academicYear) {
    const rawYear = cs.academicYear
      .replace(/^(?:السنة\s+(?:الجامعية|الدراسية)|Année\s+universitaire|Academic\s+Year)\s*[:：]?\s*/i, '')
      .trim();
    if (l === 'fr') {
      patch.academicYear = rawYear ? `Année universitaire : ${rawYear}` : def.academicYear;
    } else if (l === 'en') {
      patch.academicYear = rawYear ? `Academic Year: ${rawYear}` : def.academicYear;
    } else {
      patch.academicYear = rawYear ? `السنة الجامعية: ${rawYear}` : def.academicYear;
    }
  } else {
    patch.academicYear = def.academicYear;
  }

  return patch;
}

export const LINKS = {
  charihatek: 'https://charihatek.netlify.app/',
  // ملف التطبيق المباشر (APK)
  apk: '/Bahtak.apk',
  instagram: 'https://instagram.com/mk.abdouuu',
  instagramHandle: 'mk.abdouuu',
  tutorialVideo: 'https://www.youtube.com/shorts/uXaSKzTdk1s',
};

export const PLAN_TEMPLATES = {
  standard: `المقدمة | ص 01
المبحث الأول: [عنوان المبحث] | ص 02
- المطلب الأول: [عنوان المطلب] | ص 03
- المطلب الثاني: [عنوان المطلب] | ص 04
- المطلب الثالث: [عنوان المطلب] | ص 05
المبحث الثاني: [عنوان المبحث] | ص 06
- المطلب الأول: [عنوان المطلب] | ص 07
- المطلب الثاني: [عنوان المطلب] | ص 08
- المطلب الثالث: [عنوان المطلب] | ص 09
المبحث الثالث: [عنوان المبحث] | ص 10
- المطلب الأول: [عنوان المطلب] | ص 11
- المطلب الثاني: [عنوان المطلب] | ص 12
- المطلب الثالث: [عنوان المطلب] | ص 13
الخاتمة | ص 15`,
  twosections: `المقدمة | ص 01
المبحث الأول: [عنوان المبحث الأول] | ص 02
- المطلب الأول: [عنوان المطلب الأول] | ص 02
- المطلب الثاني: [عنوان المطلب الثاني] | ص 04
المبحث الثاني: [عنوان المبحث الثاني] | ص 06
- المطلب الأول: [عنوان المطلب الأول] | ص 06
- المطلب الثاني: [عنوان المطلب الثاني] | ص 08
الخاتمة | ص 10
قائمة المصادر والمراجع | ص 11`,
  readingcard: `المدخل التعريفي بالكتاب والمؤلف | ص 01
المحور الأول: الإطار المفاهيمي وأهداف المؤلف | ص 02
المحور الثاني: عرض وتحليل أطروحة الكتاب | ص 04
المحور الثالث: النقد والتقييم الأكاديمي | ص 06
الخاتمة والاستنتاجات العامة | ص 08`,
} as const;

export type PlanTemplateName = keyof typeof PLAN_TEMPLATES;

export function defaultSamplePages(): ResearchPage[] {
  return [
    {
      mabhathTitle: 'المبحث الأول',
      matlabTitle: 'المطلب الأول',
      content: `<p class="doc-paragraph">يُعد هذا النموذج صفحة استرشادية توضح كيفية ظهور وتنسيق البحث الأكاديمي. يمكنك كتابة الفقرات العادية بسهولة، وسيتم ضبط المحاذاة والمسافة البادئة وتباعد الأسطر تلقائياً وفق المعايير الجامعية المعتمدة<sup>1</sup>.</p><div class="doc-subtitle">1. إرشادات تنظيم المحتوى والعناوين الفرعية:</div><ul class="doc-ul"><li class="doc-li"><strong>العناوين الفرعية:</strong> استخدم عناوين مرقمة أو نقاطاً لتسليط الضوء على الأفكار الرئيسية في كل فقرة.</li><li class="doc-li"><strong>التوثيق والتهميش:</strong> يتم وضع رقم الإحالة بشكل علوي مرتفع في النص، وتوثيقه في هامش أسفل الصفحة<sup>2</sup>.</li><li class="doc-li"><strong>تعديل أو استبدال المحتوى:</strong> يمكنك تعديل هذه الصفحة مباشرة من محرر الصفحات، أو الانتقال إلى قسم «المحتوى» للصق بحثك كاملاً بضغطة زر.</li></ul>`,
      footnotes: [
        'اسم المؤلف، عنوان الكتاب أو المرجع، دار النشر، الطبعة، مكان النشر، سنة النشر، ص 15.',
        'اسم الباحث، عنوان المقال أو البحث، اسم المجلة العلمية، المجلد (01)، العدد (02)، السنة، ص 45.',
      ],
    },
  ];
}

export function createDefaultDocument(): DocumentState {
  return {
    language: 'ar',
    layoutMode: 'research',
    fontFamily: "'Amiri', serif",
    fontSize: 12.3,
    lineHeight: 1.62,
    borderStyle: 'double',
    showStudentInfo: false,
    studentName: 'الاسم واللقب (اسم الطالب)',
    studentFawj: '01',
    coverState: {
      enabled: true,
      theme: 'black',
      country: 'الجمهورية الجزائرية الديمقراطية الشعبية',
      ministry: 'وزارة التعليم العالي والبحث العلمي',
      selectedWilaya: '',
      selectedUnivId: '',
      universityName: '',
      facultyName: '',
      logoUrl: '',
      logoBase64: '',
      logoPosition: 'both',
      logoSize: 'large',
      workType: 'بحث أكاديمي حول',
      title: PLACEHOLDER_TITLE,
      subtitle: '',
      studentsText: DEFAULT_STUDENTS_TEXT,
      supervisor: 'د. / أستاذ(ة) المقياس المحترم(ة)',
      group: 'الفوج: 01',
      academicYear: 'السنة الجامعية: 2025 / 2026',
    },
    planState: {
      enabled: true,
      pageTitle: 'خـطّـة البـحـث',
      researchTitle: '',
      showPageNumbers: true,
      itemsText: PLAN_TEMPLATES.standard,
    },
    pages: defaultSamplePages(),
  };
}

export const DEMO_RAW_TEXT = `بحث بعنوان: استراتيجيات التحول الرقمي في المؤسسات الأكاديمية الحديثة

المقدمة:
يشهد العالم المعاصر ثورة تكنولوجية متسارعة أثرت بعمق على منظومة التعليم العالي والبحث العلمي^1. ولم يعد التحول الرقمي مجرد خيار تكميلي، بل غدا ضرورة استراتيجية لتحقيق الجودة والتميز المؤسسي وتطوير المهارات الجامعية^2.

المبحث الأول: الإطار المفاهيمي للتحول الرقمي
المطلب الأول: مفهوم وأهمية التحول الرقمي في التعليم العالي
يقصد بالتحول الرقمي عملية إعادة هيكلة شاملة للعمليات الأكاديمية والإدارية بالاعتماد على الحلول التقنية الحديثة^3. ويهدف هذا التحول إلى تحسين مخرجات التعلم وتسهيل تبادل المعرفة والارتقاء بالأداء الجامعي.

- تعزيز كفاءة الإدارة الجامعية والحد من الهدر الزمني والمادي.
- تطوير بيئات التعلم الذكية وتسهيل وصول الطلبة والباحثين للمصادر المعرفية.
- تمكين التعليم التفاعلي والتعلم عن بُعد بجودة وموثوقية عالية.

المطلب الثاني: متطلبات وتحديات تطبيق التحول الرقمي
يتطلب التحول الرقمي الفعال توفر بنية تحتية رقمية متطورة، بالإضافة إلى تأهيل الكوادر البشرية وتطوير التشريعات الأكاديمية المنظمة^4.

1. البنية التحتية التكنولوجية: توفير شبكات اتصال سريعة ومنصات تعليمية رقمية مؤمنة.
2. التدريب والتأهيل المستمر: بناء قدرات أعضاء هيئة التدريس والطلبة على استخدام الأدوات الرقمية.
3. إدارة التغيير: التغلب على مقاومة التغيير وغرس ثقافة الابتكار المؤسسي.

الخـاتـمـــة:
أكدت هذه الدراسة أن التحول الرقمي يمثل رافعة حقيقية لتطوير الأداء الأكاديمي، شريطة توفر الإرادة المؤسسية والاستثمار الرشيد في البنية التكنولوجية والتنمية البشرية المستدامة.

قائمة المصادر والمراجع:
[1] د. أحمد محمود، تكنولوجيا التعليم والتحول الرقمي، دار الفكر العربي، القاهرة، ط 1، 2023، ص 24.
[2] د. سمير عبد الله، استراتيجيات التطوير المؤسسي في الجامعات، مجلة الدراسات الأكاديمية، المجلد 8، العدد 2، 2024، ص 55.
[3] د. خالد بن عمر، الإدارة الإلكترونية ومستقبل التعليم، دار اليازوري العلمية، عمّان، 2022، ص 89.
[4] د. نادية كمال، تحديات الرقمنة في التعليم العالي العربي، المجلة الدولية للتربية والتنمية، المجلد 12، 2023، ص 112.`;

export const QUICK_AI_TOPICS_BY_LANG = {
  ar: [
    { label: 'التحول الرقمي والجامعات', topic: 'أثر التحول الرقمي ونظم المعلومات على أداء المؤسسات الجامعية' },
    { label: 'التدقيق الداخلي والمخاطر', topic: 'واقع التدقيق الداخلي وإدارة المخاطر في المؤسسات الاقتصادية' },
    { label: 'المسؤولية الاجتماعية', topic: 'المسؤولية الاجتماعية للشركات ودورها في تحقيق التنمية المستدامة' },
    { label: 'حوكمة الشركات', topic: 'دور حوكمة الشركات في تعزيز الشفافية والأداء المالي في المؤسسات' },
  ],
  fr: [
    { label: 'Transformation Digitale', topic: "L'impact de la transformation digitale et des systèmes d'information sur la performance des organisations" },
    { label: 'Audit Interne & Risques', topic: "La pratique de l'audit interne et du management des risques dans les entreprises contemporaines" },
    { label: 'RSE & Développement Durable', topic: "La responsabilité sociétale des entreprises (RSE) et son rôle dans le développement durable" },
    { label: 'Gouvernance d\'Entreprise', topic: "Le rôle de la gouvernance d'entreprise dans l'amélioration de la performance financière et la transparence" },
  ],
  en: [
    { label: 'Digital Transformation', topic: 'The Impact of Digital Transformation and Information Systems on Organizational Performance' },
    { label: 'Internal Audit & Risk', topic: 'Internal Audit Practices and Risk Management in Modern Corporate Enterprises' },
    { label: 'CSR & Sustainability', topic: 'Corporate Social Responsibility (CSR) and its Contribution to Sustainable Development' },
    { label: 'Corporate Governance', topic: 'The Role of Corporate Governance in Enhancing Financial Performance and Transparency' },
  ],
} as const;

export const QUICK_AI_TOPICS = QUICK_AI_TOPICS_BY_LANG.ar;
