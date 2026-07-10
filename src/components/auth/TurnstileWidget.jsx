import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { TURNSTILE_SITE_KEY } from "../../lib/turnstile.js";

const SCRIPT_ID = "prelude-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const onLoad = () => resolve(window.turnstile);
    const onError = () => reject(new Error("The security check could not load. Refresh and try again."));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (window.turnstile) onLoad();
  });
}

const TurnstileWidget = forwardRef(function TurnstileWidget({ onTokenChange, onStatusChange, disabled = false }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbackRef = useRef(onTokenChange);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("loading");

  function reportStatus(next) {
    setStatus(next);
    onStatusChange?.(next);
  }

  callbackRef.current = onTokenChange;

  useImperativeHandle(ref, () => ({
    reset() {
      callbackRef.current?.("");
      reportStatus("loading");
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }
  }), []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined;
    let cancelled = false;
    reportStatus("loading");

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !turnstile || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "auto",
          size: "flexible",
          callback: (token) => {
            setError("");
            callbackRef.current?.(token);
          },
          "expired-callback": () => {
            callbackRef.current?.("");
            setError("The security check expired. Complete it again to continue.");
            reportStatus("expired");
          },
          "error-callback": () => {
            callbackRef.current?.("");
            setError("The security check expired or failed. Please try it again.");
            reportStatus("error");
          }
        });
        reportStatus("ready");
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError.message);
          reportStatus("error");
        }
      });

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      callbackRef.current?.("");
      onStatusChange?.("idle");
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className={`auth-turnstile${disabled ? " auth-turnstile--disabled" : ""}`} aria-busy={disabled || undefined}>
      <div className="auth-turnstile__frame">
        <div ref={containerRef} className="auth-turnstile__widget" />
        {status === "loading" ? <span className="auth-turnstile__placeholder">Loading security check…</span> : null}
      </div>
      {error ? <p className="auth-turnstile__error" role="alert">{error}</p> : null}
      {status === "error" ? <button type="button" className="auth-inline-link" onClick={() => window.location.reload()}>Retry security check</button> : null}
    </div>
  );
});

export default TurnstileWidget;
