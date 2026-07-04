import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { shouldUseDemoFixtures } from "../../lib/devAuthBypass.js";
import {
  accountDeletionUsesOAuth,
  accountDeletionUsesPassword,
  primaryOAuthProvider,
  resolveAuthSignInMethods
} from "../../lib/authSignInMethod.js";
import { getSupabase } from "../../lib/supabase.js";
import { Modal, SecondaryButton } from "./ui/index.jsx";
import GoogleSignInButton from "./GoogleSignInButton.jsx";
import TurnstileWidget from "../../components/auth/TurnstileWidget.jsx";
import { isSupabaseConfigured } from "../../lib/supabaseConfig.js";
import { isTurnstileRequired } from "../../lib/turnstile.js";

const STEPS = {
  CONFIRM: "confirm",
  SUCCESS: "success"
};

function providerLabel(provider) {
  if (provider === "google") return "Google";
  if (provider === "apple") return "Apple";
  if (provider === "github") return "GitHub";
  return "your sign-in provider";
}

export default function DeleteAccountModal({
  open,
  onClose,
  user,
  onDeleteAccount,
  onStartOAuthVerification,
  onComplete
}) {
  const [step, setStep] = useState(STEPS.CONFIRM);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);

  const isDemo = shouldUseDemoFixtures(user);
  const supabaseAuth = isSupabaseConfigured();
  const [signInMethods, setSignInMethods] = useState(() => resolveAuthSignInMethods(user));
  const usesPassword = accountDeletionUsesPassword(signInMethods);
  const usesOAuth = accountDeletionUsesOAuth(signInMethods);
  const oauthProvider = primaryOAuthProvider(signInMethods);

  useEffect(() => {
    if (!open || isDemo) return undefined;
    let cancelled = false;
    setMethodsLoading(Boolean(supabaseAuth));

    async function refreshSignInMethods() {
      try {
        if (supabaseAuth) {
          const supabase = getSupabase();
          if (supabase) {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!cancelled && authUser) {
              setSignInMethods(resolveAuthSignInMethods(user, authUser));
              return;
            }
          }
        }
        if (!cancelled) setSignInMethods(resolveAuthSignInMethods(user));
      } catch {
        if (!cancelled) setSignInMethods(resolveAuthSignInMethods(user));
      } finally {
        if (!cancelled) setMethodsLoading(false);
      }
    }

    refreshSignInMethods();
    return () => {
      cancelled = true;
    };
  }, [open, isDemo, supabaseAuth, user]);

  function resetState() {
    setStep(STEPS.CONFIRM);
    setPassword("");
    setConfirmPassword("");
    setError("");
    setLoading(false);
    setCaptchaToken("");
  }

  function handleClose() {
    if (loading) return;
    resetState();
    onClose();
  }

  async function handlePasswordDelete(event) {
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
    if (supabaseAuth && isTurnstileRequired() && !captchaToken) {
      setError("Complete the security check before deleting your account.");
      return;
    }

    setLoading(true);
    try {
      await onDeleteAccount({
        verificationMethod: "password",
        password,
        confirmPassword,
        captchaToken
      });
      setStep(STEPS.SUCCESS);
      window.setTimeout(() => {
        resetState();
        onClose();
        onComplete();
      }, 2800);
    } catch (err) {
      setError(err.message || "Could not delete your account.");
      turnstileRef.current?.reset();
      setCaptchaToken("");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthVerification() {
    setError("");
    setLoading(true);
    try {
      await onStartOAuthVerification();
    } catch (err) {
      setError(err.message || "Google verification could not be started.");
      setLoading(false);
    }
  }

  const title = step === STEPS.SUCCESS ? "Account deleted" : "Delete your account";

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
            {usesPassword && !methodsLoading ? (
              <button
                type="submit"
                form="delete-account-password-form"
                className="dash-btn dash-btn--danger"
                disabled={loading || (supabaseAuth && isTurnstileRequired() && !captchaToken)}
              >
                {loading ? "Deleting…" : "Delete my account permanently"}
              </button>
            ) : null}
          </div>
        )
      }
    >
      {isDemo ? (
        <p className="dash-muted">
          Demo accounts cannot be deleted. Create a real account from the Prelude homepage to use this feature.
        </p>
      ) : null}

      {!isDemo && step === STEPS.CONFIRM && methodsLoading ? (
        <p className="dash-muted">Checking how you signed in…</p>
      ) : null}

      {!isDemo && step === STEPS.CONFIRM && !methodsLoading && usesPassword ? (
        <form id="delete-account-password-form" className="dash-delete-account" onSubmit={handlePasswordDelete}>
          <div className="dash-delete-account__warning">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <p>
              This permanently removes your account, profile, parent/child links, mentor relationships, preferences,
              and saved data from Prelude. This cannot be undone.
            </p>
          </div>
          <p className="dash-muted">
            Because you signed up with email and password, enter your password twice to verify it&apos;s really you.
          </p>
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

      {!isDemo && step === STEPS.CONFIRM && !methodsLoading && usesOAuth ? (
        <div className="dash-delete-account">
          <div className="dash-delete-account__warning">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <p>
              This permanently removes your account, profile, parent/child links, mentor relationships, preferences,
              and saved data from Prelude. This cannot be undone.
            </p>
          </div>
          <p className="dash-muted">
            You signed in with {providerLabel(oauthProvider)} and do not have a Prelude password. To delete{" "}
            <strong>{user?.email}</strong>, verify your identity with {providerLabel(oauthProvider)} first.
          </p>
          <GoogleSignInButton
            label={`Continue with ${providerLabel(oauthProvider)} verification`}
            onClick={handleOAuthVerification}
            disabled={loading}
            loading={loading}
          />
          {error ? <p className="dash-delete-account__error">{error}</p> : null}
        </div>
      ) : null}

      {!isDemo && step === STEPS.CONFIRM && !methodsLoading && !usesPassword && !usesOAuth ? (
        <p className="dash-muted">
          We couldn&apos;t determine how you signed in. Please sign out, sign back in, and try again. If the problem
          continues, contact support.
        </p>
      ) : null}

      {!isDemo && step === STEPS.SUCCESS ? (
        <div className="dash-delete-account__success">
          <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          <p>Your account has been permanently deleted.</p>
          <p className="dash-muted">Returning you to the Prelude homepage…</p>
        </div>
      ) : null}
    </Modal>
  );
}
