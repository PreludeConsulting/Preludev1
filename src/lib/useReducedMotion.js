import { useEffect, useState } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
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
