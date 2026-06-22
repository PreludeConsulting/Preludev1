import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { DELETE_ACCOUNT_PHRASE } from "../../lib/accountDeletion.js";
import { shouldUseDemoFixtures } from "../../lib/devAuthBypass.js";
import { Modal, SecondaryButton } from "./ui/index.jsx";
import TurnstileWidget from "../../components/auth/TurnstileWidget.jsx";
import { isSupabaseConfigured } from "../../lib/supabaseConfig.js";
import { isTurnstileRequired } from "../../lib/turnstile.js";

const STEPS = {
  PASSWORD: "password",
  PHRASE: "phrase",
  SUCCESS: "success"
};

export default function DeleteAccountModal({ open, onClose, user, onDeleteAccount, onComplete }) {
  const [step, setStep] = useState(STEPS.PASSWORD);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);

  const isDemo = shouldUseDemoFixtures(user);
  const supabaseAuth = isSupabaseConfigured();

  function resetState() {
    setStep(STEPS.PASSWORD);
    setPassword("");
    setConfirmPassword("");
    setConfirmationPhrase("");
    setError("");
    setLoading(false);
    setCaptchaToken("");
  }

  function handleClose() {
    if (loading) return;
    resetState();
    onClose();
  }

  async function handlePasswordContinue(event) {
    event.preventDefault();
    setError("");
    if (!password || !confirmPassword) {
      setError("Enter your password in both fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStep(STEPS.PHRASE);
  }

  async function handleDelete(event) {
    event.preventDefault();
    setError("");
    if (confirmationPhrase !== DELETE_ACCOUNT_PHRASE) {
      setError(`Type exactly: ${DELETE_ACCOUNT_PHRASE}`);
      return;
    }

    setLoading(true);
    try {
      await onDeleteAccount({ password, confirmPassword, confirmationPhrase, captchaToken });
      setStep(STEPS.SUCCESS);
      window.setTimeout(() => {
        resetState();
        onClose();
        onComplete();
      }, 2800);
    } catch (err) {
      setError(err.message || "Could not delete your account.");
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  const title =
    step === STEPS.PASSWORD
      ? "Delete your account"
      : step === STEPS.PHRASE
        ? "Confirm account deletion"
        : "Account deleted";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      footer={
        step === STEPS.SUCCESS ? null : (
          <div className="dash-modal__footer-actions">
            <SecondaryButton type="button" onClick={handleClose} disabled={loading}>
              Cancel
            </SecondaryButton>
            {step === STEPS.PASSWORD ? (
              <button
                type="submit"
                form="delete-account-password-form"
                className="dash-btn dash-btn--danger"
                disabled={loading}
              >
                {loading ? "Verifying…" : "Continue"}
              </button>
            ) : (
              <button
                type="submit"
                form="delete-account-phrase-form"
                className="dash-btn dash-btn--danger"
                disabled={loading || confirmationPhrase !== DELETE_ACCOUNT_PHRASE || (supabaseAuth && isTurnstileRequired() && !captchaToken)}
              >
                {loading ? "Deleting…" : "Delete my account permanently"}
              </button>
            )}
          </div>
        )
      }
    >
      {isDemo ? (
        <p className="dash-muted">
          Demo accounts cannot be deleted. Create a real account from the Prelude homepage to use this feature.
        </p>
      ) : null}

      {!isDemo && step === STEPS.PASSWORD ? (
        <form id="delete-account-password-form" className="dash-delete-account" onSubmit={handlePasswordContinue}>
          <div className="dash-delete-account__warning">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <p>
              This permanently removes your account, profile, and saved data from Prelude. You will need to create a
              new account to sign in again.
            </p>
          </div>
          <label className="prelude-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="prelude-field">
            <span>Confirm password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          {supabaseAuth ? <TurnstileWidget ref={turnstileRef} onTokenChange={setCaptchaToken} disabled={loading} /> : null}
          {error ? <p className="dash-delete-account__error">{error}</p> : null}
        </form>
      ) : null}

      {!isDemo && step === STEPS.PHRASE ? (
        <form id="delete-account-phrase-form" className="dash-delete-account" onSubmit={handleDelete}>
          <p className="dash-muted">
            To permanently delete <strong>{user?.email}</strong>, type the sentence below exactly as shown.
          </p>
          <p className="dash-delete-account__phrase-hint">
            <code>{DELETE_ACCOUNT_PHRASE}</code>
          </p>
          <label className="prelude-field">
            <span>Confirmation</span>
            <input
              type="text"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder={DELETE_ACCOUNT_PHRASE}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          {error ? <p className="dash-delete-account__error">{error}</p> : null}
        </form>
      ) : null}

      {!isDemo && step === STEPS.SUCCESS ? (
        <div className="dash-delete-account__success">
          <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          <p>Your account has been permanently deleted.</p>
          <p className="dash-muted">A confirmation email was sent to {user?.email}. Returning you to the Prelude homepage…</p>
        </div>
      ) : null}
    </Modal>
  );
}
