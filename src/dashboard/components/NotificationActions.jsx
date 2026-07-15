import { useState } from "react";
import { Link } from "react-router-dom";
import { claimReferralReward } from "../../lib/referralCodes.js";
import { PrimaryButton } from "./ui/index.jsx";

export default function NotificationActions({ notification, onClaimed }) {
  const [claimState, setClaimState] = useState({ status: "idle", message: "" });
  const canClaim =
    notification.actionType === "claim_referral_reward" &&
    !notification.actionCompletedAt &&
    notification.actionPayload?.rewardId;

  async function handleClaim() {
    setClaimState({ status: "loading", message: "" });
    try {
      const result = await claimReferralReward(notification.actionPayload.rewardId);
      setClaimState({ status: "done", message: result.message || "Reward claimed." });
      onClaimed?.(notification.id, result);
    } catch (error) {
      setClaimState({
        status: "error",
        message: error.payload?.message || error.message || "Could not claim this reward."
      });
    }
  }

  if (canClaim) {
    return (
      <div className="dash-notification-item__actions">
        {claimState.status === "done" ? (
          <p className="dash-save-state dash-save-state--ok" role="status">
            {claimState.message}
          </p>
        ) : (
          <>
            <PrimaryButton
              type="button"
              className="dash-btn--sm"
              onClick={handleClaim}
              disabled={claimState.status === "loading"}
            >
              {claimState.status === "loading" ? "Claiming…" : "Claim 20% discount"}
            </PrimaryButton>
            {claimState.status === "error" ? (
              <p className="dash-save-state dash-save-state--error" role="alert">
                {claimState.message}
              </p>
            ) : null}
          </>
        )}
      </div>
    );
  }

  if (notification.link) {
    return (
      <Link to={notification.link} className="dash-btn dash-btn--secondary dash-btn--sm">
        View
      </Link>
    );
  }

  return null;
}
