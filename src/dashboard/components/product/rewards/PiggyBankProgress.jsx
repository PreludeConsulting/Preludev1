import { useEffect, useRef, useState } from "react";
import { usePreludeMotion } from "../../../../context/MotionContext.jsx";
import { CoinBalance } from "./PreludePiggyBank.jsx";
import { PIGGY_IMAGE } from "./PreludePiggyBank.jsx";

const DROP_COINS = [0, 1, 2, 3];

export default function PiggyBankProgress({
  coins = 0,
  goalCoins = 300,
  size = "hero",
  className = "",
  piggyAnimate = false,
  withDropAnimation = true,
  showBalance = false,
  goalLabel = ""
}) {
  const fillPct = goalCoins > 0 ? Math.min((coins / goalCoins) * 100, 100) : 0;
  const prevCoins = useRef(coins);
  const [isDropping, setIsDropping] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const { reducedMotion } = usePreludeMotion();

  useEffect(() => {
    if (!withDropAnimation || reducedMotion) {
      prevCoins.current = coins;
      return undefined;
    }
    if (coins > prevCoins.current) {
      setIsDropping(true);
      setIsGlowing(true);
      const dropTimer = window.setTimeout(() => setIsDropping(false), 1500);
      const glowTimer = window.setTimeout(() => setIsGlowing(false), 900);
      prevCoins.current = coins;
      return () => {
        window.clearTimeout(dropTimer);
        window.clearTimeout(glowTimer);
      };
    }
    prevCoins.current = coins;
    return undefined;
  }, [coins, withDropAnimation, reducedMotion]);

  return (
    <div
      className={`dash-piggy-progress dash-piggy-progress--${size}${isDropping ? " dash-piggy-progress--dropping" : ""}${isGlowing ? " dash-piggy-progress--glow" : ""}${className ? ` ${className}` : ""}`.trim()}
    >
      <div className="dash-piggy-progress__frame">
        <div className="dash-piggy-progress__body">
          <div className="dash-piggy-progress__belly" aria-hidden="true">
            <div
              className="dash-piggy-progress__fill"
              style={{ height: `${fillPct}%` }}
            />
            <div className="dash-piggy-progress__fill-shine" />
          </div>

          {isDropping ? (
            <div className="dash-piggy-progress__slot" aria-hidden="true">
              {DROP_COINS.map((i) => (
                <span
                  key={i}
                  className="dash-piggy-progress__falling-coin"
                  style={{ animationDelay: `${i * 0.12}s`, left: `${38 + i * 8}%` }}
                />
              ))}
            </div>
          ) : null}

          <img src={PIGGY_IMAGE} alt="" className="dash-piggy-progress__pig-img" />
          <span className="dash-piggy-progress__outline" aria-hidden="true" />
        </div>

        {showBalance ? (
          <div className="dash-piggy-progress__balance">
            <CoinBalance value={coins} className="dash-piggy-progress__balance-num" />
            <span className="dash-piggy-progress__balance-label">coins</span>
          </div>
        ) : null}

        {goalLabel ? (
          <p className="dash-piggy-progress__goal">{goalLabel}</p>
        ) : null}
      </div>
    </div>
  );
}
