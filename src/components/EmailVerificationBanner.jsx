import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { resendVerificationEmail } from "../lib/emailVerification.js";

const RESEND_COOLDOWN_SECONDS = 30;

export default function EmailVerificationBanner({ className = "" }) {
  const { user } = useAuth();
  const [status, setStatus] = useState("idle");
  const [feedback, setFeedback] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = window.setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  if (!user || user.emailVerified) return null;

  async function handleResend() {
    setStatus("sending");
    setFeedback("");
    try {
      const result = await resendVerificationEmail(user);
      setStatus("sent");
      setFeedback(result?.message || "Verification email sent. Check your inbox.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setStatus("idle");
      setFeedback(err.message || "Could not send verification email.");
    }
  }

  return (
    <div className={`email-verify-banner ${className}`.trim()} role="status" aria-live="polite">
      <div className="email-verify-banner__inner">
        <Mail className="email-verify-banner__icon" aria-hidden="true" />
        <p className="email-verify-banner__text">
          <strong>Verify your email.</strong> We sent a confirmation link to{" "}
          <span className="email-verify-banner__email">{user.email}</span>. Please verify to secure your account.
        </p>
        <button
          type="button"
          className="email-verify-banner__resend"
          onClick={handleResend}
          disabled={status === "sending" || cooldown > 0}
        >
          {status === "sending" ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
        </button>
      </div>
      {feedback ? <p className="email-verify-banner__feedback">{feedback}</p> : null}
    </div>
  );
}
