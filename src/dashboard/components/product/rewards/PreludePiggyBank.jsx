import { useEffect, useRef, useState } from "react";

const mediaBase = import.meta.env.BASE_URL;
export const PIGGY_IMAGE = `${mediaBase}media/admissions-savings-piggy.png`;

const FLOAT_OFFSETS = [
  { top: "4%", left: "2%", delay: "0s", scale: 1 },
  { top: "12%", right: "0%", delay: "0.35s", scale: 0.85 },
  { bottom: "28%", left: "-4%", delay: "0.7s", scale: 1.1 },
  { bottom: "8%", right: "4%", delay: "1s", scale: 0.9 },
  { top: "38%", right: "-6%", delay: "0.55s", scale: 1.05 },
  { top: "52%", left: "8%", delay: "0.85s", scale: 0.75 }
];

const SPARKLE_OFFSETS = [
  { top: "15%", left: "18%", delay: "0.2s" },
  { top: "8%", right: "20%", delay: "0.9s" },
  { bottom: "35%", right: "12%", delay: "1.4s" },
  { bottom: "18%", left: "22%", delay: "0.6s" }
];

export function FloatingCoins({ className = "" }) {
  return (
    <div className={`dash-floating-coins ${className}`.trim()} aria-hidden="true">
      {FLOAT_OFFSETS.map((pos, i) => (
        <span
          key={i}
          className="dash-floating-coins__coin"
          style={{
            top: pos.top,
            left: pos.left,
            right: pos.right,
            bottom: pos.bottom,
            animationDelay: pos.delay,
            transform: `scale(${pos.scale})`
          }}
        />
      ))}
    </div>
  );
}

export function Sparkles({ className = "" }) {
  return (
    <div className={`dash-piggy-sparkles ${className}`.trim()} aria-hidden="true">
      {SPARKLE_OFFSETS.map((pos, i) => (
        <span key={i} className="dash-piggy-sparkles__dot" style={{ ...pos, animationDelay: pos.delay }} />
      ))}
    </div>
  );
}

export default function PreludePiggyBank({
  size = "lg",
  className = "",
  animate = false,
  withCoins = false,
  withSparkles = false
}) {
  return (
    <div
      className={`dash-piggy${size === "sm" ? " dash-piggy--sm" : ""}${size === "md" ? " dash-piggy--md" : ""}${size === "hero" ? " dash-piggy--hero" : ""}${size === "xl" ? " dash-piggy--xl" : ""}${size === "xxl" ? " dash-piggy--xxl" : ""}${animate ? " dash-piggy--float" : ""} ${className}`.trim()}
      aria-hidden="true"
    >
      {withSparkles ? <Sparkles /> : null}
      {withCoins ? <FloatingCoins /> : null}
      <img src={PIGGY_IMAGE} alt="" className="dash-piggy__img" />
      <span className="dash-piggy__glow" />
      <span className="dash-piggy__shadow" />
    </div>
  );
}

export function CoinBalance({ value, className = "" }) {
  const [display, setDisplay] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const from = previousValue.current;
    previousValue.current = value;
    if (from === value) {
      setDisplay(value);
      return undefined;
    }

    const duration = 1100;
    const start = performance.now();
    const to = value;

    let frame;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className={`dash-coin-balance ${className}`.trim()} aria-label={`${value} available coins`}>
      {display.toLocaleString()}
    </span>
  );
}

export function CoinIcon({ className = "", size = "md" }) {
  return (
    <span className={`dash-coin-icon${size === "sm" ? " dash-coin-icon--sm" : ""}${size === "lg" ? " dash-coin-icon--lg" : ""} ${className}`.trim()} aria-hidden="true">
      <span className="dash-coin-icon__mark">P</span>
    </span>
  );
}
