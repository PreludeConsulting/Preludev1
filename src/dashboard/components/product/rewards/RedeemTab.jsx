import { useMemo, useState } from "react";
import { useProgressRewards } from "../../../context/ProgressRewardsContext.jsx";
import FeaturedRewardCard from "./FeaturedRewardCard.jsx";
import RewardRedeemModal from "./RewardRedeemModal.jsx";
import RewardShop from "./RewardShop.jsx";

export function RedeemTab() {
  const { coins, shopRewards, shopRefreshAt, featuredReward, handleRedeemReward } = useProgressRewards();
  const [modalReward, setModalReward] = useState(null);

  const stableShopRewards = useMemo(() => shopRewards, [shopRewards]);

  function openRedeemModal(reward) {
    setModalReward(reward);
  }

  function closeModal() {
    setModalReward(null);
  }

  function confirmRedeem(reward, options) {
    return handleRedeemReward(reward.id, options);
  }

  return (
    <div className="dash-rewards-tab-panel">
      <h2 className="dash-rewards-section-label dash-rewards-section-label--featured">Featured Reward</h2>
      <FeaturedRewardCard reward={featuredReward} coins={coins} onRedeem={openRedeemModal} />

      <RewardShop
        shopRewards={stableShopRewards}
        refreshAt={shopRefreshAt}
        coins={coins}
        onRedeem={openRedeemModal}
      />

      <RewardRedeemModal
        reward={modalReward}
        coins={coins}
        onClose={closeModal}
        onConfirm={confirmRedeem}
      />
    </div>
  );
}

export { ProgressBar } from "./RewardCard.jsx";
