"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import createGlobe from "cobe";
import type { Globe } from "cobe";
import { Plus } from "lucide-react";

type Vec3 = [number, number, number];
type GlState = "pending" | "ready" | "unavailable";
type Tone = 1 | 2 | 3 | 4 | 5;

export interface GlobeTestimonial {
  id: string;
  /** One or two sentences. Longer quotes are clamped to four lines. */
  quote: string;
  name: string;
  role?: string;
  company?: string;
  /** City shown on the card and in the pin's accessible name. */
  city: string;
  /** Short country code such as "DZ". Distinct values feed the country counter. */
  country?: string;
  /** Pin latitude in degrees (south is negative). */
  lat: number;
  /** Pin longitude in degrees (west is negative). */
  lng: number;
  /** Square portrait shown in the pin and on the card. */
  image?: string;
  /** Star rating from 1 to 5. */
  rating?: number;
  /** Ring color as a chart token number (--chart-1 … --chart-5). Cycles through all five by default. */
  tone?: Tone;
}

export interface TestimonialGlobeLabels {
  /** Accessible name of the previous-review button. */
  previous: string;
  /** Accessible name of the next-review button. */
  next: string;
  /** Start of each pin's accessible name, followed by "<name>, <city>". */
  pin: string;
}

export interface TestimonialGlobeProps extends React.ComponentProps<"section"> {
  items: GlobeTestimonial[];
  eyebrow?: string;
  heading?: string;
  caption?: string;
  /** Call to action rendered next to the counters, e.g. a link to all reviews. */
  action?: React.ReactNode;
  /** Spin while idle. Always off when the visitor prefers reduced motion. */
  autoRotate?: boolean;
  /** Idle spin speed in radians per second. */
  rotationSpeed?: number;
  /** Feature the reviews one by one, turning each pin to the front. Off by default and never runs with reduced motion. */
  autoplay?: boolean;
  /** Milliseconds between two featured reviews while autoplay runs. */
  interval?: number;
  /** Controlled featured review (index into items), or null for none. */
  active?: number | null;
  /** Called whenever the featured review changes: autoplay, hover, click, keys, or a drag or spin that brings another pin to the front. */
  onActiveChange?: (index: number | null) => void;
  /** Largest globe diameter in pixels. The globe shrinks to fit narrow containers. */
  size?: number;
  labels?: TestimonialGlobeLabels;
  /** دالة لفتح نافذة إضافة تقييم ورأي جديد */
  onAddReview?: () => void;
}

const GLOBE_RADIUS = 0.8; // cobe draws the sphere at 0.8 of the half-canvas
const THETA = 0.3; // tilt toward the viewer, in radians
const PIN_ALTITUDE = 0.05; // pins float just above the map
const DRAG_FRICTION = 0.92; // per 60 Hz frame
const RELEASE_GRACE_MS = 80;
const TEXTURE_RETRY_MS = [150, 600, 1500];
const TURN_MS = 1200; // a featured pin reaches the front in this time
const SWAP_MS = 220;
const HOLD_MS = 7000; // a clicked pin keeps the globe paused this long
const DRAG_SLOP = 6;
const SWIPE_MIN = 40;
const WIDE_MIN = 620;
const FRONT_MARGIN = 0.06;
const MAX_CONTENT = 1200;

const DEFAULT_LABELS: TestimonialGlobeLabels = {
  previous: "التقييم السابق",
  next: "التقييم التالي",
  pin: "عرض تقييم",
};

const RING = {
  1: "ring-amber-500",
  2: "ring-emerald-500",
  3: "ring-blue-500",
  4: "ring-rose-500",
  5: "ring-cyan-500",
} as const;

const PING = {
  1: "border-amber-500",
  2: "border-emerald-500",
  3: "border-blue-500",
  4: "border-rose-500",
  5: "border-cyan-500",
} as const;

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (t: number) => t * t * (3 - 2 * t);

function toneOf(item: GlobeTestimonial, index: number): Tone {
  return item.tone ?? (((index % 5) + 1) as Tone);
}

export function hasReviewComment(quote?: string | null): boolean {
  if (typeof quote !== "string") return false;
  return quote.replace(/[\u200B-\u200D\uFEFF]/g, "").trim().length > 0;
}

function toCartesian(lat: number, lng: number): Vec3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lng * Math.PI) / 180 - Math.PI;
  const c = Math.cos(la);
  return [-c * Math.cos(lo), Math.sin(la), c * Math.sin(lo)];
}

// Same rotation cobe applies on the GPU, so the HTML pins stay glued to the map.
function project([x, y, z]: Vec3, phi: number, theta: number, altitude: number) {
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const radius = GLOBE_RADIUS * (1 + altitude);
  const sx = (cp * x + sp * z) * radius;
  const sy = (sp * st * x + ct * y - cp * st * z) * radius;
  const depth = -sp * ct * x + st * y + cp * ct * z;
  return { x: (sx + 1) / 2, y: (1 - sy) / 2, depth, rim: Math.hypot(sx, sy) - GLOBE_RADIUS };
}

/** The rotation that turns a longitude to face the viewer. */
function facingPhi(lng: number) {
  return (3 * Math.PI) / 2 - (lng * Math.PI) / 180;
}

/** The copy of `angle` (mod 2π) closest to `from`, so every turn takes the short way round. */
function nearestTurn(from: number, angle: number) {
  const tau = Math.PI * 2;
  return angle + tau * Math.round((from - angle) / tau);
}

// Pins thin out toward the horizon and vanish once the sphere hides them.
function pinOpacity(depth: number, rim: number) {
  if (depth >= 0) return 0.45 + 0.55 * smooth(clamp01(depth / 0.3));
  const exposed = Math.max(clamp01(rim / 0.04), clamp01(1 + depth * 8));
  return 0.45 * exposed * clamp01(1 + depth * 3);
}

// …and shrink as they roll away, so the face of the globe reads as near and the rim as far.
function pinScale(depth: number) {
  return 0.62 + 0.38 * smooth(clamp01((depth + 0.2) / 0.7));
}

// Exponential ease-out over a fixed time: a quick start, then a long settle onto the target.
function easeOutExpo(t: number) {
  return t >= 1 ? 1 : (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10));
}

let colorCanvas: HTMLCanvasElement | null = null;

function resolveColor(scope: HTMLElement, candidates: string[]): Vec3 | null {
  const holder = document.createElement("span");
  holder.style.cssText = "display:none;color:transparent";
  const probe = document.createElement("span");
  holder.appendChild(probe);
  scope.appendChild(holder);
  const unresolved = getComputedStyle(holder).color;
  let computed: string | null = null;
  for (const candidate of candidates) {
    probe.style.color = "";
    probe.style.color = candidate;
    const value = probe.style.color ? getComputedStyle(probe).color : unresolved;
    if (value !== unresolved) {
      computed = value;
      break;
    }
  }
  holder.remove();
  if (!computed) return null;
  colorCanvas ??= document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = 1;
  const ctx = colorCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = computed;
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return a === 0 ? null : [r / 255, g / 255, b / 255];
}

const themeToken = (name: string) => [`var(--${name})`, `var(--color-${name})`];

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function luminance([r, g, b]: Vec3) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function useThemeTick() {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const observer = new MutationObserver(bump);
    for (const el of [document.documentElement, document.body]) {
      observer.observe(el, { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-mode"] });
    }
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", bump);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", bump);
    };
  }, []);
  return tick;
}

function useDevicePixelRatio() {
  const [dpr, setDpr] = React.useState(() =>
    typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2),
  );
  React.useEffect(() => {
    let query: MediaQueryList | null = null;
    const watch = () => {
      query?.removeEventListener("change", watch);
      setDpr(Math.min(window.devicePixelRatio || 1, 2));
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      query.addEventListener("change", watch);
    };
    watch();
    return () => query?.removeEventListener("change", watch);
  }, []);
  return dpr;
}

function seededStars(count: number) {
  let seed = 11;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const stars: { id: number; left: number; top: number; size: number; delay: number; duration: number }[] = [];
  while (stars.length < count) {
    const x = 0.02 + rand() * 0.96;
    const y = 0.02 + rand() * 0.96;
    if (Math.hypot(x - 0.5, y - 0.5) < 0.44) continue;
    stars.push({ id: stars.length, left: x * 100, top: y * 100, size: rand() < 0.75 ? 1 : 2, delay: rand() * 4, duration: 2.5 + rand() * 3 });
  }
  return stars;
}

const STARS = seededStars(36);

const STAR_POINTS = Array.from({ length: 10 }, (_, k) => {
  const r = k % 2 ? 4.1 : 9.4;
  const a = (k * Math.PI) / 5 - Math.PI / 2;
  return `${(10 + r * Math.cos(a)).toFixed(2)},${(10.6 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <polygon points={STAR_POINTS} fill="currentColor" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function QuoteMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M9.6 5.5C6.4 6.5 4.4 9.3 4.4 12.9v5.6h6.2v-6.2H7.7c.2-2 1.4-3.6 3.2-4.3L9.6 5.5Zm9.4 0c-3.2 1-5.2 3.8-5.2 7.4v5.6H20v-6.2h-2.9c.2-2 1.4-3.6 3.2-4.3L19 5.5Z" />
    </svg>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"} />
    </svg>
  );
}

function Portrait({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  const [shownSrc, setShownSrc] = React.useState(src);
  if (shownSrc !== src) {
    setShownSrc(src);
    setFailed(false);
  }
  if (failed || !src) {
    // عرض الحرف الأول من اسم الطالب في دائرة ملونة أنيقة
    const firstLetter = name?.trim() ? name.trim()[0] : "ط";
    return (
      <span className={cx("grid place-items-center bg-zinc-800 text-zinc-100 font-bold text-xs select-none", className)}>
        {firstLetter}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      draggable={false}
      decoding="async"
      className={cx("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}

interface QuoteCardProps {
  item: GlobeTestimonial;
  index: number;
  tone: Tone;
  roomy: boolean;
  mode: "current" | "leaving" | "sizer";
  ref?: React.ComponentProps<"figure">["ref"];
}

const QuoteCard = React.memo(function QuoteCard({ item, index, tone, roomy, mode, ref }: QuoteCardProps) {
  const rating = item.rating === undefined ? null : Math.max(0, Math.min(5, Math.round(item.rating)));
  const hidden = mode !== "current";
  const meta = [item.role, item.company].filter(Boolean).join(" • ");
  return (
    <figure
      ref={ref}
      data-quote-card={mode === "current" ? "" : undefined}
      data-quote-leaving={mode === "leaving" ? "" : undefined}
      data-index={mode === "current" ? index : undefined}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      className={cx(
        "relative col-start-1 row-start-1 m-0 flex min-w-0 flex-col overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 shadow-md backdrop-blur-md text-right",
        roomy ? "p-6" : "px-4 py-3.5",
        mode === "sizer" && "invisible",
        mode === "leaving" && "pointer-events-none",
      )}
    >
      <div className={cx("relative flex items-center justify-between gap-3", roomy ? "h-7" : "h-6")}>
        <div className="flex items-center gap-2">
          <QuoteMark className={cx("shrink-0 text-amber-500/30 dark:text-amber-400/30", roomy ? "size-7" : "size-6")} />
          {rating !== null && (
            <span role="img" aria-label={`تقييم ${rating} من 5 نجوم`} className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((k) => (
                <StarIcon key={k} className={cx("size-3.5", k < rating ? "text-amber-400 fill-amber-400" : "text-zinc-300 dark:text-zinc-700")} />
              ))}
            </span>
          )}
        </div>
        {/* شارة المدينة بالزاوية */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <span className="size-2 rounded-full bg-amber-400" />
          <span>{item.city}</span>
        </div>
      </div>
      <blockquote
        className={cx(
          "relative m-0 line-clamp-4 text-pretty text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans",
          roomy ? "mt-3 text-[16px] sm:text-[17px] leading-7" : "mt-2 text-[14px] leading-[22px]",
        )}
      >
        <p>«{item.quote.trim()}»</p>
      </blockquote>
      <figcaption className={cx("relative mt-auto flex items-center gap-3 border-t border-black/5 dark:border-white/5", roomy ? "pt-5" : "pt-3")}>
        <span
          className={cx(
            "relative block shrink-0 overflow-hidden rounded-full bg-zinc-800 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900",
            RING[tone],
            roomy ? "size-11" : "size-9",
          )}
        >
          {mode !== "sizer" && <Portrait src={item.image} name={item.name} className="size-full" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.name}</span>
          {meta && <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{meta}</span>}
        </span>
        <span className="shrink-0 text-left text-xs leading-tight text-zinc-500 dark:text-zinc-400">
          <span className="block font-semibold">{item.city}</span>
          {item.country && <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-amber-500 dark:text-amber-400 font-bold">{item.country}</span>}
        </span>
      </figcaption>
    </figure>
  );
});

interface PinProps {
  item: GlobeTestimonial;
  index: number;
  tone: Tone;
  size: number;
  label: string;
  featured: boolean;
  approaching: boolean;
  pressed: boolean;
  tabbable: boolean;
  register: (index: number, el: HTMLButtonElement | null) => void;
  onEnter: (index: number, event: React.PointerEvent) => void;
  onLeave: (index: number, event: React.PointerEvent) => void;
  onPress: (index: number) => void;
  onKey: (index: number, event: React.KeyboardEvent) => void;
  onFocusPin: (index: number, target: HTMLElement) => void;
}

const Pin = React.memo(function Pin({
  item,
  index,
  tone,
  size,
  label,
  featured,
  approaching,
  pressed,
  tabbable,
  register,
  onEnter,
  onLeave,
  onPress,
  onKey,
  onFocusPin,
}: PinProps) {
  return (
    <button
      ref={(el) => register(index, el)}
      type="button"
      data-pin={index}
      data-featured={featured ? "" : undefined}
      data-target={approaching ? "" : undefined}
      tabIndex={tabbable ? 0 : -1}
      aria-label={label}
      aria-current={featured ? "true" : undefined}
      aria-pressed={pressed}
      className="group/pin absolute left-0 top-0 rounded-full opacity-0 outline-none will-change-transform cursor-pointer"
      style={{ width: size, height: size }}
      onPointerEnter={(event) => onEnter(index, event)}
      onPointerLeave={(event) => onLeave(index, event)}
      onClick={() => onPress(index)}
      onKeyDown={(event) => onKey(index, event)}
      onFocus={(event) => onFocusPin(index, event.currentTarget)}
    >
      <span
        aria-hidden="true"
        data-ping
        className={cx(
          "pointer-events-none absolute inset-0 rounded-full border-2 animate-ping [animation-duration:3s] motion-reduce:hidden",
          PING[tone],
          featured || approaching ? "opacity-80" : "opacity-25",
        )}
        style={{ animationDelay: `${(index % 5) * 0.6}s` }}
      />
      <span
        data-pin-face
        className={cx(
          "relative block size-full overflow-hidden rounded-full bg-zinc-800 shadow-md ring-offset-2 ring-offset-zinc-950 transition-[scale,box-shadow] duration-200 ease-out motion-reduce:transition-none",
          "group-focus-visible/pin:outline-2 group-focus-visible/pin:outline-offset-[5px] group-focus-visible/pin:outline-white",
          RING[tone],
          featured ? "scale-[1.35] ring-[3px]" : "ring-2",
        )}
      >
        <Portrait src={item.image} name={item.name} className="block size-full" />
      </span>
    </button>
  );
});

interface Turn {
  from: number;
  to: number;
  start: number;
  index: number;
  commit: boolean;
}

export function TestimonialGlobe({
  items,
  eyebrow,
  heading,
  caption,
  action,
  autoRotate = true,
  rotationSpeed = 0.12,
  autoplay = true,
  interval = 4000,
  active,
  onActiveChange,
  size = 440,
  labels,
  onAddReview,
  ref,
  className,
  onFocus,
  onBlur,
  ...rest
}: TestimonialGlobeProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
  // احتساب جميع التقييمات المعتمدة في الإحصائيات، مع عرض التقييمات التي تحتوي على تعليق نصي فقط في الواجهة
  const totalCount = items.length;
  const visibleItems = React.useMemo(
    () => items.filter((item) => hasReviewComment(item.quote)),
    [items],
  );
  const visibleCount = visibleItems.length;
  const headingId = React.useId();
  const rootRef = React.useRef(null as HTMLElement | null);
  const stageRef = React.useRef(null as HTMLDivElement | null);
  const globeBoxRef = React.useRef(null as HTMLDivElement | null);
  const canvasHostRef = React.useRef(null as HTMLDivElement | null);
  const pinRefs = React.useRef([] as (HTMLButtonElement | null)[]);
  const regionRef = React.useRef(null as HTMLDivElement | null);
  const cardRef = React.useRef(null as HTMLElement | null);
  const leavingRef = React.useRef(null as HTMLElement | null);
  const leaderRef = React.useRef(null as SVGGElement | null);
  const lineRef = React.useRef(null as SVGLineElement | null);
  const startDotRef = React.useRef(null as SVGCircleElement | null);
  const endDotRef = React.useRef(null as SVGCircleElement | null);
  const globeRef = React.useRef(null as Globe | null);
  const kickRef = React.useRef(() => {});
  const swipeRef = React.useRef(null as { id: number; x: number; y: number } | null);
  const writtenRef = React.useRef([] as { el: HTMLElement; opacity: number; z: string; hit: string }[]);

  const [width, setWidth] = React.useState(0);
  const [glState, setGlState] = React.useState("pending" as GlState);
  const [glVersion, setGlVersion] = React.useState(0);
  const [reduced, setReduced] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  const [internal, setInternal] = React.useState<number | null>(visibleCount > 0 ? 0 : null);
  const [pinned, setPinned] = React.useState(false);
  const [hoverPin, setHoverPin] = React.useState(null as number | null);
  const [cardHover, setCardHover] = React.useState(false);
  const [keyboard, setKeyboard] = React.useState(false);
  const [interacting, setInteracting] = React.useState(false);
  const [target, setTarget] = React.useState(null as number | null);
  const [isDark, setIsDark] = React.useState(true);
  const themeTick = useThemeTick();
  const dpr = useDevicePixelRatio();

  // التأكد من تحديد أول تقييم بتعليق مباشرة عند توفر العناصر وتصحيح المؤشر إذا تقلصت القائمة
  React.useEffect(() => {
    if (visibleCount === 0) {
      if (internal !== null) setInternal(null);
    } else if (internal === null || internal >= visibleCount) {
      setInternal(0);
    }
  }, [visibleCount, internal]);

  const controlled = active !== undefined;
  const requested = controlled ? active : (internal ?? (visibleCount > 0 ? 0 : null));
  const featured =
    requested !== null && requested >= 0 && requested < visibleCount ? Math.floor(requested) : (visibleCount > 0 ? 0 : null);

  const pad = width >= 1024 ? 48 : width >= 620 ? 28 : width >= 420 ? 20 : 16;
  const inner = Math.max(0, Math.min(width, MAX_CONTENT) - pad * 2);
  const wide = inner >= WIDE_MIN;
  const diameter = Math.max(
    0,
    Math.round(width === 0 ? Math.min(size, 300) : wide ? Math.min(size, inner * 0.48) : Math.min(size, 300, inner * 0.72)),
  );
  const pinSize = diameter >= 380 ? 44 : diameter >= 300 ? 38 : 34;
  const columnGap = width >= 1024 ? 72 : 36;
  const roomy = wide && Math.min(inner - diameter - columnGap, 544) >= 420;
  const ready = glState !== "pending";
  const running =
    autoplay && !reduced && visibleCount > 1 && !pinned && hoverPin === null && !cardHover && !keyboard && !interacting && visible;

  const live = React.useRef({
    phi: 0,
    theta: THETA,
    velocity: 0,
    dragging: false,
    interacting: false,
    pressed: false,
    moved: false,
    pointerId: -1,
    pressX: 0,
    pressY: 0,
    lastX: 0,
    lastMoveAt: 0,
    moveGap: 0,
    turn: null as Turn | null,
    vectors: [] as Vec3[],
    longitudes: [] as number[],
    depths: [] as number[],
    size: diameter,
    pin: pinSize,
    wide,
    featured: null as number | null,
    requested: null as number | null,
    front: -1,
    spin: false,
    follow: false,
    speed: rotationSpeed,
    reduced: false,
    onScreen: true,
    started: false,
    globeX: 0,
    globeY: 0,
    anchorX: 0,
    anchorY: 0,
    anchored: false,
    leaderShown: false,
    growStart: 0,
    growing: false,
    controlled,
    pinnedNow: false,
    onChange: onActiveChange,
  });
  const handlers = React.useRef({
    arrive: (_index: number) => {},
    front: (_index: number) => {},
    settle: () => {},
  });

  const setRoot = React.useCallback(
    (el: HTMLElement | null) => {
      rootRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  const kick = () => kickRef.current();

  const select = React.useCallback((index: number | null) => {
    const s = live.current;
    if (index === s.featured) return;
    s.requested = index;
    if (!s.controlled) {
      s.featured = index;
      s.growStart = performance.now();
      setInternal(index);
    }
    s.onChange?.(index);
  }, []);

  const turnTo = React.useCallback((index: number, commit: boolean) => {
    const s = live.current;
    const lng = s.longitudes[index];
    if (lng === undefined) return;
    if (s.turn && s.turn.index === index && s.turn.commit === commit) return;
    const to = nearestTurn(s.phi, facingPhi(lng));
    s.velocity = 0;
    if (s.reduced) {
      s.phi = to;
      s.turn = null;
      if (commit) handlers.current.arrive(index);
    } else {
      s.turn = { from: s.phi, to, start: performance.now(), index, commit };
    }
    kickRef.current();
  }, []);

  const go = React.useCallback(
    (index: number) => {
      select(index);
      turnTo(index, false);
    },
    [select, turnTo],
  );

  React.useLayoutEffect(() => {
    const s = live.current;
    if (s.vectors.length !== visibleItems.length) {
      s.front = -1;
      s.depths.length = visibleItems.length;
      pinRefs.current.length = visibleItems.length;
      writtenRef.current.length = visibleItems.length;
    }
    s.vectors = visibleItems.map((item) => toCartesian(item.lat, item.lng));
    s.longitudes = visibleItems.map((item) => item.lng);
    if (!s.started && diameter > 0) {
      s.started = true;
      const first = featured === null ? undefined : visibleItems[featured];
      if (first) s.phi = facingPhi(first.lng);
      else s.phi = facingPhi(3.06); // البدء بتدوير الكرة الأرضية على الجزائر
    }
    if (s.featured !== featured) {
      const fromHost = controlled && featured !== s.requested;
      s.featured = featured;
      s.requested = featured;
      s.growStart = performance.now();
      if (fromHost && featured !== null && s.started) turnTo(featured, false);
    }
    s.size = diameter;
    s.pin = pinSize;
    s.wide = wide;
    s.speed = rotationSpeed;
    s.reduced = reduced;
    s.controlled = controlled;
    s.pinnedNow = pinned;
    s.onChange = onActiveChange;
    s.spin = autoRotate && !reduced && !pinned && !keyboard;
    s.follow = (!autoplay || interacting) && !pinned && hoverPin === null && !keyboard && !cardHover;
    handlers.current = {
      arrive: (index) => {
        setTarget(null);
        select(index);
      },
      front: (index) => select(index),
      settle: () => setInteracting(false),
    };
    kickRef.current();
  });

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => setWidth(root.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    measure();
    return () => observer.disconnect();
  }, []);

  const measureAnchor = React.useCallback(() => {
    const stage = stageRef.current;
    const box = globeBoxRef.current;
    const region = regionRef.current;
    const s = live.current;
    if (!stage || !box || !region) {
      s.anchored = false;
      return;
    }
    const sr = stage.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    const rr = region.getBoundingClientRect();
    s.globeX = br.left - sr.left;
    s.globeY = br.top - sr.top;
    s.anchorX = rr.right - sr.left; // ربط المؤشر بالجهة المناسبة للمحاذاة
    s.anchorY = rr.top - sr.top + Math.min(44, rr.height / 2);
    s.anchored = rr.width > 0;
    kickRef.current();
  }, []);

  React.useLayoutEffect(() => {
    measureAnchor();
    const stage = stageRef.current;
    const region = regionRef.current;
    if (!stage || !region) return;
    const observer = new ResizeObserver(measureAnchor);
    observer.observe(stage);
    observer.observe(region);
    return () => observer.disconnect();
  }, [measureAnchor, wide, diameter]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const s = live.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      s.reduced = motion.matches;
      setReduced(motion.matches);
      kickRef.current();
    };
    const sync = () => {
      setVisible(s.onScreen && !document.hidden);
      kickRef.current();
    };
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      s.onScreen = entry?.isIntersecting ?? true;
      sync();
    });
    onMotion();
    motion.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", sync);
    observer.observe(root);
    return () => {
      motion.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", sync);
      observer.disconnect();
    };
  }, []);

  const place = React.useCallback((now: number) => {
    const s = live.current;
    const written = writtenRef.current;
    const { vectors, size: d, phi, theta } = s;
    let front = -1;
    let frontDepth = -Infinity;
    let featuredPoint: { x: number; y: number; depth: number; scale: number } | null = null;
    for (let i = 0; i < vectors.length; i++) {
      const vector = vectors[i];
      if (!vector) continue;
      const point = project(vector, phi, theta, PIN_ALTITUDE);
      s.depths[i] = point.depth;
      if (point.depth > frontDepth) {
        frontDepth = point.depth;
        front = i;
      }
      const el = pinRefs.current[i];
      if (!el) continue;
      const isFeatured = i === s.featured;
      const opacity = Math.round(pinOpacity(point.depth, point.rim) * 100) / 100;
      const scale = pinScale(point.depth);
      const z = String((isFeatured ? 100 : 0) + Math.round((point.depth + 1) * 40));
      const hit = opacity > 0.4 ? "auto" : "none";
      const prev = written[i]?.el === el ? written[i] : undefined;
      if (!prev || prev.opacity !== opacity) el.style.opacity = String(opacity);
      if (!prev || prev.z !== z) el.style.zIndex = z;
      if (!prev || prev.hit !== hit) el.style.pointerEvents = hit;
      written[i] = { el, opacity, z, hit };
      if (opacity > 0) {
        el.style.transform = `translate3d(${(point.x * d).toFixed(2)}px, ${(point.y * d).toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      }
      if (isFeatured) featuredPoint = { x: point.x * d, y: point.y * d, depth: point.depth, scale };
    }

    if (front >= 0 && front !== s.front) {
      const current = s.depths[s.front] ?? -Infinity;
      if (s.front < 0) s.front = front;
      else if (frontDepth > current + FRONT_MARGIN) {
        s.front = front;
        if (s.follow && !s.turn) handlers.current.front(front);
      }
    }

    const group = leaderRef.current;
    const line = lineRef.current;
    const startDot = startDotRef.current;
    const endDot = endDotRef.current;
    s.growing = false;
    if (!group || !line || !startDot || !endDot) return;
    const show = s.wide && s.anchored && !s.turn && !!featuredPoint && featuredPoint.depth > 0.15;
    if (show !== s.leaderShown) {
      s.leaderShown = show;
      group.style.opacity = show ? "1" : "0";
      if (show) s.growStart = now;
    }
    if (!show || !featuredPoint) return;
    const x0 = s.globeX + featuredPoint.x;
    const y0 = s.globeY + featuredPoint.y;
    const dx = s.anchorX - x0;
    const dy = s.anchorY - y0;
    const distance = Math.hypot(dx, dy) || 1;
    const gap = (s.pin / 2) * 1.35 * featuredPoint.scale + 6;
    const length = Math.max(0, distance - gap);
    const grow = s.reduced ? 1 : smooth(clamp01((now - s.growStart) / 360));
    s.growing = grow < 1;
    const sx = x0 + (dx / distance) * gap;
    const sy = y0 + (dy / distance) * gap;
    line.style.transform = `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px) rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${Math.max(0.001, length * grow).toFixed(2)})`;
    startDot.style.transform = `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px)`;
    endDot.style.transform = `translate(${s.anchorX.toFixed(2)}px, ${s.anchorY.toFixed(2)}px) scale(${grow >= 1 ? 1 : 0})`;
  }, []);

  React.useLayoutEffect(() => {
    place(performance.now());
  }, [place, diameter, pinSize, featured, wide, visibleCount]);

  const hasSize = diameter > 0;

  React.useEffect(() => {
    const host = canvasHostRef.current;
    if (!host || !hasSize) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block";
    host.appendChild(canvas);

    const s = live.current;
    let globe: Globe | null = null;
    try {
      globe = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width: s.size,
        height: s.size,
        phi: s.phi,
        theta: s.theta,
        dark: 1,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor: [0.15, 0.15, 0.18],
        markerColor: [0.96, 0.62, 0.05],
        glowColor: [0.2, 0.2, 0.25],
        markers: [],
        markerElevation: 0,
      });
    } catch {
      globe = null;
    }
    const gl = globe ? ((canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null) : null;
    globeRef.current = globe;

    let raf = 0;
    let last = 0;
    let renderedSize = s.size;
    let phiLabel = "";
    const isBusy = () =>
      s.dragging ||
      s.interacting ||
      s.turn !== null ||
      s.growing ||
      Math.abs(s.velocity) > 1e-4 ||
      (s.spin && s.speed !== 0);

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      const turn = s.turn;
      if (turn) {
        const t = s.reduced ? 1 : clamp01((now - turn.start) / TURN_MS);
        s.phi = turn.from + (turn.to - turn.from) * easeOutExpo(t);
        s.velocity = 0;
        if (t >= 1) {
          s.turn = null;
          s.phi = turn.to;
          if (turn.commit) handlers.current.arrive(turn.index);
        }
      } else if (!s.dragging) {
        if (Math.abs(s.velocity) > 1e-4) {
          const steps = dt * 60;
          s.phi += s.velocity * steps;
          s.velocity *= Math.pow(DRAG_FRICTION, steps);
        } else {
          s.velocity = 0;
          if (s.spin) s.phi += s.speed * dt;
        }
      }
      if (s.interacting && !s.dragging && s.velocity === 0) {
        s.interacting = false;
        handlers.current.settle();
      }
      if (globe) {
        if (s.size !== renderedSize) {
          renderedSize = s.size;
          globe.update({ phi: s.phi, theta: s.theta, width: s.size, height: s.size });
        } else {
          globe.update({ phi: s.phi, theta: s.theta });
        }
      }
      place(now);
      const label = s.phi.toFixed(2);
      if (label !== phiLabel) {
        phiLabel = label;
        host.dataset.phi = label;
      }
      if (isBusy() && s.onScreen && !document.hidden) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    kickRef.current = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    kickRef.current();

    const retries = TEXTURE_RETRY_MS.map((ms) => window.setTimeout(() => kickRef.current(), ms));

    const onLost = (event: Event) => {
      event.preventDefault();
      setGlState("unavailable");
    };
    const onRestored = () => setGlVersion((v) => v + 1);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    setGlState(gl ? "ready" : "unavailable");

    return () => {
      cancelAnimationFrame(raf);
      retries.forEach((id) => window.clearTimeout(id));
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      kickRef.current = () => {};
      globe?.destroy();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      globeRef.current = null;
      host.replaceChildren();
      setGlState("pending");
    };
  }, [hasSize, dpr, glVersion]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const background = resolveColor(root, themeToken("background"));
    const onDark = background ? luminance(background) < 0.5 : document.documentElement.classList.contains("dark");
    setIsDark(onDark);
    const globe = globeRef.current;
    if (!globe) return;
    const base = background ?? (onDark ? [0.04, 0.04, 0.04] : [1, 1, 1]);
    const foreground = resolveColor(root, themeToken("foreground")) ?? (onDark ? [0.98, 0.98, 0.98] : [0.04, 0.04, 0.04]);
    globe.update({
      dark: onDark ? 1 : 0,
      diffuse: onDark ? 1.2 : 0.4,
      mapBrightness: onDark ? 6 : 1.2,
      baseColor: mix(base, foreground, onDark ? 0.3 : 0.05),
      glowColor: mix(base, foreground, onDark ? 0.45 : 0.14),
      markers: [],
    });
    kickRef.current();
  }, [ready, glVersion, themeTick]);

  React.useEffect(() => {
    if (!running || visibleCount <= 1) return;
    const id = window.setTimeout(() => {
      const next = ((live.current.featured ?? -1) + 1) % visibleCount;
      setTarget(next);
      turnTo(next, true);
    }, Math.max(0, interval - TURN_MS));
    return () => window.clearTimeout(id);
  }, [running, featured, interval, visibleCount, turnTo]);

  React.useEffect(() => {
    if (running) return;
    const s = live.current;
    if (s.turn?.commit) {
      s.turn = null;
      kickRef.current();
    }
    setTarget(null);
  }, [running]);

  React.useEffect(() => {
    if (!pinned) return;
    const id = window.setTimeout(() => setPinned(false), HOLD_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned, featured]);

  const [cards, setCards] = React.useState({
    shown: featured ?? (visibleCount > 0 ? 0 : null),
    leaving: null as number | null,
    key: 0,
  });
  if (featured === null && (cards.shown !== null || cards.leaving !== null)) {
    setCards({ shown: null, leaving: null, key: cards.key + 1 });
  } else if (cards.shown !== featured && featured !== null) {
    setCards({
      shown: featured,
      leaving: reduced || cards.shown === null || cards.shown >= visibleCount ? null : cards.shown,
      key: cards.key + 1,
    });
  } else if (cards.shown === null && visibleCount > 0) {
    setCards({ shown: 0, leaving: null, key: cards.key + 1 });
  }
  React.useLayoutEffect(() => {
    if (cards.key === 0 || live.current.reduced) return;
    const enter = cardRef.current;
    const exit = leavingRef.current;
    enter?.animate(
      [
        { opacity: 0, transform: "translateY(14px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: SWAP_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
    exit?.animate(
      [
        { opacity: 1, transform: "translateY(0) scale(1)" },
        { opacity: 0, transform: "translateY(12px) scale(0.98)" },
      ],
      { duration: SWAP_MS, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
    );
    const key = cards.key;
    const id = window.setTimeout(() => setCards((c) => (c.key === key ? { ...c, leaving: null } : c)), SWAP_MS);
    return () => window.clearTimeout(id);
  }, [cards.key]);

  const step = (delta: number) => {
    if (visibleCount === 0) return;
    go((((featured ?? (delta > 0 ? -1 : 0)) + delta) % visibleCount + visibleCount) % visibleCount);
  };

  const registerPin = React.useCallback((index: number, el: HTMLButtonElement | null) => {
    pinRefs.current[index] = el;
  }, []);

  const onPinEnter = React.useCallback(
    (index: number, event: React.PointerEvent) => {
      if (event.pointerType === "touch" || live.current.dragging) return;
      flushSync(() => {
        setHoverPin(index);
        select(index);
      });
    },
    [select],
  );

  const onPinLeave = React.useCallback((index: number, event: React.PointerEvent) => {
    if (event.pointerType === "touch") return;
    setHoverPin((current) => (current === index ? null : current));
  }, []);

  const onPinKey = React.useCallback(
    (index: number, event: React.KeyboardEvent) => {
      const total = live.current.vectors.length;
      if (event.altKey || event.ctrlKey || event.metaKey || total === 0) return;
      let next: number;
      if (event.key === "ArrowRight") next = (index + 1) % total;
      else if (event.key === "ArrowLeft") next = (index - 1 + total) % total;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = total - 1;
      else return;
      event.preventDefault();
      go(next);
      pinRefs.current[next]?.focus({ preventScroll: true });
    },
    [go],
  );

  const onPinPress = React.useCallback(
    (index: number) => {
      const s = live.current;
      if (s.moved) {
        s.moved = false;
        return;
      }
      if (s.pinnedNow && s.featured === index) {
        setPinned(false);
        return;
      }
      select(index);
      setPinned(true);
      turnTo(index, false);
    },
    [select, turnTo],
  );

  const onPinFocus = React.useCallback(
    (index: number, target: HTMLElement) => {
      if (!target.matches(":focus-visible")) return;
      select(index);
      if ((live.current.depths[index] ?? -1) < 0.55) turnTo(index, false);
    },
    [select, turnTo],
  );

  const beginDrag = (event: React.PointerEvent) => {
    const s = live.current;
    s.dragging = true;
    s.interacting = true;
    s.turn = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteracting(true);
    kick();
  };

  const endDrag = () => {
    const s = live.current;
    s.dragging = false;
    s.pressed = false;
    s.pointerId = -1;
    kick();
  };

  const tabStop = featured ?? 0;
  const avg = (() => {
    const rated = items.filter((item) => typeof item.rating === "number");
    if (rated.length === 0) return null;
    return (rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length).toFixed(1);
  })();
  const universities = new Set(items.map((item) => item.company ?? item.city)).size;
  const shownItem = cards.shown === null ? undefined : visibleItems[cards.shown];
  const leavingItem = cards.leaving === null ? undefined : visibleItems[cards.leaving];
  const headingSize = wide
    ? width >= 1024
      ? "text-3xl lg:text-4xl leading-tight font-serif"
      : "text-2xl lg:text-3xl leading-snug font-serif"
    : width >= 420
      ? "text-2xl leading-snug font-serif"
      : "text-xl leading-tight font-serif";

  return (
    <section
      {...rest}
      ref={setRoot}
      data-slot="testimonial-globe"
      data-layout={wide ? "wide" : "stacked"}
      data-active={featured ?? ""}
      data-paused={pinned ? "true" : "false"}
      data-autoplay={running ? "running" : "held"}
      data-gl={glState}
      aria-labelledby={rest["aria-labelledby"] ?? (heading ? headingId : undefined)}
      className={cx("relative isolate w-full overflow-hidden bg-transparent text-zinc-100", className)}
      onFocus={(event) => {
        onFocus?.(event);
        if ((event.target as HTMLElement).matches(":focus-visible")) setKeyboard(true);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.contains(next)) setKeyboard(false);
      }}
    >
      <div
        ref={stageRef}
        className={cx("relative mx-auto w-full", wide ? "grid items-center gap-y-6 py-10" : "flex flex-col items-center gap-6 py-6")}
        style={{
          maxWidth: MAX_CONTENT,
          paddingInline: pad,
          ...(wide
            ? { gridTemplateColumns: `${diameter}px minmax(0, 34rem)`, columnGap, justifyContent: "center" }
            : {}),
        }}
      >
        <header
          className={cx(
            "flex min-w-0 flex-col",
            wide ? "col-start-2 row-start-1 items-start self-end text-right" : "w-full items-center text-center",
          )}
        >
          {eyebrow && (
            <p className="m-0 text-xs font-bold tracking-wider text-amber-400 uppercase">{eyebrow}</p>
          )}
          {heading && (
            <h2 id={headingId} className={cx("m-0 mt-2 text-balance font-bold text-zinc-900 dark:text-zinc-100", headingSize)}>
              {heading}
            </h2>
          )}
          {caption && <p className="m-0 mt-2 max-w-prose text-pretty text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">{caption}</p>}
          <div className={cx("flex flex-wrap items-center gap-x-5 gap-y-2", wide ? "mt-4 justify-start" : "mt-3 justify-center")}>
            <dl className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              <div className="flex items-baseline gap-1.5">
                <dd className="order-1 m-0 font-bold tabular-nums text-zinc-900 dark:text-white text-base">{totalCount}</dd>
                <dt className="order-2">{totalCount === 1 ? "تقييم طالب" : "تقييماً معتمداً"}</dt>
              </div>
              {avg !== null && (
                <>
                  <span aria-hidden="true" className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
                  <div className="flex items-baseline gap-1.5">
                    <dd className="order-1 m-0 inline-flex items-center gap-1 font-bold tabular-nums text-amber-500 dark:text-amber-400 text-base">
                      <StarIcon className="size-3.5 fill-current" />
                      {avg}
                    </dd>
                    <dt className="order-2">معدل الرضا</dt>
                  </div>
                </>
              )}
              <span aria-hidden="true" className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex items-baseline gap-1.5">
                <dd className="order-1 m-0 font-bold tabular-nums text-zinc-900 dark:text-white text-base">{universities}</dd>
                <dt className="order-2">جامعة ومؤسسة</dt>
              </div>
            </dl>
            {onAddReview && (
              <button
                type="button"
                onClick={onAddReview}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 px-3.5 py-1.5 text-xs font-bold transition hover:scale-105 active:scale-95 cursor-pointer shadow-xs backdrop-blur-sm"
                title="أضف تقييمك ورأيك في منصة «بحثك»"
              >
                <Plus className="size-3.5 stroke-[2.5]" />
                <span>أضف تقييمك</span>
                <StarIcon className="size-3 fill-amber-400 text-amber-400" />
              </button>
            )}
            {action}
          </div>
        </header>

        <div
          ref={globeBoxRef}
          data-globe-box
          className={cx("relative shrink-0 touch-pan-y select-none", wide && "col-start-1 row-span-2 row-start-1 self-center")}
          style={{ width: diameter, height: diameter }}
          onPointerDown={(event) => {
            if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
            const s = live.current;
            s.pressed = true;
            s.moved = false;
            s.pointerId = event.pointerId;
            s.pressX = s.lastX = event.clientX;
            s.pressY = event.clientY;
            s.lastMoveAt = event.timeStamp;
            s.moveGap = 0;
            s.velocity = 0;
            if (!(event.target as Element).closest("[data-pin]")) beginDrag(event);
          }}
          onPointerMove={(event) => {
            const s = live.current;
            if (!s.pressed || event.pointerId !== s.pointerId) return;
            if (!s.dragging) {
              if (Math.hypot(event.clientX - s.pressX, event.clientY - s.pressY) < DRAG_SLOP) return;
              s.moved = true;
              beginDrag(event);
            }
            const now = event.timeStamp;
            const delta = ((event.clientX - s.lastX) / Math.max(s.size, 1)) * Math.PI;
            const elapsed = Math.max(now - s.lastMoveAt, 1);
            s.moveGap = elapsed;
            s.lastX = event.clientX;
            s.lastMoveAt = now;
            s.phi += delta;
            s.velocity = (delta / elapsed) * (1000 / 60);
            if (Math.abs(event.clientX - s.pressX) > DRAG_SLOP) s.moved = true;
          }}
          onPointerUp={(event) => {
            const s = live.current;
            if (event.pointerId !== s.pointerId) return;
            if (s.dragging) {
              const grace = Math.min(250, Math.max(RELEASE_GRACE_MS, s.moveGap * 1.5));
              if (s.reduced || event.timeStamp - s.lastMoveAt > grace) s.velocity = 0;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }
            endDrag();
          }}
          onPointerCancel={() => {
            live.current.velocity = 0;
            endDrag();
          }}
          onLostPointerCapture={(event) => {
            if (event.pointerId === live.current.pointerId) endDrag();
          }}
        >
          <div aria-hidden="true" className={cx("pointer-events-none absolute inset-0", !isDark && "opacity-25")}>
            {STARS.map((star) => (
              <span
                key={star.id}
                className="absolute rounded-full bg-white/60 animate-pulse motion-reduce:animate-none"
                style={{
                  left: `${star.left}%`,
                  top: `${star.top}%`,
                  width: star.size,
                  height: star.size,
                  animationDelay: `${star.delay}s`,
                  animationDuration: `${star.duration}s`,
                }}
              />
            ))}
          </div>

          {glState === "unavailable" && (
            <div
              aria-hidden="true"
              data-globe-fallback
              className="pointer-events-none absolute inset-[10%] overflow-hidden rounded-full border border-white/10"
              style={{
                background:
                  "radial-gradient(circle at 36% 30%, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 72%)",
              }}
            >
              <svg viewBox="0 0 100 100" className="size-full text-white/15" fill="none" stroke="currentColor" strokeWidth="0.6">
                <ellipse cx="50" cy="50" rx="50" ry="14" />
                <ellipse cx="50" cy="50" rx="50" ry="32" />
                <line x1="0" y1="50" x2="100" y2="50" />
                <ellipse cx="50" cy="50" rx="18" ry="50" />
                <ellipse cx="50" cy="50" rx="36" ry="50" />
                <line x1="50" y1="0" x2="50" y2="100" />
              </svg>
            </div>
          )}

          <div
            ref={canvasHostRef}
            data-globe
            aria-hidden="true"
            className={cx(
              "absolute inset-0 cursor-grab transition-opacity duration-150 active:cursor-grabbing motion-reduce:transition-none",
              ready ? "opacity-100" : "opacity-0",
            )}
          />

          <div className="pointer-events-none absolute inset-0">
            {visibleItems.map((item, i) => (
              <Pin
                key={item.id}
                item={item}
                index={i}
                tone={toneOf(item, i)}
                size={pinSize}
                label={`${text.pin} ${item.name}, ${item.city}`}
                featured={i === featured}
                approaching={target === i}
                pressed={i === featured && pinned}
                tabbable={i === tabStop}
                register={registerPin}
                onEnter={onPinEnter}
                onLeave={onPinLeave}
                onPress={onPinPress}
                onKey={onPinKey}
                onFocusPin={onPinFocus}
              />
            ))}
          </div>
        </div>

        <div
          className={cx("relative w-full min-w-0", wide ? "col-start-2 row-start-2 self-start" : "max-w-md")}
          onPointerEnter={(event) => {
            if (event.pointerType !== "touch") setCardHover(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") setCardHover(false);
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 -bottom-4 -z-10 h-10 rounded-[100%] bg-black opacity-[0.12] blur-2xl dark:opacity-70"
          />
          <div
            ref={regionRef}
            data-quote-region
            aria-live={running ? "off" : "polite"}
            aria-atomic="true"
            className="grid touch-pan-y"
            onPointerDown={(event) => {
              if (event.pointerType === "mouse") return;
              swipeRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              const swipe = swipeRef.current;
              if (!swipe || swipe.id !== event.pointerId) return;
              swipeRef.current = null;
              const dx = event.clientX - swipe.x;
              const dy = event.clientY - swipe.y;
              if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
            }}
            onPointerCancel={() => {
              swipeRef.current = null;
            }}
          >
            {visibleItems.map((item, i) => (
              <QuoteCard key={`sizer-${item.id}`} item={item} index={i} tone={toneOf(item, i)} roomy={roomy} mode="sizer" />
            ))}
            {visibleCount === 0 && (
              <div className="col-start-1 row-start-1 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 p-6 text-center text-sm text-zinc-600 dark:text-zinc-300 shadow-md backdrop-blur-md">
                <p className="m-0 font-semibold">
                  {totalCount > 0
                    ? `تم تسجيل ${totalCount} تقييم بالنجوم — لم تُكتب تعليقات نصية لعرضها بعد.`
                    : "لا توجد تعليقات نصية حالياً — كن أول من يشاركنا رأيه في منصة «بحثك»."}
                </p>
              </div>
            )}
            {leavingItem && cards.leaving !== null && (
              <QuoteCard
                key={`leaving-${cards.key}`}
                ref={leavingRef}
                item={leavingItem}
                index={cards.leaving}
                tone={toneOf(leavingItem, cards.leaving)}
                roomy={roomy}
                mode="leaving"
              />
            )}
            {shownItem && cards.shown !== null && (
              <QuoteCard
                key={`card-${cards.key}`}
                ref={cardRef}
                item={shownItem}
                index={cards.shown}
                tone={toneOf(shownItem, cards.shown)}
                roomy={roomy}
                mode="current"
              />
            )}
          </div>

          {/* شريط تنقل أنيق ومحدد بين التقييمات */}
          {visibleCount > 1 && (
            <div
              dir="rtl"
              className="mt-3.5 flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md px-3.5 py-2 shadow-xs select-none"
            >
              {/* التقييم الحالي وعدد التقييمات ذات التعليق */}
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  التقييم {(featured ?? 0) + 1} من {visibleCount}
                </span>
              </div>

              {/* مؤشرات التقييمات التفاعلية (dots / pills) */}
              <div className="flex items-center gap-1.5 px-2">
                {visibleItems.map((item, idx) => {
                  const isActive = (featured ?? 0) === idx;
                  return (
                    <button
                      key={`nav-dot-${item.id || idx}`}
                      type="button"
                      onClick={() => go(idx)}
                      aria-label={`الانتقال إلى التقييم ${idx + 1}`}
                      title={`التقييم ${idx + 1}`}
                      className={cx(
                        "h-2 rounded-full transition-all duration-300 cursor-pointer",
                        isActive
                          ? "w-7 bg-amber-400 shadow-xs"
                          : "w-2 bg-black/20 dark:bg-white/20 hover:bg-black/40 dark:hover:bg-white/40"
                      )}
                    />
                  );
                })}
              </div>

              {/* أزرار السابق والتالي وزر إضافة تقييم */}
              <div className="flex items-center gap-2">
                {onAddReview && (
                  <button
                    type="button"
                    onClick={onAddReview}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 px-2.5 py-1 text-xs font-bold transition hover:scale-105 active:scale-95 cursor-pointer"
                    title="أضف تقييمك ورأيك في المنصة"
                  >
                    <Plus className="size-3.5 stroke-[2.5]" />
                    <span>أضف تقييم</span>
                  </button>
                )}

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="التقييم السابق"
                    title="السابق"
                    className="grid size-7 place-items-center rounded-lg bg-black/5 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/20 hover:text-zinc-950 dark:hover:text-white transition cursor-pointer"
                  >
                    <Chevron direction="right" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="التقييم التالي"
                    title="التالي"
                    className="grid size-7 place-items-center rounded-lg bg-black/5 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/20 hover:text-zinc-950 dark:hover:text-white transition cursor-pointer"
                  >
                    <Chevron direction="left" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {wide && (
          <svg aria-hidden="true" data-leader className="pointer-events-none absolute left-0 top-0 z-[95] size-px overflow-visible text-amber-500/60 dark:text-amber-400/60">
            <g ref={leaderRef} className="opacity-0 transition-opacity duration-200 motion-reduce:transition-none">
              <line
                ref={lineRef}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
                stroke="currentColor"
                strokeOpacity="0.4"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
              <circle ref={startDotRef} r="2.5" className="fill-amber-400" />
              <circle ref={endDotRef} r="3.5" className="fill-zinc-950 stroke-amber-400" strokeWidth="1.2" />
            </g>
          </svg>
        )}
      </div>
    </section>
  );
}

// التقييمات المعتمدة لطلبة وباحثي الجامعات الجزائرية (موزعة جغرافياً حول الكرة الأرضية)
export const DEFAULT_ALGERIAN_REVIEWS: GlobeTestimonial[] = [
  {
    id: "dz-algiers",
    quote: "نسقت بحث مقياس القانون مع الغلاف الأكاديمي وشعار الجامعة وشجرة الخطة في دقائق معدودة، وفر عليا ساعات طويلة من التنسيق اليدوي المرهق.",
    name: "أنيس بوقرة",
    role: "طالب سنة ثانية ماستر",
    company: "جامعة الجزائر 1 - بن يوسف بن خدة",
    city: "الجزائر العاصمة",
    country: "DZ",
    lat: 36.75,
    lng: 3.06,
    rating: 5,
    tone: 1,
  },
  {
    id: "dz-oran",
    quote: "شجرة خطة البحث وترقيم الهوامش التلقائي في أسفل صفحات A4 وفق المعايير الأكاديمية الرسمية جعلت أستاذ المقياس يقبل بحثي مباشرة بدون أي تعديلات.",
    name: "سارة بن سالم",
    role: "باحثة ماستر علوم اقتصادية",
    company: "جامعة وهران 1 - أحمد بن بلة",
    city: "وهران",
    country: "DZ",
    lat: 41.88,
    lng: -87.63,
    rating: 5,
    tone: 2,
  },
  {
    id: "dz-constantine",
    quote: "توليد البحث بالذكاء الاصطناعي مع التنسيق المباشر وضبط المراجع والهوامش، والطباعة الفورية لـ PDF وتصدير Word، أنقذني تماماً قبل موعد تسليم البحث.",
    name: "كمال عبد اللاوي",
    role: "طالب دراسات عليا",
    company: "جامعة قسنطينة 2 - عبد الحميد مهري",
    city: "قسنطينة",
    country: "DZ",
    lat: 39.90,
    lng: 116.41,
    rating: 5,
    tone: 3,
  },
];

/** دالة مساعدة لجلب كل التقييمات: المعتمدة + ما يضيفه المستخدمون محلياً */
export function getStoredAndDefaultReviews(): GlobeTestimonial[] {
  try {
    const raw = localStorage.getItem("bahtak_all_reviews");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // تحويل تقييمات المستخدمين إلى صيغة GlobeTestimonial مع الإبقاء على التعليق كما هو حتى يُحتسب الفارغ منها في الإحصاءات دون الظهور في الواجهة
        const userReviews: GlobeTestimonial[] = parsed.map((item, idx) => ({
          id: item.id || `user-rev-${idx}`,
          quote: typeof item.comment === "string" ? item.comment.trim() : "",
          name: item.name || "طالب باحث",
          role: "تقييم طالب",
          company: item.university || "جامعة جزائرية",
          city: "الجزائر",
          country: "DZ",
          lat: 36.75 + (idx % 3) * 0.2 - 0.1,
          lng: 3.06 + (idx % 3) * 0.3 - 0.1,
          rating: item.rating || 5,
          tone: (((idx % 5) + 1) as Tone),
        }));

        return [...userReviews, ...DEFAULT_ALGERIAN_REVIEWS];
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ALGERIAN_REVIEWS;
}

export default TestimonialGlobe;
