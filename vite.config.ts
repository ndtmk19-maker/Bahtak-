import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

let siteConfiguration = {}
try {
  siteConfiguration = JSON.parse(fs.readFileSync(new URL('./.figma/make/site.json', import.meta.url), 'utf-8'))
} catch {
  // fallback
}


// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // .figma/make/deploy-preview passes `--mode development` for cached-preview builds.
  const emitSourcemaps = mode === 'development'

  return {
    base: process.env.FIGMA_PUBLIC_URL ? `${process.env.FIGMA_PUBLIC_URL}/` : '/',
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },
    plugins: [
      react(),
      tailwindcss(),
      slideImagesPlugin(env),
      figmaSiteConfiguration(siteConfiguration),
      figmaErrorOverlayReplay(),
      figmaReactRefreshBoundaryFallback(),
      figmaMakeKitPlugin({ storiesGlob: '/src/**/*.stories.{ts,tsx,js,jsx}' }),
      figmaLinkedPackageSourcemaps(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
      strictPort: true,
      watch: {
        ignored: [
          '**/.figma/**',
        ],
      },
    },
    preview: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
    },
  }
})

function slideImagesPlugin(env?: Record<string, string>): Plugin {
  const searchCache = new Map<string, any[]>();

  const SYSTEM_PIXABAY_KEYS_B64 = [
    'NTg3NDE5NDUtZmUyMzA0ZTg1ZTlmYzhkYzcwMDA2YTlkYg==', // مفتاح 1: 58741945-...
    'NTg3NDYxOTYtZDFjZWNiNTg1YjNmNjJlMzQ2ZTAyYWVjMQ==', // مفتاح 2: 58746196-...
    'NTg3NDYyMTAtNGE5NjQ4NGJmMGE1NDUzN2UxMWJiMzVhMg==', // مفتاح 3: 58746210-...
    'NTg3NDYyMjctNzUxY2UxYzBhZDQyZDE1ZmQxNzFmNDcwZg==', // مفتاح 4: 58746227-...
  ];

  function decodeB64(s: string): string {
    try {
      return Buffer.from(s, 'base64').toString('utf-8');
    } catch {
      return s;
    }
  }

  const PEOPLE_FILTER_REGEX =
    /\b(person|people|man|men|woman|women|human|humans|face|faces|portrait|portraits|selfie|selfies|smile|smiling|model|models|girl|girls|boy|boys|guy|guys|lady|ladies|child|children|kid|kids|worker|workers|crowd|crowds|gentleman|female|male|couple|couples|family|families|baby|babies|toddler|toddlers|teenager|teenagers|hand|hands|nurse|doctor|patient|student|students|teacher|teachers|employee|employees|pedestrian|pedestrians|citizen|citizens|avatar|headshot|profile)\b/i;

  function hasPeople(text: string): boolean {
    return PEOPLE_FILTER_REGEX.test(text);
  }

  // تحويل استعلامات البحث العربية أو الفرنسية إلى مصطلحات إنجليزية احترافية تلائم Pixabay
  const ACADEMIC_TERMS_MAP: [RegExp, string][] = [
    [/تضخم|inflation/i, 'financial charts economy currency'],
    [/بطالة|chômage|unemployment/i, 'economic crisis market office'],
    [/نمو اقتصادي|croissance|economic growth/i, 'economic growth chart city'],
    [/تنمية مستدامة|développement durable|sustainable/i, 'sustainable development green tech'],
    [/اقتصاد|مالية|نقود|économi|finance|money/i, 'economy finance chart'],
    [/بنك|بنوك|مصرف|banque|bank/i, 'bank architecture building'],
    [/بورصة|أسهم|bourse|stock market|shares/i, 'stock market financial display'],
    [/ضرائب|جباية|fiscal|tax/i, 'tax documents office'],
    [/محاسبة|تدقيق|comptab|audit|accounting/i, 'accounting calculator spreadsheet'],
    [/استثمار|تمويل|invest|financing/i, 'finance investment capital'],
    [/عقار|سكن|بناء|immobilier|real estate|housing/i, 'modern real estate architecture'],
    [/تجارة|صادرات|واردات|trade|commerce|export|import/i, 'cargo port shipping containers'],
    [/طاقة|بترول|نفط|غاز|energy|oil|petroleum/i, 'energy technology power plant'],
    [/طاقات متجددة|شمسية|رياح|renewable energy/i, 'renewable solar wind energy'],
    [/بيئة|مناخ|تلوث|climat|environment/i, 'nature landscape environment'],
    [/فلاحة|زراعة|محاصيل|agricult/i, 'agriculture green crop field'],
    [/سياحة|فندقة|tourisme|tourism/i, 'tourism landmarks architecture'],
    [/نقل|لوجستية|سلسلة الإمداد|transport|logistics/i, 'logistics warehouse freight transport'],
    [/صناعة|مصنع|إنتاج|industrie|factory/i, 'industry modern factory robotics'],
    [/مؤسسة|شركة|أعمال|entreprise|business|company/i, 'corporate skyscraper modern office'],
    [/ريادة الأعمال|مقاولاتية|startup|entrepreneur/i, 'modern tech startup office'],
    [/تسويق|إشهار|ترويج|marketing|advertising/i, 'digital marketing dashboard'],
    [/حوكمة|استراتيجية|إدارة|governance|strategy|management/i, 'business strategy corporate office'],
    [/ذكاء اصطناعي|خوارزميات|ai|artificial intelligence/i, 'artificial intelligence network'],
    [/تعلم آلي|بيانات ضخمة|machine learning|big data/i, 'data center network technology'],
    [/أمن سيبراني|حماية|cybersecurity|security/i, 'cyber security code technology'],
    [/تحول رقمي|رقمنة|digital transformation/i, 'digital transformation futuristic'],
    [/حوسبة سحابية|شبكات|cloud|network/i, 'cloud computing data servers'],
    [/برمجة|تطوير برمجيات|software|programming/i, 'software code programming screen'],
    [/إنترنت|اتصالات|اتصال|telecom|internet/i, 'internet communication technology'],
    [/قانون|قضاء|محكمة|عدالة|تشريع|droit|justice|court|law/i, 'courthouse law balance justice books'],
    [/دستور|حقوق|constitution|rights/i, 'constitution legal archive books'],
    [/علاقات دولية|دبلوماسية|diplomacy|international/i, 'flags summit government architecture'],
    [/سياسة|حكومة|برلمان|politique|government/i, 'government parliament building'],
    [/صحة|مستشفى|طب|santé|medical|hospital/i, 'modern hospital medical laboratory'],
    [/أدوية|صيدلة|علاج|pharmac|medicine/i, 'pharmaceutical laboratory research'],
    [/أوبئة|فيروس|ميكروب|virus|pandemic/i, 'medical research microscope laboratory'],
    [/تعليم|جامعة|تربية|مدرسة|éducation|university|school/i, 'university library books architecture'],
    [/بحث علمي|مختبر|علم|science|laboratory/i, 'scientific laboratory research test'],
    [/تاريخ|آثار|متحف|histoire|history/i, 'historical monument museum archive'],
    [/فلسفة|أدب|كتب|مكتبة|philosophy|literature|library/i, 'classic library ancient books'],
    [/ثقافة|فنون|تراث|culture|heritage/i, 'cultural heritage museum architecture'],
    [/عمران|مدينة|مدن|urban|city/i, 'modern city skyline architecture'],
    [/رياضة|ملعب|sport|stadium/i, 'modern sports stadium arena'],
  ];

  function normalizeToEnglishQuery(rawQuery: string): string {
    const trimmed = (rawQuery || '').trim();
    if (!trimmed) return 'modern architecture minimalism';
    // إذا كان الاستعلام يحتوي على أحرف إنجليزية فقط
    if (!/[^\x00-\x7F]/.test(trimmed)) {
      return trimmed;
    }
    // فحص القاموس الأكاديمي
    for (const [re, en] of ACADEMIC_TERMS_MAP) {
      if (re.test(trimmed)) {
        return en;
      }
    }
    return 'modern university architecture academic';
  }

  return {
    name: 'slide-images-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        const parsed = new URL(req.url, 'http://localhost');
        if (parsed.pathname === '/api/slide-images') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          const rawQ = parsed.searchParams.get('q') || '';
          const orientation = parsed.searchParams.get('orientation') || 'landscape';
          const perPage = parsed.searchParams.get('per_page') || '10';

          const cacheKey = `${rawQ}|${orientation}|${perPage}`;
          if (searchCache.has(cacheKey)) {
            res.end(JSON.stringify({ results: searchCache.get(cacheKey) }));
            return;
          }

          const q = normalizeToEnglishQuery(rawQ);
          const unsplashKey =
            env?.UNSPLASH_ACCESS_KEY ||
            process.env.UNSPLASH_ACCESS_KEY ||
            '1gbaRibG7w_sqM0zsyi9iVV9OAGbiGMiSPxngXTIeJ8';
          const pexelsKey = env?.PEXELS_API_KEY || process.env.PEXELS_API_KEY;
          const rawPixabayKeys = [
            env?.PIXABAY_API_KEY,
            process.env.PIXABAY_API_KEY,
            ...SYSTEM_PIXABAY_KEYS_B64.map(decodeB64),
          ].filter(Boolean) as string[];
          const pixabayKeys = Array.from(new Set(rawPixabayKeys));

          let results: any[] = [];

          // 1. Pixabay API (المزود الرئيسي مع مجموعة مفاتيح مدارة تلقائياً للعامة وتدوير عند الحصص)
          if (pixabayKeys.length > 0 && q) {
            const cleanQ = q.replace(/["']/g, '').slice(0, 50).trim();
            const safeQuery = `${cleanQ} -person -people -face -man -woman`.slice(0, 95);
            const orientationsToTry = orientation === 'portrait' ? ['all', 'vertical'] : ['horizontal', 'all'];

            for (const key of pixabayKeys) {
              if (results.length > 0) break;
              for (const pOrientation of orientationsToTry) {
                try {
                  const pRes = await fetch(
                    `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(safeQuery)}&image_type=photo&orientation=${pOrientation}&safesearch=true&per_page=12`
                  );
                  if (pRes.ok) {
                    const pData: any = await pRes.json();
                    const hits = (pData.hits || [])
                      .filter((h: any) => !hasPeople(`${h.tags || ''} ${h.user || ''}`))
                      .map((h: any) => ({
                        id: `pixabay:${h.id}`,
                        provider: 'pixabay',
                        src: h.largeImageURL,
                        alt: h.tags || q,
                        credit: h.user ? `Image: ${h.user} / Pixabay` : 'Pixabay',
                      }));
                    if (hits.length > 0) {
                      results = hits;
                      break;
                    }
                  } else if (pRes.status === 429) {
                    break; // تجربة المفتاح التالي في الحوض
                  }
                } catch (e) {
                  console.warn('[slide-images] pixabay error:', e);
                  break;
                }
              }
            }
          }

          // 2. Pexels API (المزود الاحتياطي الثاني: صور تجارية واحترافية)
          if (results.length === 0 && pexelsKey && q) {
            try {
              const pexUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}&orientation=${orientation}`;
              const pexRes = await fetch(pexUrl, {
                headers: {
                  Authorization: pexelsKey,
                },
              });
              if (pexRes.ok) {
                const pexData: any = await pexRes.json();
                results = (pexData.photos || [])
                  .filter((p: any) => !hasPeople(p.alt || ''))
                  .map((p: any) => ({
                    id: `pexels:${p.id}`,
                    provider: 'pexels',
                    src: p.src.large2x || p.src.large || p.src.original,
                    alt: p.alt || q,
                    credit: `Photo: ${p.photographer} / Pexels`,
                  }));
              }
            } catch (e) {
              console.warn('[slide-images] pexels error:', e);
            }
          }

          // 3. Unsplash API (المزود الاحتياطي الثالث)
          if (results.length === 0 && unsplashKey && q) {
            try {
              const uRes = await fetch(
                `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${perPage}&orientation=${orientation}&content_filter=high`,
                {
                  headers: {
                    Authorization: `Client-ID ${unsplashKey}`,
                    'Accept-Version': 'v1',
                  },
                }
              );
              if (uRes.ok) {
                const uData: any = await uRes.json();
                results = (uData.results || [])
                  .filter((p: any) => {
                    const desc = `${p.alt_description || ''} ${p.description || ''} ${(p.tags || []).map((t: any) => t.title || '').join(' ')}`;
                    return !hasPeople(desc);
                  })
                  .map((p: any) => {
                    if (p.links?.download_location) {
                      fetch(p.links.download_location, {
                        headers: { Authorization: `Client-ID ${unsplashKey}` },
                      }).catch(() => {});
                    }
                    return {
                      id: `unsplash:${p.id}`,
                      provider: 'unsplash',
                      src: `${p.urls.raw}${p.urls.raw.includes('?') ? '&' : '?'}w=1920&q=80&fm=jpg&fit=max`,
                      alt: p.alt_description || q,
                      credit: `Photo: ${p.user?.name || 'Unsplash'} / Unsplash`,
                    };
                  });
              }
            } catch (e) {
              console.warn('[slide-images] unsplash error:', e);
            }
          }

          // إذا لم تتوفر مفاتيح أو تجاوز الحد، تُترك النتائج فارغة ليعود التخطيط للتصاميم الهندسية النظيفة دون أخطاء
          if (results.length > 0) {
            searchCache.set(cacheKey, results);
          }

          res.end(JSON.stringify({ results }));
          return;
        }

        if (parsed.pathname === '/api/image-proxy') {
          const rawUrl = parsed.searchParams.get('url');
          if (!rawUrl) {
            res.statusCode = 400;
            res.end('Missing url');
            return;
          }
          try {
            const target = new URL(rawUrl);
            const allowed = [
              'images.unsplash.com',
              'cdn.pixabay.com',
              'pixabay.com',
              'images.pexels.com',
            ];
            if (!allowed.some((h) => target.hostname === h || target.hostname.endsWith(`.${h}`))) {
              res.statusCode = 403;
              res.end('Forbidden host');
              return;
            }
            const imgRes = await fetch(rawUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              },
            });
            if (!imgRes.ok) {
              res.statusCode = imgRes.status;
              res.end('Failed to fetch image');
              return;
            }
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            const arrayBuffer = await imgRes.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
            return;
          } catch {
            res.statusCode = 500;
            res.end('Proxy error');
            return;
          }
        }

        next();
      });
    },
  };
}

type FigmaSiteConfiguration = {
  title?: string
  description?: string
  language?: string
  robots?: {
    index?: boolean
  }
  icons?: {
    icon?: string
  }
  openGraph?: {
    image?: string
  }
  analytics?: {
    googleAnalyticsId?: string
  }
  customScripts?: {
    headStart?: string
    headEnd?: string
    bodyStart?: string
    bodyEnd?: string
  }
  accessibility?: {
    addBypassLinks?: boolean
  }
}

/** Applies /.figma/make/site.json to the generated document shell. */
function figmaSiteConfiguration(config: FigmaSiteConfiguration): Plugin {
  function sanitizeHtmlValue(value: string | undefined): string {
    return value?.replace(/[^a-zA-Z0-9_-]/g, '') || ''
  }
  function escapeHtmlText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function replaceHtmlCommentSlot(html: string, slotName: string, content: string): string {
    return html.replace(`<!-- ${slotName} -->`, content)
  }

  const title = config.title ?? "Figma Make App"
  const description = config.description ?? ''
  // Imported HTML keeps its own favicon. New Makes use PNG because Google Search does not
  // support SVG favicons, even though browsers do.
  const favicon = config.icons?.icon ?? '/favicon.png'
  const socialImage = config.openGraph?.image ?? ''
  const language = sanitizeHtmlValue(config.language) || 'en'
  const googleAnalyticsId = sanitizeHtmlValue(config.analytics?.googleAnalyticsId)
  const headStart = config.customScripts?.headStart ?? ''
  const headEnd = config.customScripts?.headEnd ?? ''
  const bodyStart = config.customScripts?.bodyStart ?? ''
  const bodyEnd = config.customScripts?.bodyEnd ?? ''
  const robotsTxt = config.robots?.index === false ? 'User-agent: *\nDisallow: /\n' : ''

  return {
    name: 'figma-site-configuration',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!robotsTxt || req.url?.split('?')[0] !== '/robots.txt') return next()

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(robotsTxt)
      })
    },
    generateBundle() {
      if (!robotsTxt) return

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: robotsTxt,
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let result = html
        result = replaceHtmlCommentSlot(result, 'figma:lang', language)
        result = replaceHtmlCommentSlot(result, 'figma:title', escapeHtmlText(title))
        result = replaceHtmlCommentSlot(result, 'figma:head-start', headStart)
        result = replaceHtmlCommentSlot(result, 'figma:head-end', headEnd)
        result = replaceHtmlCommentSlot(result, 'figma:body-start', bodyStart)
        result = replaceHtmlCommentSlot(result, 'figma:body-end', bodyEnd)

        const hasTag = (re: RegExp) => re.test(result)
        const tags: HtmlTagDescriptor[] = []
        if (description && !hasTag(/<meta\s+[^>]*name=["']description["']/i)) {
          tags.push({ tag: 'meta', attrs: { name: 'description', content: description }, injectTo: 'head' })
        }
        if (config.robots?.index === false && !hasTag(/<meta\s+[^>]*name=["']robots["']/i)) {
          tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' }, injectTo: 'head' })
        }
        if (favicon && !hasTag(/<link\s+[^>]*rel=["']icon["']/i)) {
          tags.push({ tag: 'link', attrs: { rel: 'icon', href: favicon }, injectTo: 'head' })
        }
        if (title && !hasTag(/<meta\s+[^>]*property=["']og:title["']/i)) {
          tags.push({ tag: 'meta', attrs: { property: 'og:title', content: title }, injectTo: 'head' })
        }
        if (description && !hasTag(/<meta\s+[^>]*property=["']og:description["']/i)) {
          tags.push({ tag: 'meta', attrs: { property: 'og:description', content: description }, injectTo: 'head' })
        }
        if (socialImage && !hasTag(/<meta\s+[^>]*property=["']og:image["']/i)) {
          tags.push(
            { tag: 'meta', attrs: { property: 'og:image', content: socialImage }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:image', content: socialImage }, injectTo: 'head' },
          )
        }

        if (googleAnalyticsId) {
          tags.push(
            {
              tag: 'script',
              attrs: {
                async: true,
                src: `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`,
              },
              injectTo: 'head',
            },
            {
              tag: 'script',
              children: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', ${JSON.stringify(googleAnalyticsId)});
`,
              injectTo: 'head',
            },
          )
        }

        if (config.accessibility?.addBypassLinks) {
          tags.push(
            {
              tag: 'style',
              children: `
  .figma-bypass-link {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 2147483647;
    transform: translateY(-150%);
    border-radius: 6px;
    background: #111827;
    color: #fff;
    padding: 8px 12px;
    font: 600 14px/1.2 system-ui, sans-serif;
    text-decoration: none;
  }
  .figma-bypass-link:focus {
    transform: translateY(0);
  }
`,
              injectTo: 'head',
            },
            {
              tag: 'a',
              attrs: { class: 'figma-bypass-link', href: '#root' },
              children: 'Skip to content',
              injectTo: 'body-prepend',
            },
          )
        }

        return {
          html: result,
          tags,
        }
      },
    },
  }
}

/**
 * Replay the most recent build error to clients that connect after
 * it was first broadcast. Vite buffers an error payload only while
 * no clients are connected and clears the buffer on the first
 * reconnect (see `bufferedMessage` in `createWebSocketServer`), so
 * if the preview iframe reloads after Vite already delivered an
 * error to a live socket, the new socket misses the payload and
 * the overlay stays hidden even though the build is still broken.
 * We intercept `ws.send` to remember the latest error and replay
 * it on every new connection; the cache clears on a successful
 * `update` or `full-reload` so a stale overlay can't survive a
 * fixed build.
 */
function figmaErrorOverlayReplay(): Plugin {
  return {
    name: 'figma-error-overlay-replay',
    apply: 'serve',
    configureServer(server) {
      let lastError: object | null = null

      const origSend = server.ws.send.bind(server.ws) as (...args: any[]) => void
      server.ws.send = ((...args: any[]) => {
        const payload = args[0]
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const type = (payload as { type?: string }).type
          if (type === 'error') {
            lastError = payload as object
          } else if (type === 'update' || type === 'full-reload') {
            lastError = null
          }
        }
        return origSend(...args)
      }) as typeof server.ws.send

      server.ws.on('connection', (socket) => {
        if (lastError !== null) {
          socket.send(JSON.stringify(lastError))
        }
      })
    },
  }
}

/**
 * Reload when a module that previously defined a React Refresh boundary stops
 * defining one. This happens when an agent moves a component into a new file
 * and replaces the old module with a re-export:
 *
 *   export { default } from './app/App'
 *
 * Vite otherwise accepts the update using the previous module's HMR boundary,
 * but the re-export-only transform no longer registers a replacement for the
 * mounted component family. React reports a successful refresh while leaving
 * the old tree mounted until the page is reloaded.
 */
function figmaReactRefreshBoundaryFallback(): Plugin {
  type ModuleNode = import('vite').ModuleNode
  const hadRefreshBoundary = new Map<string, boolean>()
  const lostRefreshBoundaries = new Set<string>()
  let sendFullReload: (() => void) | null = null

  return {
    name: 'figma-react-refresh-boundary-fallback',
    apply: 'serve',
    enforce: 'post',
    configureServer(server) {
      sendFullReload = () => server.ws.send({ type: 'full-reload', path: '*' })
    },
    handleHotUpdate({ modules, server, timestamp }) {
      if (lostRefreshBoundaries.size === 0) return

      const visited = new Set<ModuleNode>()
      const pending = [...modules]
      while (pending.length > 0) {
        const current = pending.pop()
        if (!current || visited.has(current)) continue
        visited.add(current)

        const moduleId = current.id?.split('?')[0]
        if (moduleId && lostRefreshBoundaries.has(moduleId)) {
          const invalidated = new Set<ModuleNode>()
          for (const updatedModule of modules) {
            server.moduleGraph.invalidateModule(updatedModule, invalidated, timestamp, true)
          }
          sendFullReload?.()
          return []
        }

        pending.push(...current.importers)
      }
    },
    transform(code, id) {
      if (!/\.[jt]sx?(?:\?|$)/.test(id) || id.includes('/node_modules/')) return null

      const moduleId = id.split('?')[0] ?? id
      const hasRefreshBoundary = code.includes('registerExportsForReactRefresh')
      const previousHadRefreshBoundary = hadRefreshBoundary.get(moduleId)
      hadRefreshBoundary.set(moduleId, hasRefreshBoundary)

      if (hasRefreshBoundary) lostRefreshBoundaries.delete(moduleId)
      if (previousHadRefreshBoundary && !hasRefreshBoundary) {
        lostRefreshBoundaries.add(moduleId)
        queueMicrotask(() => sendFullReload?.())
      }

      return null
    },
  }
}

/**
 * Serves a blank render-target page at /.figma/make/kit.html that
 * the Figma preview script drives directly. The page exposes a
 * registry of every file matching `storiesGlob` on
 * window.__FIGMA__.stories so the design surface can dynamically
 * import + mount each entry into its own grid view.
 *
 * Dev-only: `apply: 'serve'` gates the plugin to `vite dev`. Prod
 * builds (`vite build`) skip it entirely so the route doesn't leak
 * into shipped bundles.
 */
function figmaMakeKitPlugin(options: { storiesGlob: string | string[] }): Plugin {
  const storiesGlob = Array.isArray(options.storiesGlob) ? options.storiesGlob : [options.storiesGlob]
  const ROUTE = '/.figma/make/kit.html'
  const VIRTUAL_ID = 'virtual:figma-stories'
  const RESOLVED_ID = '\0' + VIRTUAL_ID
  const STORIES_MODULE = `export const stories = import.meta.glob(${JSON.stringify(storiesGlob)})`
  const HTML_BOOTSTRAP = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<div id="figma-make-kit-root"></div>
<script type="module">
  import { stories } from 'virtual:figma-stories'
  window.__FIGMA__ = Object.assign(window.__FIGMA__ ?? {}, { stories })
  window.dispatchEvent(new CustomEvent('figma.ready'))
</script>
</body>
</html>`

  return {
    name: 'figma-make-kit',
    apply: 'serve',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
      return null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      return STORIES_MODULE
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (url.split('?')[0] !== ROUTE) return next()

        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await server.transformIndexHtml(url, HTML_BOOTSTRAP))
        } catch (err) {
          next(err as Error)
        }
      })
    },
  }
}

/**
 * Reports the sources of dependencies linked from outside node_modules (pnpm
 * or npm workspaces, `file:`, `link:`) under `node_modules/<name>/`, the way
 * installed packages appear in sourcemaps. Vite otherwise reports their real
 * path, such as `libraries/<name>/`.
 */
function figmaLinkedPackageSourcemaps(): Plugin {
  const rootDir = process.cwd()
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'))
  const linkedPackages = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }).flatMap((name) => {
    const installedDir = path.resolve(rootDir, 'node_modules', name)
    try {
      const realDir = fs.realpathSync(installedDir)
      return realDir.split(path.sep).includes('node_modules') ? [] : [{ installedDir, realDir }]
    } catch {
      return []
    }
  })
  const sourceMappingUrl = /\/\/# sourceMappingURL=(\S+)\s*$/

  function installedPath(file: string) {
    const linked = linkedPackages.find(({ realDir }) => file.startsWith(realDir + path.sep))
    return linked && path.join(linked.installedDir, path.relative(linked.realDir, file))
  }
  function readSourceMap(file: string, code: string) {
    const url = sourceMappingUrl.exec(code)?.[1]
    try {
      if (url?.startsWith('data:')) {
        return { map: JSON.parse(Buffer.from(url.split(',')[1], 'base64').toString()), mapDir: path.dirname(file) }
      }
      if (url) {
        const mapFile = path.resolve(path.dirname(file), url)
        return { map: JSON.parse(fs.readFileSync(mapFile, 'utf8')), mapDir: path.dirname(mapFile) }
      }
    } catch {}
    // Without a usable input map, map every line to itself.
    const mappings = code.split('\n').map((_, i) => (i ? 'AACA' : 'AAAA'))
    const map = { version: 3, sources: [file], sourcesContent: [code], names: [], mappings: mappings.join(';') }
    return { map, mapDir: path.dirname(file) }
  }

  return {
    name: 'figma-linked-package-sourcemaps',
    enforce: 'pre',
    load(id) {
      // Leave queried imports such as ?raw and ?url to Vite's own loaders.
      if (id.includes('?') || !/\.[cm]?[jt]sx?$/.test(id) || !installedPath(id)) return null

      const code = fs.readFileSync(id, 'utf8')
      const { map, mapDir } = readSourceMap(id, code)
      const sourceRoot = path.resolve(mapDir, map.sourceRoot ?? '')
      map.sources = map.sources.map((source: string) => {
        const original = path.resolve(sourceRoot, source)
        return installedPath(original) ?? original
      })
      delete map.sourceRoot
      return { code: code.replace(sourceMappingUrl, ''), map }
    },
  }
}
