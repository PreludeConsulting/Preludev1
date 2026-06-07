import { motion } from "motion/react";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useReducedMotion } from "../../lib/useReducedMotion.js";

const line = {
  hidden: { opacity: 0, y: 14 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.06 + i * 0.06, duration: 0.45, ease: "easeOut" }
  })
};

export function HeroHeadline() {
  const reducedMotion = useReducedMotion();
  const { t } = useLanguage();
  const [lineOne, lineTwo, lineThree] = t("hero.headline");
  const lines = [
    { text: lineOne, accent: false },
    { text: lineTwo, accent: false },
    { text: lineThree, accent: true }
  ].filter(({ text }) => text);

  if (reducedMotion) {
    return (
      <h1 className="shopify-hero__headline">
        {lines.map(({ text, accent }) => (
          <span
            key={text}
            className={
              accent
                ? "shopify-hero__headline-accent hero-headline-shimmer shopify-hero__headline-line"
                : "shopify-hero__headline-line"
            }
          >
            {text}
          </span>
        ))}
      </h1>
    );
  }

  return (
    <motion.h1 className="shopify-hero__headline" initial="hidden" animate="show">
      {lines.map(({ text, accent }, index) => (
        <motion.span
          key={text}
          className={
            accent
              ? "shopify-hero__headline-accent hero-headline-shimmer shopify-hero__headline-line block"
              : "shopify-hero__headline-line block"
          }
          custom={index}
          variants={line}
        >
          {text}
        </motion.span>
      ))}
    </motion.h1>
  );
}

export function HeroVisualAnimation({ children }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className="shopify-hero__visual"
      initial={reducedMotion ? false : { opacity: 0, x: 16, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: 0.12, duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function HeroSubcopy({ children }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <p className="shopify-hero__subcopy">{children}</p>;

  return (
    <motion.p
      className="shopify-hero__subcopy"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.4 }}
    >
      {children}
    </motion.p>
  );
}

export function HeroFormAnimation({ children }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return children;

  return (
    <motion.div
      className="shopify-hero__form-wrap"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}

export function HeroNote({ children }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <p className="shopify-hero__note">{children}</p>;

  return (
    <motion.p
      className="shopify-hero__note"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.34, duration: 0.4 }}
    >
      {children}
    </motion.p>
  );
}
