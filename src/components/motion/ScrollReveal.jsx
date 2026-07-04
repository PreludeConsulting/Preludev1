import { useRef } from "react";
import { useScrollEnterReveal } from "../../lib/useAnimeScrollAnimation.js";

/**
 * Tier 1 calm scroll reveal — shared fade-up on enter for homepage sections.
 */
export default function ScrollReveal({ children, className = "", delay = 0, as: Tag = "div", id }) {
  const ref = useRef(null);
  useScrollEnterReveal(ref, { delay: delay * 1000 });

  return (
    <Tag ref={ref} className={className} id={id}>
      {children}
    </Tag>
  );
}
