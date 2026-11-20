// نظام الصور: يقرر أي الشرائح تستحق صورة، ويبني كلمات بحث إنجليزية من محتواها،
// ثم يبحث في Unsplash وPixabay (أو في نقطة بحث خلفية خاصة بالموقع) ويُرجع صوراً مفهرسة برقم الشريحة.
// النتيجة تُمرَّر إلى layoutDeck(deck, theme, opts, images)؛ وعند غياب الصور يرجع التخطيط إلى تصاميم هندسية.
import type { ResearchLanguage } from "../../types";
import type { SlideTheme } from "./themes";
import type { DeckImages, Point, Slide, SlideDeck, SlideImage } from "./types";

export type ImageProviderId = "unsplash" | "pixabay" | "pexels";
export type ImageRole = "cover" | "section" | "case-study" | "question" | "content" | "closing";

export interface SlideImageConfig {
  /** مفتاح Unsplash Access Key (يُفضَّل عدم وضعه في الواجهة؛ استعمل searchEndpoint) */
  unsplashAccessKey?: string;
  /** مفتاح Pixabay API */
  pixabayKey?: string;
  /** مفتاح Pexels API */
  pexelsKey?: string;
  /**
   * نقطة بحث خلفية خاصة بالموقع (موصى بها لإخفاء المفاتيح):
   * GET `${searchEndpoint}?q=...&orientation=landscape|portrait&per_page=10`
   * يجب أن تُرجع JSON بالشكل: { results: SlideImage[] }
   */
  searchEndpoint?: string;
  /** ترتيب المزودين عند البحث المباشر (الافتراضي: unsplash ثم pixabay) */
  providers?: ImageProviderId[];
  /** تحويل رابط الصورة النهائي (مثلاً عبر وكيل CORS في الموقع) */
  proxyImageUrl?: (url: string) => string;
  /** ترجمة/تلخيص نص الشريحة إلى كلمات بحث إنجليزية (مثلاً عبر محرك الذكاء الاصطناعي في الموقع) */
  translateQuery?: (text: string, lang: ResearchLanguage) => Promise<string>;
  /** الحد الأقصى لعدد الصور في العرض (الافتراضي 14) */
  maxImages?: number;
  /** مهلة كل طلب بالملّي ثانية (الافتراضي 9000) */
  timeoutMs?: number;
  /** عدد الطلبات المتزامنة (الافتراضي 3) */
  concurrency?: number;
}

let GLOBAL_CFG: SlideImageConfig = {};

/** ضبط إعدادات الصور مرة واحدة عند تشغيل الموقع */
export function configureSlideImages(cfg: SlideImageConfig): void {
  GLOBAL_CFG = { ...GLOBAL_CFG, ...cfg };
}

export function getSlideImageConfig(): SlideImageConfig {
  return GLOBAL_CFG;
}

export interface ImageRequest {
  slideIndex: number;
  role: ImageRole;
  query: string;
  orientation: "landscape" | "portrait";
  /** نص الشريحة الخام (يُمرَّر إلى translateQuery) */
  seedText: string;
}

// ---------- قاموس المصطلحات: عربي / فرنسي / إنجليزي ← كلمات بحث إنجليزية ----------

const TERMS: [RegExp, string][] = [
  [/ذكاء اصطناعي|intelligence artificielle|artificial intelligence/i, "artificial intelligence"],
  [/تعلم آلي|apprentissage automatique|machine learning/i, "machine learning"],
  [/أمن (?:المعلومات|سيبراني)|سيبراني|cybersécurité|cyber ?security/i, "cyber security"],
  [/قواعد البيانات|بيانات ضخمة|big data|base de données|database/i, "data center"],
  [/حوسبة سحابية|cloud/i, "cloud computing"],
  [/شبكات|réseaux|network/i, "network technology"],
  [/برمجة|برمجيات|programmation|logiciel|software|programming/i, "software programming"],
  [/تحول رقمي|التحول الرقمي|رقمنة|transformation numérique|digital transformation/i, "digital transformation"],
  [/تجارة إلكترونية|commerce électronique|e-?commerce/i, "online shopping"],
  [/إنترنت|internet/i, "internet technology"],
  [/هاتف|smartphone|mobile/i, "smartphone"],
  [/تضخم|inflation/i, "financial charts economy currency"],
  [/بطالة|chômage|unemployment/i, "economic crisis market office"],
  [/نمو اقتصادي|croissance économique|economic growth/i, "economic growth chart city"],
  [/تنمية مستدامة|développement durable|sustainable development/i, "sustainable development green technology"],
  [/تنمية|développement|development/i, "development modern city architecture"],
  [/اقتصاد|économi|econom/i, "economy finance chart"],
  [/بنك|بنوك|مصرف|banque|bank/i, "bank architecture building"],
  [/بورصة|أسهم|bourse|stock market|actions/i, "stock market financial display"],
  [/تأمين|assurance|insurance/i, "insurance documents office"],
  [/ضريب|جباية|fiscal|impôt|tax/i, "tax documents office"],
  [/ميزانية|budget/i, "budget planning spreadsheet"],
  [/محاسب|comptab|accounting/i, "accounting calculator spreadsheet"],
  [/تدقيق|مراجعة الحسابات|audit/i, "financial audit report documents"],
  [/تمويل|financement|financing/i, "finance investment capital"],
  [/استثمار|investissement|investment/i, "investment capital real estate"],
  [/عقار|immobilier|real estate/i, "modern real estate architecture"],
  [/سكن|logement|housing/i, "residential buildings architecture"],
  [/بناء|تشييد|construction/i, "construction site architecture"],
  [/تجارة خارجية|صادرات|واردات|export|import|commerce extérieur|foreign trade/i, "cargo port containers shipping"],
  [/تجارة|commerce|trade/i, "trade commercial container market"],
  [/محروقات|نفط|بترول|pétrole|hydrocarbures|oil|petroleum/i, "oil industry refinery platform"],
  [/طاقة متجددة|énergies? renouvelables?|renewable energy/i, "renewable energy solar wind"],
  [/طاقة|énergie|energy/i, "energy technology power plant"],
  [/بيئة|بيئي|environnement|environment/i, "nature landscape environment"],
  [/مناخ|climat|climate/i, "climate landscape ecology"],
  [/مياه|ماء|eau|water/i, "clean water landscape"],
  [/فلاح|زراع|agricult/i, "agriculture field green crop"],
  [/سياحة|tourisme|tourism/i, "tourism landmarks architectural"],
  [/نقل|transport/i, "transportation logistics railway"],
  [/لوجست|سلسلة الإمداد|logistique|supply chain|logistics/i, "logistics warehouse freight"],
  [/صناعة|صناعي|industri/i, "industry modern factory robotics"],
  [/مؤسسات صغيرة|مؤسسة صغيرة|pme|sme|small business/i, "modern small business workspace"],
  [/مقاولاتية|ريادة الأعمال|entrepreneuriat|entrepreneurship|startup/i, "modern tech startup office"],
  [/مؤسسة|شركة|entreprise|company|firm/i, "corporate headquarters skyscraper"],
  [/موارد بشرية|ressources humaines|human resources/i, "modern office workspace conference"],
  [/تسويق|marketing/i, "digital marketing dashboard analytics"],
  [/إشهار|إعلان|publicité|advertising/i, "advertising digital billboard"],
  [/جودة|qualité|quality/i, "quality control laboratory technical"],
  [/استراتيج|stratégi|strateg/i, "corporate business strategy boardroom"],
  [/قيادة|leadership/i, "corporate executive boardroom"],
  [/حوكمة|gouvernance|governance/i, "corporate governance architecture"],
  [/ابتكار|innovation/i, "innovation technology laboratory"],
  [/تسيير|إدارة|ادارة|gestion|management/i, "business management office"],
  [/أداء|performance/i, "financial performance chart analytics"],
  [/اتصال|communication/i, "digital communication technology"],
  [/إعلام|صحافة|médias|journalisme|media|journalism/i, "broadcast studio media equipment"],
  [/شبكات التواصل|مواقع التواصل|réseaux sociaux|social media/i, "social media technology digital"],
  [/قانون|قانوني|تشريع|droit|juridique|législation|law|legal/i, "courthouse law scale justice books"],
  [/دستور|constitution/i, "constitution law legal archive"],
  [/قضاء|محكمة|tribunal|justice|court/i, "courthouse pillars justice"],
  [/جريمة|جنائي|crime|pénal|criminal/i, "legal justice crime evidence court"],
  [/عقد|عقود|contrat|contract/i, "contract document pen legal"],
  [/انتخاب|élection|election/i, "election ballot box government"],
  [/علاقات دولية|relations internationales|international relations|diplomat/i, "diplomacy flags government summit"],
  [/سياسة|سياسي|politique|politic/i, "government parliament building architecture"],
  [/صحة|صحي|santé|health/i, "modern medical hospital facility"],
  [/مستشفى|hôpital|hospital/i, "modern hospital building clinic"],
  [/دواء|أدوية|صيدلة|médicament|pharmac/i, "pharmacy pharmaceutical laboratory"],
  [/سكري|diabète|diabetes/i, "medical healthcare laboratory"],
  [/سرطان|cancer/i, "oncology medical research laboratory"],
  [/وباء|فيروس|كورونا|épidémie|virus|pandemic|covid/i, "medical research laboratory microscope"],
  [/تغذية|nutrition/i, "healthy agricultural food harvest"],
  [/تمريض|infirm|nursing/i, "medical clinical equipment clinic"],
  [/تعليم|تربية|enseignement|éducation|education/i, "modern university campus classroom"],
  [/جامعة|طلبة|طالب|université|étudiant|university|student/i, "university library books architecture"],
  [/مدرسة|école|school/i, "school campus building classroom"],
  [/أسرة|عائلة|famille|family/i, "residential home architecture"],
  [/شباب|jeunes|youth/i, "modern university library study"],
  [/طفل|أطفال|enfant|children|child/i, "school education learning books"],
  [/مرأة|نساء|femme|women/i, "corporate leadership office boardroom"],
  [/علم النفس|نفسي|psycholog/i, "brain neuroscience abstract concept"],
  [/علم الاجتماع|مجتمع|اجتماعي|sociolog|société|society|social/i, "modern city urban architecture"],
  [/تاريخ|histoire|history/i, "historical museum archives monument"],
  [/فلسفة|philosophie|philosophy/i, "philosophy library classic books"],
  [/أدب|لغة|littérature|langue|literature|language/i, "ancient books library literature"],
  [/ثقافة|culture/i, "cultural museum heritage architecture"],
  [/رياضة|sport/i, "modern sports stadium arena"],
  [/مدينة|عمران|حضري|ville|urbain|city|urban/i, "modern city skyline architecture"],
  [/فقر|pauvreté|poverty/i, "economic development crisis abstract"],
  [/عولمة|mondialisation|globalization/i, "globalization world map technology"],
];

function englishTerms(text: string): string[] {
  const t = (text || "").toLowerCase();
  const out: string[] = [];
  for (const [re, en] of TERMS) {
    if (re.test(t) && !out.includes(en)) out.push(en);
    if (out.length >= 3) break;
  }
  return out;
}

const pointsText = (pts: Point[]) =>
  pts
    .map((p) => (p.label ? `${p.label}: ${p.text}` : p.text))
    .join(" ")
    .slice(0, 600);

function slideSeed(s: Slide): string {
  switch (s.kind) {
    case "cover":
      return `${s.meta.title} ${s.meta.subtitle || ""}`;
    case "section":
      return `${s.title} ${s.children.join(" ")}`;
    case "question":
      return s.text;
    case "content":
      return `${s.title} ${pointsText(s.points)}`;
    case "closing":
      return "";
    default:
      return "";
  }
}

/** كلمات بحث للشريحة: كلمات مخصصة ← مصطلحات العنوان ← مصطلحات النص ← موضوع العرض ← احتياطي القالب */
export function buildImageQuery(s: Slide, deck: SlideDeck, th: SlideTheme, rotation = 0): string {
  if (s.kind === "content" && s.imageQuery?.trim()) return s.imageQuery.trim();
  if (s.kind === "closing") {
    const topic = englishTerms(deck.title);
    return topic.length ? `${topic[0]} architecture minimalist` : "modern architecture minimalism";
  }
  const title =
    s.kind === "content" || s.kind === "section"
      ? s.title
      : s.kind === "cover"
        ? s.meta.title
        : s.kind === "question"
          ? s.text
          : deck.title;
  const own = englishTerms(title);
  const body = own.length ? [] : englishTerms(slideSeed(s));
  const topic = englishTerms(deck.title);
  const terms = [...own, ...body];
  if (!terms.length) terms.push(...topic);
  const q = terms.slice(0, 2).join(" ");
  if (q) return q;
  const fb = th.photo?.queries?.length ? th.photo.queries : ["abstract architecture"];
  return fb[rotation % fb.length];
}

/** تحديد الشرائح التي تحصل على صورة، بإيقاع يمنع ازدحام الصور */
export function planDeckImagery(deck: SlideDeck, th: SlideTheme, maxImages = 14): ImageRequest[] {
  const req: ImageRequest[] = [];
  const add = (i: number, role: ImageRole, orientation: "landscape" | "portrait" = "landscape") => {
    const s = deck.slides[i];
    req.push({
      slideIndex: i,
      role,
      orientation,
      query: buildImageQuery(s, deck, th, req.length),
      seedText: slideSeed(s),
    });
  };
  const primary: number[] = [];
  const content: number[] = [];
  let sinceLast = 99;
  deck.slides.forEach((s, i) => {
    if (s.kind === "cover" || s.kind === "closing" || s.kind === "section" || s.kind === "question") {
      primary.push(i);
      sinceLast = 0;
      return;
    }
    if (s.kind !== "content") {
      sinceLast++;
      return;
    }
    const txt = pointsText(s.points);
    const bullets = s.points.filter((p) => p.kind === "bullet").length;
    // الصور للشرائح النصية الخفيفة (عبارة محورية أو قائمة قصيرة)؛ البطاقات والمخططات تبقى هندسية
    const eligible =
      s.layout === "statement" ||
      (s.layout === "list" && s.part === 1 && bullets <= 5 && txt.length <= 520 && !s.points.some((p) => p.kind === "sub"));
    if (eligible && sinceLast >= 2) {
      content.push(i);
      sinceLast = 0;
    } else sinceLast++;
  });
  primary.forEach((i) => {
    const s = deck.slides[i];
    const role: ImageRole =
      s.kind === "section" ? (s.variant === "case-study" ? "case-study" : "section") : (s.kind as ImageRole);
    add(i, role, s.kind === "section" ? "portrait" : "landscape");
  });
  content.forEach((i) => add(i, "content", "portrait"));
  // ترتيب الأولوية عند تجاوز الحد: الغلاف، الختام، الفواصل، دراسة الحالة، الإشكالية، ثم المتن
  const rank: Record<ImageRole, number> = { cover: 0, closing: 1, section: 2, "case-study": 2, question: 3, content: 4 };
  return req
    .sort((a, b) => rank[a.role] - rank[b.role] || a.slideIndex - b.slideIndex)
    .slice(0, maxImages)
    .sort((a, b) => a.slideIndex - b.slideIndex);
}

// ---------- المزودون ----------

async function fetchJson(url: string, timeoutMs: number, headers?: Record<string, string>): Promise<unknown> {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const r = await fetch(url, { headers, signal: ctl?.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface UnsplashPhoto {
  id: string;
  alt_description?: string | null;
  urls: { raw: string; regular: string };
  user: { name: string };
  links: { download_location?: string };
}

async function searchUnsplash(q: string, orientation: string, cfg: SlideImageConfig): Promise<Candidate[]> {
  if (!cfg.unsplashAccessKey) return [];
  const url =
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}` +
    `&per_page=10&orientation=${orientation}&content_filter=high`;
  const auth = { Authorization: `Client-ID ${cfg.unsplashAccessKey}`, "Accept-Version": "v1" };
  const data = (await fetchJson(url, cfg.timeoutMs ?? 9000, auth)) as { results?: UnsplashPhoto[] };
  return (data.results || []).map((p) => ({
    id: `unsplash:${p.id}`,
    provider: "unsplash" as const,
    src: `${p.urls.raw}${p.urls.raw.includes("?") ? "&" : "?"}w=1920&q=80&fm=jpg&fit=max`,
    alt: p.alt_description || q,
    credit: `Photo: ${p.user.name} / Unsplash`,
    // يُستعمل لاحقاً لإبلاغ Unsplash بالتنزيل (شرط من شروط استعمال الواجهة)
    _download: p.links.download_location,
  }));
}

interface PixabayHit {
  id: number;
  largeImageURL: string;
  tags?: string;
  user?: string;
}

async function searchPixabay(q: string, orientation: string, cfg: SlideImageConfig): Promise<SlideImage[]> {
  if (!cfg.pixabayKey) return [];
  const url =
    `https://pixabay.com/api/?key=${encodeURIComponent(cfg.pixabayKey)}&q=${encodeURIComponent(q.slice(0, 95))}` +
    `&image_type=photo&orientation=${orientation === "portrait" ? "vertical" : "horizontal"}` +
    `&safesearch=true&per_page=10&min_width=1200`;
  const data = (await fetchJson(url, cfg.timeoutMs ?? 9000)) as { hits?: PixabayHit[] };
  return (data.hits || []).map((h) => ({
    id: `pixabay:${h.id}`,
    provider: "pixabay" as const,
    src: h.largeImageURL,
    alt: h.tags || q,
    credit: h.user ? `Image: ${h.user} / Pixabay` : "Pixabay",
  }));
}

interface PexelsHit {
  id: number;
  photographer: string;
  alt?: string;
  src: { large2x?: string; large?: string; original: string };
}

async function searchPexels(q: string, orientation: string, cfg: SlideImageConfig): Promise<SlideImage[]> {
  if (!cfg.pexelsKey) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=10&orientation=${orientation}`;
  const data = (await fetchJson(url, cfg.timeoutMs ?? 9000, { Authorization: cfg.pexelsKey })) as {
    photos?: PexelsHit[];
  };
  return (data.photos || []).map((p) => ({
    id: `pexels:${p.id}`,
    provider: "pexels" as const,
    src: p.src.large2x || p.src.large || p.src.original,
    alt: p.alt || q,
    credit: `Photo: ${p.photographer} / Pexels`,
  }));
}

async function searchEndpoint(q: string, orientation: string, cfg: SlideImageConfig): Promise<SlideImage[]> {
  if (!cfg.searchEndpoint) return [];
  const sep = cfg.searchEndpoint.includes("?") ? "&" : "?";
  const url = `${cfg.searchEndpoint}${sep}q=${encodeURIComponent(q)}&orientation=${orientation}&per_page=10`;
  const data = (await fetchJson(url, cfg.timeoutMs ?? 9000)) as { results?: SlideImage[] };
  return (data.results || []).filter((r) => r && typeof r.src === "string" && r.src);
}

type Candidate = SlideImage & { _download?: string };

async function searchAll(q: string, orientation: string, cfg: SlideImageConfig): Promise<Candidate[]> {
  if (cfg.searchEndpoint) {
    try {
      const r = await searchEndpoint(q, orientation, cfg);
      if (r.length) return r;
    } catch {
      /* ننتقل إلى المزودين المباشرين */
    }
  }
  for (const p of cfg.providers || ["pexels", "unsplash", "pixabay"]) {
    try {
      let r: Candidate[] = [];
      if (p === "pexels") r = await searchPexels(q, orientation, cfg);
      else if (p === "unsplash") r = await searchUnsplash(q, orientation, cfg);
      else if (p === "pixabay") r = await searchPixabay(q, orientation, cfg);
      if (r.length) return r;
    } catch {
      /* نجرب المزود التالي */
    }
  }
  return [];
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (i < items.length) {
      const k = i++;
      await fn(items[k]);
    }
  });
  await Promise.all(workers);
}

/**
 * البحث عن صور العرض كاملاً. لا يرمي أخطاء: الشرائح التي يتعذر جلب صورة لها تُترك دون صورة
 * ويستعمل التخطيط لها تصميماً هندسياً بديلاً.
 */
export async function resolveDeckImages(
  deck: SlideDeck,
  th: SlideTheme,
  cfg: SlideImageConfig = GLOBAL_CFG,
): Promise<DeckImages> {
  const conf = { ...GLOBAL_CFG, ...cfg };
  const out: DeckImages = {};
  if (!conf.searchEndpoint && !conf.unsplashAccessKey && !conf.pixabayKey) return out;
  const reqs = planDeckImagery(deck, th, conf.maxImages ?? 14);
  const lang = (deck.language || "ar") as ResearchLanguage;

  if (conf.translateQuery) {
    await pool(reqs, conf.concurrency ?? 3, async (r) => {
      const s = deck.slides[r.slideIndex];
      if (s.kind === "content" && s.imageQuery) return;
      try {
        const q = (await conf.translateQuery!(r.seedText.slice(0, 500), lang)).trim();
        if (q && q.length <= 80) r.query = q;
      } catch {
        /* نُبقي كلمات القاموس */
      }
    });
  }

  const cache = new Map<string, Promise<Candidate[]>>();
  const used = new Set<string>();
  const results = new Map<number, Candidate[]>();
  await pool(reqs, conf.concurrency ?? 3, async (r) => {
    const key = `${r.query}|${r.orientation}`;
    if (!cache.has(key)) cache.set(key, searchAll(r.query, r.orientation, conf).catch(() => []));
    let list = await cache.get(key)!;
    if (!list.length && r.orientation === "portrait") {
      const k2 = `${r.query}|landscape`;
      if (!cache.has(k2)) cache.set(k2, searchAll(r.query, "landscape", conf).catch(() => []));
      list = await cache.get(k2)!;
    }
    results.set(r.slideIndex, list);
  });

  // الاختيار بالتسلسل لضمان عدم تكرار نفس الصورة في شريحتين
  for (const r of reqs) {
    const list = results.get(r.slideIndex) || [];
    const pick = list.find((c) => !used.has(c.id || c.src));
    if (!pick) continue;
    used.add(pick.id || pick.src);
    const { _download, ...img } = pick;
    out[r.slideIndex] = { ...img, src: conf.proxyImageUrl ? conf.proxyImageUrl(img.src) : img.src };
    if (_download && conf.unsplashAccessKey) {
      fetch(_download, { headers: { Authorization: `Client-ID ${conf.unsplashAccessKey}` } }).catch(() => {});
    }
  }
  return out;
}
