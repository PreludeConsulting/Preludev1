import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  PROMO_SUCCESS_SUBTITLE,
  PROMO_SUCCESS_TITLE,
  normalizePromoCodeInput
} from "../../../shared/promoCodeConstants.js";
import { normalizeReferralCodeInput } from "../../../shared/referralConstants.js";
import { validatePromoCode } from "../../lib/promoCodes.js";
import { validateReferralCode } from "../../lib/referralCodes.js";

function normalizeInput(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function roleAllowsPromo(role) {
  const r = String(role || "").toUpperCase();
  return !r || r === "STUDENT";
}

function roleAllowsReferral(role) {
  const r = String(role || "").toUpperCase();
  return !r || r === "STUDENT" || r === "PARENT";
}

/**
 * Single signup field that accepts either a campaign promo code or a household referral code.
 * Only one can be applied.
 */
export default function PromoOrReferralCodeField({
  email = "",
  role = "",
  value = "",
  appliedKind = null,
  appliedSummary = null,
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
  const [kind, setKind] = useState(appliedKind);
  const [summary, setSummary] = useState(appliedSummary);
  const statusRef = useRef(null);
  const lastValidatedEmailRef = useRef("");

  const applied = Boolean(kind);

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  useEffect(() => {
    setKind(appliedKind);
    setSummary(appliedSummary);
  }, [appliedKind, appliedSummary]);

  useEffect(() => {
    if (applied && statusRef.current) statusRef.current.focus();
  }, [applied]);

  useEffect(() => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!applied || !draft) return;
    if (!lastValidatedEmailRef.current) {
      lastValidatedEmailRef.current = normalizedEmail;
      return;
    }
    if (normalizedEmail && lastValidatedEmailRef.current !== normalizedEmail) {
      clearApplied();
      lastValidatedEmailRef.current = "";
    }
  }, [email, applied, draft]);

  function clearApplied() {
    setDraft("");
    setKind(null);
    setSummary(null);
    setError("");
    lastValidatedEmailRef.current = "";
    onChange?.("");
    onRemoved?.();
  }

  async function applyCode() {
    const normalized = normalizePromoCodeInput(draft) || normalizeReferralCodeInput(draft);
    if (!normalized) {
      setError("Enter a promo or referral code to apply.");
      return;
    }

    const upperRole = String(role || "").toUpperCase();
    if (upperRole === "MENTOR") {
      setError("Promo and referral codes are only available for Student and Parent accounts.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      let promoResult = null;
      let referralResult = null;

      if (roleAllowsPromo(role)) {
        promoResult = await validatePromoCode({
          code: normalized,
          email: email.trim() || undefined
        });
        if (promoResult?.valid) {
          setDraft(promoResult.code || normalized);
          setKind("promo");
          setSummary(promoResult.summary || null);
          lastValidatedEmailRef.current = email.trim().toLowerCase();
          onChange?.(promoResult.code || normalized);
          onApplied?.({
            kind: "promo",
            code: promoResult.code || normalized,
            summary: promoResult.summary || null
          });
          return;
        }
      }

      if (roleAllowsReferral(role)) {
        referralResult = await validateReferralCode({
          code: normalized,
          role: role || "STUDENT",
          email: email.trim() || undefined
        });
        if (referralResult?.valid) {
          setDraft(referralResult.code || normalized);
          setKind("referral");
          setSummary(null);
          lastValidatedEmailRef.current = email.trim().toLowerCase();
          onChange?.(referralResult.code || normalized);
          onApplied?.({
            kind: "referral",
            code: referralResult.code || normalized,
            message: referralResult.message
          });
          return;
        }
      }

      // Prefer a specific failure over a generic not-found when available.
      const promoError = promoResult?.error;
      const referralError = referralResult?.error;
      if (promoError && promoError !== "not_found" && promoError !== "invalid_code_format") {
        setError(promoResult.message || "This promo code could not be applied.");
      } else if (referralError && referralError !== "not_found" && referralError !== "invalid_code_format") {
        setError(referralResult.message || "This referral code could not be applied.");
      } else {
        setError("We could not recognize that code. Check it and try again.");
      }
    } catch (err) {
      setError(err.message || "We could not verify that code right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="promo-code-field referral-code-field">
      <div className="auth-field__label-row">
        <label htmlFor={fieldId} className="auth-field__label">
          Promo/Referral Code — Optional
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
          name="promo-or-referral-code"
          autoComplete="off"
          spellCheck={false}
          placeholder="Enter promo or referral code"
          value={draft}
          readOnly={applied || loading}
          disabled={disabled}
          aria-describedby={statusId}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const next = normalizeInput(event.target.value);
            setDraft(next);
            onChange?.(next);
            if (error) setError("");
            if (applied) {
              setKind(null);
              setSummary(null);
              onRemoved?.();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !applied) {
              event.preventDefault();
              applyCode();
            }
          }}
        />
        {applied ? (
          <button
            type="button"
            className="promo-code-field__action promo-code-field__action--ghost"
            onClick={clearApplied}
            disabled={disabled || loading}
          >
            <X size={16} aria-hidden="true" />
            <span>Remove</span>
          </button>
        ) : (
          <button
            type="button"
            className="promo-code-field__action"
            onClick={applyCode}
            disabled={disabled || loading || !draft.trim()}
            aria-busy={loading || undefined}
          >
            {loading ? <Loader2 className="promo-code-field__spinner" aria-hidden="true" /> : null}
            <span>{loading ? "Checking…" : "Apply code"}</span>
          </button>
        )}
      </div>

      <div id={statusId} ref={statusRef} tabIndex={-1} className="promo-code-field__status" aria-live="polite">
        {error ? (
          <p className="auth-field__message auth-field__message--error" role="alert">
            {error}
          </p>
        ) : kind === "promo" && summary ? (
          <div className="promo-code-field__success" role="status">
            <p className="promo-code-field__success-title">{PROMO_SUCCESS_TITLE}</p>
            <p className="promo-code-field__success-copy">{PROMO_SUCCESS_SUBTITLE}</p>
            <dl className="promo-code-field__summary">
              <div>
                <dt>Plan</dt>
                <dd>{summary.plan}</dd>
              </div>
              <div>
                <dt>Price today</dt>
                <dd>{summary.priceToday}</dd>
              </div>
              <div>
                <dt>Payment method required</dt>
                <dd>{summary.paymentMethodRequired ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>Access period</dt>
                <dd>{summary.accessPeriod}</dd>
              </div>
              <div>
                <dt>Renewal terms</dt>
                <dd>{summary.renewalTerms}</dd>
              </div>
            </dl>
          </div>
        ) : kind === "referral" ? (
          <p className="auth-field__message auth-field__message--ok" role="status">
            Referral code applied. You’ll receive 20% off your first monthly subscription payment. Only one promo or
            referral code can be used.
          </p>
        ) : (
          <p className="auth-field__message auth-field__message--empty" aria-hidden="true">
            {"\u00a0"}
          </p>
        )}
      </div>
    </div>
  );
}
