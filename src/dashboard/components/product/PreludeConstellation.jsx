import { useId } from "react";
import { usePreludeMotion } from "../../../context/MotionContext.jsx";
import { cn } from "../../../lib/utils.js";

const VARIANT_COPY = {
  progress: { eyebrow: "YOUR PRELUDE", title: "Build the constellation", action: "trace" },
  rewards: { eyebrow: "REWARD ORBIT", title: "Turn progress into support", action: "collect" },
  colleges: { eyebrow: "COLLEGE ATLAS", title: "Save your next horizon", action: "stamp" },
  calendar: { eyebrow: "DEADLINE SKY", title: "See what comes next", action: "trace" },
  mentor: { eyebrow: "MATCH SIGNAL", title: "Find the right guide", action: "connect" },
  messages: { eyebrow: "OPEN CHANNEL", title: "Keep the signal moving", action: "signal" }
};

const POINTS = [
  [36, 118],
  [92, 62],
  [154, 92],
  [220, 42],
  [286, 88],
  [350, 48]
];

export default function PreludeConstellation({
  variant = "progress",
  value = 0,
  total = 5,
  active = false,
  compact = false,
  className,
  label
}) {
  const { reducedMotion } = usePreludeMotion();
  const gradientId = useId().replace(/:/g, "");
  const copy = VARIANT_COPY[variant] || VARIANT_COPY.progress;
  const safeTotal = Math.max(1, total);
  const litCount = Math.max(0, Math.min(POINTS.length, Math.ceil((value / safeTotal) * POINTS.length)));

  return (
    <div
      className={cn(
        "prelude-constellation",
        `prelude-constellation--${variant}`,
        `prelude-constellation--${copy.action}`,
        compact && "prelude-constellation--compact",
        active && !reducedMotion && "prelude-constellation--active",
        className
      )}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <div className="prelude-constellation__type" aria-hidden="true">
        <span>{copy.eyebrow}</span>
        <strong>{copy.title}</strong>
      </div>
      <svg viewBox="0 0 390 160" className="prelude-constellation__svg">
        <defs>
          <linearGradient id={gradientId} x1="28" y1="130" x2="360" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#786aff" />
            <stop offset=".52" stopColor="#14b8a6" />
            <stop offset="1" stopColor="#ff735c" />
          </linearGradient>
        </defs>
        <path
          className="prelude-constellation__ghost-line"
          d="M36 118L92 62L154 92L220 42L286 88L350 48"
        />
        <path
          className="prelude-constellation__line"
          d="M36 118L92 62L154 92L220 42L286 88L350 48"
          stroke={`url(#${gradientId})`}
        />
        <path className="prelude-constellation__orbit" d="M70 128C134 152 242 146 328 103" />
        {POINTS.map(([cx, cy], index) => {
          const lit = index < litCount;
          const current = lit && index === litCount - 1;
          return (
            <g
              key={`${cx}-${cy}`}
              className={cn(
                "prelude-constellation__node",
                lit && "prelude-constellation__node--lit",
                current && "prelude-constellation__node--current"
              )}
              style={{ "--node-index": index }}
            >
              <circle className="prelude-constellation__node-halo" cx={cx} cy={cy} r={lit ? 13 : 9} />
              <circle className="prelude-constellation__node-core" cx={cx} cy={cy} r={lit ? 5.5 : 4} />
            </g>
          );
        })}
        <g className="prelude-constellation__token">
          <path d="M181 112h28l9 13-23 20-23-20 9-13Z" />
          <path d="M188 121h14M195 116v20" />
        </g>
        <g className="prelude-constellation__signal">
          <circle cx="92" cy="62" r="4" />
          <circle cx="286" cy="88" r="4" />
        </g>
      </svg>
    </div>
  );
}
