import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { loadPreferences } from "../dashboard/lib/dashboardPreferences.js";

const MotionContext = createContext({ reducedMotion: false });

export function PreludeMotionProvider({ children }) {
  const osReducedMotion = useReducedMotion();
  const [prefReducedMotion, setPrefReducedMotion] = useState(
    () => loadPreferences().reduceMotion
  );

  useEffect(() => {
    function syncFromPreferences() {
      setPrefReducedMotion(loadPreferences().reduceMotion);
    }
    syncFromPreferences();
    window.addEventListener("prelude-preferences-changed", syncFromPreferences);
    return () => window.removeEventListener("prelude-preferences-changed", syncFromPreferences);
  }, []);

  const reducedMotion = Boolean(osReducedMotion || prefReducedMotion);
  const value = useMemo(() => ({ reducedMotion }), [reducedMotion]);

  return (
    <MotionContext.Provider value={value}>
      <MotionConfig reducedMotion={reducedMotion ? "always" : "user"} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
        {children}
      </MotionConfig>
    </MotionContext.Provider>
  );
}

export function usePreludeMotion() {
  return useContext(MotionContext);
}
