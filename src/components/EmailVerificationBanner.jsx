import { Mail } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { resendVerificationEmail } from "../lib/emailVerification.js";

export default function EmailVerificationBanner({ className = "" }) {
  const { user } = useAuth();
  const [status, setStatus] = useState("idle");
  const [feedback, setFeedback] = useState("");

  if (!user || user.emailVerified) return null;

  async function handleResend() {
    setStatus("sending");
    setFeedback("");
    try {
      const result = await resendVerificationEmail(user);
      setStatus("sent");
      setFeedback(result?.message || "Verification email sent. Check your inbox.");
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
          disabled={status === "sending" || status === "sent"}
        >
          {status === "sending" ? "Sending…" : status === "sent" ? "Email sent" : "Resend link"}
        </button>
      </div>
      {feedback ? <p className="email-verify-banner__feedback">{feedback}</p> : null}
    </div>
  );
}
