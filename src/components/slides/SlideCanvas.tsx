import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { SLIDE_H, SLIDE_W, type LaidSlide, type Prim, type TPara } from "../../lib/slides";
import { SLIDE_ICONS } from "../../lib/slides/icons";
import { LINE_SPACING } from "../../lib/slides/metrics";

// المعاينة ترسم نفس العناصر الموضعة التي يكتبها مُصدِّر PPTX (البوصة = 96px، النقطة = 1.333px)
const IN = 96;
const PT = 96 / 72;
const W = SLIDE_W * IN;
const H = SLIDE_H * IN;

const rgba = (hex?: string, alpha = 1) => {
  if (!hex) return "transparent";
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const n = parseInt(clean, 16);
  if (isNaN(n)) return "transparent";
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const box = (x: number, y: number, w: number, h: number): CSSProperties => ({
  position: "absolute",
  left: x * IN,
  top: y * IN,
  width: w * IN,
  height: h * IN,
});

function Para({ p, isGhost }: { p: TPara; isGhost?: boolean }) {
  return (
    <p
      dir={p.rtl ? "rtl" : "ltr"}
      style={{
        margin: 0,
        marginBottom: (p.spaceAfter || 0) * PT,
        fontSize: p.size * PT,
        lineHeight: isGhost ? 0.9 : LINE_SPACING * 1.2,
        color: `#${p.color}`,
        textAlign: p.align,
        direction: p.rtl ? "rtl" : "ltr",
        fontWeight: p.bold ? 700 : 400,
        position: "relative",
        paddingInlineStart: p.bullet ? 18 * PT : 0,
        whiteSpace: isGhost ? "nowrap" : undefined,
      }}
    >
      {p.bullet && (
        <span
          style={{
            position: "absolute",
            insetInlineStart: 0,
            top: 0,
            fontSize: p.size * PT * 0.8,
            lineHeight: `${p.size * PT * LINE_SPACING * 1.2}px`,
            color: `#${p.color}`,
          }}
        >
          ●
        </span>
      )}
      {p.runs.map((r, i) => (
        <span
          key={i}
          style={{
            fontWeight: (r.bold ?? p.bold) ? 700 : 400,
            color: r.color ? `#${r.color}` : undefined,
          }}
        >
          {r.text}
        </span>
      ))}
    </p>
  );
}

function PrimView({ p }: { p: Prim }) {
  switch (p.t) {
    case "image":
      return (
        <img
          src={p.src}
          alt={p.alt || ""}
          crossOrigin="anonymous"
          loading="eager"
          decoding="async"
          onError={(e) => {
            console.warn("[SlideCanvas] Image load error:", p.src);
            (e.currentTarget as HTMLElement).style.opacity = "0";
          }}
          style={{
            ...box(p.x, p.y, p.w, p.h),
            objectFit: p.fit === "cover" ? "cover" : "contain",
          }}
        />
      );
    case "rect":
      return (
        <div
          style={{
            ...box(p.x, p.y, p.w, p.h),
            background: rgba(p.fill, p.alpha ?? 1),
            borderRadius: (p.radius || 0) * IN,
            border: p.line
              ? `${(p.lineW || 1) * PT}px solid ${rgba(p.line, 1)}`
              : undefined,
            boxSizing: "border-box",
          }}
        />
      );
    case "ellipse":
      return (
        <div
          style={{
            ...box(p.x, p.y, p.w, p.h),
            borderRadius: "50%",
            background: rgba(p.fill, p.alpha ?? 1),
            border: p.line
              ? `${(p.lineW || 1) * PT}px solid ${rgba(p.line, 1)}`
              : undefined,
            boxSizing: "border-box",
          }}
        />
      );
    case "tri": {
      // المثلث القائم في PowerPoint: الزاوية القائمة أسفل اليسار
      const pts = [
        [0, 0],
        [0, 1],
        [1, 1],
      ].map(([x, y]) => [p.flipH ? 1 - x : x, p.flipV ? 1 - y : y]);
      return (
        <svg style={box(p.x, p.y, p.w, p.h)} viewBox="0 0 1 1" preserveAspectRatio="none">
          <polygon
            points={pts.map((q) => q.join(",")).join(" ")}
            fill={rgba(p.fill, p.alpha ?? 1)}
          />
        </svg>
      );
    }
    case "line":
      return (
        <svg style={{ position: "absolute", inset: 0, width: W, height: H, overflow: "visible" }}>
          <line
            x1={p.x1 * IN}
            y1={p.y1 * IN}
            x2={p.x2 * IN}
            y2={p.y2 * IN}
            stroke={rgba(p.color, p.alpha ?? 1)}
            strokeWidth={p.width * PT}
            strokeLinecap="round"
          />
        </svg>
      );
    case "text": {
      const isGhost = p.role === "ghost";
      return (
        <div
          style={{
            ...box(p.x, p.y, p.w, p.h),
            fontFamily: `"${p.font}", Arial, sans-serif`,
            display: "flex",
            flexDirection: "column",
            justifyContent:
              p.valign === "middle" ? "center" : p.valign === "bottom" ? "flex-end" : "flex-start",
            overflowWrap: "anywhere",
            pointerEvents: isGhost ? "none" : undefined,
            userSelect: isGhost ? "none" : undefined,
          }}
        >
          {p.paras.map((q, i) => (
            <Para key={i} p={q} isGhost={isGhost} />
          ))}
        </div>
      );
    }
    case "icon": {
      const Icon = SLIDE_ICONS[p.name];
      if (!Icon) return null;
      return (
        <div style={box(p.x, p.y, p.w, p.h)}>
          <Icon width="100%" height="100%" color={`#${p.color}`} strokeWidth={1.75} />
        </div>
      );
    }
  }
}

/** يرسم الشريحة بمقاسها الحقيقي ثم يصغّرها لتملأ عرض الحاوية */
export const SlideCanvas = memo(function SlideCanvas({
  slide,
  className = "",
}: {
  slide: LaidSlide;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: `${SLIDE_W} / ${SLIDE_H}` }}
    >
      <div
        dir="ltr"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: `#${slide.bg}`,
          overflow: "hidden",
        }}
      >
        {slide.prims.map((p, i) => (
          <PrimView key={i} p={p} />
        ))}
      </div>
    </div>
  );
});
