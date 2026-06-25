import RewardCard from "./RewardCard.jsx";

export default function FeaturedRewardCard({ reward, coins, onRedeem }) {
  return (
    <div className="dash-featured-reward-wrap">
      <div className="dash-featured-reward-wrap__aura" aria-hidden="true" />
      <RewardCard reward={reward} variant="featured" coins={coins} onRedeem={onRedeem} />
    </div>
  );
}
