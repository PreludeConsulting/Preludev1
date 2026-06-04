import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "../lib/useReducedMotion.js";

const INTRO_KEY = "prelude-hero-opening-seen";

const PHASE = {
  SPLASH: "splash",
  NETWORK: "network",
  TRANSITION: "transition",
  SETTLED: "settled"
};

const HeroIntroContext = createContext({
  phase: PHASE.SETTLED,
  introReady: true,
  showOverlay: false,
  reducedMotion: false
});

export function useHeroIntroContext() {
  return useContext(HeroIntroContext);
}

function readSkipIntro() {
  try {
    return sessionStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

export function HeroIntroProvider({ children }) {
  const reducedMotion = useReducedMotion();
  const skipIntro = reducedMotion || readSkipIntro();
  const [phase, setPhase] = useState(skipIntro ? PHASE.SETTLED : PHASE.SPLASH);

  useEffect(() => {
    if (skipIntro) return;

    const t1 = setTimeout(() => setPhase(PHASE.NETWORK), 1100);
    const t2 = setTimeout(() => setPhase(PHASE.TRANSITION), 2100);
    const t3 = setTimeout(() => {
      setPhase(PHASE.SETTLED);
      try {
        sessionStorage.setItem(INTRO_KEY, "1");
      } catch {
        /* ignore */
      }
    }, 3400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [skipIntro]);

  const value = useMemo(
    () => ({
      phase,
      introReady: phase === PHASE.TRANSITION || phase === PHASE.SETTLED,
      showOverlay: phase === PHASE.SPLASH || phase === PHASE.NETWORK,
      reducedMotion
    }),
    [phase, reducedMotion]
  );

  return <HeroIntroContext.Provider value={value}>{children}</HeroIntroContext.Provider>;
}

export { PHASE };
