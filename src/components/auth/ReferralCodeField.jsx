import { Loader2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  normalizeReferralCodeInput,
  publicReferralError
} from "../../../shared/referralConstants.js";
import { validateReferralCode } from "../../lib/referralCodes.js";

function normalizeInput(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

export default function ReferralCodeField({
  email = "",
  role = "",
  value = "",
  disabled = false,
  onChange,
  onApplied,
  onRemoved
}) {
  const fieldId = useId();
  const statusId = `${fieldId}-status`;
  const [draft, setDraft] = useState(value || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(Boolean(value));

  useEffect(() => {
    setDraft(value || "");
    setApplied(Boolean(value));
  }, [value]);

  async function applyCode() {
    const normalized = normalizeReferralCodeInput(draft);
    if (!normalized) {
      setError("Enter a referral code to apply.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await validateReferralCode({
        code: normalized,
        role,
        email: email.trim() || undefined
      });
      if (!result.valid) {
        setError(result.message || publicReferralError(result.error));
        setApplied(false);
        return;
      }
      setDraft(result.code || normalized);
      setApplied(true);
      onChange?.(result.code || normalized);
      onApplied?.({ code: result.code || normalized, message: result.message });
    } catch (err) {
      setError(err.message || publicReferralError("server_error"));
      setApplied(false);
    } finally {
      setLoading(false);
    }
  }

  function removeCode() {
    setDraft("");
    setApplied(false);
    setError("");
    onChange?.("");
    onRemoved?.();
  }

  return (
    <div className="promo-code-field referral-code-field">
      <div className="auth-field__label-row">
        <label htmlFor={fieldId} className="auth-field__label">
          Referral code — Optional
        </label>
      </div>
      <p className="auth-field__hint">
        Have a referral code from a friend or family member? Enter it here to receive 20% off your first month.
      </p>

      <div className="promo-code-field__row">
        <input
          id={fieldId}
          className="auth-field__input promo-code-field__input"
          type="text"
          name="referral-code"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. PETER-K7Q4"
          value={draft}
          readOnly={applied || loading}
          disabled={disabled || String(role).toUpperCase() === "MENTOR"}
          aria-describedby={statusId}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const next = normalizeInput(event.target.value);
            setDraft(next);
            onChange?.(next);
            if (error) setError("");
            if (applied) setApplied(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !applied) {
              event.preventDefault();
              applyCode();
            }
          }}
        />
        {applied ? (
          <button type="button" className="promo-code-field__action promo-code-field__action--ghost" onClick={removeCode} disabled={disabled || loading}>
            <X size={16} aria-hidden="true" />
            <span>Remove</span>
          </button>
        ) : (
          <button
            type="button"
            className="promo-code-field__action"
            onClick={applyCode}
            disabled={disabled || loading || !draft.trim() || String(role).toUpperCase() === "MENTOR"}
            aria-busy={loading || undefined}
          >
            {loading ? <Loader2 className="promo-code-field__spinner" aria-hidden="true" /> : null}
            <span>{loading ? "Checking…" : "Apply code"}</span>
          </button>
        )}
      </div>

      <div id={statusId} className="promo-code-field__status" aria-live="polite">
        {error ? (
          <p className="auth-field__message auth-field__message--error" role="alert">
            {error}
          </p>
        ) : applied ? (
          <p className="auth-field__message auth-field__message--ok" role="status">
            Referral code applied. You’ll receive 20% off your first monthly subscription payment.
          </p>
        ) : String(role).toUpperCase() === "MENTOR" ? (
          <p className="auth-field__message">Referral codes are only available for Student and Parent accounts.</p>
        ) : (
          <p className="auth-field__message auth-field__message--empty" aria-hidden="true">
            {"\u00a0"}
          </p>
        )}
      </div>
    </div>
  );
}
