import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  PROMO_CODE_PATTERN,
  PROMO_SUCCESS_SUBTITLE,
  PROMO_SUCCESS_TITLE,
  normalizePromoCodeInput
} from "../../../shared/promoCodeConstants.js";
import { validatePromoCode } from "../../lib/promoCodes.js";

function normalizeInput(value) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export default function PromoCodeField({
  email = "",
  value = "",
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
  const [summary, setSummary] = useState(appliedSummary);
  const lastValidatedEmailRef = useRef("");
  const statusRef = useRef(null);

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  useEffect(() => {
    setSummary(appliedSummary);
  }, [appliedSummary]);

  useEffect(() => {
    if (summary && statusRef.current) {
      statusRef.current.focus();
    }
  }, [summary]);

  useEffect(() => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!summary || !draft) return;
    if (!lastValidatedEmailRef.current) {
      lastValidatedEmailRef.current = normalizedEmail;
      return;
    }
    if (normalizedEmail && lastValidatedEmailRef.current !== normalizedEmail) {
      setDraft("");
      setSummary(null);
      setError("");
      lastValidatedEmailRef.current = "";
      onChange?.("");
      onRemoved?.();
    }
  }, [email, summary, draft, onChange, onRemoved]);

  async function applyCode() {
    const normalized = normalizePromoCodeInput(draft);
    if (!normalized) {
      setError("Enter a promo code to apply.");
      return;
    }
    if (!PROMO_CODE_PATTERN.test(normalized)) {
      setError("Promo codes can only contain letters, numbers, and hyphens.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await validatePromoCode({
        code: normalized,
        email: email.trim() || undefined
      });
      if (!result.valid) {
        setError(result.message);
        return;
      }
      const nextCode = result.code || normalized;
      setDraft(nextCode);
      setSummary(result.summary);
      lastValidatedEmailRef.current = email.trim().toLowerCase();
      onChange?.(nextCode);
      onApplied?.({ code: nextCode, summary: result.summary, email });
    } catch (err) {
      setError(err.message || "We could not verify the promo code right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function removeCode() {
    setDraft("");
    setSummary(null);
    setError("");
    lastValidatedEmailRef.current = "";
    onChange?.("");
    onRemoved?.();
  }

  const applied = Boolean(summary);

  return (
    <div className="promo-code-field">
      <div className="auth-field__label-row">
        <label htmlFor={fieldId} className="auth-field__label">
          Promo Code — Optional
        </label>
      </div>

      <div className="promo-code-field__row">
        <input
          id={fieldId}
          className="auth-field__input promo-code-field__input"
          type="text"
          name="promo-code"
          autoComplete="off"
          spellCheck={false}
          placeholder="Enter your promo code"
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
            disabled={disabled || loading || !draft.trim()}
            aria-busy={loading || undefined}
          >
            {loading ? <Loader2 className="promo-code-field__spinner" aria-hidden="true" /> : null}
            <span>{loading ? "Checking…" : "Apply Code"}</span>
          </button>
        )}
      </div>

      <div id={statusId} ref={statusRef} tabIndex={-1} className="promo-code-field__status" aria-live="polite">
        {error ? (
          <p className="auth-field__message auth-field__message--error" role="alert">
            {error}
          </p>
        ) : applied ? (
          <div className="promo-code-field__success" role="status">
            <p className="promo-code-field__success-title">{PROMO_SUCCESS_TITLE}</p>
            <p className="promo-code-field__success-copy">{PROMO_SUCCESS_SUBTITLE}</p>
            <dl className="promo-code-field__summary">
              <div><dt>Plan</dt><dd>{summary.plan}</dd></div>
              <div><dt>Price today</dt><dd>{summary.priceToday}</dd></div>
              <div><dt>Payment method required</dt><dd>{summary.paymentMethodRequired ? "Yes" : "No"}</dd></div>
              <div><dt>Access period</dt><dd>{summary.accessPeriod}</dd></div>
              <div><dt>Renewal terms</dt><dd>{summary.renewalTerms}</dd></div>
            </dl>
          </div>
        ) : (
          <p className="auth-field__message auth-field__message--empty" aria-hidden="true">
            {"\u00a0"}
          </p>
        )}
      </div>
    </div>
  );
}
