import { Gift } from "lucide-react";

/**
 * Apple Cash-style reward redemption card inside mentor↔student chat.
 * Visually from the student (outgoing for student, incoming for mentor).
 */
export default function RewardRedemptionCard({ message }) {
  const meta = message?.metadata || {};
  const rewardName = meta.rewardName || meta.reward_name || "Reward";
  const coinCost = Number(meta.coinCost ?? meta.coin_cost ?? 0);
  const studentName = meta.studentName || meta.student_name || message?.senderName || "Student";

  return (
    <div className="msg-reward-card" role="article" aria-label={`Reward redeemed: ${rewardName}`}>
      <div className="msg-reward-card__eyebrow">
        <Gift className="msg-reward-card__icon" aria-hidden="true" />
        Reward Redeemed
      </div>
      <p className="msg-reward-card__title">{rewardName}</p>
      {coinCost > 0 ? <p className="msg-reward-card__coins">{coinCost} Prelude Coins</p> : null}
      <p className="msg-reward-card__by">Redeemed by {studentName}</p>
    </div>
  );
}
