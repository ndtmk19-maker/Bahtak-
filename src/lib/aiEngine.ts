// @ts-nocheck
// محرك التوليد الأكاديمي بالذكاء الاصطناعي — الإعدادات والتعليمات (Prompts) وعملاء البث اللحظي
import { getEffectiveGeminiKey, rotateSystemGeminiKey } from './aiKeys';

// النماذج الرسمية النشطة وفائقة السرعة في Google Gemini API (تم التحقق منها بنجاح 200 OK)
var FAST_GEMINI_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash'
];

// مصفوفة المعايرة الهندسية لحجم البحث وعدد الصفحات المتولدة.
// معايرة الصفحة: ورقة A4 بخط Amiri 12.3pt وتباعد 1.62 تتسع لنحو 380–450 كلمة من المتن (بعد العناوين والهوامش).
// لذلك يجب ألا تقل حصة المطلب عن ~400 كلمة حتى لا يملأ نصف صفحة فقط ثم يترك فراغاً قبل المطلب/المبحث التالي.
// القاعدة: mabahithWords ÷ (عدد المباحث × عدد المطالب الافتراضي في AI_LENGTHS) ≥ 400 كلمة لكل مطلب.
var LENGTH_CONFIGS = {
    'short': {
        label: 'موجز (5 إلى 8 صفحات)',
        targetPages: '5 إلى 8 صفحات',
        introWords: 380,
        introParagraphs: '3 فقرات منهجية متكاملة ومستفيضة',
        mabahithWords: 1500,
        matlabParagraphs: '3 فقرات علمية مستفيضة لكل مطلب (110–150 كلمة للفقرة) مع مناقشة وتوثيق',
        minMatlabWords: 400,
        conclusionWords: 320,
        maxRefs: 8,
        introMaxTokens: 2000,
        mabhathMaxTokens: 4200,
        conclusionMaxTokens: 1800
    },
    'medium': {
        label: 'متوسط (8 إلى 12 صفحة)',
        targetPages: '8 إلى 12 صفحة',
        introWords: 480,
        introParagraphs: '4 فقرات منهجية متزنة (تمهيد، إشكالية وأسئلة، فرضيات، منهج وخطة)',
        mabahithWords: 2700,
        matlabParagraphs: '3 إلى 4 فقرات علمية مفصلة لكل مطلب (110–160 كلمة للفقرة) بدقة وأمثلة واقعية وتوثيق أكاديمي',
        minMatlabWords: 420,
        conclusionWords: 380,
        maxRefs: 10,
        introMaxTokens: 2500,
        mabhathMaxTokens: 5800,
        conclusionMaxTokens: 2200
    },
    'giant': {
        label: 'موسع (12 إلى 16 صفحة)',
        targetPages: '12 إلى 16 صفحة',
        introWords: 620,
        introParagraphs: '5 فقرات تأصيلية موسعة',
        mabahithWords: 4200,
        matlabParagraphs: '4 فقرات علمية موسعة لكل مطلب (120–170 كلمة للفقرة) مع مناقشة فكرية معمقة وهوامش وفيرة',
        minMatlabWords: 450,
        conclusionWords: 470,
        maxRefs: 12,
        introMaxTokens: 3200,
        mabhathMaxTokens: 7200,
        conclusionMaxTokens: 2800
    },
    'huge': {
        label: 'مطول جداً (20 إلى 25 صفحة)',
        targetPages: '20 إلى 25 صفحة',
        introWords: 820,
        introParagraphs: '6 فقرات عميقة ومفصلة',
        mabahithWords: 6400,
        matlabParagraphs: '4 إلى 5 فقرات تحليلية موسعة وتفريعات لكل مطلب (120–180 كلمة للفقرة) مع إحالات مرجعية مكثفة',
        minMatlabWords: 480,
        conclusionWords: 570,
        maxRefs: 12,
        introMaxTokens: 4000,
        mabhathMaxTokens: 8192,
        conclusionMaxTokens: 3500
    }
};

// تعليمات العناصر البصرية (جداول Markdown وأشكال بيانية) المشتركة بين المباحث ودراسة الحالة.
// الصيغ هنا هي نفسها التي يتعرف عليها parser.ts (TABLE_CAPTION_RE / CHART_MARKER_RE / SOURCE_LINE_RE).
function buildVisualsGuide(maxTables, allowChart) {
    return 'العناصر البصرية الأكاديمية (عند الاقتضاء العلمي فقط — لا تُقحمها في موضوع نظري لا يحتاجها):\n' +
    '- إذا تضمن المطلب مقارنة بين مفاهيم أو أنواع أو مراحل أو نماذج، أو بيانات رقمية وإحصائية موثقة، فأدرج ' + (maxTables > 1 ? ('جدولاً واحداً إلى ' + maxTables + ' جداول كحد أقصى') : 'جدولاً واحداً كحد أقصى') + ' بصيغة Markdown القياسية بالشكل الحرفي التالي:\n' +
    'الجدول رقم (01): عنوان وصفي دقيق للجدول\n' +
    '| المعيار | العنصر الأول | العنصر الثاني |\n' +
    '|---|---|---|\n' +
    '| خلية قصيرة | خلية قصيرة | خلية قصيرة |\n' +
    '- ضوابط الجدول: من 2 إلى 5 أعمدة، ومن 3 إلى 8 صفوف، وخلايا قصيرة (لا تتجاوز 10 كلمات)، دون دمج خلايا ودون أسطر فارغة داخل الجدول، وكل صف في سطر مستقل يبدأ وينتهي بالرمز |. لا تضع سطر "المصدر:" تحت الجدول إطلاقاً.\n' +
    '- مهّد للجدول بجملة في الفقرة السابقة (مثل: «ويوضح الجدول الموالي...») ثم علّق عليه بفقرة تحليلية بعده؛ الجدول لا يغني عن التحليل النثري ولا يُحتسب من عدد الكلمات المطلوب.\n' +
    (allowChart
        ? ('- إذا توفرت بيانات كمية حقيقية موثقة (نسب أو أعداد من تقارير رسمية أو دراسات منشورة) فيمكنك إضافة شكل بياني واحد على الأكثر في سطر مستقل بهذه الصيغة الحرفية (JSON صالح في سطر واحد):\n' +
           '[[CHART {"type":"bar","title":"عنوان الشكل","unit":"%","data":[{"label":"الفئة الأولى","value":45},{"label":"الفئة الثانية","value":30}],"source":"اسم الجهة أو المرجع"}]]\n' +
           '  حيث type إحدى القيم: bar (أشرطة أفقية للمقارنات) أو column (أعمدة للتطور الزمني) أو pie (نسب من كل واحد مجموعها 100). من 2 إلى 8 بيانات وتسميات قصيرة.\n')
        : '') +
    '- الأمانة العلمية: لا تخترع أرقاماً أو نسباً دقيقة غير موثقة؛ عند غياب بيانات مؤكدة اجعل الجدول مقارنة نوعية (خصائص، مزايا وعيوب، مراحل) بدل الأرقام، ولا تضع شكلاً بيانياً.\n' +
    '- لا تكتب الجدول أو الشكل داخل ``` ولا تضع رموز ** داخل الخلايا.';
}

var ORDINAL_LABELS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

function sanitizeFallbackTopic(topic) {
    return (topic || '').replace(/^["«'\s]+|["»'\s]+$/g, '').trim() || 'موضوع البحث';
}

// توليد عناوين مطالب متميزة ومختلفة لكل مبحث لمنع تكرار خطة المبحث الأول في المبحث الثاني والثالث
function getDistinctFallbackMatalib(topic, mabhathIdx, count) {
    var cleanTopic = sanitizeFallbackTopic(topic);
    var topicRef = cleanTopic.length <= 42 ? cleanTopic : 'موضوع الدراسة';
    var tCount = Math.max(1, parseInt(count, 10) || 2);

    var pools = [
        // المبحث الأول: الإطار النظري والمفاهيمي
        [
            'ماهية ' + topicRef + ' ونشأته التاريخية',
            'الأسس النظرية والخصائص المميزة لـ ' + topicRef,
            'الأهمية العلمية والأهداف الجوهرية لـ ' + topicRef,
            'المفاهيم والمصطلحات ذات الصلة بـ ' + topicRef,
            'المبادئ والركائز التأسيسية للموضوع',
            'العوامل والمحددات الأساسية المؤثرة في ' + topicRef
        ],
        // المبحث الثاني: الآليات التطبيقية والأبعاد الميدانية
        [
            'الآليات والأدوات العملية لتفعيل ' + topicRef,
            'مجالات التطبيق العملي ومؤشرات القياس والأداء',
            'الأدوار المؤسسية والسياسات الداعمة للتنفيذ',
            'متطلبات الحوكمة وضوابط الممارسة الميدانية',
            'النماذج والتجارب التطبيقية في مجال ' + topicRef,
            'العلاقة التفاعلية بين السياسات العامة و' + topicRef
        ],
        // المبحث الثالث: التحديات والتقييم والآفاق المستقبلية
        [
            'التحديات والمعوقات الراهنة أمام ' + topicRef,
            'تقييم الآثار الاقتصادية والاجتماعية والمؤسسية',
            'الفرص المتاحة والآفاق المستقبلية لتطوير ' + topicRef,
            'استراتيجيات المعالجة وتحسين الكفاءة التشغيلية',
            'مخاطر القصور وسبل التحصين والوقاية',
            'رؤية استشرافية وتوصيات تطويرية حول ' + topicRef
        ],
        // المبحث الرابع (عند الطلب الموسع)
        [
            'الإطار القانوني والتنظيمي المنظم للمجال',
            'المعايير الدولية وآليات الرقابة والامتثال',
            'دراسة مقارنة للتشريعات والممارسات المعاصرة',
            'مسؤوليات الفاعلين في منظومة التنفيذ',
            'سبل تحديث البنية التنظيمية والمؤسسية',
            'ضمانات الشفافية والمساءلة في التطبيق'
        ],
        // المبحث الخامس
        [
            'منهجية التحليل وتقييم المعطيات الميدانية',
            'قراءة نقدية في المؤشرات والاتجاهات الحديثة',
            'استخلاص الدروس المستفادة من المقارنات',
            'قياس الكفاءة والفعالية على المدى البعيد',
            'محددات الاستدامة والتطوير المستمر',
            'البدائل الاستراتيجية المقترحة للتنفيذ'
        ]
    ];

    var selectedPool = pools[mabhathIdx % pools.length];
    var list = [];
    for (var j = 0; j < tCount; j++) {
        var sub = selectedPool[j] || ('المحور التحليلي ' + (ORDINAL_LABELS[j] || (j + 1)) + ' في ' + topicRef);
        list.push(sub);
    }
    return list;
}

// دالة إنشاء خطة بديلة ذكية بمطالب متباينة تماماً لكل مبحث في حال تعذر الاتصال بالكامل (مع دعم الفرنسية والإنجليزية)
function buildFallbackPlan(topic, mabhathCount, matlabCount, lengthMode, lang) {
    var isFr = lang === 'fr';
    var isEn = lang === 'en';
    var mCount = Math.max(1, parseInt(mabhathCount, 10) || 2);
    var tCount = Math.max(1, parseInt(matlabCount, 10) || 2);
    var cleanTopic = sanitizeFallbackTopic(topic);
    var topicRef = cleanTopic.length <= 42 ? cleanTopic : (isFr ? 'le sujet d\'étude' : isEn ? 'the research topic' : 'موضوع الدراسة');

    if (isFr) {
        var ROMAN_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        var frThemes = [
            'Cadre conceptuel et théorique de ' + topicRef,
            'Mécanismes opérationnels et dimensions pratiques de ' + topicRef,
            'Défis, évaluation critique et perspectives futures de ' + topicRef,
            'Cadre institutionnel et managérial de ' + topicRef,
            'Analyse comparative et approches contemporaines de ' + topicRef
        ];
        var mabahithFr = [];
        for (var i = 0; i < mCount; i++) {
            var rom = ROMAN_LABELS[i] || String(i + 1);
            var mTitle = 'Chapitre ' + rom + ' : ' + (frThemes[i] || ('Dimension analytique de ' + topicRef));
            var matalibFr = [];
            for (var j = 0; j < tCount; j++) {
                matalibFr.push({
                    title: 'Section ' + (j + 1) + ' : ' + (j === 0 ? 'Définition et fondements théoriques' : j === 1 ? 'Typologie et caractéristiques fondamentales' : 'Enjeux et applications pratiques')
                });
            }
            mabahithFr.push({ title: mTitle, matalib: matalibFr });
        }
        return {
            title: cleanTopic,
            problematic: 'Quelles sont les dimensions conceptuelles et pratiques de ' + cleanTopic + ', et comment optimiser ses mécanismes opérationnels ?',
            questions: [],
            hypotheses: [
                'Il existe une corrélation significative entre la rigueur méthodologique et la performance des pratiques appliquées.',
                'L\'adoption de stratégies d\'optimisation permet de surmonter les principaux défis du secteur.'
            ],
            methodology: 'Méthodologie descriptive et analytique',
            mabahith: mabahithFr
        };
    }

    if (isEn) {
        var enThemes = [
            'Conceptual and Theoretical Framework of ' + topicRef,
            'Operational Mechanisms and Practical Dimensions of ' + topicRef,
            'Challenges, Critical Evaluation and Future Perspectives of ' + topicRef,
            'Institutional and Managerial Framework of ' + topicRef,
            'Comparative Analysis and Contemporary Trends in ' + topicRef
        ];
        var mabahithEn = [];
        for (var i = 0; i < mCount; i++) {
            var num = i + 1;
            var mTitle = 'Chapter ' + num + ': ' + (enThemes[i] || ('Analytical Dimension of ' + topicRef));
            var matalibEn = [];
            for (var j = 0; j < tCount; j++) {
                matalibEn.push({
                    title: 'Section ' + (j + 1) + ': ' + (j === 0 ? 'Theoretical Foundations and Definitions' : j === 1 ? 'Key Classifications and Features' : 'Practical Applications and Implications')
                });
            }
            mabahithEn.push({ title: mTitle, matalib: matalibEn });
        }
        return {
            title: cleanTopic,
            problematic: 'What are the conceptual and operational dimensions of ' + cleanTopic + ', and how can its systemic frameworks be optimized?',
            questions: [],
            hypotheses: [
                'There is a significant positive correlation between theoretical foundation and empirical execution.',
                'Implementing strategic optimization methodologies mitigates operational and systemic challenges.'
            ],
            methodology: 'Descriptive and Analytical Methodology',
            mabahith: mabahithEn
        };
    }

    var mabahith = [];
    var mabhathThemes = [
        'الإطار المفاهيمي والنظري لـ ' + topicRef,
        'الآليات التطبيقية والأبعاد الميدانية لـ ' + topicRef,
        'التحديات والتقييم والآفاق المستقبلية لـ ' + topicRef,
        'الإطار المؤسسي والتنظيمي لـ ' + topicRef,
        'التحليل المقارن والاتجاهات المعاصرة في ' + topicRef,
        'استراتيجيات التطوير والبدائل العملية لـ ' + topicRef
    ];

    for (var i = 0; i < mCount; i++) {
        var mTitle = 'المبحث ' + (ORDINAL_LABELS[i] || (i + 1)) + ': ' + (mabhathThemes[i] || ('البعد التحليلي لـ ' + topicRef));
        var matSubTitles = getDistinctFallbackMatalib(cleanTopic, i, tCount);
        var matalib = matSubTitles.map(function(sub, j) {
            return {
                title: 'المطلب ' + (ORDINAL_LABELS[j] || (j + 1)) + ': ' + sub
            };
        });
        mabahith.push({
            title: mTitle,
            matalib: matalib
        });
    }

    return {
        title: cleanTopic,
        problematic: 'ما هي الأبعاد المفاهيمية والتطبيقية المرتبطة بـ ' + cleanTopic + '، وما هي التحديات والآفاق الكفيلة بتطويرها؟',
        questions: [],
        hypotheses: [
            'توجد علاقة ارتباطية إيجابية بين وضوح التأصيل النظري وكفاءة الآليات التطبيقية المرتبطة بالموضوع.'
        ],
        methodology: 'المنهج الوصفي التحليلي',
        mabahith: mabahith
    };
}

function extractGeminiResponseText(data) {
    var parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    if (!parts) return '';
    return parts.map(function(p) { return p.text || ''; }).join('');
}

// استدعاء Google Gemini مع البث اللحظي والتجاوز التلقائي الذكي عند الضغط
async function fetchGeminiStreamWithFallback(apiKey, prompt, onChunk, config) {
    config = config || {};
    var temp = typeof config.temperature === 'number' ? config.temperature : 0.35;
    var maxTokens = config.maxTokens || 4096;

    var currentKey = getEffectiveGeminiKey(apiKey);
    var models = FAST_GEMINI_MODELS.slice();
    var lastErr = null;

    for (var i = 0; i < models.length; i++) {
        var m = models[i];
        if (typeof config.onModelSelect === 'function') {
            config.onModelSelect(m);
        }

        try {
            var streamRes = await callGeminiStreaming(currentKey, m, prompt, onChunk, temp, maxTokens);
            if (streamRes && streamRes.trim()) {
                return streamRes;
            }
        } catch (err) {
            console.warn('⚠️ تعذر النموذج (' + m + ')، التحويل التلقائي للبديل:', err.message);
            lastErr = err;
            var msg = (err.message || '').toLowerCase();

            // إذا كان المفتاح غير صالح إطلاقاً، نتوقف فوراً
            if (msg.includes('api key not valid') || msg.includes('api_key_invalid')) {
                throw new Error('رمز الـ API الخاص بـ Google Gemini غير صالح. يرجى التأكد من صحة المفتاح.');
            }

            // إذا كان خطأ تجاوز الحصة المؤقت (429)، نقوم بتدوير المفتاح وتجربة البديل
            if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
                currentKey = rotateSystemGeminiKey();
                await new Promise(function(resolve) { setTimeout(resolve, 1400); });
            }

            continue;
        }
    }

    // محاولة أخيرة عبر الاتصال المباشر غير التدفقي
    for (var j = 0; j < models.length; j++) {
        try {
            var directRes = await callGeminiDirect(currentKey, models[j], prompt, temp, maxTokens);
            if (directRes && directRes.trim()) return directRes;
        } catch (eDirect) {
            lastErr = eDirect;
        }
    }

    throw lastErr || new Error('فشلت نماذج Gemini في الاستجابة. يرجى التحقق من المفتاح واتصالك بالإنترنت.');
}

// دالة البث اللحظي لـ Gemini عبر Server-Sent Events (SSE) مع محلل متين
async function callGeminiStreaming(apiKey, model, prompt, onChunk, temperature, maxTokens) {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':streamGenerateContent?alt=sse&key=' + encodeURIComponent(apiKey);

    var genConfig = {
        temperature: typeof temperature === 'number' ? temperature : 0.35,
        maxOutputTokens: maxTokens || 4096
    };

    var controller = new AbortController();
    var timeoutId = setTimeout(function() {
        controller.abort();
    }, 60000); // مهلة كافية 60 ثانية

    try {
        var res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: genConfig
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            var errData = await res.json().catch(function() { return {}; });
            var errMsg = (errData.error && errData.error.message) || res.statusText;
            throw new Error('Gemini (' + model + ') [' + res.status + ']: ' + errMsg);
        }

        if (!res.body || typeof res.body.getReader !== 'function') {
            var directData = await res.json();
            var fallbackText = extractGeminiResponseText(directData);
            if (typeof onChunk === 'function' && fallbackText) onChunk(fallbackText, fallbackText);
            return fallbackText;
        }

        var reader = res.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var accumulated = '';
        var buffer = '';

        while (true) {
            var r = await reader.read();
            if (r.done) break;

            buffer += decoder.decode(r.value, { stream: true });
            
            // أحداث SSE تفصل بينها أسطر فارغة مزدوجة \n\n
            var events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() || ''; // الحفاظ على الجزء غير المكتمل في النهاية

            for (var i = 0; i < events.length; i++) {
                var eventText = events[i].trim();
                if (!eventText) continue;

                // تجميع كافة أسطر data: في هذا الحدث
                var jsonStr = eventText
                    .split(/\r?\n/)
                    .map(function(l) { return l.trim(); })
                    .filter(function(l) { return l.indexOf('data:') === 0; })
                    .map(function(l) { return l.replace(/^data:\s*/, ''); })
                    .join('\n')
                    .trim();

                if (!jsonStr || jsonStr === '[DONE]') continue;

                try {
                    var parsed = JSON.parse(jsonStr);
                    var candidates = parsed.candidates;
                    if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
                        var parts = candidates[0].content.parts;
                        for (var p = 0; p < parts.length; p++) {
                            var piece = parts[p].text || '';
                            if (piece) {
                                accumulated += piece;
                                if (typeof onChunk === 'function') {
                                    onChunk(piece, accumulated);
                                }
                            }
                        }
                    }
                } catch (eJson) {
                    // تجاهل أي جزء غير مكتمل بعد
                }
            }
        }

        // فحص البقايا إن وجدت
        if (buffer.trim()) {
            var trailingJson = buffer
                .split(/\r?\n/)
                .map(function(l) { return l.trim(); })
                .filter(function(l) { return l.indexOf('data:') === 0; })
                .map(function(l) { return l.replace(/^data:\s*/, ''); })
                .join('\n')
                .trim();
            if (trailingJson && trailingJson !== '[DONE]') {
                try {
                    var pEnd = JSON.parse(trailingJson);
                    var cEnd = pEnd.candidates && pEnd.candidates[0] && pEnd.candidates[0].content && pEnd.candidates[0].content.parts && pEnd.candidates[0].content.parts[0] && pEnd.candidates[0].content.parts[0].text;
                    if (cEnd) {
                        accumulated += cEnd;
                        if (typeof onChunk === 'function') onChunk(cEnd, accumulated);
                    }
                } catch (e) {}
            }
        }

        // إذا تعذر البث بالكامل لأي سبب، نطلب النص عبر generateContent المباشر
        if (!accumulated.trim()) {
            return await callGeminiDirect(apiKey, model, prompt, temperature, maxTokens);
        }

        return accumulated;

    } finally {
        clearTimeout(timeoutId);
    }
}

// استدعاء Gemini غير تدفقي كاحتياطي
async function callGeminiDirect(apiKey, model, prompt, temperature, maxTokens) {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(apiKey);
    var genConfig = {
        temperature: typeof temperature === 'number' ? temperature : 0.35,
        maxOutputTokens: maxTokens || 4096
    };

    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 35000);

    try {
        var res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: genConfig
            }),
            signal: controller.signal
        });

        if (!res.ok) {
            var errJson = await res.json().catch(function() { return {}; });
            var errMsg = (errJson.error && errJson.error.message) || res.statusText;
            throw new Error('Gemini (' + model + ') [' + res.status + ']: ' + errMsg);
        }

        var data = await res.json();
        var text = extractGeminiResponseText(data);
        if (!text || !text.trim()) throw new Error('استجابة فارغة من النموذج.');
        return text;
    } finally {
        clearTimeout(timer);
    }
}

// استدعاء OpenAI / Groq / OpenRouter مع البث اللحظي
async function fetchOpenAiStreamWithFallback(apiKey, endpoint, model, prompt, onChunk, temperature, maxTokens) {
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 40000);

    try {
        var res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: model || 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: typeof temperature === 'number' ? temperature : 0.35,
                max_tokens: maxTokens || 4096,
                stream: true
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            var errData = await res.json().catch(function() { return {}; });
            var errMsg = (errData.error && errData.error.message) || res.statusText;
            throw new Error('API Error: ' + errMsg);
        }

        if (!res.body || typeof res.body.getReader !== 'function') {
            var data = await res.json();
            return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        }

        var reader = res.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var accumulated = '';
        var buffer = '';

        while (true) {
            var r = await reader.read();
            if (r.done) break;

            buffer += decoder.decode(r.value, { stream: true });
            var lines = buffer.split('\n');
            buffer = lines.pop();

            for (var l = 0; l < lines.length; l++) {
                var line = lines[l].trim();
                if (line.indexOf('data: ') === 0) {
                    var jsonStr = line.substring(6).trim();
                    if (!jsonStr || jsonStr === '[DONE]') continue;
                    try {
                        var parsed = JSON.parse(jsonStr);
                        var delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content;
                        if (delta) {
                            accumulated += delta;
                            if (typeof onChunk === 'function') {
                                onChunk(delta, accumulated);
                            }
                        }
                    } catch (eJson) {
                        // تجاهل أخطاء التجزئة
                    }
                }
            }
        }

        if (!accumulated.trim()) {
            throw new Error('لم يرجع تدفق الـ API أي محتوى.');
        }

        return accumulated;

    } finally {
        clearTimeout(timeoutId);
    }
}

export function fetchAiText(provider, apiKey, prompt, onChunk, options, customUrl, customModel) {
    options = options || {};
    var temp = typeof options.temperature === 'number' ? options.temperature : 0.35;
    var maxTokens = options.maxTokens || 4096;

    if (provider === 'gemini') {
        return fetchGeminiStreamWithFallback(apiKey, prompt, onChunk, {
            temperature: temp,
            maxTokens: maxTokens,
            onModelSelect: options.onModelSelect
        });
    } else if (provider === 'groq') {
        if (options.onModelSelect) options.onModelSelect('llama-3.3-70b-versatile');
        return fetchOpenAiStreamWithFallback(apiKey, 'https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile', prompt, onChunk, temp, maxTokens)
            .catch(function(eGroq) {
                console.warn('Groq primary failed, fallback to 8B:', eGroq.message);
                if (options.onModelSelect) options.onModelSelect('llama-3.1-8b-instant');
                return fetchOpenAiStreamWithFallback(apiKey, 'https://api.groq.com/openai/v1/chat/completions', 'llama-3.1-8b-instant', prompt, onChunk, temp, maxTokens);
            });
    } else if (provider === 'openai') {
        if (options.onModelSelect) options.onModelSelect('gpt-4o-mini');
        return fetchOpenAiStreamWithFallback(apiKey, 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', prompt, onChunk, temp, maxTokens);
    }
    var url = (customUrl || '').trim() || 'https://openrouter.ai/api/v1/chat/completions';
    var model = (customModel || '').trim() || 'openrouter/auto';
    if (options.onModelSelect) options.onModelSelect(model);
    return fetchOpenAiStreamWithFallback(apiKey, url, model, prompt, onChunk, temp, maxTokens);
}

// صياغة خطة بحث أكاديمي دقيقة وواقعية بعدد المباحث والمطالب الدقيق دون أي تكرار (مع دعم الفرنسية والإنجليزية)
export function buildPlanPrompt(topic, mabhathCount, matlabCount, cfg, caseStudyCompany, caseStudyRequested, customPlanOptions, lang) {
    var isFr = lang === 'fr';
    var isEn = lang === 'en';
    var exactTopic = (topic || '').trim();
    var customMabahith = customPlanOptions && Array.isArray(customPlanOptions.customMabahith) && customPlanOptions.customMabahith.length > 0
        ? customPlanOptions.customMabahith
        : null;
    var needInferredTitle = !!(customPlanOptions && customPlanOptions.needInferredTitle);
    var mCount = customMabahith ? Math.max(1, Math.min(10, customMabahith.length)) : Math.max(1, parseInt(mabhathCount, 10) || 2);
    var tCount = Math.max(1, parseInt(matlabCount, 10) || 2);
    var cleanCompany = (caseStudyCompany || '').trim();
    var isCaseStudy = !!cleanCompany || !!caseStudyRequested;

    var mabhathAngles = isFr ? [
        'Cadre conceptuel et théorique du sujet',
        'Mécanismes opérationnels et dimensions pratiques',
        'Défis, évaluation critique et perspectives futures',
        'Cadre institutionnel et managérial',
        'Analyse comparative et tendances contemporaines'
    ] : isEn ? [
        'Conceptual and Theoretical Framework',
        'Operational Mechanisms and Practical Dimensions',
        'Challenges, Critical Evaluation and Future Perspectives',
        'Institutional and Managerial Dimensions',
        'Comparative Analysis and Contemporary Trends'
    ] : [
        'الإطار النظري والمفاهيمي للموضوع',
        'الآليات التطبيقية والممارسات العملية للموضوع',
        'التحديات والتقييم والآفاق المستقبلية للموضوع',
        'الأبعاد المؤسسية والقانونية للموضوع',
        'الدراسة التحليلية والمقارنة والاتجاهات الحديثة'
    ];

    var ROMAN_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    var exampleMabahith = [];
    if (customMabahith) {
        for (var ci = 0; ci < mCount; ci++) {
            var cm = customMabahith[ci];
            var ordCm = isFr ? (ROMAN_LABELS[ci] || String(ci + 1)) : isEn ? String(ci + 1) : (ORDINAL_LABELS[ci] || String(ci + 1));
            var existingMatalib = Array.isArray(cm.matalib) && cm.matalib.length > 0 ? cm.matalib : null;
            var cmMatalib = [];
            if (existingMatalib) {
                for (var cj = 0; cj < existingMatalib.length; cj++) {
                    cmMatalib.push({ title: existingMatalib[cj].title });
                }
            } else {
                for (var fk = 0; fk < tCount; fk++) {
                    var ordFk = isFr ? ('Section ' + (fk + 1)) : isEn ? ('Section ' + (fk + 1)) : ('المطلب ' + (ORDINAL_LABELS[fk] || String(fk + 1)));
                    cmMatalib.push({
                        title: ordFk + ': [' + (isFr ? 'Sous-titre spécifique' : isEn ? 'Specific subtitle' : 'عنوان فرعي مناسب وفريد يتبع "' + cm.title + '" دون تكرار') + ']'
                    });
                }
            }
            var mPrefix = isFr ? ('Chapitre ' + ordCm) : isEn ? ('Chapter ' + ordCm) : ('المبحث ' + ordCm);
            exampleMabahith.push({
                title: cm.title || mPrefix,
                matalib: cmMatalib
            });
        }
    } else {
        for (var i = 0; i < mCount; i++) {
            var ordMb = isFr ? (ROMAN_LABELS[i] || String(i + 1)) : isEn ? String(i + 1) : (ORDINAL_LABELS[i] || String(i + 1));
            var angleHint = mabhathAngles[i] || (isFr ? ('Axe analytique ' + ordMb) : isEn ? ('Analytical dimension ' + ordMb) : ('المحور التحليلي ' + ordMb + ' للموضوع'));
            var exampleMatalib = [];
            for (var j = 0; j < tCount; j++) {
                var ordMt = isFr ? ('Section ' + (j + 1)) : isEn ? ('Section ' + (j + 1)) : ('المطلب ' + (ORDINAL_LABELS[j] || String(j + 1)));
                exampleMatalib.push({
                    title: ordMt + (isFr ? ' : [Sous-titre original]' : isEn ? ': [Original subtitle]' : ': [عنوان فرعي جديد وفريد يخص المبحث ' + ordMb + ' فقط ولا يتكرر في غيره]')
                });
            }
            var mbPrefix = isFr ? ('Chapitre ' + ordMb) : isEn ? ('Chapter ' + ordMb) : ('المبحث ' + ordMb);
            exampleMabahith.push({
                title: mbPrefix + (isFr ? ' : [' : isEn ? ': [' : ': [') + angleHint + ']',
                matalib: exampleMatalib
            });
        }
    }

    var schemaObj = {
        title: needInferredTitle ? (isFr ? 'Titre académique précis et concis' : isEn ? 'Precise and concise academic research title' : 'صغ عنواناً أكاديمياً موجزاً ودقيقاً يعبّر عن محاور هذه الخطة دون كتابة كلمة بحث أو خطة') : exactTopic,
        problematic: isFr
            ? 'Formulation d\'une problématique de recherche centrale unique se terminant impérativement par un point d\'interrogation (?)'
            : isEn
            ? 'Formulation of a single core research problem ending strictly with a question mark (?)'
            : 'صياغة إشكالية رئيسية واحدة فقط للبحث تكون جوهرية ومحكمة وتنتهي حتماً بعلامة استفهام (؟) كنص نثري متصل دون أي مطات أو نقاط ودون أي تساؤلات فرعية',
        hypotheses: isFr ? ['Première hypothèse...', 'Deuxième hypothèse...'] : isEn ? ['First hypothesis...', 'Second hypothesis...'] : ['الفرضية الأولى...', 'الفرضية الثانية...'],
        methodology: isFr ? 'Méthodologie descriptive et analytique' : isEn ? 'Descriptive and Analytical Methodology' : 'المنهج الوصفي التحليلي',
        mabahith: exampleMabahith
    };
    if (isCaseStudy && !cleanCompany) {
        schemaObj.caseStudyCompany = isFr ? 'Nom d\'une entreprise ou institution réelle' : isEn ? 'Name of a real corporation or institution' : 'اسم شركة أو مؤسسة أو هيئة حقيقية مناسبة تماماً لتطبيق هذا الموضوع (مثل مؤسسة جزائرية أو عربية معروفة، دون كتابة عبارة دراسة حالة قبل الاسم)';
    }
    var schemaPreview = JSON.stringify(schemaObj, null, 2);

    if (isFr) {
        return 'Tu es un éminent professeur d\'université et doyen académique. Tu dois concevoir un plan de recherche universitaire rigoureux, équilibré et de haut niveau académique en français au format JSON strict.\n' +
        'Titre exact demandé : « ' + exactTopic + ' »\n' +
        'Nombre de chapitres requis exactement : ' + mCount + ' chapitres.\n' +
        'Nombre de sections par chapitre exactement : ' + tCount + ' sections (soit un total de ' + (mCount * tCount) + ' sections distinctes).\n\n' +
        'Règles strictes :\n' +
        '1. Le tableau mabahith doit contenir exactement ' + mCount + ' chapitres, et chaque chapitre doit contenir exactement ' + tCount + ' sections.\n' +
        '2. Les titres de chapitres doivent être formulés sous la forme « Chapitre I : ... », « Chapitre II : ... ».\n' +
        '3. Les titres de sections doivent être formulés sous la forme « Section 1 : ... », « Section 2 : ... » sans aucun formatage markdown (** ou #).\n' +
        '4. Chaque chapitre et section doit traiter un aspect original et non redondant.\n' +
        '5. Formule une problématique claire se terminant par (?) et des hypothèses pertinentes.\n\n' +
        'Tu dois renvoyer UNIQUEMENT un objet JSON valide conforme à ce schéma sans texte additionnel ni balises markdown :\n' +
        schemaPreview;
    }

    if (isEn) {
        return 'You are a distinguished university professor and academic dean. Generate a rigorous, well-structured academic research outline in English in strict JSON format.\n' +
        'Exact Research Title: « ' + exactTopic + ' »\n' +
        'Required Chapters count: exactly ' + mCount + ' chapters.\n' +
        'Required Sections per chapter: exactly ' + tCount + ' sections (total of ' + (mCount * tCount) + ' distinct sections).\n\n' +
        'Strict Guidelines:\n' +
        '1. The mabahith array must contain exactly ' + mCount + ' chapters, each with ' + tCount + ' sections in matalib.\n' +
        '2. Chapter titles formatted as « Chapter 1: ... », « Chapter 2: ... ».\n' +
        '3. Section titles formatted as « Section 1: ... », « Section 2: ... » without markdown asterisks (** or #).\n' +
        '4. Each section must cover a unique academic angle without repetition.\n' +
        '5. Formulate a single core research problem ending with (?) and valid hypotheses.\n\n' +
        'Return ONLY valid JSON matching this structure without any surrounding markdown code fences or explanatory text:\n' +
        schemaPreview;
    }

    var casePlanNote = '';
    if (cleanCompany) {
        casePlanNote = ' (وتُضاف لاحقاً «دراسة حالة: ' + cleanCompany + '» بزيادة مستقلة من 1 إلى 3 صفحات فوق هذا النطاق دون اختصار المباحث).';
    } else if (isCaseStudy) {
        casePlanNote = ' (وتُضاف لاحقاً «دراسة حالة» تطبيقية مستقلة بزيادة من 1 إلى 3 صفحات فوق هذا النطاق دون اختصار المباحث).';
    } else {
        casePlanNote = '.';
    }

    var caseRule = isCaseStudy
        ? '\n4. تنبيه إلزامي: المباحث الـ ' + mCount + ' مخصصة حصراً للإطار النظري والتحليلي العام للموضوع؛ ممنوع تسمية أي مبحث بـ «دراسة حالة» داخل مصفوف mabahith، لأن دراسة الحالة ستُكتب في قسم مستقل تماماً بعد المباحث وقبل الخاتمة.' +
          (!cleanCompany ? ' واختر في حقل caseStudyCompany اسم مؤسسة حقيقية ملائمة لتطبيق هذا الموضوع.' : '')
        : '';

    if (customMabahith) {
        var totalMatalibCount = exampleMabahith.reduce(function(acc, mb) { return acc + (mb.matalib ? mb.matalib.length : 0); }, 0);
        return 'أنت عميد أكاديمي ومحكم أبحاث ودراسات عليا. قدّم الطالب **خطة بحث محددة مسبقاً** ويريد توليد البحث بناءً عليها بالضبط دون تغيير عناوينها. أرجع كائن JSON صالحاً فقط دون أي شروحات أو كتل ماركداون.\n' +
        (needInferredTitle
            ? 'العنوان المبدئي المستخلص: «' + exactTopic + '» — لم يكتب الطالب عنواناً مستقلاً، لذا صغ في حقل title عنواناً أكاديمياً موجزاً ورصيناً يعبّر عن كامل محاور خطته (دون كلمة «بحث» أو «خطة» وبلا «دراسة حالة»).\n'
            : 'العنوان الدقيق المطلوب للبحث (التزم بهذا العنوان حرفياً كما هو): «' + exactTopic + '»\n') +
        'عدد المباحث المطلوبة من خطة الطالب: ' + mCount + ' مباحث (بإجمالي ' + totalMatalibCount + ' مطلباً).\n' +
        'حجم البحث الأساسي للمباحث: ' + cfg.targetPages + casePlanNote + '\n\n' +
        'قواعد صارمة لا يُسمح بمخالفتها:\n' +
        '1. التزم حرفياً بجميع عناوين المباحث والمطالب المكتوبة مسبقاً في قالب schema أدناه دون حذف أو تغيير صياغة أو إعادة تسمية (ولا تقلق بشأن المقدمة والخاتمة والمراجع لأنها ستُصاغ تلقائياً في مراحل مستقلة قبل وبعد هذه المباحث).\n' +
        '2. أي عنوان مبحث أو مطلب مرمّز بين قوسين [...] داخل الخطة فقط يجب استبداله بعنوان أكاديمي أصيل ومتميز ينسجم مع بقية الخطة دون تكرار.\n' +
        '3. صغ إشكالية رئيسية واحدة رصينة وفرضيات ومنهجاً تتطابق تماماً مع محاور خطة الطالب المحددة.' +
        (caseRule ? caseRule : '') + '\n\n' +
        'يجب أن تُرجع كائن JSON صالح 100% حصراً بنفس البنية وعدد العناصر تماماً دون نصوص خارج الأقواس:\n' +
        schemaPreview;
    }

    return 'أنت عميد أكاديمي ومحكم أبحاث ودراسات عليا. المطلوب منك وضع خطة بحث أكاديمي دقيقة ومحكمة متناسقة مع موضوع البحث بصيغة JSON فقط دون أي شروحات إضافية أو كتل ماركداون.\n' +
    'العنوان الدقيق المطلوب للبحث (التزم بهذا العنوان حرفياً كما هو دون تغيير أي كلمة أو إعادة صياغة): «' + exactTopic + '»\n' +
    'عدد المباحث المطلوبة بالضبط: ' + mCount + ' مباحث.\n' +
    'عدد المطالب في كل مبحث بالضبط: ' + tCount + ' مطالب (بإجمالي ' + (mCount * tCount) + ' مطلباً مختلفاً تماماً).\n' +
    'حجم البحث الأساسي للمباحث: ' + cfg.targetPages + casePlanNote + '\n\n' +
    'قواعد صارمة لا يُسمح بمخالفتها:\n' +
    '1. يجب أن يحتوي مصفوف mabahith على ' + mCount + ' عناصر بالضبط، وأن يحتوي حقل matalib في كل مبحث على ' + tCount + ' عناصر بالضبط دون نقصان أي مطلب.\n' +
    '2. ممنوع منعاً باتاً تكرار نفس عناوين المطالب أو نسخ خطة المبحث الأول داخل المبحث الثاني أو الثالث؛ يجب أن يعالج كل مبحث زاوية علمية مستقلة بمطالب جديدة وفريدة تماماً لا تتشابه لفظياً ولا موضوعياً مع مطالب أي مبحث آخر.\n' +
    '3. التزم حرفياً بكتابة العناوين بصيغة «المبحث الأول: ...» و«المطلب الأول: ...» دون أي علامات ماركداون مثل ** أو #.' + caseRule + '\n\n' +
    'يجب أن تُرجع كائن JSON صالح 100% حصراً بنفس البنية وعدد العناصر تماماً دون نصوص خارج الأقواس:\n' +
    schemaPreview;
}

// صياغة مقدمة أكاديمية كاملة مع هوامش مرقمة (مع دعم الفرنسية والإنجليزية)
export function buildIntroPrompt(plan, cfg, caseStudyCompany, caseStudyRequested, lang) {
    var isFr = lang === 'fr';
    var isEn = lang === 'en';

    if (isFr) {
        var rawProbFr = (plan && plan.problematic ? String(plan.problematic) : '').trim();
        if (rawProbFr && !/[?]$/.test(rawProbFr)) rawProbFr += ' ?';
        if (!rawProbFr) rawProbFr = "Quelles sont les dimensions conceptuelles et pratiques de « " + (plan.title || 'ce sujet') + " », et comment optimiser ses mécanismes opérationnels ?";
        return "Tu es un éminent professeur d'université et chercheur académique francophone. Rédige l'introduction générale académique complète de cette recherche :\n" +
        "Titre de la recherche : « " + plan.title + " »\n" +
        "Problématique centrale : " + rawProbFr + "\n\n" +
        "Exigences de longueur : environ " + cfg.introWords + " mots rédigés dans un style académique soutenu et rigoureux.\n\n" +
        "Structure méthodologique de l'introduction :\n" +
        "1. Commence immédiatement par :\nIntroduction :\n" +
        "2. Développe les paragraphes suivants de façon fluide et continue sans intertitres séparés :\n" +
        "   - Cadre contextuel et accroche scientifique du sujet.\n" +
        "   - Définitions conceptuelles des termes clés.\n" +
        "   - Intérêt théorique et portée pratique de la recherche.\n" +
        "   - Énoncé explicite de la problématique centrale se terminant impérativement par un point d'interrogation (ex: « La problématique centrale s'articule ainsi autour de l'interrogation suivante : " + rawProbFr + " »).\n" +
        "   - Formulation des hypothèses de recherche et méthodologie adoptée.\n" +
        "   - Annonce claire du plan des chapitres.\n" +
        "3. Insère des appels de notes de bas de page [1], [2] à la fin des paragraphes.\n" +
        "4. Termine obligatoirement par la section des notes :\n" +
        "Notes de bas de page :\n" +
        "[1] Auteur, Titre de l'ouvrage, Éditeur, Année, p. X.\n" +
        "[2] Auteur, Titre de l'article, Revue scientifique, Vol. X, N° Y, Année, p. Z.";
    }

    if (isEn) {
        var rawProbEn = (plan && plan.problematic ? String(plan.problematic) : '').trim();
        if (rawProbEn && !/[?]$/.test(rawProbEn)) rawProbEn += '?';
        if (!rawProbEn) rawProbEn = "What are the theoretical and operational dimensions of « " + (plan.title || 'this topic') + " », and how can its strategic frameworks be optimized?";
        return "You are a distinguished university professor and academic researcher. Write the complete, peer-reviewed standard academic introduction for this paper:\n" +
        "Research Title: « " + plan.title + " »\n" +
        "Central Problem / Question: " + rawProbEn + "\n\n" +
        "Length requirement: approximately " + cfg.introWords + " words in rigorous, formal academic English.\n\n" +
        "Methodological structure of the Introduction:\n" +
        "1. Start directly on line 1 with:\nIntroduction:\n" +
        "2. Develop cohesive, well-connected academic paragraphs without arbitrary section subheadings:\n" +
        "   - Background overview and contextual rationale.\n" +
        "   - Academic definitions and conceptual framework.\n" +
        "   - Significance and scholarly relevance of the study.\n" +
        "   - Statement of the central research problem ending with a question mark (?).\n" +
        "   - Research hypotheses and methodological approach.\n" +
        "   - Brief outline of the study chapters.\n" +
        "3. Insert footnote markers [1], [2] in text.\n" +
        "4. Conclude with the footnotes block:\n" +
        "Footnotes:\n" +
        "[1] Author, Book Title, Publisher, Year, p. X.\n" +
        "[2] Author, Article Title, Academic Journal, Vol. X, No. Y, Year, p. Z.";
    }

    var rawProb = (plan && plan.problematic ? String(plan.problematic) : '').trim();
    if (rawProb && !/[؟?]$/.test(rawProb)) rawProb += '؟';
    if (!rawProb) rawProb = 'ما هي الأبعاد المفاهيمية والتطبيقية المرتبطة بـ ' + (plan.title || 'هذا الموضوع') + '، وكيف تسهم في الارتقاء بالأداء والممارسات العملية؟';
    var cleanCompany = (caseStudyCompany || '').trim();
    var caseNote = cleanCompany
        ? 'ملاحظة سياقية: يختم هذا البحث مباحثه النظرية بدراسة حالة تطبيقية حول «' + cleanCompany + '»، أشر بإيجاز في التمهيد إلى البعد التطبيقي مع الالتزام التام بأن تتوقف المقدمة عند الإشكالية الرئيسية الواحدة.\n'
        : (caseStudyRequested
            ? 'ملاحظة سياقية: يختم هذا البحث مباحثه النظرية بدراسة حالة تطبيقية ميدانية مرتبطة بالموضوع، أشر بإيجاز في التمهيد إلى البعد التطبيقي مع الالتزام التام بأن تتوقف المقدمة عند الإشكالية الرئيسية الواحدة.\n'
            : '');

    var axesSummary = (plan && Array.isArray(plan.mabahith) ? plan.mabahith : [])
        .map(function(m) { return m && m.title ? m.title : ''; })
        .filter(Boolean)
        .join(' — ');
    var axesNote = axesSummary
        ? 'محاور البحث الأساسية (للتمهيد المفاهيمي المتناسق فقط دون سرد خطة البحث أو العناوين بعد الإشكالية): ' + axesSummary + '\n'
        : '';

    return 'أنت بروفيسور وعالم أكاديمي خبير. اكتب مقدمة بحث علمي رصينة ومحكمة:\n' +
    'عنوان البحث: ' + plan.title + '\n' +
    'الإشكالية الرئيسية المحددة للبحث: ' + rawProb + '\n' +
    axesNote +
    caseNote + '\n' +
    'معيار الطول والحجم المطلوب:\n' +
    '- الطول الإجمالي للمقدمة: حوالي ' + cfg.introWords + ' كلمة (' + cfg.introParagraphs + ').\n\n' +
    'القواعد المنهجية الصارمة:\n' +
    '1. ابدأ السطر الأول مباشرة بـ:\nالمقدمة:\n' +
    '2. هيكل متن المقدمة:\n' +
    '   - اكتب تمهيداً أكاديمياً تحليلياً موسعاً يؤطر للموضوع مفاهيمياً وعملياً، مع توثيق الإحالات بأرقام ^1 و ^2 في نهايات الفقرات التمهيدية.\n' +
    '   - اختم متن المقدمة مباشرة بصياغة الإشكالية الرئيسية الواحدة المحددة في فقرة نثرية انسيابية (مثال: وتتحدد إشكالية هذا البحث في التساؤل الجوهري التالي: [الإشكالية]؟).\n' +
    '3. شرط حاسم وقاطع لا يقبل الاستثناء: الإشكالية هي آخر كتابة وآخر جملة في متن المقدمة تماماً!\n' +
    '   - ممنوع منعاً باتاً ومطلقاً كتابة أي نص أو فقرات أو عناوين بعد الإشكالية.\n' +
    '   - ممنوع كتابة: أهمية البحث، أهداف البحث، الفرضيات، المنهج المتبع، خطة البحث، أو أي شروح بعد الإشكالية.\n' +
    '   - يجب أن تتوقف كتابة متن المقدمة مباشرة وبشكل نهائي عند علامة الاستفهام (؟) الخاصة بالإشكالية.\n' +
    '   - يُمنع وضع الإشكالية على شكل قائمة نقطية أو مطات (- أو *)، بل تصاغ كفقرة نثرية رصينة.\n' +
    '   - يُمنع صياغة أي تساؤلات أو أسئلة فرعية نهائياً (إشكالية رئيسية واحدة فقط).\n' +
    '4. ضع قسم الهوامش التوثيقية التابع للمقدمة فقط في السطور الأخيرة:\n' +
    'الهوامش:\n' +
    '^1 اسم المؤلف، عنوان المرجع، دار النشر، المدينة، سنة النشر، الصفحة.\n' +
    '^2 اسم الباحث، عنوان المقال، اسم المجلة المحكمة، المجلد، العدد، السنة، الصفحة.';
}

// تنقية المقدمة والتأكد من وجود إشكالية رئيسية واحدة تنتهي بـ (؟) كنص نثري متصل، وأن الإشكالية هي آخر كتابة في متن المقدمة تماماً
export function cleanIntroText(txt, lang) {
    if (!txt) return '';
    var res = String(txt).replace(/\r\n/g, '\n');
    var isFr = lang === 'fr';
    var isEn = lang === 'en';
    var isLatin = isFr || isEn;

    if (isLatin) {
        res = res.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
        return res;
    }

    // فصل قسم الهوامش إن وجد في نهاية المقدمة لحمايته
    var fnMatch = res.match(/\n\s*(?:#+\s*)?(?:الهوامش|المراجع|قائمة\s+الهوامش)\s*:?\s*\n+[\s\S]*$/i);
    var footnotesBlock = '';
    var body = res;

    if (fnMatch && typeof fnMatch.index === 'number') {
        footnotesBlock = fnMatch[0];
        body = res.substring(0, fnMatch.index);
    }

    // 1. إزالة أي كتل للتساؤلات أو الأسئلة أو الإشكاليات الفرعية الممتدة في أسطر مستقلة أو قوائم
    var subPattern = /\n\s*(?:(?:وتتفرع|ويتفرع|وتنبثق|وينبثق|ويندرج|وتندرج|وتتمحور|ويمكن\s+تفريغ|ويمكن\s+طرح)\s+(?:عن|تحت|ضمن|حول|من)\s+(?:هذه\s+)?(?:الإشكالية|الإشكال|التساؤل|السؤال|الدراسة)[^\n]*|ال?(?:أسئلة|تساؤلات|إشكاليات)\s+الفرعية[^\n]*|تساؤلات\s+فرعية[^\n]*|أسئلة\s+فرعية[^\n]*)[\s\S]*?(?=\n\s*(?:(?:أهمية|الأهمية|أهداف|الأهداف|منهج|المنهج|دوافع|الدوافع|أسباب|الأسباب|خطة|الخطة|هيكل|الهيكل|فرضيات|الفرضيات|الهوامش|المصادر|المراجع)(?:\s|:|\n)|#|\n\n[^\n-*\d]|$))/gi;
    body = body.replace(subPattern, '');

    // 2. إزالة أي جمل فرعية داخل نفس السطر مثل: وتتفرع عن هذه الإشكالية التساؤلات التالية: ...
    body = body.replace(/(?:وتتفرع|ويتفرع|وتنبثق|وينبثق)\s+(?:عن|من)\s+(?:هذه\s+)?(?:الإشكالية|الدراسة)[^\n]+[؟?]/gi, '');

    // 3. تحويل الإشكالية إذا كانت متبوعة بقائمة أسئلة نقطية: الاحتفاظ بالسؤال الرئيسي الأول فقط نثرياً وحذف الباقي
    body = body.replace(
        /(?:(?:طرح\s+)?الإشكالية|إشكالية\s+البحث|التساؤل\s+الرئيسي)\s*:?\s*\n+(?:\s*[-*•\d\.\)-]+\s*([^\n]+[؟?]))(?:\s*\n+\s*[-*•\d\.\)-]+\s*[^\n]+[؟?])*/gi,
        function(match, firstQuestion) {
            return '\n\nوتتحدد إشكالية هذا البحث في التساؤل الجوهري التالي: ' + firstQuestion.trim();
        }
    );

    // 4. إزالة أي مطات أو نقاط تبدأ بها جملة الإشكالية: مثل "- الإشكالية: كيف...؟" أو "• الإشكالية: كيف...؟"
    body = body.replace(
        /\n\s*[-*•\d\.\)-]+\s*(?:(?:طرح\s+)?(?:الإشكالية|إشكالية\s+البحث)|التساؤل\s+الرئيسي)\s*:?\s*([^\n]+[؟?])/gi,
        '\n\nوتتحدد إشكالية هذا البحث في التساؤل الجوهري التالي: $1'
    );

    // 5. إذا كانت الإشكالية مكتوبة وبداخل نفس السطر مطة: "الإشكالية: - كيف...؟"
    body = body.replace(
        /((?:(?:طرح\s+)?(?:الإشكالية|إشكالية\s+البحث)|التساؤل\s+الرئيسي)\s*:?\s*)[-*•]\s*/gi,
        '$1'
    );

    // 6. إذا كان هناك سطر نقطي منفرد يحتوي على سؤال رئيسي ينتهي بـ ؟
    body = body.replace(
        /\n\s*(?:[-*•]|\d+[\.\)-])\s*((?:ما|ماذا|كيف|هل|إلى\s+أي\s+مدى|لماذا|أين|متى|من|فما|فكيف)\s+[^\n]+[؟?])/gi,
        '\n\nوتتحدد إشكالية هذا البحث في التساؤل الجوهري التالي: $1'
    );

    // 7. إزالة أي تكرار لعبارة التمهيد للإشكالية
    body = body.replace(/(?:وتتحدد إشكالية هذا البحث في التساؤل الجوهري التالي:\s*)+/g, 'وتتحدد إشكالية هذا البحث في التساؤل الجوهري التالي: ');

    // 8. تحويل أي علامات استفهام لاتينية ? إلى عربية ؟
    body = body.replace(/([؟?])+/g, '؟');

    // 9. إذا كانت فقرة الإشكالية لا تنتهي بعلامة استفهام، نضيف علامة الاستفهام العربية
    body = body.replace(/((?:الإشكالية|إشكالية\s+البحث|طرح\s+الإشكالية)[^:\n]*:\s*[^\n]+?)(?=[.\s]*$)/gm, function(match) {
        var trimmed = match.trim();
        if (!trimmed.endsWith('؟')) {
            return trimmed.replace(/[.\s]+$/, '') + '؟';
        }
        return match;
    });

    // 10. إزالة أي مطات متبقية عشوائياً قبل جملة الإشكالية في بداية السطر
    body = body.replace(/\n\s*[-*•]\s*(?=وتتحدد إشكالية)/g, '\n');

    // 11. الشرط الصارم: الإشكالية هي آخر كتابة في متن المقدمة تماماً (حذف أي نصوص أو عناوين أو فقرات بعدها)
    var probRegexes = [
        /(?:(?:وتتحدد|وتتمحور|وانطلاقاً\s+مما\s+سبق،?\s*تتحدد|بناءً\s+على\s+ما\s+تقدم،?\s*تطرح|ومن\s+هنا\s+تتحدد|ويمكن\s+صياغة|وتتبلور)\s+(?:إشكالية|الإشكالية)|(?:طرح\s+)?(?:الإشكالية|إشكالية\s+البحث)|التساؤل\s+الرئيسي)[^:\n]*:?[^\n؟?]*[؟?]/i,
        /(?:الإشكالية|إشكالية)[^؟?]*[؟?]/i,
        /\b(?:ما|ماذا|كيف|هل|إلى\s+أي\s+مدى|لماذا|أين|متى|من|فما|فكيف)\s+[^؟?\n]+؟/i
    ];

    for (var i = 0; i < probRegexes.length; i++) {
        var matchProb = body.match(probRegexes[i]);
        if (matchProb && typeof matchProb.index === 'number') {
            var endPos = matchProb.index + matchProb[0].length;
            body = body.substring(0, endPos).trim();
            break;
        }
    }

    // 12. ضبط الفراغات وتكرار الأسطر الفارغة
    body = body.replace(/\n{3,}/g, '\n\n').trim();

    // 13. تصفية الهوامش لتشمل فقط المراجع المذكورة فعلياً في المتن المتبقي
    if (footnotesBlock) {
        var citedNumbers = new Set();
        var citationMatches = body.matchAll(/\^(\d+)/g);
        for (var cm of citationMatches) {
            citedNumbers.add(parseInt(cm[1], 10));
        }

        var fnLines = footnotesBlock.split('\n');
        var keptFnLines = [];
        var headerKept = false;

        for (var fl of fnLines) {
            var trimmedFl = fl.trim();
            if (!trimmedFl) continue;
            if (/^(?:#+\s*)?(?:الهوامش|المراجع|قائمة\s+الهوامش)\s*:?$/i.test(trimmedFl)) {
                keptFnLines.push(trimmedFl);
                headerKept = true;
                continue;
            }

            var fnNumMatch = trimmedFl.match(/^[\^\[\(]?\s*(\d+)[\.\)\]\-]?/);
            if (fnNumMatch) {
                var num = parseInt(fnNumMatch[1], 10);
                if (citedNumbers.size === 0 || citedNumbers.has(num)) {
                    keptFnLines.push(trimmedFl);
                }
            } else {
                keptFnLines.push(trimmedFl);
            }
        }

        if (keptFnLines.length > 1 || (!headerKept && keptFnLines.length > 0)) {
            return body + '\n\n' + keptFnLines.join('\n');
        }
    }

    return body;
}

// صياغة مبحث أكاديمي كامل ومطالبه مع هوامش مرقمة لكل مطلب (مع دعم الفرنسية والإنجليزية)
export function buildMabhathPrompt(plan, mb, targetWordsPerMb, cfg, caseStudyRequested, lang) {
    var isFr = lang === 'fr';
    var isEn = lang === 'en';

    if (isFr) {
        var matalibFr = mb.matalib || [];
        var mtCountFr = matalibFr.length;
        var minMatlabWordsFr = (cfg && cfg.minMatlabWords) || 400;
        var perMatlabWordsFr = Math.max(minMatlabWordsFr, Math.round((targetWordsPerMb || 600) / Math.max(1, mtCountFr)));
        var matalibListFr = matalibFr.map(function(mt, mIdx) {
            return (mt.title || ('Section ' + (mIdx + 1)));
        }).join('\n');
        return "Tu es un enseignant-chercheur universitaire. Rédige le contenu intégral et approfondi de ce chapitre :\n" +
        "Titre de la recherche : " + plan.title + "\n" +
        "Chapitre à rédiger : " + mb.title + "\n" +
        "Sections obligatoires à rédiger dans l'ordre :\n" + matalibListFr + "\n\n" +
        "Exigences de rédaction :\n" +
        "- Rédige environ " + perMatlabWordsFr + " mots par section (3 à 4 paragraphes académiques substantiels, denses et rigoureux).\n" +
        "- Écris le titre exact de chaque section sur une ligne indépendante sans markdown (** ou #).\n" +
        "- Insère des appels de notes de bas de page [1], [2]... avec références précises.\n" +
        "- Si pertinent pour le sujet, inclus un tableau au format Markdown :\n" +
        "  Tableau n° (01) : [Titre du tableau]\n" +
        "  | Critère | Dimension A | Dimension B |\n" +
        "  | ... | ... | ... |\n" +
        "- Conclus chaque section par ses notes de bas de page :\n" +
        "Notes de bas de page :\n" +
        "[1] Auteur, Titre de l'ouvrage, Éditeur, Année, p. X.\n\n" +
        "Règles strictes :\n" +
        "1. Commence immédiatement par le titre du chapitre :\n" + mb.title + "\n" +
        "2. Rédige l'intégralité des " + mtCountFr + " sections sans en omettre aucune.\n" +
        "3. Ne rédige pas d'introduction générale ni de conclusion dans ce chapitre.";
    }

    if (isEn) {
        var matalibEn = mb.matalib || [];
        var mtCountEn = matalibEn.length;
        var minMatlabWordsEn = (cfg && cfg.minMatlabWords) || 400;
        var perMatlabWordsEn = Math.max(minMatlabWordsEn, Math.round((targetWordsPerMb || 600) / Math.max(1, mtCountEn)));
        var matalibListEn = matalibEn.map(function(mt, mIdx) {
            return (mt.title || ('Section ' + (mIdx + 1)));
        }).join('\n');
        return "You are a university professor and researcher. Write the full comprehensive academic text for this chapter:\n" +
        "Research Title: " + plan.title + "\n" +
        "Chapter to write: " + mb.title + "\n" +
        "Required Sections to develop:\n" + matalibListEn + "\n\n" +
        "Writing Requirements:\n" +
        "- Write approximately " + perMatlabWordsEn + " words per section (3 to 4 substantial, evidence-based academic paragraphs).\n" +
        "- Write each section title on an independent line without markdown bold (** or #).\n" +
        "- Insert footnote references [1], [2]... with full academic citations.\n" +
        "- Where appropriate, incorporate a Markdown table:\n" +
        "  Table 1: [Table Title]\n" +
        "  | Metric | Dimension A | Dimension B |\n" +
        "  | ... | ... | ... |\n" +
        "- Conclude each section with its footnotes:\n" +
        "Footnotes:\n" +
        "[1] Author, Book Title, Publisher, Year, p. X.\n\n" +
        "Strict Guidelines:\n" +
        "1. Start directly on line 1 with the chapter title:\n" + mb.title + "\n" +
        "2. Develop all " + mtCountEn + " sections thoroughly in sequence.\n" +
        "3. Do not include a general introduction or conclusion in this chapter.";
    }

    var matalib = mb.matalib || [];
    var mtCount = matalib.length;
    // حد أدنى لكل مطلب يكفي لملء صفحة A4 بنسبة 85%–95% (انظر معايرة LENGTH_CONFIGS)
    var minMatlabWords = (cfg && cfg.minMatlabWords) || 400;
    var perMatlabWords = Math.max(minMatlabWords, Math.round((targetWordsPerMb || 600) / Math.max(1, mtCount)));
    var effectiveMbWords = Math.max(targetWordsPerMb || 0, perMatlabWords * Math.max(1, mtCount));
    var matalibList = matalib.map(function(mt, mIdx) {
        return (mt.title || ('المطلب ' + (ORDINAL_LABELS[mIdx] || (mIdx + 1))));
    }).join('\n');
    var lastMatlabTitle = matalib[mtCount - 1] ? matalib[mtCount - 1].title : '';
    var otherMabahith = (plan.mabahith || []).filter(function(other) {
        return other && other.title && other.title !== mb.title;
    }).map(function(other) {
        return '- ' + other.title;
    }).join('\n');

    return 'أنت باحث أكاديمي متخصص. اكتب متن هذا المبحث الأكاديمي كاملاً بأسلوب علمي رصين ومفصل دون اختصار مخل:\n' +
    'عنوان البحث العام: ' + plan.title + '\n' +
    'المبحث المطلوب كتابته حصراً الآن: ' + mb.title + '\n' +
    (otherMabahith ? 'بقية مباحث البحث (للتكامل فقط — ممنوع تكرار محاورها أو إعادة كتابة مطالبها هنا):\n' + otherMabahith + '\n' : '') +
    'جميع المطالب المطلوب كتابتها كاملة داخل هذا المبحث (' + mtCount + ' مطالب بالضبط):\n' + matalibList + '\n\n' +
    'معيار الطول والحجم المطلوب:\n' +
    '- الطول الإجمالي المطلوب لهذا المبحث كاملاً بجميع مطالبه الـ ' + mtCount + ' هو: حوالي ' + effectiveMbWords + ' كلمة (أي نحو ' + perMatlabWords + ' كلمة متوازنة لكل مطلب دون إطالة مفرطة في الأول والثاني تؤدي لاختصار أو حذف: ' + lastMatlabTitle + ').\n' +
    '- لكل مطلب: اكتب ' + cfg.matlabParagraphs + '، مع إحالات وهوامش توثيقية حقيقية.\n' +
    '- لا يقل متن أي مطلب عن ' + minMatlabWords + ' كلمة (ما يملأ صفحة A4 تقريباً)، وتجنب الفقرات القصيرة جداً (أقل من 70 كلمة) والجمل المبتورة؛ الإطالة تكون بالتحليل والأمثلة والمناقشة لا بالحشو والتكرار.\n\n' +
    buildVisualsGuide(1, true) + '\n\n' +
    'الشروط الصارمة:\n' +
    '1. ابدأ بالسطر الأول مباشرة بعنوان المبحث كنص صريح دون أي نجمات أو رموز ماركداون (** أو # أو أرقام قبله):\n' + mb.title + '\n' +
    '2. التزم بكتابة كل المطالب المذكورة أعلاه بالترتيب وعددها (' + mtCount + ') دون دمج أو إسقاط أو اختصار أي مطلب منها، واكتب عنوان كل مطلب في سطر مستقل تماماً كما هو حرفياً دون وضع أرقام مثل 1. أو 3. ودون ** أو # قبل كلمة «المطلب»، متبوعاً بمتنه ثم هوامشه كالتالي:\n' +
    (matalib[0] ? matalib[0].title : 'المطلب الأول: [عنوان المطلب]') + '\n' +
    '(اكتب فقرات علمية تحليلية رصينة تناقش هذا المطلب بأمثلة ومفاهيم واضحة، مع وضع أرقام الهوامش ^1 و ^2 في نهايات الفقرات).\n' +
    'الهوامش:\n' +
    '^1 اسم المؤلف، عنوان الكتاب الأكاديمي، دار النشر، سنة الطبع، ص...\n' +
    '^2 اسم المؤلف، عنوان الدراسة، دار النشر، سنة الطبع، ص...\n' +
    '(يمكن أن يرد الجدول أو الشكل البياني — إن اقتضاه المطلب — داخل المتن قبل قسم الهوامش، ويأخذ ترقيماً تسلسلياً يبدأ من (01)).\n' +
    '3. كرر نفس البنية العلمية المفصلة لجميع المطالب الـ ' + mtCount + ' كاملة وصولاً إلى كتابة (' + lastMatlabTitle + ') بالكامل مع قسم الهوامش الخاص به.\n' +
    '4. لا تكتب مقدمة عامة ولا خاتمة ولا تكتب عنوان مبحث آخر غير (' + mb.title + ').' +
    (caseStudyRequested ? '\n5. تخصص دراسة الحالة التطبيقية في قسم مستقل لاحق بعد المباحث؛ لذا ركّز في هذا المبحث على التحليل العلمي والمفاهيمي والتنظيمي لمطالبه دون استباق دراسة الحالة.' : '');
}

// استكمال مطالب ناقصة داخل مبحث لم يكمل النموذج كل مطالبه المحددة
export function buildMissingMatalibPrompt(plan, mb, missingMatalib, perMatlabWords, cfg, lang) {
    var isFr = lang === 'fr';
    var isEn = lang === 'en';

    if (isFr) {
        var listFr = (missingMatalib || []).map(function(mt) { return mt.title; }).join('\n');
        return "Tu es un enseignant-chercheur universitaire. Les sections suivantes du chapitre « " + mb.title + " » doivent être rédigées maintenant de façon complète et approfondie :\n" +
        "Titre de la recherche : " + plan.title + "\n" +
        "Chapitre : " + mb.title + "\n" +
        "Sections à rédiger maintenant :\n" + listFr + "\n\n" +
        "Exigences :\n" +
        "- Écris le titre exact de chaque section sur une ligne indépendante.\n" +
        "- Rédige environ " + Math.max(perMatlabWords || 0, 380) + " mots par section avec des paragraphes académiques rigoureux.\n" +
        "- Insère des appels de notes de bas de page [1], [2]... et termine par :\n" +
        "Notes de bas de page :\n" +
        "[1] Auteur, Titre de l'ouvrage, Éditeur, Année, p. X.";
    }

    if (isEn) {
        var listEn = (missingMatalib || []).map(function(mt) { return mt.title; }).join('\n');
        return "You are a university professor. The following sections of chapter « " + mb.title + " » need to be written now in full detail:\n" +
        "Research Title: " + plan.title + "\n" +
        "Chapter: " + mb.title + "\n" +
        "Sections to write now:\n" + listEn + "\n\n" +
        "Guidelines:\n" +
        "- Write each section title on an independent line.\n" +
        "- Write approximately " + Math.max(perMatlabWords || 0, 380) + " words per section with rigorous academic paragraphs.\n" +
        "- Insert footnotes [1], [2]... and conclude with:\n" +
        "Footnotes:\n" +
        "[1] Author, Book Title, Publisher, Year, p. X.";
    }

    var list = (missingMatalib || []).map(function(mt) {
        return mt.title;
    }).join('\n');
    var firstExpectedTitle = (missingMatalib && missingMatalib[0] && missingMatalib[0].title) || 'المطلب الثالث: ...';
    return 'أنت باحث أكاديمي متخصص. تم توليد المطالب السابقة من المبحث التالي وبقيت المطالب الناقصة أدناه فقط بحاجة إلى كتابة:\n' +
    'عنوان البحث العام: ' + plan.title + '\n' +
    'المبحث: ' + mb.title + '\n' +
    'المطالب المطلوب كتابتها الآن حصراً دون نقصان:\n' + list + '\n\n' +
    'الشروط الصارمة:\n' +
    '1. لا تعد كتابة عنوان المبحث ولا المقدمة ولا المطالب السابقة.\n' +
    '2. ابدأ السطر الأول مباشرة بكتابة هذا العنوان حرفياً في سطر مستقل دون أي أرقام قبله (مثل 1.) ودون علامات ** أو #:\n' + firstExpectedTitle + '\n' +
    '3. التزم بكتابة عنوان كل مطلب ناقص كما هو حرفياً في سطر مستقل، ثم اكتب تحته نحو ' + Math.max(perMatlabWords || 0, (cfg && cfg.minMatlabWords) || 400) + ' كلمة (' + cfg.matlabParagraphs + ') متبوعاً بقسم:\n' +
    'الهوامش:\n' +
    '^1 اسم المؤلف، عنوان المرجع، دار النشر، سنة النشر، ص...\n' +
    '^2 اسم المؤلف، عنوان الدراسة، دار النشر، سنة النشر، ص...';
}

// صياغة دراسة حالة تطبيقية حول شركة أو مؤسسة تضاف بعد المباحث وقبل الخاتمة
export function buildCaseStudyPrompt(plan, company, cfg, coreTopicOverride, lang) {
    var isFr = lang === 'fr';
    var isEn = lang === 'en';

    if (isFr) {
        var cleanCompanyFr = (company || '').trim() || "l'institution sélectionnée";
        return "Tu es un chercheur universitaire expert en études de cas appliquées. Rédige une étude de cas empirique et professionnelle (2 à 3 pages A4) sur « " + cleanCompanyFr + " » :\n" +
        "Titre de la recherche : " + (coreTopicOverride || plan.title) + "\n" +
        "Entreprise / Institution étudiée : " + cleanCompanyFr + "\n\n" +
        "Structure obligatoire :\n" +
        "Étude de cas : " + cleanCompanyFr + "\n" +
        "Premièrement : Présentation générale de " + cleanCompanyFr + "\n" +
        "(1 à 2 paragraphes concis définissant l'institution, son secteur et ses missions).\n\n" +
        "Deuxièmement : Analyse empirique et application au sein de " + cleanCompanyFr + "\n" +
        "(5 à 6 paragraphes analytiques et appliqués détaillant la mise en œuvre pratique, les résultats et les défis).\n\n" +
        "Notes de bas de page :\n" +
        "[1] Rapport annuel ou source documentée, Année, p. X.";
    }

    if (isEn) {
        var cleanCompanyEn = (company || '').trim() || "the selected institution";
        return "You are an academic researcher specializing in empirical case studies. Write an empirical case study section (2 to 3 A4 pages) on « " + cleanCompanyEn + " »:\n" +
        "Research Title: " + (coreTopicOverride || plan.title) + "\n" +
        "Target Organization: " + cleanCompanyEn + "\n\n" +
        "Structure:\n" +
        "Case Study: " + cleanCompanyEn + "\n" +
        "1. Overview of " + cleanCompanyEn + "\n" +
        "(1 to 2 concise paragraphs introducing the organization and core operations).\n\n" +
        "2. Practical Application and Empirical Analysis in " + cleanCompanyEn + "\n" +
        "(5 to 6 in-depth analytical paragraphs examining implementation, outcomes, and challenges).\n\n" +
        "Footnotes:\n" +
        "[1] Annual report or documented source, Year, p. X.";
    }

    var cleanCompany = (company || '').trim();
    var cleanTopic = sanitizeFallbackTopic(coreTopicOverride || (plan && plan.title));
    var hasNamedEntity = cleanCompany.length > 0;
    var entityDisplay = hasNamedEntity ? cleanCompany : 'المؤسسة المختارة الملائمة للموضوع';
    var mbDetailsSummary = (plan && plan.mabahith ? plan.mabahith : []).map(function(m) {
        var mats = (m.matalib || []).map(function(mt) { return mt.title; }).join('، ');
        return mats ? (m.title + ' (' + mats + ')') : m.title;
    }).join(' | ');
    var firstHeading = hasNamedEntity ? ('أولاً: التعريف بـ ' + cleanCompany) : 'أولاً: التعريف بـ [اسم المؤسسة المختارة]';
    var secondHeading = hasNamedEntity ? ('ثانياً: ' + cleanTopic + ' في ' + cleanCompany) : ('ثانياً: ' + cleanTopic + ' في [اسم المؤسسة المختارة]');

    return 'أنت باحث أكاديمي وخبير ميداني متخصص في دراسات الحالة المؤسسية. المطلوب كتابة قسم «دراسة حالة» تطبيقية احترافية (صفحتان إلى 3 صفحات A4) ' +
    (hasNamedEntity
        ? ('حول «' + cleanCompany + '» وتطبيق «' + cleanTopic + '» فيها، ')
        : ('تختار فيها **شركة أو مؤسسة أو هيئة حقيقية معروفة ومناسبة تماماً** لتطبيق «' + cleanTopic + '» (يفضّل مؤسسة جزائرية أو عربية رائدة في القطاع)، ')) +
    'بحيث يكون التعريف بالمؤسسة مختصراً جداً ويكون الثقل والتفصيل كله في التطبيق العملي للموضوع داخلها:\n' +
    'عنوان البحث: ' + cleanTopic + '\n' +
    (hasNamedEntity
        ? ('الشركة / المؤسسة محل الدراسة: ' + cleanCompany + '\n')
        : 'ملاحظة: طلب الطالب دراسة حالة ضمن العنوان دون تسمية مؤسسة بعينها؛ التزم باختيار مؤسسة حقيقية واحدة محددة ومناسبة وتسميتها صراحة في العنوان والفقرات.\n') +
    (mbDetailsSummary ? 'محاور البحث النظري (لربط التطبيق الفعلي بمفاهيمها وأدواتها دون تكرار نظري): ' + mbDetailsSummary + '\n' : '') +
    '\n' +
    'توزيع الحجم (إجمالي نحو 750 إلى 950 كلمة ≈ صفحتان A4 ممتلئتان — يُقبل زيادة صفحة إلى 3 صفحات إضافية فوق عدد صفحات البحث المختار دون تقليص المباحث):\n' +
    '- المحور الأول (التعريف بالمؤسسة): مختصر ومركز (110 إلى 150 كلمة — فقرة واحدة أو فقرتان قصيرتان كحد أقصى).\n' +
    '- المحور الثاني (الموضوع في المؤسسة): مفصل ومعمق وتطبيقي (640 إلى 800 كلمة — 5 إلى 6 فقرات تحليلية عملية وافية تمثل قرابة 80% إلى 85% من دراسة الحالة، دون احتساب الجدول).\n\n' +
    'البنية الإلزامية الدقيقة (التزم بهذه العناوين حرفياً دون أي علامات ماركداون # أو ** أو أرقام قبلها):\n' +
    '1. ابدأ السطر الأول مباشرة بالعنوان التالي:\n' +
    (hasNamedEntity ? ('دراسة حالة: ' + cleanCompany) : 'دراسة حالة: [اسم المؤسسة المختارة]') + '\n' +
    'ممنوع منعاً باتاً تسمية هذا القسم باسم «المبحث» أو ترقيمه كمبحث (لا تكتب المبحث الثالث ولا المبحث الرابع).\n\n' +
    '2. ثم اكتب المحور الأول موجزاً بعنوان مستقل في سطر لوحده:\n' +
    firstHeading + '\n' +
    'اكتفِ ببطاقة تعريفية مركزة (110–150 كلمة): سنة التأسيس وسياقه، الصفة القانونية والقطاع الاقتصادي، النشاط الجوهري، والمكانة والانتشار التنظيمي دون إسهاب أو إطالة، مع هامش توثيقي واحد ^1 ثم:\n' +
    'الهوامش:\n' +
    '^1 مصدر أو مرجع تعريفي رسمي حول المؤسسة.\n\n' +
    '3. ثم اكتب المحور الثاني بتفصيل تطبيقي حقيقي وعميق بعنوان مستقل في سطر لوحده:\n' +
    secondHeading + '\n' +
    'حلل في 4 إلى 5 فقرات نثرية متماسكة ومعمقة كيف يُطبَّق «' + cleanTopic + '» فعلياً داخل «' + entityDisplay + '» وكأن الدراسة ترصد نظام العمل الحقيقي المطبق فيها (اكتب بنثر أكاديمي مترابط دون استخدام أ) ب) كعناوين جانبية، وعالج النقاط الآتية بالعمق الكافي):\n' +
    '- الجهة أو المديرية المختصة داخل المؤسسة التي تتولى تسيير «' + cleanTopic + '»، والإطار القانوني أو التنظيمي أو الاتفاقية الجماعية التي تؤطر عملها.\n' +
    '- التفاصيل التشغيلية والممارسة الميدانية الفعلية: اشرح الآليات والمكونات الحقيقية للتطبيق داخل أقسام وفروع المؤسسة (مثل مكونات النظام، مسارات التنفيذ والاعتماد، الأدوات التقنية أو التنظيمية المعتمدة، ومعايير القياس أو التصنيف، مع ربطها بمحاور البحث النظرية السابقة).\n' +
    '- التقييم النقدي الواقعي للتطبيق: أبرز المكاسب التشغيلية الفعلية المحققة مقابل المعوقات الميدانية والتنظيمية الحقيقية المرتبطة بحجم المؤسسة وخصوصية قطاعها.\n' +
    '- سبل التطوير التطبيقي الملائمة للهيكل الفعلي للمؤسسة.\n' +
    'جدول تطبيقي في المحور الثاني (موصى به بقوة متى سمح الموضوع): أدرج جدولاً واحداً يلخص الواقع الميداني، مثل: مكونات النظام المطبق ومسؤول كل مكون، أو مراحل التطبيق ومخرجاتها، أو المكاسب مقابل المعوقات، أو مقارنة بين الإطار النظري والممارسة الفعلية في المؤسسة.\n' +
    buildVisualsGuide(1, true) + '\n' +
    'وثّق الإحالات ^1 و ^2 و ^3 في الفقرات، ثم ضع:\n' +
    'الهوامش:\n' +
    '^1 دراسة أو مرجع تطبيقي حول المؤسسة أو آليات عملها.\n' +
    '^2 نظام تنظيمي أو اتفاقية قطاعية أو تقرير مؤسسي ذو صلة.\n' +
    '^3 مرجع أكاديمي متخصص ذو صلة بالتطبيق العملي.\n\n' +
    'قواعد الجودة والأمانة العلمية (صارمة جداً):\n' +
    '- ممنوع الكلام الإنشائي السطحي والعموميات الفضفاضة (مثل: «تولي المؤسسة اهتماماً كبيراً»، «تسعى للتميز»، «تطبق سياسات فعالة» دون شرح كيف تُنفَّذ هذه الآليات عملياً بخطوات ومكونات واضحة داخل المؤسسة).\n' +
    '- استند إلى المعطيات التنظيمية والقانونية والقطاعية الحقيقية المعروفة عن المؤسسة وبيئة عملها؛ وبيّن آليات التشغيل والتطبيق بعمق فني ومنهجي حقيقي، وتجنب فقط اختلاق أرقام مالية دقيقة أو نسب إحصائية أو موازنات أو أعداد موظفين وهمية غير مؤكدة (لذلك يكون جدول دراسة الحالة نوعياً، ولا يُضاف شكل بياني إلا ببيانات منشورة موثقة مع ذكر مصدرها).\n' +
    '- لا تستخدم «أولاً:» أو «ثانياً:» كقوائم تعداد فرعية داخل الفقرات (استخدم - عند الحاجة لتعداد نقطي فقط) ليبقى العنوانان الرئيسيان واضحين.\n' +
    '- لا تكتب مقدمة عامة ولا خاتمة ولا قائمة مصادر ومراجع نهائية في هذا القسم.';
}

// صياغة خاتمة وقائمة مصادر ومراجع كاملة ومفصلة (مع دعم الفرنسية والإنجليزية)
export function buildConclusionPrompt(plan, cfg, caseStudyCompany, caseStudyRequested, lang) {
    var isFr = lang === 'fr';
    var isEn = lang === 'en';

    if (isFr) {
        var mbTitlesSummaryFr = plan.mabahith.map(function(m){ return m.title; }).join(' — ');
        return "Tu es un professeur d'université et chercheur émérite. Rédige la conclusion générale et la bibliographie complète de ce travail académique :\n" +
        "Titre de la recherche : " + plan.title + "\n" +
        "Chapitres du travail : " + mbTitlesSummaryFr + "\n\n" +
        "Exigences de longueur et format :\n" +
        "- Longueur de la conclusion : environ " + cfg.conclusionWords + " mots (3 à 4 paragraphes substantiels).\n" +
        "- Nombre de références bibliographiques : entre 8 et " + cfg.maxRefs + " références fiables et de haute qualité académique (strictement limitées à une page A4).\n\n" +
        "Structure obligatoire :\n" +
        "1. Commence immédiatement par :\nConclusion :\n" +
        "2. Développe :\n" +
        "   - Synthèse analytique globale des résultats de l'étude.\n" +
        "   - Confirmation ou infirmation des hypothèses de départ.\n" +
        "   - Recommandations pratiques et managériales pour le secteur.\n" +
        "   - Limites de la recherche et perspectives de travaux futurs.\n" +
        "3. Insère les notes de bas de page de la conclusion :\n" +
        "Notes de bas de page :\n" +
        "[1] Auteur, Titre de l'ouvrage, Éditeur, Année, p. X.\n\n" +
        "4. Fais suivre immédiatement par la bibliographie structurée par catégorie :\n\n" +
        "Bibliographie :\n" +
        "I. Ouvrages généraux et spécialisés :\n" +
        "[1] Nom (Initiale), Titre de l'ouvrage, Éditeur, Ville, Année.\n" +
        "[2] Nom (Initiale), Titre de l'ouvrage, Éditeur, Ville, Année.\n" +
        "[3] Nom (Initiale), Titre de l'ouvrage, Éditeur, Ville, Année.\n" +
        "[4] Nom (Initiale), Titre de l'ouvrage, Éditeur, Ville, Année.\n" +
        "II. Articles de revues scientifiques et périodiques :\n" +
        "[5] Nom (Initiale), « Titre de l'article », Revue Scientifique, Vol. X, N° Y, Année, pp. XX-YY.\n" +
        "[6] Nom (Initiale), « Titre de l'article », Revue Scientifique, Vol. X, N° Y, Année, pp. XX-YY.\n" +
        "[7] Nom (Initiale), « Titre de l'article », Revue Scientifique, Vol. X, N° Y, Année, pp. XX-YY.\n" +
        "III. Thèses et mémoires universitaires :\n" +
        "[8] Nom (Initiale), Titre de la thèse, Thèse de Doctorat / Mémoire de Master, Université, Année.\n" +
        "IV. Rapports officiels et sources institutionnelles :\n" +
        "[9] Institution / Organisme, Titre du rapport officiel, Année, URL.\n\n" +
        "Ne mets aucun texte introductif ou de politesse en dehors de cette structure.";
    }

    if (isEn) {
        var mbTitlesSummaryEn = plan.mabahith.map(function(m){ return m.title; }).join(' — ');
        return "You are a university professor and academic researcher. Write the comprehensive conclusion and complete reference list for this research paper:\n" +
        "Paper Title: " + plan.title + "\n" +
        "Paper Chapters: " + mbTitlesSummaryEn + "\n\n" +
        "Length & Standards:\n" +
        "- Conclusion length: approximately " + cfg.conclusionWords + " words (3 to 4 substantial paragraphs).\n" +
        "- Reference count: between 8 and " + cfg.maxRefs + " high-quality peer-reviewed references (must fit strictly on one single page).\n\n" +
        "Mandatory Structure:\n" +
        "1. Start directly on line 1 with:\nConclusion:\n" +
        "2. Develop:\n" +
        "   - Rigorous synthesis of key findings.\n" +
        "   - Assessment of research questions and hypotheses.\n" +
        "   - Actionable practical and policy recommendations.\n" +
        "   - Study limitations and future research directions.\n" +
        "3. Insert conclusion footnotes:\n" +
        "Footnotes:\n" +
        "[1] Author, Title, Publisher, Year, p. X.\n\n" +
        "4. Follow immediately with the categorized reference list:\n\n" +
        "References:\n" +
        "1. Books and Monographs:\n" +
        "[1] Author, Book Title, Publisher, City, Year.\n" +
        "[2] Author, Book Title, Publisher, City, Year.\n" +
        "[3] Author, Book Title, Publisher, City, Year.\n" +
        "[4] Author, Book Title, Publisher, City, Year.\n" +
        "2. Peer-Reviewed Journal Articles:\n" +
        "[5] Author, \"Article Title\", Journal Name, Vol. X, No. Y, Year, pp. XX-YY.\n" +
        "[6] Author, \"Article Title\", Journal Name, Vol. X, No. Y, Year, pp. XX-YY.\n" +
        "[7] Author, \"Article Title\", Journal Name, Vol. X, No. Y, Year, pp. XX-YY.\n" +
        "3. Dissertations and Theses:\n" +
        "[8] Author, Dissertation Title, Ph.D. Dissertation / Master's Thesis, University, Year.\n" +
        "4. Institutional Reports & Online Sources:\n" +
        "[9] Organization, Report Title, Publisher, Year, URL.\n\n" +
        "Do not include any conversational filler outside this structure.";
    }

    var mbTitlesSummary = plan.mabahith.map(function(m){ return m.title; }).join(' - ');
    var cleanCompany = (caseStudyCompany || '').trim();
    var caseStudyInfo = cleanCompany
        ? 'دراسة الحالة التطبيقية المدرجة بعد المباحث: دراسة حالة: ' + cleanCompany + ' (تأكد من تضمين نتيجة وتوصية عملية تتصلان بواقع «' + cleanCompany + '» ضمن الخاتمة).\n'
        : (caseStudyRequested
            ? 'يتضمن البحث قسم دراسة حالة تطبيقية بعد المباحث وقبل الخاتمة (تأكد من الإشارة بإيجاز في الخاتمة إلى نتيجة وتوصية تطبيقية ميدانية متصلة بالموضوع).\n'
            : '');
    return 'أنت بروفيسور أكاديمي خبير. اكتب خاتمة علمية مفصلة وقائمة مصادر ومراجع أكاديمية محكمة وكاملة للبحث التالي:\n' +
    'عنوان البحث: ' + plan.title + '\n' +
    'مباحث ومحاور البحث: ' + mbTitlesSummary + '\n' +
    caseStudyInfo + '\n' +
    'معيار الطول والحجم المطلوب:\n' +
    '- الطول الإجمالي للخاتمة: حوالي ' + cfg.conclusionWords + ' كلمة.\n' +
    '- عدد المراجع الإجمالي: من 8 إلى ' + cfg.maxRefs + ' مراجع كحد أقصى (شرط أساسي حاسم: يجب ألا تتجاوز قائمة المراجع صفحة واحدة إطلاقاً، فاختر أهم وأدق المراجع الأكاديمية واكتفِ بهذا العدد لتتسع بالكامل في صفحة واحدة).\n\n' +
    'الشروط الصارمة في الصياغة:\n' +
    '1. ابدأ السطر الأول مباشرة بـ:\nالخـاتـمـــة:\n' +
    '2. اكتب في 3 إلى 4 فقرات: حوصلة النتائج المتوصل إليها، الاستنتاجات العلمية، ومجموعة توصيات عملية مقترحة، مع توثيق هوامش ^1 و ^2.\n' +
    '3. ضع قسم الهوامش:\nالهوامش:\n^1 اسم المرجع، دار النشر، السنة، ص...\n^2 اسم المرجع، دار النشر، السنة، ص...\n' +
    '4. اتبعها مباشرة بقائمة المصادر والمراجع مصنفة بشكل أكاديمي محكم كالتالي:\n\n' +
    'قائمة المصادر والمراجع:\n' +
    'أولاً: الكتب والمؤلفات:\n' +
    '[1] اسم المؤلف، عنوان الكتاب، دار النشر، مكان النشر، سنة النشر.\n' +
    '[2] اسم المؤلف، عنوان الكتاب، دار النشر، مكان النشر، سنة النشر.\n' +
    '[3] اسم المؤلف، عنوان الكتاب، دار النشر، مكان النشر، سنة النشر.\n' +
    '[4] اسم المؤلف، عنوان الكتاب، دار النشر، مكان النشر، سنة النشر.\n' +
    'ثانياً: المجلات والدوريات العلمية المحكمة:\n' +
    '[5] اسم الباحث، عنوان المقال، اسم المجلة، الجامعة، المجلد، العدد، السنة، الصفحات.\n' +
    '[6] اسم الباحث، عنوان المقال، اسم المجلة، الجامعة، المجلد، العدد، السنة، الصفحات.\n' +
    '[7] اسم الباحث، عنوان المقال، اسم المجلة، الجامعة، المجلد، العدد، السنة، الصفحات.\n' +
    'ثالثاً: الرسائل والأطروحات الجامعية:\n' +
    '[8] اسم الباحث، عنوان الأطروحة (أطروحة دكتوراه أو ماستر)، الكلية، الجامعة، السنة الجامعية.\n' +
    'رابعاً: المواقع والمنصات الرسمية:\n' +
    '[9] الهيئة أو المنظمة، عنوان التقرير، الرابط وتاريخ الاطلاع.\n\n' +
    'لا تضع أي نصوص ترحيبية أو اعتذارية خارج هذا الهيكل.';
}

export { LENGTH_CONFIGS, buildFallbackPlan, getDistinctFallbackMatalib };
