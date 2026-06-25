import { useEffect, useState } from "react";
import { formatShopCountdown } from "../../../lib/rewardShop.js";
import RewardCard from "./RewardCard.jsx";

export default function RewardShop({ shopRewards, refreshAt, onRedeem, coins }) {
  const [countdown, setCountdown] = useState(() => formatShopCountdown(refreshAt - Date.now()));

  useEffect(() => {
    function tick() {
      const remaining = refreshAt - Date.now();
      setCountdown(formatShopCountdown(remaining));
    }
    tick();
    const id = window.setInterval(tick, 60000);
    return () => window.clearInterval(id);
  }, [refreshAt]);

  return (
    <section className="dash-reward-shop" id="reward-shop" aria-labelledby="reward-shop-title">
      <div className="dash-reward-shop__head">
        <div>
          <h3 id="reward-shop-title" className="dash-rewards-section-label">Reward Shop</h3>
          <p className="dash-reward-shop__subtitle">New rewards refresh every 24 hours.</p>
        </div>
        <p className="dash-reward-shop__countdown" aria-live="polite">{countdown}</p>
      </div>

      <div className="dash-reward-shop__grid">
        {shopRewards.map((reward) => (
          <RewardCard key={reward.id} reward={reward} coins={coins} onRedeem={onRedeem} />
        ))}
      </div>
    </section>
  );
}
