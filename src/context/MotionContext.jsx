import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { loadPreferences } from "../dashboard/lib/dashboardPreferences.js";
import { detectMotionTier, MOTION_TIERS } from "../lib/motion/motionPolicy.js";

const MotionContext = createContext({
  reducedMotion: false,
  motionTier: MOTION_TIERS.full,
  documentVisible: true
});

function readDocumentVisible() {
  return typeof document === "undefined" ? true : document.visibilityState !== "hidden";
}

export function PreludeMotionProvider({ children }) {
  const osReducedMotion = useReducedMotion();
  const [prefReducedMotion, setPrefReducedMotion] = useState(
    () => loadPreferences().reduceMotion
  );
  const [documentVisible, setDocumentVisible] = useState(readDocumentVisible);

  useEffect(() => {
    function syncFromPreferences() {
      setPrefReducedMotion(loadPreferences().reduceMotion);
    }
    syncFromPreferences();
    window.addEventListener("prelude-preferences-changed", syncFromPreferences);
    return () => window.removeEventListener("prelude-preferences-changed", syncFromPreferences);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => setDocumentVisible(readDocumentVisible());
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const reducedMotion = Boolean(osReducedMotion || prefReducedMotion);
  const motionTier = useMemo(
    () => detectMotionTier({ reducedMotion }),
    [reducedMotion]
  );
  const value = useMemo(
    () => ({ reducedMotion, motionTier, documentVisible }),
    [documentVisible, motionTier, reducedMotion]
  );

  useEffect(() => {
    document.documentElement.dataset.motionTier = motionTier;
    document.documentElement.dataset.documentVisible = documentVisible ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.motionTier;
      delete document.documentElement.dataset.documentVisible;
    };
  }, [documentVisible, motionTier]);

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
