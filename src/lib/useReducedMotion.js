import { usePreludeMotion } from "../context/MotionContext.jsx";

export function useReducedMotion() {
  return usePreludeMotion().reducedMotion;
}

export const heroMotion = {
  float: (reduced) =>
    reduced
      ? {}
      : {
          y: [0, -5, 0],
          transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
        },
  cardFloat: (reduced) =>
    reduced
      ? {}
      : {
          y: [0, -3, 0],
          transition: { duration: 7, repeat: Infinity, ease: "easeInOut" }
        }
};
