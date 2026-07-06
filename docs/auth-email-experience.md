# Email Authentication Experience

Prelude email-auth pages share the `AuthLayout` shell in `src/components/auth/AuthLayout.jsx` and common form primitives in `src/components/auth/AuthForm.jsx`.

The shared system keeps the pages compact, neutral, and centered while preserving the existing Supabase auth flow. Do not replace the Supabase methods in `src/lib/supabaseAuth.js` for visual changes. Login, signup, resend confirmation, password recovery, password reset, OAuth callback, email-link verification, and login-code verification should continue to use the existing auth helpers and redirects.

The six-digit verification UI is `OtpInput`. It intentionally supports numeric mobile keyboards, `autocomplete="one-time-code"`, paste with spaces, arrow-key movement, backspace-to-previous-field behavior, stable inline errors, and a full-group invalid state. Keep verification errors generic and user-actionable; do not surface raw Supabase strings or log OTP values.

Turnstile styling only frames the official widget and reserves space while it loads. Do not restyle the iframe, hide it, bypass it, or fake a successful CAPTCHA token.
