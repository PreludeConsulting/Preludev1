import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { TEST_PREP_OPTIONS, TUTORING_SUBJECT_OPTIONS } from "../../../lib/progressRewards.js";
import RewardIcon from "./RewardIcon.jsx";
import RewardTierBadge from "./RewardTierBadge.jsx";
import { useDialogFocusTrap } from "../../../../lib/useDialogFocusTrap.js";

function fulfillmentLabel(reward) {
  if (reward?.fulfillmentType === "live_call") return "Live 30-minute call";
  return "Asynchronous written review";
}

export default function RewardRedeemModal({ reward, coins, onClose, onConfirm }) {
  const [selection, setSelection] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useDialogFocusTrap(Boolean(reward), onClose);

  useEffect(() => {
    if (!reward) return;
    setSelection("");
    setSuccess(false);
    setSubmitting(false);
  }, [reward]);

  if (!reward) return null;

  const tierId = reward.tier || "common";
  const tierConfig = reward.tierConfig;
  const coinsNeeded = Math.max(0, reward.coins - coins);
  const canAfford = coins >= reward.coins && !reward.redeemed;
  const needsSelection = reward.requiresSelection;
  const selectionOptions =
    reward.selectionType === "tutoring_subject" ? TUTORING_SUBJECT_OPTIONS : TEST_PREP_OPTIONS;
  const selectionLabel =
    reward.selectionType === "tutoring_subject" ? "Choose your tutoring subject" : "Choose your test prep focus";
  const canConfirm = canAfford && (!needsSelection || selection) && !submitting;
  const displayTitle = reward.title || reward.headline;
  const details =
    reward.confirmationDetails ||
    reward.description ||
    "Review the details of this reward before redeeming.";

  async function handleConfirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const result = await onConfirm(reward, {
        selection: needsSelection ? selection : undefined,
        testPrepOption: needsSelection ? selection : undefined
      });
      if (result?.success) {
        setSuccess(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dash-rewards-modal" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={`dash-rewards-modal__panel dash-rewards-modal__panel--redeem dash-rewards-modal__panel--tier-${tierId}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-redeem-title"
        tabIndex={-1}
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
            <p className="dash-rewards-modal__success-desc">
              {reward.fulfillmentType === "live_call"
                ? "We’ll follow up to schedule your live session."
                : "A mentor will follow up with next steps."}
            </p>
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
                    {displayTitle}
                  </h3>
                  <RewardTierBadge tier={tierId} className="dash-rewards-modal__tier-badge" />
                </div>
                {reward.subtitle ? (
                  <p className="dash-rewards-modal__subtitle">{reward.subtitle}</p>
                ) : null}
              </div>
            </div>

            <p className="dash-rewards-modal__desc">{details}</p>

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
                <dt>Type</dt>
                <dd>{fulfillmentLabel(reward)}</dd>
              </div>
            </dl>

            {reward.scope ? (
              <p className="dash-rewards-modal__subtitle">Includes: {reward.scope}</p>
            ) : null}
            {reward.exclusions ? (
              <p className="dash-rewards-modal__warning" role="note">
                Note: {reward.exclusions}
              </p>
            ) : null}
            {(reward.mentorsRequired || 1) > 1 ? (
              <p className="dash-rewards-modal__subtitle">
                Requires {reward.mentorsRequired} mentors for fulfillment.
              </p>
            ) : null}

            {!canAfford ? (
              <p className="dash-rewards-modal__warning" role="alert">
                You need {coinsNeeded} more coins to redeem this reward.
              </p>
            ) : null}

            {needsSelection ? (
              <div className="dash-rewards-modal__field">
                <label htmlFor="reward-selection" className="dash-rewards-modal__field-label">
                  {selectionLabel}
                </label>
                <select
                  id="reward-selection"
                  className="dash-rewards-modal__select"
                  value={selection}
                  onChange={(e) => setSelection(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Select an option…</option>
                  {selectionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="dash-rewards-modal__actions">
              <button type="button" className="dash-btn dash-btn--secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                className={`dash-btn dash-btn--primary dash-rewards-modal__confirm-btn dash-rewards-redeem-btn--tier-${tierId}`}
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                {submitting ? "Redeeming…" : "Confirm Redeem"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
