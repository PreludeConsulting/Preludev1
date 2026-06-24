import { createContext, useCallback, useContext, useMemo, useState } from "react";
import CoinBurst from "./CoinBurst.jsx";

const FeedbackContext = createContext(null);

export function InteractionFeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [burst, setBurst] = useState(null);
  const [highlightEventId, setHighlightEventId] = useState(null);

  const showToast = useCallback((message, variant = "success") => {
    const id = `if-toast-${Date.now()}`;
    setToasts((t) => [...t, { id, message, variant }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const triggerCoinBurst = useCallback((amount, origin = null) => {
    setBurst({ id: Date.now(), amount, origin });
  }, []);

  const clearBurst = useCallback(() => setBurst(null), []);

  const flashEvent = useCallback((eventId) => {
    if (!eventId) return;
    setHighlightEventId(eventId);
    window.setTimeout(() => setHighlightEventId(null), 1400);
  }, []);

  const value = useMemo(
    () => ({ showToast, triggerCoinBurst, flashEvent, highlightEventId }),
    [showToast, triggerCoinBurst, flashEvent, highlightEventId]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="prelude-feedback-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`prelude-feedback-toast prelude-feedback-toast--${t.variant}`}>
            {t.message}
          </div>
        ))}
      </div>
      <CoinBurst active={Boolean(burst)} amount={burst?.amount} origin={burst?.origin} onDone={clearBurst} />
    </FeedbackContext.Provider>
  );
}

export function useInteractionFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    return {
      showToast: () => {},
      triggerCoinBurst: () => {},
      flashEvent: () => {},
      highlightEventId: null
    };
  }
  return ctx;
}
