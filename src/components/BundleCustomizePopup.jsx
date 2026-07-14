import { Check, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatUsd,
  getDefaultBundleSelection,
  normalizeBundleSelection,
  quoteBundleSelection,
  SUPPORT_BUNDLES
} from "../../shared/supportBundles.js";
import { WALLET_STATES } from "../lib/planWalletMachine.js";

function getTabbable(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function QuantityControl({ label, hint, value, allowed, onChange }) {
  const steps = Array.isArray(allowed) && allowed.length ? allowed : [value];
  const index = steps.indexOf(value);
  const safeIndex = index >= 0 ? index : 0;
  const displayValue = index >= 0 ? value : steps[0];

  return (
    <div className="pw-bundle-qty">
      <div className="pw-bundle-qty__copy">
        <span className="pw-bundle-qty__label">{label}</span>
        {hint ? <span className="pw-bundle-qty__hint">{hint}</span> : null}
      </div>
      <div className="pw-bundle-qty__stepper" role="group" aria-label={label}>
        <button
          type="button"
          className="pw-bundle-qty__step"
          aria-label={`Decrease ${label}`}
          disabled={safeIndex <= 0}
          onClick={() => onChange(steps[safeIndex - 1])}
        >
          <Minus aria-hidden="true" />
        </button>
        <span className="pw-bundle-qty__value" aria-live="polite">
          {displayValue}
        </span>
        <button
          type="button"
          className="pw-bundle-qty__step"
          aria-label={`Increase ${label}`}
          disabled={safeIndex >= steps.length - 1}
          onClick={() => onChange(steps[safeIndex + 1])}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function CheckboxOption({ checked, label, meta, onChange }) {
  return (
    <label className={`pw-bundle-option${checked ? " pw-bundle-option--on" : ""}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="pw-bundle-option__mark" aria-hidden="true">
        {checked ? <Check /> : null}
      </span>
      <span className="pw-bundle-option__copy">
        <span className="pw-bundle-option__label">{label}</span>
        {meta ? <span className="pw-bundle-option__meta">{meta}</span> : null}
      </span>
    </label>
  );
}

function IncludedFeature({ label }) {
  return (
    <div className="pw-bundle-option pw-bundle-option--on pw-bundle-option--included">
      <span className="pw-bundle-option__mark" aria-hidden="true">
        <Check />
      </span>
      <span className="pw-bundle-option__copy">
        <span className="pw-bundle-option__label">{label}</span>
      </span>
    </div>
  );
}

export default function BundleCustomizePopup({
  bundleId,
  selection,
  onSelectionChange,
  status,
  busy,
  notice,
  context = "public",
  dialogRef,
  backdropRef,
  onCheckout,
  onViewOtherBundles,
  onRequestClose
}) {
  const catalog = SUPPORT_BUNDLES[bundleId];
  const bodyRef = useRef(null);
  const firstActionRef = useRef(null);
  const localSelection = selection || getDefaultBundleSelection(bundleId);
  const quote = useMemo(
    () => quoteBundleSelection(localSelection, { snapInvalidQuantities: true }),
    [localSelection]
  );
  const [priceFlash, setPriceFlash] = useState(false);
  const priceRef = useRef(null);

  useEffect(() => {
    if (!bundleId || !onSelectionChange) return;
    const normalized = normalizeBundleSelection(localSelection, { snapInvalidQuantities: true });
    if (!normalized.ok) return;
    const next = normalized.selection;
    const qtyChanged = Object.keys(next.quantities || {}).some(
      (key) => next.quantities[key] !== localSelection.quantities?.[key]
    );
    const servicesChanged = Object.keys(next.services || {}).some(
      (key) => next.services[key] !== Boolean(localSelection.services?.[key])
    );
    const usesChanged = Object.keys(next.sessionUses || {}).some(
      (key) => next.sessionUses[key] !== Boolean(localSelection.sessionUses?.[key])
    );
    if (qtyChanged || servicesChanged || usesChanged) onSelectionChange(next);
  }, [bundleId, localSelection, onSelectionChange]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (status === WALLET_STATES.POPUP_OPEN) {
      firstActionRef.current?.focus();
    }
  }, [status]);

  useEffect(() => {
    if (!priceFlash) return undefined;
    const id = window.setTimeout(() => setPriceFlash(false), 1200);
    return () => window.clearTimeout(id);
  }, [priceFlash]);

  if (!catalog) return null;

  function patchSelection(patch) {
    onSelectionChange({ ...localSelection, ...patch, bundleId });
  }

  function updateQuantity(key, next) {
    patchSelection({
      quantities: { ...localSelection.quantities, [key]: next }
    });
  }

  function updateAddOn(id, enabled) {
    patchSelection({
      addOns: { ...localSelection.addOns, [id]: enabled }
    });
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onRequestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const tabbable = getTabbable(dialogRef.current);
    if (tabbable.length === 0) return;
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const totals = quote.ok ? quote : null;
  const isPayment = context === "payment";
  const isBilling = context === "billing";

  return (
    <div className="pw-popup-layer" onKeyDown={handleKeyDown}>
      <div
        ref={backdropRef}
        className="pw-popup-backdrop"
        onClick={busy ? undefined : onRequestClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`pw-bundle-title-${bundleId}`}
        className={`pw-popup pw-popup--bundle pw-popup--${bundleId}`}
      >
        <header className="pw-popup__head">
          <div className="pw-popup__head-row">
            <h2 id={`pw-bundle-title-${bundleId}`}>{catalog.title}</h2>
            {catalog.badge ? <span className="pw-popup__badge">{catalog.badge}</span> : null}
          </div>
          <p className="pw-popup__head-sub">{catalog.description}</p>
        </header>

        <div
          ref={bodyRef}
          className="pw-popup__body"
          tabIndex={0}
          role="region"
          aria-label={`${catalog.title} customization`}
        >
          <section
            ref={priceRef}
            tabIndex={-1}
            className={`pw-popup__price ${priceFlash ? "pw-popup__price--flash" : ""}`}
            aria-label={`${catalog.title} total`}
          >
            <span className="pw-popup__price-amount">
              {totals ? totals.displayTotal : formatUsd(catalog.startingCents)}
            </span>
            <span className="pw-popup__price-period">one-time</span>
            <span className="pw-popup__price-label">
              {totals?.savingsLabel ||
                (totals
                  ? totals.summaryLines[0]
                  : `Starting at ${formatUsd(catalog.startingCents)}`)}
            </span>
          </section>

          <div className="pw-bundle-controls">
            {Object.values(catalog.quantities || {}).map((field) => (
              <QuantityControl
                key={field.id}
                label={field.label}
                hint={field.hint}
                value={localSelection.quantities[field.id]}
                allowed={field.allowed}
                onChange={(next) => updateQuantity(field.id, next)}
              />
            ))}

            {catalog.addOns?.length ? (
              <div className="pw-bundle-group">
                <p className="pw-bundle-group__label">Optional add-ons</p>
                <div className="pw-bundle-group__options">
                  {catalog.addOns.map((item) => (
                    <CheckboxOption
                      key={item.id}
                      checked={Boolean(localSelection.addOns?.[item.id])}
                      label={item.label}
                      meta={`+$${Math.round(item.cents / 100)}`}
                      onChange={(enabled) => updateAddOn(item.id, enabled)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {catalog.services?.length ? (
              <div className="pw-bundle-group">
                <p className="pw-bundle-group__label">
                  {bundleId === "essay_support" ? "Essay focus" : "Included services"}
                </p>
                <div className="pw-bundle-group__options" role="list" aria-label="Included in every package">
                  {catalog.services.map((item) => (
                    <div key={item.id} role="listitem">
                      <IncludedFeature label={item.label} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {catalog.sessionUses?.length ? (
              <div className="pw-bundle-group">
                <p className="pw-bundle-group__label">Sessions may be used for</p>
                <div className="pw-bundle-group__options" role="list" aria-label="Included session uses">
                  {catalog.sessionUses.map((item) => (
                    <div key={item.id} role="listitem">
                      <IncludedFeature label={item.label} />
                    </div>
                  ))}
                </div>
                <p className="pw-bundle-group__note">Mix different session types within the same bundle.</p>
              </div>
            ) : null}
          </div>

          <section className="pw-popup__features" aria-label="Selected for this bundle">
            <h3>What&apos;s included</h3>
            {totals ? (
              <ul>
                {totals.summaryLines.map((line) => (
                  <li key={line}>
                    <Check aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pw-popup__notice" role="status">
                {quote.message}
              </p>
            )}
          </section>

          <p className="pw-popup__supporting">
            {isPayment || isBilling
              ? "One-time purchase via Stripe. This is not a recurring monthly subscription."
              : "Customize your bundle, then continue to secure one-time checkout."}
          </p>

          {notice ? (
            <p className="pw-popup__notice" role="status">
              {notice}
            </p>
          ) : null}
        </div>

        <footer className="pw-popup__actions">
          <button
            ref={firstActionRef}
            type="button"
            className="pw-popup__action pw-popup__action--primary"
            onClick={() => onCheckout(localSelection)}
            disabled={busy || !totals}
            aria-busy={busy}
          >
            {busy ? "Processing…" : "Continue to checkout"}
          </button>
          <div className="pw-popup__actions-row">
            <button
              type="button"
              className="pw-popup__action"
              onClick={() => {
                priceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                setPriceFlash(true);
              }}
              disabled={busy}
            >
              View total
            </button>
            <button type="button" className="pw-popup__action" onClick={onViewOtherBundles} disabled={busy}>
              View other options
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
