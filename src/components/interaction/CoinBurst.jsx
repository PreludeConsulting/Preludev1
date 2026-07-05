import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePreludeMotion } from "../../context/MotionContext.jsx";
import { MOTION } from "../../lib/motion/tokens.js";

const COIN_COUNT = 8;

function Coin({ index, origin }) {
  const angle = (index / COIN_COUNT) * Math.PI * 2;
  const dx = Math.cos(angle) * (36 + (index % 3) * 14);
  const dy = Math.sin(angle) * (28 + (index % 2) * 16) - 12;
  const delay = index * 0.04;
  const rot = (index % 2 === 0 ? 1 : -1) * (120 + index * 20);

  return (
    <span
      className="prelude-coin-burst__coin"
      style={{
        "--dx": `${dx}px`,
        "--dy": `${dy}px`,
        "--rot": `${rot}deg`,
        "--delay": `${delay}s`,
        left: origin?.x ?? "50%",
        top: origin?.y ?? "50%"
      }}
      aria-hidden="true"
    />
  );
}

export default function CoinBurst({ active, amount, origin, onDone }) {
  const { reducedMotion } = usePreludeMotion();
  const coins = useMemo(() => Array.from({ length: COIN_COUNT }, (_, i) => i), []);
  const label = amount ? `+${amount} coins` : "Coins earned";

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => onDone?.(), MOTION.coinBurstMs);
    return () => window.clearTimeout(timer);
  }, [active, onDone]);

  if (!active) return null;

  if (reducedMotion) {
    return createPortal(
      <div className="prelude-coin-burst prelude-coin-burst--static" role="status" aria-live="polite">
        <span className="prelude-coin-burst__label">{label}</span>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="prelude-coin-burst" aria-hidden="true">
      {amount ? <span className="prelude-coin-burst__amount">+{amount}</span> : null}
      {coins.map((i) => (
        <Coin key={i} index={i} origin={origin} />
      ))}
    </div>,
    document.body
  );
}
