function totalEssaySupportCredits(packages = [], key) {
  return packages.reduce((total, pkg) => {
    if (String(pkg?.bundleId || "").trim().toLowerCase() !== "essay_support") return total;
    const amount = Number(pkg?.[key]);
    return Number.isFinite(amount) && amount > 0 ? total + amount : total;
  }, 0);
}

export function getEssaySupportCreditSummary({ reviewCredits, packages = [] } = {}) {
  const purchasedFromPackages = totalEssaySupportCredits(packages, "sessionsPurchased");
  const remainingFromPackages = totalEssaySupportCredits(packages, "sessionsRemaining");
  const purchased = Math.max(0, Number(reviewCredits?.purchased) || purchasedFromPackages);
  const remaining = Math.max(0, Number(reviewCredits?.remaining) || remainingFromPackages);
  const assigned = Math.max(
    0,
    Number.isFinite(Number(reviewCredits?.assigned))
      ? Number(reviewCredits.assigned)
      : purchased - remaining
  );

  return { purchased, assigned, remaining };
}

export default function EssaySupportCreditsSummary({ reviewCredits, packages = [], compact = false }) {
  const credits = getEssaySupportCreditSummary({ reviewCredits, packages });

  return (
    <section className="essay-support-credits" aria-label="Essay Support credit balance">
      <div className="essay-support-credits__head">
        <h3 className="essay-support-credits__title">Essay Support</h3>
        <span className="essay-support-credits__payment">One-time payment</span>
      </div>
      <dl className="essay-support-credits__counts">
        <div>
          <dt>Credits purchased</dt>
          <dd>{credits.purchased}</dd>
        </div>
        <div>
          <dt>Assigned</dt>
          <dd>{credits.assigned}</dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd>{credits.remaining}</dd>
        </div>
      </dl>
      {!compact ? (
        <p className="essay-support-credits__note">
          1 credit covers one personal statement or all supplemental essays for one college.
        </p>
      ) : null}
    </section>
  );
}
