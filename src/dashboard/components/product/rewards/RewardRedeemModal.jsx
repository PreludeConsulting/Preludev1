import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { TEST_PREP_OPTIONS } from "../../../lib/progressRewards.js";
import RewardIcon from "./RewardIcon.jsx";
import RewardTierBadge from "./RewardTierBadge.jsx";

export default function RewardRedeemModal({ reward, coins, onClose, onConfirm }) {
  const [testPrepOption, setTestPrepOption] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!reward) return;
    setTestPrepOption("");
    setSuccess(false);
  }, [reward]);

  if (!reward) return null;

  const tierId = reward.tier || "common";
  const tierConfig = reward.tierConfig;
  const coinsNeeded = Math.max(0, reward.coins - coins);
  const canAfford = coins >= reward.coins && !reward.redeemed;
  const needsTestPrep = reward.requiresSelection;
  const canConfirm = canAfford && (!needsTestPrep || testPrepOption);

  function handleConfirm() {
    if (!canConfirm) return;
    const result = onConfirm(reward, { testPrepOption: needsTestPrep ? testPrepOption : undefined });
    if (result?.success) {
      setSuccess(true);
    }
  }

  return (
    <div className="dash-rewards-modal" role="presentation" onClick={onClose}>
      <div
        className={`dash-rewards-modal__panel dash-rewards-modal__panel--redeem dash-rewards-modal__panel--tier-${tierId}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-redeem-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          "--tier-accent": tierConfig?.accentColor,
          "--tier-bg": tierConfig?.backgroundColor
        }}
      >
        <button type="button" className="dash-rewards-modal__close" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        {success ? (
          <div className="dash-rewards-modal__success">
            <p className="dash-rewards-modal__success-title">Reward redeemed!</p>
            <p className="dash-rewards-modal__success-desc">A mentor will follow up with next steps.</p>
            <button type="button" className="dash-btn dash-btn--primary dash-rewards-modal__confirm" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="dash-rewards-modal__reward-head">
              <RewardIcon reward={reward} large tier={tierId} />
              <div>
                <div className="dash-rewards-modal__title-row">
                  <h3 id="reward-redeem-title" className="dash-rewards-modal__title">
                    {reward.headline}
                  </h3>
                  <RewardTierBadge tier={tierId} className="dash-rewards-modal__tier-badge" />
                </div>
                {reward.subtitle ? (
                  <p className="dash-rewards-modal__subtitle">{reward.subtitle}</p>
                ) : null}
              </div>
            </div>

            <p className="dash-rewards-modal__desc">{reward.description}</p>

            <dl className="dash-rewards-modal__stats">
              <div>
                <dt>Coins required</dt>
                <dd>{reward.coins}</dd>
              </div>
              <div>
                <dt>Your balance</dt>
                <dd>{coins}</dd>
              </div>
              <div>
                <dt>Value</dt>
                <dd>${reward.estimatedValue}</dd>
              </div>
            </dl>

            {!canAfford ? (
              <p className="dash-rewards-modal__warning" role="alert">
                You need {coinsNeeded} more coins to redeem this reward.
              </p>
            ) : null}

            {needsTestPrep ? (
              <div className="dash-rewards-modal__field">
                <label htmlFor="test-prep-focus" className="dash-rewards-modal__field-label">
                  Choose your test prep focus
                </label>
                <select
                  id="test-prep-focus"
                  className="dash-rewards-modal__select"
                  value={testPrepOption}
                  onChange={(e) => setTestPrepOption(e.target.value)}
                >
                  <option value="">Select an option…</option>
                  {TEST_PREP_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="dash-rewards-modal__actions">
              <button type="button" className="dash-btn dash-btn--secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={`dash-btn dash-btn--primary dash-rewards-modal__confirm-btn dash-rewards-redeem-btn--tier-${tierId}`}
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                Confirm Redeem
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
