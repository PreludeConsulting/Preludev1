import { useEffect, useState } from "react";
import { usePreludeMotion } from "../../context/MotionContext.jsx";
import { isMotionActive } from "./motionPolicy.js";

export function useViewportActivity(
  ref,
  { threshold = 0.01, rootMargin = "80px 0px" } = {}
) {
  const { documentVisible, reducedMotion } = usePreludeMotion();
  const [inViewport, setInViewport] = useState(
    () => typeof window !== "undefined" && typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    const node = ref?.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(Boolean(entry?.isIntersecting)),
      { threshold, rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin, threshold]);

  return {
    inViewport,
    active: isMotionActive({ documentVisible, inViewport, reducedMotion })
  };
}
