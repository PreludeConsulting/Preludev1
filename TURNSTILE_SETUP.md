# Cloudflare Turnstile for Supabase Auth

Prelude sends Turnstile tokens with Supabase email/password login, signup, password-reset requests, and the password reauthentication used for account deletion. Google OAuth and password recovery completion do not accept CAPTCHA tokens in the Supabase client API.

## Cloudflare

1. Create a Turnstile widget for each deployed hostname, including `preludev1.pages.dev` while it is in use.
2. Choose the Managed widget mode.
3. Copy the public site key and secret key.

## Supabase dashboard

1. Open **Authentication → Bot and Abuse Protection → CAPTCHA protection**.
2. Select Cloudflare Turnstile.
3. Paste the Turnstile **secret key** and enable CAPTCHA protection.
4. Never place the secret key in a `VITE_` variable or commit it to this repository.

## Cloudflare Pages

Add this production build variable, then redeploy:

```text
VITE_TURNSTILE_SITE_KEY=<public Turnstile site key>
```

Use Cloudflare's documented test keys for local verification only. The app remains compatible when the site key is absent, but CAPTCHA is not active until both the Pages variable and Supabase dashboard protection are configured.

## Verification

After deployment, verify login, signup, forgot-password, and account deletion. Confirm each form displays a Turnstile challenge, failed auth resets it, expired challenges disable submission, and Google OAuth still redirects normally.
