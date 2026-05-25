import { useRef } from "react";
import { motion, useInView } from "motion/react";

export default function BlurText({
  text,
  by = "word",
  delay = 200,
  className = "",
  once = true,
  as: Tag = "span"
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: "-10% 0px -10% 0px" });
  const parts = by === "letter" ? Array.from(text) : text.split(" ");

  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {parts.map((part, index) => {
        const needsWordGap = by === "word" && index < parts.length - 1;
        return (
          <span key={`${part}-${index}`}>
          <motion.span
            aria-hidden="true"
            className="inline-block will-change-transform"
            initial={{ filter: "blur(10px)", opacity: 0, y: 50 }}
            animate={
              inView
                ? {
                    filter: ["blur(10px)", "blur(5px)", "blur(0px)"],
                    opacity: [0, 0.5, 1],
                    y: [50, -5, 0]
                  }
                : undefined
            }
            transition={{
              duration: 0.7,
              delay: (index * delay) / 1000,
              times: [0, 0.5, 1],
              ease: "easeOut"
            }}
          >
            {part === " " ? "\u00A0" : part}
          </motion.span>
          {needsWordGap ? " " : null}
          </span>
        );
      })}
    </Tag>
  );
}
