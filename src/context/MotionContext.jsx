import { createContext, useContext, useMemo } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";

const MotionContext = createContext({ reducedMotion: false });

export function PreludeMotionProvider({ children }) {
  const reducedMotion = useReducedMotion();
  const value = useMemo(() => ({ reducedMotion: Boolean(reducedMotion) }), [reducedMotion]);

  return (
    <MotionContext.Provider value={value}>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
        {children}
      </MotionConfig>
    </MotionContext.Provider>
  );
}

export function usePreludeMotion() {
  return useContext(MotionContext);
}
