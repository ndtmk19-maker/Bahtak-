// @ts-nocheck
// محرك التوليد الأكاديمي بالذكاء الاصطناعي — الإعدادات والتعليمات (Prompts) وعملاء البث اللحظي
// الاتصال يتم مباشرة من متصفح المستخدم إلى مزود الخدمة باستخدام مفتاحه الشخصي دون أي خادم وسيط.

        // قائمة النماذج السريعة مرتبة حسب الأولوية والأداء التوليدي
        var FAST_GEMINI_MODELS = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-1.5-flash',
            'gemini-1.5-flash-8b'
        ];

        // مصفوفة المعايرة الهندسية الصارمة لحجم البحث وعدد الصفحات المتولدة
        var LENGTH_CONFIGS = {
            'short': {
                label: 'موجز (5 إلى 8 صفحات)',
                targetPages: '5 إلى 8 صفحات',
                introWords: 240,
                introParagraphs: 'فقرتين مركزتين وشاملتين فقط',
                mabahithWords: 750, // إجمالي كلمات كافة المباحث
                matlabParagraphs: 'فقرة أو فقرتين مركزتين لكل مطلب مع أمثلة مباشرة دون استطراد',
                conclusionWords: 200,
                maxRefs: 10,
                introMaxTokens: 750,
                mabhathMaxTokens: 900,
                conclusionMaxTokens: 650
            },
            'medium': {
                label: 'متوسط (8 إلى 12 صفحة)',
                targetPages: '8 إلى 12 صفحة',
                introWords: 380,
                introParagraphs: '3 فقرات منهجية متزنة (تمهيد، إشكالية وأسئلة، منهج وخطة)',
                mabahithWords: 1400, // إجمالي كلمات المباحث (~700 كلمة لكل مبحث إن كانا مبحثين)
                matlabParagraphs: 'فقرتين متكاملتين لكل مطلب بدقة علمية وأمثلة محددة دون إسهاب زائد',
                conclusionWords: 260,
                maxRefs: 14,
                introMaxTokens: 1100,
                mabhathMaxTokens: 1300,
                conclusionMaxTokens: 850
            },
            'giant': {
                label: 'موسع (12 إلى 16 صفحة)',
                targetPages: '12 إلى 16 صفحة',
                introWords: 520,
                introParagraphs: '4 فقرات تأصيلية موسعة',
                mabahithWords: 2200, // (~1100 كلمة لكل مبحث إن كانا مبحثين)
                matlabParagraphs: '3 فقرات علمية مفصلة لكل مطلب مع مناقشة عميقة وتوثيق',
                conclusionWords: 340,
                maxRefs: 18,
                introMaxTokens: 1500,
                mabhathMaxTokens: 1800,
                conclusionMaxTokens: 1100
            },
            'huge': {
                label: 'مطول جداً (20 إلى 25 صفحة)',
                targetPages: '20 إلى 25 صفحة',
                introWords: 700,
                introParagraphs: '5 إلى 6 فقرات عميقة ومفصلة',
                mabahithWords: 3800,
                matlabParagraphs: '4 إلى 5 فقرات تحليلية موسعة وتفريعات لكل مطلب',
                conclusionWords: 450,
                maxRefs: 24,
                introMaxTokens: 2200,
                mabhathMaxTokens: 2600,
                conclusionMaxTokens: 1400
            }
        };

        // دالة إنشاء خطة بديلة ذكية وفورية في أجزاء من الثانية
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

        // استدعاء Gemini مع آلية التجاوز الفوري التلقائي (Auto-Fallback in Milliseconds)
        async function fetchGeminiStreamWithFallback(apiKey, prompt, onChunk, config) {
            config = config || {};
            var temp = typeof config.temperature === 'number' ? config.temperature : 0.35;
            var disableThinking = config.disableThinking !== false;
            var maxTokens = config.maxTokens || 4096;
            var jsonMode = !!config.jsonMode;

            var models = FAST_GEMINI_MODELS.slice();
            var lastErr = null;

            for (var i = 0; i < models.length; i++) {
                var m = models[i];
                if (typeof config.onModelSelect === 'function') {
                    config.onModelSelect(m);
                }

                try {
                    // المحاولة 1: البث اللحظي السريع مع تعطيل التفكير إن أمكن
                    var streamRes = await callGeminiStreaming(apiKey, m, prompt, onChunk, temp, disableThinking, maxTokens, jsonMode);
                    if (streamRes && streamRes.trim()) return streamRes;
                } catch (e1) {
                    lastErr = e1;
                    var errMsg = (e1.message || '').toLowerCase();
                    var isThrottledOrUnavailable = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('overloaded') || errMsg.includes('503') || errMsg.includes('500') || errMsg.includes('not found') || errMsg.includes('404');

                    // إذا كان الخطأ بسبب الضغط أو الحصة، نقفز فوراً في ميلي ثانية إلى النموذج التالي
                    if (isThrottledOrUnavailable) {
                        console.warn('⚡ التجاوز التلقائي الفوري من (' + m + ') إلى النموذج التالي بسبب الضغط:', e1.message);
                        continue;
                    }

                    // إذا كان الخطأ بسبب حقل thinkingConfig، نعيد المحاولة فوراً لنفس النموذج بدونه
                    if (errMsg.includes('thinking') || errMsg.includes('unknown field') || errMsg.includes('invalid argument')) {
                        try {
                            var streamRes2 = await callGeminiStreaming(apiKey, m, prompt, onChunk, temp, false, maxTokens, jsonMode);
                            if (streamRes2 && streamRes2.trim()) return streamRes2;
                        } catch (e2) {
                            console.warn('Gemini stream (' + m + ') fallback failed:', e2.message);
                            lastErr = e2;
                        }
                    }
                }
            }

            // المحاولة الاحتياطية السريعة (Direct Non-streaming) كخيار أخير في حال تعذر البث
            for (var j = 0; j < Math.min(models.length, 3); j++) {
                var altModel = models[j];
                if (typeof config.onModelSelect === 'function') config.onModelSelect(altModel);
                try {
                    var directRes = await callGeminiDirect(apiKey, altModel, prompt, temp, maxTokens, jsonMode);
                    if (directRes && directRes.trim()) return directRes;
                } catch (eDirect) {
                    lastErr = eDirect;
                }
            }

            throw lastErr || new Error('تعذر إكمال الاتصال بنماذج الذكاء الاصطناعي. يرجى التحقق من المفتاح وصلاحيته.');
        }

        // دالة البث اللحظي لـ Gemini عبر Server-Sent Events (SSE) مع مهلة TTFT استباقية
        async function callGeminiStreaming(apiKey, model, prompt, onChunk, temperature, disableThinking, maxTokens, jsonMode) {
            var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':streamGenerateContent?alt=sse&key=' + encodeURIComponent(apiKey);

            var genConfig = {
                temperature: typeof temperature === 'number' ? temperature : 0.35,
                maxOutputTokens: maxTokens || 4096
            };

            // تفعيل وضع JSON النقي عند طلبه لتسريع خطة البحث إلى أقل من ثانية واحدة
            if (jsonMode) {
                genConfig.responseMimeType = "application/json";
            }

            // تعطيل ميزانية التفكير الداخلي لتقليص زمن الاستجابة الأولي (Time-to-First-Token)
            if (disableThinking && model.includes('2.5')) {
                genConfig.thinkingConfig = {
                    thinkingBudget: 0
                };
            }

            var controller = new AbortController();
            // مهلة زمنية ذكية: 8 ثوانٍ للحصول على أول رمز (TTFT Timeout) لتجنب التعليق
            var hasReceivedFirstChunk = false;
            var ttftTimeout = setTimeout(function() {
                if (!hasReceivedFirstChunk) {
                    controller.abort();
                }
            }, 8000);

            // مهلة قصوى أمان 40 ثانية للاكتمال الكلي
            var totalTimeout = setTimeout(function() {
                controller.abort();
            }, 40000);

            try {
                var res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: 'user',
                                parts: [{ text: prompt }]
                            }
                        ],
                        generationConfig: genConfig
                    }),
                    signal: controller.signal
                });

                if (!res.ok) {
                    clearTimeout(ttftTimeout);
                    clearTimeout(totalTimeout);
                    var errData = await res.json().catch(function() { return {}; });
                    var errMsg = (errData.error && errData.error.message) || res.statusText;
                    throw new Error('Gemini (' + model + ') [' + res.status + ']: ' + errMsg);
                }

                if (!res.body || typeof res.body.getReader !== 'function') {
                    clearTimeout(ttftTimeout);
                    clearTimeout(totalTimeout);
                    var directData = await res.json();
                    return extractGeminiResponseText(directData);
                }

                var reader = res.body.getReader();
                var decoder = new TextDecoder('utf-8');
                var accumulated = '';
                var buffer = '';

                while (true) {
                    var r = await reader.read();
                    if (r.done) break;

                    if (!hasReceivedFirstChunk) {
                        hasReceivedFirstChunk = true;
                        clearTimeout(ttftTimeout);
                    }

                    buffer += decoder.decode(r.value, { stream: true });
                    var lines = buffer.split('\n');
                    buffer = lines.pop(); // الحفاظ على الجزء غير المكتمل

                    for (var l = 0; l < lines.length; l++) {
                        var line = lines[l].trim();
                        if (line.indexOf('data: ') === 0) {
                            var jsonStr = line.substring(6).trim();
                            if (!jsonStr || jsonStr === '[DONE]') continue;
                            try {
                                var parsed = JSON.parse(jsonStr);
                                if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content && parsed.candidates[0].content.parts) {
                                    var parts = parsed.candidates[0].content.parts;
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
                                // تجاهل أخطاء التجزئة الجزئية
                            }
                        }
                    }
                }

                if (!accumulated.trim()) {
                    throw new Error('لم يرجع تدفق Gemini أي محتوى.');
                }

                return accumulated;

            } finally {
                clearTimeout(ttftTimeout);
                clearTimeout(totalTimeout);
            }
        }

        // استدعاء Gemini غير تدفقي كاحتياطي أخير
        async function callGeminiDirect(apiKey, model, prompt, temperature, maxTokens, jsonMode) {
            var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(apiKey);
            var genConfig = {
                temperature: typeof temperature === 'number' ? temperature : 0.35,
                maxOutputTokens: maxTokens || 4096
            };
            if (jsonMode) genConfig.responseMimeType = "application/json";

            var controller = new AbortController();
            var timer = setTimeout(function() { controller.abort(); }, 12000);

            try {
                var res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: genConfig
                    }),
                    signal: controller.signal
                });

                if (!res.ok) {
                    var errJson = await res.json().catch(function() { return {}; });
                    throw new Error((errJson.error && errJson.error.message) || res.statusText);
                }

                var data = await res.json();
                var text = extractGeminiResponseText(data);
                if (!text || !text.trim()) throw new Error('استجابة فارغة من النموذج.');
                return text;
            } finally {
                clearTimeout(timer);
            }
        }

        // استدعاء OpenAI / Groq / OpenRouter مع البث اللحظي والتجاوز السريع
        async function fetchOpenAiStreamWithFallback(apiKey, endpoint, model, prompt, onChunk, temperature, maxTokens) {
            var controller = new AbortController();
            var timeoutId = setTimeout(function() { controller.abort(); }, 25000);

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
            var disableThinking = options.disableThinking !== false;
            var maxTokens = options.maxTokens || 4096;
            var jsonMode = !!options.jsonMode;

            if (provider === 'gemini') {
                return fetchGeminiStreamWithFallback(apiKey, prompt, onChunk, {
                    temperature: temp,
                    disableThinking: disableThinking,
                    maxTokens: maxTokens,
                    jsonMode: jsonMode,
                    onModelSelect: options.onModelSelect
                });
            } else if (provider === 'groq') {
                if (options.onModelSelect) options.onModelSelect('llama-3.3-70b-versatile');
                return fetchOpenAiStreamWithFallback(apiKey, 'https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile', prompt, onChunk, temp, maxTokens)
                    .catch(function(eGroq) {
                        console.warn('Groq primary model failed, falling back to instant 8B:', eGroq.message);
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

        export function buildPlanPrompt(topic, mabhathCount, matlabCount, cfg) {
            return 'أنت عميد أكاديمي ومحكم أبحاث ودراسات عليا. المطلوب منك وضع خطة بحث أكاديمي دقيقة ومحكمة ومضبوطة الحجم بصيغة JSON فقط دون أي شروحات إضافية أو كتل ماركداون.\n' +
            'الموضوع المطلوب: «' + topic + '»\n' +
            'عدد المباحث المطلوبة: ' + mabhathCount + '\n' +
            'عدد المطالب في كل مبحث: ' + matlabCount + '\n' +
            'حجم البحث المستهدف الإجمالي: ' + cfg.targetPages + ' (ضع عناوين مباشرة لكل مطلب دون تفريعات فرعية كثيرة).\n\n' +
            'يجب أن تُرجع كائن JSON صالح 100% حصراً بالشكل التالي دون نصوص خارج الأقواس:\n' +
            '{\n' +
            '  "title": "العنوان الأكاديمي الدقيق والكامل للبحث",\n' +
            '  "problematic": "الإشكالية الجوهرية للبحث مصاغة بدقة علمية رصينة",\n' +
            '  "questions": ["السؤال الفرعي الأول؟", "السؤال الفرعي الثاني؟"],\n' +
            '  "hypotheses": ["الفرضية الأولى...", "الفرضية الثانية..."],\n' +
            '  "methodology": "المنهج الوصفي التحليلي",\n' +
            '  "mabahith": [\n' +
            '    {\n' +
            '      "title": "المبحث الأول: [عنوان المبحث الأول]",\n' +
            '      "matalib": [\n' +
            '        { "title": "المطلب الأول: [عنوان المطلب الأول]" },\n' +
            '        { "title": "المطلب الثاني: [عنوان المطلب الثاني]" }\n' +
            '      ]\n' +
            '    }\n' +
            '  ]\n' +
            '}';
        }

        export function buildIntroPrompt(plan, cfg) {
            return 'أنت بروفيسور وعالم أكاديمي خبير. اكتب مقدمة بحث علمي رصينة ومتوازنة:\n' +
            'عنوان البحث: ' + plan.title + '\n' +
            'الإشكالية المقررة: ' + plan.problematic + '\n' +
            'الأسئلة الفرعية: ' + (plan.questions || []).join(' - ') + '\n' +
            'الفرضيات: ' + (plan.hypotheses || []).join(' - ') + '\n' +
            'المنهج العلمي: ' + (plan.methodology || 'المنهج الوصفي التحليلي') + '\n\n' +
            'معيار الطول والحجم المطلوب بدقة متناهية:\n' +
            '- الطول الإجمالي للمقدمة: حوالي ' + cfg.introWords + ' كلمة (' + cfg.introParagraphs + ').\n' +
            '- الالتزام الصارم بهذا الحجم دون أي استطراد لضمان خروج البحث الإجمالي في حدود ' + cfg.targetPages + ' بالضبط دون تجاوز.\n\n' +
            'القواعد الصارمة:\n' +
            '1. ابدأ السطر الأول مباشرة بـ:\nالمقدمة:\n' +
            '2. صياغة منهجية متقنة تتضمن: التمهيد، الإشكالية، الأهمية والأهداف، المنهج المتبع، وخطة البحث.\n' +
            '3. وثّق الإحالات بأرقام ^1 و ^2 في نهايات الفقرات.\n' +
            '4. اختم المقدمة بقسم الهوامش حصراً كالتالي:\nالهوامش:\n^1 اسم المؤلف، عنوان المرجع، دار النشر، السنة، ص...\n^2 اسم الباحث، عنوان المقال، اسم المجلة، المجلد، العدد، السنة، ص...';
        }

        export function buildMabhathPrompt(plan, mb, targetWordsPerMb, cfg) {
            var matalibList = (mb.matalib || []).map(function(mt, mIdx) {
                return '- ' + (mt.title || ('المطلب ' + (mIdx+1)));
            }).join('\n');
            return 'أنت باحث أكاديمي متخصص. اكتب متن هذا المبحث الأكاديمي بدقة علمية وتركيز دون حشو زائد:\n' +
            'عنوان البحث العام: ' + plan.title + '\n' +
            'المبحث المطلوب كتابته حصراً: ' + mb.title + '\n' +
            'مطالب هذا المبحث:\n' + matalibList + '\n\n' +
            'معيار الطول والحجم المطلوب بدقة متناهية (إلزامي صارم):\n' +
            '- الطول الإجمالي المطلوب لهذا المبحث كاملاً بجميع مطالبه هو: حوالي ' + targetWordsPerMb + ' كلمة فقط لا غير.\n' +
            '- لكل مطلب: اكتب ' + cfg.matlabParagraphs + '، مع إحالات توثيقية واضحة.\n' +
            '- تحذير هام: يمنع الإسهاب أو كتابة فقرات غير منتهية؛ التزم بعدد الكلمات المحدد (' + targetWordsPerMb + ' كلمة) لكي لا يتجاوز البحث إجمالي ' + cfg.targetPages + ' نهائياً.\n\n' +
            'الشروط الصارمة:\n' +
            '1. ابدأ بالسطر الأول مباشرة بعنوان المبحث:\n' + mb.title + '\n' +
            '2. ثم اكتب كل مطلب:\n' +
            'المطلب الأول: [عنوان المطلب]\n' +
            '(فقرات مركزة متسلسلة علمياً مع توثيق إحالات ^1، ^2 في نهايات الفقرات).\n' +
            'الهوامش:\n' +
            '^1 اسم المرجع الكامل، دار النشر، السنة، ص...\n' +
            '^2 اسم المرجع الكامل، دار النشر، السنة، ص...\n' +
            '3. كرر نفس البنية لبقية مطالب هذا المبحث بالهو هامش لكل مطلب مع الالتزام التام بحد ' + targetWordsPerMb + ' كلمة للمبحث كاملاً.\n' +
            '4. لا تكتب مقدمة عامة ولا خاتمة، بل اكتب نصوص هذا المبحث ومطالبه وهوامشه فقط.';
        }

        export function buildConclusionPrompt(plan, cfg) {
            var mbTitlesSummary = plan.mabahith.map(function(m){ return m.title; }).join(' - ');
            return 'أنت بروفيسور أكاديمي. اكتب خاتمة علمية وقائمة مصادر ومراجع متوازنة للبحث التالي:\n' +
            'عنوان البحث: ' + plan.title + '\n' +
            'مباحث ومحاور البحث: ' + mbTitlesSummary + '\n\n' +
            'معيار الطول والحجم المطلوب بدقة:\n' +
            '- الطول الإجمالي للخاتمة: حوالي ' + cfg.conclusionWords + ' كلمة.\n' +
            '- عدد المراجع الإجمالي: حوالي ' + cfg.maxRefs + ' مرجعاً متنوعاً (كتب ومجلات علمية محكمة).\n' +
            '- الالتزام التام لضمان عدم زيادة عدد صفحات البحث الإجمالية عن ' + cfg.targetPages + '.\n\n' +
            'الشروط الصارمة:\n' +
            '1. ابدأ السطر الأول بـ:\nالخـاتـمـــة:\n' +
            '2. اكتب ملخص النتائج المتوصل إليها ثم قائمة توصيات عملية مركزة.\n' +
            '3. ضع قسم الهوامش إن وجد:\nالهوامش:\n^1 ...\n' +
            '4. ثم اتبعها مباشرة بقائمة المصادر والمراجع كالتالي:\n' +
            'قائمة المصادر والمراجع:\n' +
            'أولاً: الكتب والمؤلفات:\n[1] ...\n' +
            'ثانياً: المجلات والدوريات:\n[' + Math.ceil(cfg.maxRefs/2) + '] ...\n' +
            'لا تضع أي نصوص ترحيبية أو إضافية.';
        }

        export { LENGTH_CONFIGS, buildFallbackPlan };
