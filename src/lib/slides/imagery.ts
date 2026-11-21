// نظام الصور: يقرر أي الشرائح تستحق صورة، ويبني كلمات بحث إنجليزية من محتواها،
// ثم يبحث في Unsplash وPixabay (أو في نقطة بحث خلفية خاصة بالموقع) ويُرجع صوراً مفهرسة برقم الشريحة.
// النتيجة تُمرَّر إلى layoutDeck(deck, theme, opts, images)؛ وعند غياب الصور يرجع التخطيط إلى تصاميم هندسية.
import type { ResearchLanguage } from "../../types";
import {
  getAllPixabayKeys,
  getEffectivePixabayKey,
  getEffectiveUnsplashKey,
  rotatePixabayKey,
} from "./imageKeys";
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

function decodeB64(s: string): string {
  try {
    if (typeof atob === "function") return atob(s);
  } catch {}
  try {
    return Buffer.from(s, "base64").toString("utf-8");
  } catch {}
  return s;
}

// مفاتيح النظام المدمجة لجميع مستخدمي المنصة (مشفرة بـ Base64 لحمايتها من المسح الآلي)
export const SYSTEM_PIXABAY_KEY = getEffectivePixabayKey();
export const SYSTEM_UNSPLASH_KEY = getEffectiveUnsplashKey();

const PEOPLE_FILTER_REGEX =
  /\b(person|people|man|men|woman|women|human|humans|face|faces|portrait|portraits|selfie|selfies|smile|smiling|model|models|girl|girls|boy|boys|guy|guys|lady|ladies|child|children|kid|kids|worker|workers|crowd|crowds|gentleman|female|male|couple|couples|family|families|baby|babies|toddler|toddlers|teenager|teenagers|hand|hands|nurse|doctor|patient|student|students|teacher|teachers|employee|employees|pedestrian|pedestrians|citizen|citizens|avatar|headshot|profile)\b/i;

function hasPeople(text: string): boolean {
  return PEOPLE_FILTER_REGEX.test(text);
}

let GLOBAL_CFG: SlideImageConfig = {
  pixabayKey: getEffectivePixabayKey(),
  unsplashAccessKey: getEffectiveUnsplashKey(),
  providers: ["pixabay", "unsplash"],
};

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
  [/تضخم|inflation/i, "inflation economy"],
  [/بطالة|chômage|unemployment/i, "unemployment crisis"],
  [/نمو اقتصادي|croissance économique|economic growth/i, "economic growth"],
  [/تنمية مستدامة|développement durable|sustainable development/i, "sustainable ecology"],
  [/تنمية|développement|development/i, "city development"],
  [/اقتصاد|économi|econom/i, "finance economy"],
  [/بنك|بنوك|مصرف|banque|bank/i, "bank architecture"],
  [/بورصة|أسهم|bourse|stock market|actions/i, "stock market"],
  [/تأمين|assurance|insurance/i, "insurance office"],
  [/ضريب|جباية|fiscal|impôt|tax/i, "tax documents"],
  [/ميزانية|budget/i, "budget planning"],
  [/محاسب|comptab|accounting/i, "accounting calculator"],
  [/تدقيق|مراجعة الحسابات|audit/i, "financial audit"],
  [/تمويل|financement|financing/i, "finance investment"],
  [/استثمار|investissement|investment/i, "investment capital"],
  [/عقار|immobilier|real estate/i, "real estate architecture"],
  [/سكن|logement|housing/i, "residential buildings"],
  [/بناء|تشييد|construction/i, "construction building"],
  [/تجارة خارجية|صادرات|واردات|export|import|commerce extérieur|foreign trade/i, "cargo containers"],
  [/تجارة|commerce|trade/i, "commercial trade"],
  [/محروقات|نفط|بترول|pétrole|hydrocarbures|oil|petroleum/i, "oil refinery"],
  [/طاقة متجددة|énergies? renouvelables?|renewable energy/i, "renewable energy"],
  [/طاقة|énergie|energy/i, "energy technology"],
  [/بيئة|بيئي|environnement|environment/i, "nature environment"],
  [/مناخ|climat|climate/i, "climate landscape"],
  [/مياه|ماء|eau|water/i, "clean water"],
  [/فلاح|زراع|agricult/i, "agriculture field"],
  [/سياحة|tourisme|tourism/i, "tourism landmarks"],
  [/نقل|transport/i, "transportation logistics"],
  [/لوجست|سلسلة الإمداد|logistique|supply chain|logistics/i, "warehouse logistics"],
  [/صناعة|صناعي|industri/i, "modern factory"],
  [/مؤسسات صغيرة|مؤسسة صغيرة|pme|sme|small business/i, "small business"],
  [/مقاولاتية|ريادة الأعمال|entrepreneuriat|entrepreneurship|startup/i, "tech startup"],
  [/مؤسسة|شركة|entreprise|company|firm/i, "corporate skyscraper"],
  [/موارد بشرية|ressources humaines|human resources/i, "modern office"],
  [/تسويق|marketing/i, "digital marketing"],
  [/إشهار|إعلان|publicité|advertising/i, "advertising billboard"],
  [/جودة|qualité|quality/i, "quality control"],
  [/استراتيج|stratégi|strateg/i, "business strategy"],
  [/قيادة|leadership/i, "executive boardroom"],
  [/حوكمة|gouvernance|governance/i, "corporate governance"],
  [/ابتكار|innovation/i, "technology innovation"],
  [/تسيير|إدارة|ادارة|gestion|management/i, "business management"],
  [/أداء|performance/i, "performance analytics"],
  [/اتصال|communication/i, "digital communication"],
  [/إعلام|صحافة|médias|journalisme|media|journalism/i, "broadcast studio"],
  [/شبكات التواصل|مواقع التواصل|réseaux sociaux|social media/i, "social media technology"],
  [/قانون|قانوني|تشريع|droit|juridique|législation|law|legal/i, "courthouse law"],
  [/دستور|constitution/i, "constitution law"],
  [/قضاء|محكمة|tribunal|justice|court/i, "justice courthouse"],
  [/جريمة|جنائي|crime|pénal|criminal/i, "legal justice"],
  [/عقد|عقود|contrat|contract/i, "legal contract"],
  [/انتخاب|élection|election/i, "ballot box"],
  [/علاقات دولية|relations internationales|international relations|diplomat/i, "diplomacy flags"],
  [/سياسة|سياسي|politique|politic/i, "parliament building"],
  [/صحة|صحي|santé|health/i, "hospital medical"],
  [/مستشفى|hôpital|hospital/i, "hospital clinic"],
  [/دواء|أدوية|صيدلة|médicament|pharmac/i, "pharmaceutical laboratory"],
  [/سكري|diabète|diabetes/i, "medical healthcare"],
  [/سرطان|cancer/i, "medical research"],
  [/وباء|فيروس|كورونا|épidémie|virus|pandemic|covid/i, "microscope laboratory"],
  [/تغذية|nutrition/i, "healthy food"],
  [/تمريض|infirm|nursing/i, "medical clinical"],
  [/تعليم|تربية|enseignement|éducation|education/i, "university campus"],
  [/جامعة|طلبة|طالب|université|étudiant|university|student/i, "university library"],
  [/مدرسة|école|school/i, "school campus"],
  [/أسرة|عائلة|famille|family/i, "residential home"],
  [/شباب|jeunes|youth/i, "university library"],
  [/طفل|أطفال|enfant|children|child/i, "education books"],
  [/مرأة|نساء|femme|women/i, "executive office"],
  [/علم النفس|نفسي|psycholog/i, "brain neuroscience"],
  [/علم الاجتماع|مجتمع|اجتماعي|sociolog|société|society|social/i, "city architecture"],
  [/تاريخ|histoire|history/i, "historical monument"],
  [/فلسفة|philosophie|philosophy/i, "ancient books"],
  [/أدب|لغة|littérature|langue|literature|language/i, "classic library"],
  [/ثقافة|culture/i, "museum architecture"],
  [/رياضة|sport/i, "sports stadium"],
  [/مدينة|عمران|حضري|ville|urbain|city|urban/i, "city skyline"],
  [/فقر|pauvreté|poverty/i, "economic crisis"],
  [/عولمة|mondialisation|globalization/i, "globalization map"],
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
    const safeTopic = topic[0]?.replace(/\b(unemployment|poverty|crime|disease|virus|covid|crisis)\b/gi, "").trim();
    return safeTopic ? `${safeTopic} architecture` : "modern architecture minimalism";
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
  if (terms.length > 0) {
    return terms[rotation % terms.length];
  }
  const fb = th.photo?.queries?.length ? th.photo.queries : ["modern architecture", "academic library", "business office"];
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
    // الصور للشرائح النصية (عبارة محورية أو قائمة قصيرة أو مطلب رئيسي خفيف)؛ البطاقات والمخططات الكثيفة تبقى هندسية
    const eligible =
      s.layout === "statement" ||
      ((s.layout === "list" || s.layout === "cards") &&
        s.part === 1 &&
        bullets >= 1 &&
        bullets <= 4 &&
        txt.length <= 540 &&
        !s.points.some((p) => p.kind === "sub"));
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
  const key = cfg.unsplashAccessKey || getEffectiveUnsplashKey();
  if (!key) return [];
  const cleanQ = q.replace(/["']/g, "").slice(0, 50).trim();
  const url =
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(cleanQ)}` +
    `&per_page=10&orientation=${orientation}&content_filter=high`;
  const auth = { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" };
  const data = (await fetchJson(url, cfg.timeoutMs ?? 9000, auth)) as { results?: UnsplashPhoto[] };
  return (data.results || [])
    .filter((p) => {
      const desc = `${p.alt_description || ""} ${(p as any).description || ""}`;
      return !hasPeople(desc);
    })
    .map((p) => ({
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
  const keysToTry: string[] = [];
  if (cfg.pixabayKey && cfg.pixabayKey.trim()) {
    keysToTry.push(cfg.pixabayKey.trim());
  }
  for (const k of getAllPixabayKeys()) {
    if (!keysToTry.includes(k)) {
      keysToTry.push(k);
    }
  }
  if (keysToTry.length === 0) return [];

  const cleanQ = q.replace(/["']/g, "").slice(0, 50).trim();
  const safeQuery = `${cleanQ} -person -people -face -man -woman`.slice(0, 95);
  const orientationsToTry = orientation === "portrait" ? ["all", "vertical"] : ["horizontal", "all"];

  for (const key of keysToTry) {
    for (const pOrientation of orientationsToTry) {
      try {
        const url =
          `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(safeQuery)}` +
          `&image_type=photo&orientation=${pOrientation}` +
          `&safesearch=true&per_page=12`;
        const data = (await fetchJson(url, cfg.timeoutMs ?? 9000)) as { hits?: PixabayHit[] };
        const hits = (data.hits || [])
          .filter((h) => !hasPeople(`${h.tags || ""} ${h.user || ""}`))
          .map((h) => ({
            id: `pixabay:${h.id}`,
            provider: "pixabay" as const,
            src: h.largeImageURL,
            alt: h.tags || q,
            credit: h.user ? `Image: ${h.user} / Pixabay` : "Pixabay",
          }));
        if (hits.length > 0) {
          return hits;
        }
      } catch (e) {
        rotatePixabayKey();
        break; // الانتقال للمفتاح التالي في الحوض
      }
    }
  }
  return [];
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
  for (const p of cfg.providers || ["pixabay", "pexels", "unsplash"]) {
    try {
      let r: Candidate[] = [];
      if (p === "pixabay") r = await searchPixabay(q, orientation, cfg);
      else if (p === "pexels") r = await searchPexels(q, orientation, cfg);
      else if (p === "unsplash") r = await searchUnsplash(q, orientation, cfg);
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
