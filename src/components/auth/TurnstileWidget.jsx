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

const TurnstileWidget = forwardRef(function TurnstileWidget({ onTokenChange, disabled = false }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbackRef = useRef(onTokenChange);
  const [error, setError] = useState("");

  callbackRef.current = onTokenChange;

  useImperativeHandle(ref, () => ({
    reset() {
      callbackRef.current?.("");
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }
  }), []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined;
    let cancelled = false;

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
          "expired-callback": () => callbackRef.current?.(""),
          "error-callback": () => {
            callbackRef.current?.("");
            setError("The security check expired or failed. Please try it again.");
          }
        });
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      });

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      callbackRef.current?.("");
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className={`auth-turnstile${disabled ? " auth-turnstile--disabled" : ""}`} aria-busy={disabled || undefined}>
      <div ref={containerRef} />
      {error ? <p className="auth-turnstile__error" role="alert">{error}</p> : null}
    </div>
  );
});

export default TurnstileWidget;
