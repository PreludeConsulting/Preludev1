import { useEffect, useRef, useState } from "react";
import { usePreludeMotion } from "../../../../context/MotionContext.jsx";
import { CoinBalance } from "./PreludePiggyBank.jsx";

const mediaBase = import.meta.env.BASE_URL;
export const GLASS_PIGGY_IMAGE = `${mediaBase}media/glass-piggy-bank-coins.png`;

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
      className={`dash-piggy-progress dash-piggy-progress--${size}${isDropping ? " dash-piggy-progress--dropping" : ""}${isGlowing ? " dash-piggy-progress--glow" : ""}${piggyAnimate ? " dash-piggy-progress--bounce" : ""}${className ? ` ${className}` : ""}`.trim()}
    >
      <div className="dash-piggy-progress__frame">
        <div className="dash-piggy-progress__body">
          <div className="dash-piggy-progress__pig">
            <img src={GLASS_PIGGY_IMAGE} alt="" className="dash-piggy-progress__pig-img" />

            {isDropping ? (
              <div className="dash-piggy-progress__slot" aria-hidden="true">
                {DROP_COINS.map((i) => (
                  <span
                    key={i}
                    className="dash-piggy-progress__falling-coin"
                    style={{ animationDelay: `${i * 0.12}s`, left: `${46 + i * 5}%` }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {showBalance ? (
          <div className="dash-piggy-progress__balance">
            <CoinBalance value={coins} className="dash-piggy-progress__balance-num" />
            <span className="dash-piggy-progress__balance-label">coins</span>
          </div>
        ) : null}

        {goalLabel ? <p className="dash-piggy-progress__goal">{goalLabel}</p> : null}
      </div>
    </div>
  );
}
