// @ts-nocheck
// محرك التوليد الأكاديمي بالذكاء الاصطناعي — الإعدادات والتعليمات (Prompts) وعملاء البث اللحظي
// الاتصال يتم مباشرة من متصفح المستخدم إلى مزود الخدمة باستخدام مفتاحه الشخصي دون أي خادم وسيط.

// النماذج الرسمية المعتمدة المستقرة وفائقة السرعة في Google Gemini API
var FAST_GEMINI_MODELS = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro'
];

// مصفوفة المعايرة الهندسية لحجم البحث وعدد الصفحات المتولدة
var LENGTH_CONFIGS = {
    'short': {
        label: 'موجز (5 إلى 8 صفحات)',
        targetPages: '5 إلى 8 صفحات',
        introWords: 300,
        introParagraphs: '3 فقرات منهجية متكاملة',
        mabahithWords: 1200,
        matlabParagraphs: 'فقرتين علميتين لكل مطلب مع مناقشة وتوثيق',
        conclusionWords: 280,
        maxRefs: 12,
        introMaxTokens: 900,
        mabhathMaxTokens: 1400,
        conclusionMaxTokens: 800
    },
    'medium': {
        label: 'متوسط (8 إلى 12 صفحة)',
        targetPages: '8 إلى 12 صفحة',
        introWords: 450,
        introParagraphs: '4 فقرات منهجية متزنة (تمهيد، إشكالية وأسئلة، فرضيات، منهج وخطة)',
        mabahithWords: 2000,
        matlabParagraphs: 'فقرات علمية مفصلة لكل مطلب بدقة وأمثلة واقعية وتوثيق أكاديمي',
        conclusionWords: 350,
        maxRefs: 16,
        introMaxTokens: 1300,
        mabhathMaxTokens: 2000,
        conclusionMaxTokens: 1100
    },
    'giant': {
        label: 'موسع (12 إلى 16 صفحة)',
        targetPages: '12 إلى 16 صفحة',
        introWords: 600,
        introParagraphs: '5 فقرات تأصيلية موسعة',
        mabahithWords: 3200,
        matlabParagraphs: 'فقرات علمية موسعة لكل مطلب مع مناقشة فكرية معمقة وهوامش وفيرة',
        conclusionWords: 450,
        maxRefs: 20,
        introMaxTokens: 1800,
        mabhathMaxTokens: 2600,
        conclusionMaxTokens: 1400
    },
    'huge': {
        label: 'مطول جداً (20 إلى 25 صفحة)',
        targetPages: '20 إلى 25 صفحة',
        introWords: 800,
        introParagraphs: '6 فقرات عميقة ومفصلة',
        mabahithWords: 5000,
        matlabParagraphs: 'فقرات تحليلية موسعة وتفريعات لكل مطلب مع إحالات مرجعية مكثفة',
        conclusionWords: 550,
        maxRefs: 25,
        introMaxTokens: 2400,
        mabhathMaxTokens: 3200,
        conclusionMaxTokens: 1600
    }
};

// دالة إنشاء خطة بديلة ذكية في حال تعذر الاتصال بالكامل
function buildFallbackPlan(topic, mabhathCount, matlabCount, lengthMode) {
    var mCount = parseInt(mabhathCount, 10) || 2;
    var tCount = parseInt(matlabCount, 10) || 2;
    var cleanTopic = (topic || '').replace(/^["«'\s]+|["»'\s]+$/g, '').trim();

    var ordinals = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];
    var mabahith = [];

    var mabhathThemes = [
        'الإطار المفاهيمي والنظري لـ ' + cleanTopic,
        'الآليات التطبيقية والأبعاد الميدانية لـ ' + cleanTopic,
        'التحديات والآفاق المستقبلية لـ ' + cleanTopic
    ];

    for (var i = 0; i < mCount; i++) {
        var mTitle = 'المبحث ' + (ordinals[i] || (i + 1)) + ': ' + (mabhathThemes[i] || ('دراسة في ' + cleanTopic));
        var matalib = [];
        for (var j = 0; j < tCount; j++) {
            var matTitle = 'المطلب ' + (ordinals[j] || (j + 1)) + ': ' + (
                j === 0 ? 'المفاهيم والأسس الجوهرية' :
                j === 1 ? 'الخصائص والمحددات العلمية' :
                'الأهمية والتطبيقات العملية'
            );
            matalib.push({
                title: matTitle
            });
        }
        mabahith.push({
            title: mTitle,
            matalib: matalib
        });
    }

    return {
        title: cleanTopic,
        problematic: 'ما هي الأبعاد المفاهيمية والتطبيقية المرتبطة بـ ' + cleanTopic + '، وكيف تسهم في الارتقاء بالأداء والممارسات العملية؟',
        questions: [
            'ما هو التأطير النظري والمفاهيمي لـ ' + cleanTopic + '؟',
            'ما هي الآليات التطبيقية المعتمدة في هذا المجال؟'
        ],
        hypotheses: [
            'توجد علاقة ارتباطية إيجابية بين وضوح الرؤية النظرية وحسن التطبيق العملي.'
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

    var models = FAST_GEMINI_MODELS.slice();
    var lastErr = null;

    for (var i = 0; i < models.length; i++) {
        var m = models[i];
        if (typeof config.onModelSelect === 'function') {
            config.onModelSelect(m);
        }

        try {
            var streamRes = await callGeminiStreaming(apiKey, m, prompt, onChunk, temp, maxTokens);
            if (streamRes && streamRes.trim()) {
                return streamRes;
            }
        } catch (err) {
            console.warn('⚠️ تعذر النموذج (' + m + ')، التحويل التلقائي للبديل:', err.message);
            lastErr = err;
            var msg = (err.message || '').toLowerCase();

            // إذا كان المفتاح غير صالح إطلاقاً، نتوقف فوراً
            if (msg.includes('api key not valid') || msg.includes('api_key_invalid')) {
                throw new Error('رمز الـ API الخاص بـ Google Gemini غير صالح. يرجى التأكد من نسخه بشكل صحيح.');
            }

            // إذا كان خطأ تجاوز الحصة المؤقت (429)، ننتظر ثانية ونصف قبل تجربة النموذج التالي
            if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
                await new Promise(function(resolve) { setTimeout(resolve, 1400); });
            }

            continue;
        }
    }

    // محاولة أخيرة عبر الاتصال المباشر غير التدفقي
    for (var j = 0; j < models.length; j++) {
        try {
            var directRes = await callGeminiDirect(apiKey, models[j], prompt, temp, maxTokens);
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

// صياغة خطة بحث أكاديمي دقيقة وواقعية
export function buildPlanPrompt(topic, mabhathCount, matlabCount, cfg) {
    return 'أنت عميد أكاديمي ومحكم أبحاث ودراسات عليا. المطلوب منك وضع خطة بحث أكاديمي دقيقة ومحكمة متناسقة مع موضوع البحث بصيغة JSON فقط دون أي شروحات إضافية أو كتل ماركداون.\n' +
    'الموضوع المطلوب بدقة: «' + topic + '»\n' +
    'عدد المباحث المطلوبة: ' + mabhathCount + '\n' +
    'عدد المطالب في كل مبحث: ' + matlabCount + '\n' +
    'حجم البحث المستهدف الإجمالي: ' + cfg.targetPages + '.\n\n' +
    'يجب أن تُرجع كائن JSON صالح 100% حصراً بالشكل التالي دون نصوص خارج الأقواس:\n' +
    '{\n' +
    '  "title": "عنوان أكاديمي دقيق وكامل يعكس الموضوع بدقة",\n' +
    '  "problematic": "الإشكالية الجوهرية للبحث مصاغة بدقة علمية رصينة",\n' +
    '  "questions": ["السؤال الفرعي الأول؟", "السؤال الفرعي الثاني؟"],\n' +
    '  "hypotheses": ["الفرضية الأولى...", "الفرضية الثانية..."],\n' +
    '  "methodology": "المنهج الوصفي التحليلي",\n' +
    '  "mabahith": [\n' +
    '    {\n' +
    '      "title": "المبحث الأول: [عنوان المبحث الأول ذو صلة مباشرة بموضوع البحث]",\n' +
    '      "matalib": [\n' +
    '        { "title": "المطلب الأول: [عنوان المطلب الأول]" },\n' +
    '        { "title": "المطلب الثاني: [عنوان المطلب الثاني]" }\n' +
    '      ]\n' +
    '    }\n' +
    '  ]\n' +
    '}';
}

// صياغة مقدمة أكاديمية كاملة مع هوامش مرقمة
export function buildIntroPrompt(plan, cfg) {
    return 'أنت بروفيسور وعالم أكاديمي خبير. اكتب مقدمة بحث علمي رصينة وكاملة وغنية بالتحليل:\n' +
    'عنوان البحث: ' + plan.title + '\n' +
    'الإشكالية المقررة: ' + plan.problematic + '\n' +
    'الأسئلة الفرعية: ' + (plan.questions || []).join(' - ') + '\n' +
    'الفرضيات: ' + (plan.hypotheses || []).join(' - ') + '\n' +
    'المنهج العلمي: ' + (plan.methodology || 'المنهج الوصفي التحليلي') + '\n\n' +
    'معيار الطول والحجم المطلوب:\n' +
    '- الطول الإجمالي للمقدمة: حوالي ' + cfg.introWords + ' كلمة (' + cfg.introParagraphs + ').\n\n' +
    'القواعد الصارمة:\n' +
    '1. ابدأ السطر الأول مباشرة بـ:\nالمقدمة:\n' +
    '2. صياغة منهجية متقنة تتضمن: التمهيد، الإشكالية، الأهمية والأهداف، المنهج المتبع، وخطة البحث في فقرات رصينة ومتكاملة.\n' +
    '3. وثّق الإحالات بأرقام ^1 و ^2 في نهايات الفقرات.\n' +
    '4. اختم المقدمة بقسم الهوامش حصراً كالتالي:\nالهوامش:\n^1 اسم المؤلف، عنوان المرجع، دار النشر، المدينة، سنة النشر، الصفحة.\n^2 اسم الباحث، عنوان المقال، اسم المجلة المحكمة، المجلد، العدد، السنة، الصفحة.';
}

// صياغة مبحث أكاديمي كامل ومطالبه مع هوامش مرقمة لكل مطلب
export function buildMabhathPrompt(plan, mb, targetWordsPerMb, cfg) {
    var matalibList = (mb.matalib || []).map(function(mt, mIdx) {
        return '- ' + (mt.title || ('المطلب ' + (mIdx+1)));
    }).join('\n');
    return 'أنت باحث أكاديمي متخصص. اكتب متن هذا المبحث الأكاديمي كاملاً بأسلوب علمي رصين ومفصل دون اختصار مخل:\n' +
    'عنوان البحث العام: ' + plan.title + '\n' +
    'المبحث المطلوب كتابته حصراً: ' + mb.title + '\n' +
    'مطالب هذا المبحث:\n' + matalibList + '\n\n' +
    'معيار الطول والحجم المطلوب:\n' +
    '- الطول الإجمالي المطلوب لهذا المبحث كاملاً بجميع مطالبه هو: حوالي ' + targetWordsPerMb + ' كلمة.\n' +
    '- لكل مطلب: اكتب ' + cfg.matlabParagraphs + '، مع إحالات وهوامش توثيقية حقيقية.\n\n' +
    'الشروط الصارمة:\n' +
    '1. ابدأ بالسطر الأول مباشرة بعنوان المبحث:\n' + mb.title + '\n' +
    '2. ثم اكتب كل مطلب بالتفصيل:\n' +
    'المطلب الأول: [عنوان المطلب]\n' +
    '(اكتب فقرات علمية تحليلية رصينة وموسعة تناقش محتوى المطلب بأمثلة ومفاهيم واضحة، مع وضع أرقام الهوامش ^1 و ^2 في نهايات الفقرات).\n' +
    'الهوامش:\n' +
    '^1 اسم المؤلف، عنوان الكتاب الأكاديمي، دار النشر، سنة الطبع، ص...\n' +
    '^2 اسم المؤلف، عنوان الدراسة، دار النشر، سنة الطبع، ص...\n' +
    '3. كرر نفس البنية العلمية المفصلة لبقية مطالب هذا المبحث بالهو هامش لكل مطلب.\n' +
    '4. لا تكتب مقدمة عامة ولا خاتمة، بل اكتب متن هذا المبحث ومطالبه وهوامشه فقط.';
}

// صياغة خاتمة وقائمة مصادر ومراجع كاملة ومفصلة
export function buildConclusionPrompt(plan, cfg) {
    var mbTitlesSummary = plan.mabahith.map(function(m){ return m.title; }).join(' - ');
    return 'أنت بروفيسور أكاديمي خبير. اكتب خاتمة علمية مفصلة وقائمة مصادر ومراجع أكاديمية محكمة وكاملة للبحث التالي:\n' +
    'عنوان البحث: ' + plan.title + '\n' +
    'مباحث ومحاور البحث: ' + mbTitlesSummary + '\n\n' +
    'معيار الطول والحجم المطلوب:\n' +
    '- الطول الإجمالي للخاتمة: حوالي ' + cfg.conclusionWords + ' كلمة.\n' +
    '- عدد المراجع الإجمالي: حوالي ' + cfg.maxRefs + ' مرجعاً أكاديمياً حقيقياً متنوعاً.\n\n' +
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

export { LENGTH_CONFIGS, buildFallbackPlan };
