import { Building2, GraduationCap, MessageCircle, Users } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext.jsx";

const FEATURE_ICONS = [GraduationCap, Users, MessageCircle, Building2];

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

export default function NetworkSection() {
  const { t } = useLanguage();
  const metrics = t("network.metrics");
  const features = t("network.features");

  return (
    <section className="network-section" aria-labelledby="network-section-heading">
      <div className="network-section__inner">
        <Reveal className="network-section__intro">
          <h2 id="network-section-heading" className="network-section__headline">
            {t("network.headline").map((line) => (
              <span className="network-section__headline-line" key={line}>
                {line}
              </span>
            ))}
          </h2>
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

        <Reveal className="network-section__features-block">
          <h2 className="network-section__subheadline">{t("network.subheadline")}</h2>

          <ul className="network-section__features">
            {features.map((feature, index) => {
              const Icon = FEATURE_ICONS[index];
              return (
                <li key={feature.title}>
                  <Reveal className="network-section__feature" delay={index * 0.05}>
                    <span className="network-section__feature-icon" aria-hidden="true">
                      <Icon strokeWidth={1.5} />
                    </span>
                    <h3 className="network-section__feature-title">{feature.title}</h3>
                    <p className="network-section__feature-desc">{feature.description}</p>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
