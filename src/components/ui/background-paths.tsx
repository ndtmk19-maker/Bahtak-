"use client";

/**
 * @author: @dorianbaffier
 * @description: Background Paths
 * @version: 2.0.0
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { AndroidIcon, InstagramIcon } from "./BrandIcons";
import { LINKS } from "@/data/defaults";

export interface BackgroundPathsProps {
  className?: string;
  children?: ReactNode;
  count?: number;
  spread?: number;
  angle?: number;
  speed?: number;
  interactive?: boolean;
  title?: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  onStart?: () => void;
  onContinueSaved?: () => void;
  hasSaved?: boolean;
  extraContent?: ReactNode;
  onLogoClick?: () => void;
}

const SAMPLES = 64;
const OVERSCAN = 0.06;
const DRAW_MS = 1400;
const DRAW_STAGGER_MS = 40;
const PART_RADIUS = 150;
const PART_PUSH = 56;

interface Layer {
  width: number;
  opacity: number;
  phase: number;
  pace: number;
  part: number;
}

const LAYERS: Layer[] = [
  { width: 1, opacity: 0.16, phase: 0.6, pace: 0.7, part: 0.45 },
  { width: 1.25, opacity: 0.26, phase: 0.3, pace: 0.85, part: 0.75 },
  { width: 1.5, opacity: 0.4, phase: 0, pace: 1, part: 1 },
];

interface Pointer {
  x: number;
  y: number;
  amount: number;
  on: boolean;
}

interface Frame {
  width: number;
  height: number;
  time: number;
  drawn: number[];
  pointer: Pointer;
}

interface Shape {
  count: number;
  spread: number;
  slope: number;
  interactive: boolean;
}

function lineY(
  s: number,
  u: number,
  layer: Layer,
  frame: Frame,
  shape: Shape,
  band: number
) {
  const t = frame.time * layer.pace;
  const x = u * frame.width;
  const center =
    frame.height * 0.5 +
    shape.slope * (x - frame.width / 2) +
    band *
      0.1 *
      Math.sin(Math.PI * 2 * (0.75 * u + 0.1) + layer.phase + t * 0.35);
  const turn = 0.22 + 0.09 * Math.sin(t * 0.21 + layer.phase);
  const breathe = 0.3 * Math.sin(t * 0.5 + s * 4 + layer.phase);
  const twist = Math.cos(
    Math.PI * (u - turn) + s * (0.6 + breathe) + layer.phase
  );
  return center + s * shape.spread * band * twist;
}

function part(x: number, y: number, frame: Frame, strength: number) {
  const { pointer } = frame;
  if (pointer.amount < 0.001) {
    return y;
  }
  const dx = x - pointer.x;
  const dy = y - pointer.y;
  const falloff = Math.exp(-(dx * dx + dy * dy) / (PART_RADIUS * PART_RADIUS));
  const side = dy / (Math.abs(dy) + 24);
  return y + side * falloff * PART_PUSH * strength * pointer.amount;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  shape: Shape,
  color: string
) {
  const { width, height } = frame;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const band = Math.min(height, width * 1.1);
  const perLayer = Math.max(1, Math.round(shape.count / LAYERS.length));
  const xs = new Float32Array(SAMPLES + 1);
  const ys = new Float32Array(SAMPLES + 1);

  LAYERS.forEach((layer, layerIndex) => {
    ctx.lineWidth = layer.width;
    for (let i = 0; i < perLayer; i++) {
      const drawn = frame.drawn[layerIndex * perLayer + i] ?? 1;
      if (drawn <= 0) {
        continue;
      }
      const s = perLayer === 1 ? 0 : i / (perLayer - 1) - 0.5;
      const last = Math.max(1, Math.ceil(SAMPLES * drawn));
      for (let k = 0; k <= last; k++) {
        const u = -OVERSCAN + (k / SAMPLES) * (1 + OVERSCAN * 2);
        const x = u * width;
        const y = lineY(s, u, layer, frame, shape, band);
        xs[k] = x;
        ys[k] = shape.interactive ? part(x, y, frame, layer.part) : y;
      }
      ctx.globalAlpha = layer.opacity * (0.45 + 0.55 * (1 - Math.abs(s) * 2));
      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      for (let k = 1; k < last; k++) {
        const mx = (xs[k] + xs[k + 1]) / 2;
        const my = (ys[k] + ys[k + 1]) / 2;
        ctx.quadraticCurveTo(xs[k], ys[k], mx, my);
      }
      ctx.lineTo(xs[last], ys[last]);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
}

const EASE_OUT = (t: number) => 1 - (1 - t) ** 3;

export function BackgroundPaths({
  className,
  children,
  count = 42,
  spread = 1,
  angle = -8,
  speed = 1,
  interactive = true,
  title = "ارتقِ ببحوثك إلى مستوى آخر",
  subtitle = "Bahtak — بحثك",
  description = "منصة مخصصة للطلبة والباحثين لتنسيق وتوليد البحوث الأكاديمية الجزائرية وفق المعايير الرسمية (A4) — مع الغلاف وشعار جامعتك من بين 69 ولاية، شجرة الخطة، ترقيم الهوامش، والطباعة المباشرة لـ PDF وتصدير Word.",
  buttonText = "ابدأ الآن بإنشاء بحثك",
  onStart,
  onContinueSaved,
  hasSaved,
  extraContent,
  onLogoClick,
}: BackgroundPathsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(root && canvas && ctx)) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const shape: Shape = {
      count,
      spread,
      slope: Math.tan((angle * Math.PI) / 180),
      interactive: interactive && !reduceMotion,
    };
    const perLayer = Math.max(1, Math.round(count / LAYERS.length));
    const total = perLayer * LAYERS.length;
    const frame: Frame = {
      width: 0,
      height: 0,
      time: 40,
      drawn: new Array(total).fill(reduceMotion ? 1 : 0),
      pointer: { x: 0, y: 0, amount: 0, on: false },
    };
    let color = getComputedStyle(canvas).color;
    let start = 0;
    let last = 0;
    let raf = 0;
    let visible = true;

    const paint = () => drawLines(ctx, frame, shape, color);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      frame.width = rect.width;
      frame.height = rect.height;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };

    const loop = (now: number) => {
      raf = 0;
      if (!start) {
        start = now;
        last = now;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      frame.time += dt * speed;
      const elapsed = now - start;
      for (let i = 0; i < frame.drawn.length; i++) {
        if (frame.drawn[i] < 1) {
          const local = (elapsed - (i % perLayer) * DRAW_STAGGER_MS) / DRAW_MS;
          frame.drawn[i] = EASE_OUT(Math.min(Math.max(local, 0), 1));
        }
      }
      const { pointer } = frame;
      pointer.amount += ((pointer.on ? 1 : 0) - pointer.amount) * 0.08;
      paint();
      const settling =
        frame.drawn.some((d) => d < 1) ||
        (pointer.amount > 0.001 && !pointer.on) ||
        pointer.on;
      if (visible && (speed > 0 || settling)) {
        raf = requestAnimationFrame(loop);
      }
    };
    const play = () => {
      if (!raf && visible && !reduceMotion) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    canvas.style.opacity = "1";
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    let onScreen = true;
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      visible = onScreen && !document.hidden;
      if (visible) {
        play();
      }
    });
    intersection.observe(root);
    const onVisibility = () => {
      visible = onScreen && !document.hidden;
      if (visible) {
        play();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const colorTimer = window.setInterval(() => {
      if (!visible) {
        return;
      }
      const next = getComputedStyle(canvas).color;
      if (next !== color) {
        color = next;
        paint();
      }
    }, 500);

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !shape.interactive) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      frame.pointer.x = event.clientX - rect.left;
      frame.pointer.y = event.clientY - rect.top;
      frame.pointer.on = true;
      play();
    };
    const onLeave = () => {
      frame.pointer.on = false;
      play();
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    play();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(colorTimer);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [count, spread, angle, speed, interactive]);

  const words = title.split(" ");

  return (
    <div
      className={cn(
        "relative flex min-h-screen w-full flex-col items-center justify-between overflow-x-hidden overflow-y-auto bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 scroll-thin",
        className
      )}
      ref={rootRef}
    >
      {/* خلفية المسارات المتدفقة فائقة النعومة على Canvas مع قناع التلاشي */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, #000 15%, #000 85%, transparent), radial-gradient(ellipse 40% 32% at 50% 50%, rgb(0 0 0 / 0.3), #000)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      >
        <canvas
          className="h-full w-full opacity-0 transition-opacity duration-500 ease-out"
          ref={canvasRef}
        />
      </div>

      {children !== undefined ? (
        children
      ) : (
        <>
          {/* الشريط العلوي المصغر مع الشعار */}
          <div className="relative z-10 w-full flex items-center justify-between px-6 py-5 sm:px-10">
            <div className="flex items-center gap-3">
              <img
                src="/app_icon.png"
                alt="Bahtak Logo"
                width={42}
                height={42}
                onClick={onLogoClick}
                className="size-[42px] rounded-xl object-contain shadow-xs border border-black/10 dark:border-white/10 cursor-pointer select-none"
              />
              <div className="text-right">
                <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100 block leading-tight font-serif">
                  {subtitle}
                </span>
                <span className="text-[0.72rem] text-zinc-600 dark:text-zinc-400 font-sans">
                  منصة البحوث الأكاديمية الجزائرية 🇩🇿
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="#reviews-section"
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-3.5 py-1 text-[0.76rem] font-bold text-zinc-700 dark:text-zinc-300 backdrop-blur-md transition cursor-pointer"
              >
                <span className="text-amber-500 dark:text-amber-400">★ 4.9</span>
                <span>تقييمات الطلبة</span>
              </a>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5 px-3.5 py-1 text-[0.76rem] font-semibold text-zinc-600 dark:text-zinc-400 backdrop-blur-md max-sm:hidden">
                <span className="size-1.5 rounded-full bg-neutral-900 dark:bg-white animate-pulse" />
                تنسيق معتمد A4 لعام 2026
              </span>
            </div>
          </div>

          {/* المحتوى المركزي الترحيبي */}
          <div className="relative z-10 container mx-auto px-4 md:px-6 text-center my-auto py-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.5 }}
              className="max-w-4xl mx-auto flex flex-col items-center"
            >
              {/* شارة التعريف العلوية متناسقة مع ألوان الخلفية والزجاج */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-4 py-1.5 text-[0.82rem] font-semibold text-neutral-800 dark:text-neutral-200 shadow-xs backdrop-blur-md"
              >
                <span className="text-neutral-500 dark:text-neutral-400">✦</span>
                <span>منصة إعداد وتنسيق وتوليد البحوث الجامعية</span>
              </motion.div>

              {/* العنوان بحركة الكلمات السلسة دون تقطيع الأحرف العربية */}
              <h1 className="font-serif text-5xl sm:text-7xl md:text-8xl font-bold mb-6 tracking-tight leading-[1.2]">
                {words.map((word, wordIndex) => (
                  <motion.span
                    key={wordIndex}
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: wordIndex * 0.12,
                      type: "spring",
                      stiffness: 150,
                      damping: 25,
                    }}
                    className="inline-block mx-2 sm:mx-3 text-transparent bg-clip-text 
                    bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-700/80 
                    dark:from-white dark:to-white/80"
                  >
                    {word}
                  </motion.span>
                ))}
              </h1>

              {/* تعريف بالموقع */}
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.7 }}
                className="max-w-2xl text-[1.02rem] sm:text-[1.22rem] font-medium sm:font-semibold leading-relaxed sm:leading-[1.85] text-neutral-800 dark:text-neutral-200 mb-9 text-center font-sans tracking-wide"
              >
                {description}
              </motion.p>

              {/* زر ابدأ الآن الأصلي من المرجع */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.65, duration: 0.5 }}
                className="flex flex-col items-center gap-3.5"
              >
                <div
                  className="inline-block group relative bg-gradient-to-b from-black/10 to-white/10 
                  dark:from-white/10 dark:to-black/10 p-px rounded-2xl backdrop-blur-lg 
                  overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300"
                >
                  <Button
                    variant="ghost"
                    onClick={onStart}
                    className="rounded-[1.15rem] px-8 sm:px-10 py-5 sm:py-6 text-lg sm:text-xl font-bold backdrop-blur-md 
                    bg-white/95 hover:bg-white/100 dark:bg-black/95 dark:hover:bg-black/100 
                    text-black dark:text-white transition-all duration-300 
                    group-hover:-translate-y-0.5 border border-black/10 dark:border-white/10
                    hover:shadow-md dark:hover:shadow-neutral-800/50 cursor-pointer flex items-center justify-center gap-3"
                  >
                    <span className="opacity-90 group-hover:opacity-100 transition-opacity font-serif">
                      {buttonText}
                    </span>
                    <span
                      className="mr-2 opacity-70 group-hover:opacity-100 group-hover:-translate-x-1.5 
                      transition-all duration-300 font-bold"
                    >
                      ←
                    </span>
                  </Button>
                </div>

                {hasSaved && (
                  <button
                    type="button"
                    onClick={onContinueSaved}
                    className="mt-1 inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 px-4 py-1.5 text-[0.82rem] font-semibold text-zinc-800 dark:text-neutral-200 shadow-sm backdrop-blur transition hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                  >
                    <span className="size-2 rounded-full bg-neutral-800 dark:bg-neutral-200" />
                    <span>لديك بحث محفوظ: متابعة التحرير ➔</span>
                  </button>
                )}
              </motion.div>
            </motion.div>
          </div>

          {/* قسم التقييمات وقائمة الـ reviews مدمج بسلاسة مع الخلفية دون فواصل */}
          {extraContent && (
            <div className="relative z-10 w-full">
              {extraContent}
            </div>
          )}

          {/* التذييل مع حقوق المطور وتحميل نسخة الأندرويد بتصميم متناسق مع الخلفية */}
          <footer className="relative z-10 w-full border-t border-black/5 dark:border-white/5 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md px-6 py-4 sm:px-10">
            <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[0.8rem]">
              {/* حقوق المطور والانستغرام */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                  Bahtak — بحثك © 2026
                </span>
                <span>•</span>
                <span>هذا التطبيق من عمل:</span>
                <a
                  href={LINKS.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="group/insta inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] px-3 py-1 font-semibold text-neutral-800 dark:text-neutral-200 shadow-xs transition hover:scale-105"
                >
                  <InstagramIcon className="size-3.5 text-neutral-600 dark:text-neutral-400 group-hover/insta:text-neutral-900 dark:group-hover/insta:text-white transition-colors" />
                  <span>@{LINKS.instagramHandle}</span>
                </a>
              </div>

              {/* زر تحميل نسخة الأندرويد متناسق مع ألوان وزجاجية الخلفية */}
              <div className="flex items-center gap-3">
                <a
                  href={LINKS.apk}
                  download="Bahtak.apk"
                  className="group/apk inline-flex items-center gap-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 hover:bg-white dark:hover:bg-neutral-800 px-4 py-2 font-bold text-neutral-900 dark:text-neutral-100 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span className="grid size-6 place-items-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs transition group-hover/apk:scale-105">
                    <AndroidIcon className="size-3.5" />
                  </span>
                  <span className="text-[0.82rem]">تحميل نسخة الأندرويد (APK)</span>
                  <Download className="size-3.5 text-neutral-500 dark:text-neutral-400 opacity-70 group-hover/apk:opacity-100 group-hover/apk:translate-y-0.5 transition-all" />
                </a>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

export default BackgroundPaths;
