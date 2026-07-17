import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { SecondaryButton, SectionCard } from "../ui/index.jsx";
import { fetchMyReferralCode } from "../../../lib/referralCodes.js";
import { formatReferralMonthLabel, logReferralEvent } from "../../../../shared/referralConstants.js";

export default function ReferralCodePanel({ enabled = true }) {
  const fieldId = useId();
  const [status, setStatus] = useState("loading");
  const [code, setCode] = useState("");
  const [validMonth, setValidMonth] = useState("");
  const [message, setMessage] = useState("");
  const [copyState, setCopyState] = useState("idle");

  useEffect(() => {
    if (!enabled) {
      setStatus("hidden");
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus("loading");
      try {
        const result = await fetchMyReferralCode();
        if (cancelled) return;
        if (!result.eligible) {
          setStatus("hidden");
          return;
        }
        setCode(result.code || "");
        setValidMonth(result.validMonth || "");
        setStatus("ready");
        logReferralEvent("referral_code_viewed_client", {});
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(error.message || "We could not load your referral code.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
      logReferralEvent("referral_code_copied", {});
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  if (!enabled || status === "hidden") return null;

  const monthLabel = validMonth ? formatReferralMonthLabel(validMonth) : null;

  return (
    <SectionCard title="Referral code" className="dash-panel">
      <div className="dash-referral-code">
        <p className="dash-muted">
          Share this code with friends or family. When they sign up and complete their first monthly payment, they get 20%
          off — and your household earns a 20% reward for a future month.
          {monthLabel
            ? ` This code is active for ${monthLabel} and refreshes automatically on the first of each month.`
            : " This code refreshes automatically on the first of each month."}
        </p>

        {status === "loading" ? (
          <p className="dash-muted" role="status">
            <Loader2 className="dash-referral-code__spinner" aria-hidden="true" /> Loading referral code…
          </p>
        ) : null}

        {status === "error" ? (
          <p className="dash-save-state dash-save-state--error" role="alert">
            {message}
          </p>
        ) : null}

        {status === "ready" ? (
          <div className="dash-referral-code__row">
            <label className="dash-field dash-referral-code__field" htmlFor={fieldId}>
              <span className="sr-only">Your referral code</span>
              <input
                id={fieldId}
                className="dash-input"
                value={code}
                readOnly
                aria-readonly="true"
                onFocus={(event) => event.target.select()}
              />
            </label>
            <SecondaryButton type="button" className="dash-btn--sm" onClick={handleCopy} aria-label="Copy referral code">
              {copyState === "copied" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copyState === "copied" ? "Copied" : "Copy code"}
            </SecondaryButton>
          </div>
        ) : null}

        {copyState === "copied" ? (
          <span className="dash-save-state dash-save-state--ok" role="status">
            Copied
          </span>
        ) : null}
        {copyState === "error" ? (
          <span className="dash-save-state dash-save-state--error" role="alert">
            Could not copy. Select the code and copy it manually.
          </span>
        ) : null}
      </div>
    </SectionCard>
  );
}
