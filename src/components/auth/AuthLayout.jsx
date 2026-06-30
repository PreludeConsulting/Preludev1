import AppLink from "../AppLink.jsx";

export default function AuthLayout({
  title,
  subtitle,
  headerLink,
  children,
  footer,
  panel = false,
  headingId = "auth-heading"
}) {
  return (
    <main className="auth-shell">
      <div className="auth-shell__backdrop" aria-hidden="true">
        <div className="auth-shell__orb auth-shell__orb--primary" />
        <div className="auth-shell__orb auth-shell__orb--secondary" />
        <div className="auth-shell__orb auth-shell__orb--accent" />
        <div className="auth-shell__grain" />
      </div>

      <div className={`auth-shell__frame${panel ? " auth-shell__frame--panel" : ""}`}>
        <div className="auth-shell__brand">
          <AppLink href="/" className="auth-shell__logo" aria-label="Prelude home">
            <img src="/prelude-email-logo.png" alt="" width={40} height={40} />
          </AppLink>
        </div>

        <header className="auth-shell__header">
          <h1 id={headingId} className="auth-shell__title">
            {title}
          </h1>
          {subtitle ? <p className="auth-shell__subtitle">{subtitle}</p> : null}
          {headerLink ? (
            <p className="auth-shell__header-link">
              {headerLink.prefix}{" "}
              <AppLink href={headerLink.href} className="auth-shell__text-link">
                {headerLink.label}
              </AppLink>
            </p>
          ) : null}
        </header>

        <div className="auth-shell__body">{children}</div>

        {footer ? <footer className="auth-shell__footer">{footer}</footer> : null}
      </div>
    </main>
  );
}
