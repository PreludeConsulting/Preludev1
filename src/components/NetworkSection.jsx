import { useRef } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useViewportActivity } from "../lib/motion/useViewportActivity.js";

function Reveal({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function HeadlineLine({ line, accent }) {
  if (!accent || !line.includes(accent)) {
    return <span className="network-section__headline-line">{line}</span>;
  }

  const [before, after] = line.split(accent);
  return (
    <span className="network-section__headline-line">
      {before}
      <span className="network-section__headline-accent">{accent}</span>
      {after}
    </span>
  );
}

export default function NetworkSection() {
  const { t } = useLanguage();
  const sectionRef = useRef(null);
  const { active } = useViewportActivity(sectionRef, { rootMargin: "120px 0px" });
  const metrics = t("network.metrics");
  const headlineAccent = t("network.headlineAccent");

  return (
    <section
      ref={sectionRef}
      id="mentorship"
      data-section-nav="mentorship"
      className="network-section"
      data-motion-active={active ? "true" : "false"}
      aria-labelledby="network-section-heading"
    >
      <div className="network-section__inner">
        <Reveal className="network-section__intro">
          <p className="network-section__badge">
            <span className="network-section__badge-dot" aria-hidden="true" />
            {t("network.badge")}
          </p>
          <h2 id="network-section-heading" className="network-section__headline">
            {t("network.headline").map((line) => (
              <HeadlineLine key={line} line={line} accent={headlineAccent} />
            ))}
          </h2>
          <p className="network-section__subtitle">{t("network.subtitle")}</p>
        </Reveal>

        <ul className="network-section__stats">
          {metrics.map((row, index) => (
            <li className="network-section__stat" key={row.title}>
              <Reveal className="network-section__stat-inner" delay={index * 0.06}>
                <p className="network-section__stat-value">{row.value}</p>
                <div className="network-section__stat-copy">
                  <h3 className="network-section__stat-title">{row.title}</h3>
                  <p className="network-section__stat-desc">{row.description}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
