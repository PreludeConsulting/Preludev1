import { Building2, GraduationCap, MessageCircle, Users } from "lucide-react";
import { motion } from "motion/react";
import NetworkMessagesVisual from "./NetworkMessagesVisual.jsx";

const METRIC_ROWS = [
  {
    value: "25+",
    title: "Universities",
    description: "Represented across the Prelude mentor network."
  },
  {
    value: "<5 hr",
    title: "Average mentor response",
    description: "Get timely answers, feedback, and guidance when questions come up."
  },
  {
    value: "50+",
    title: "Unique perspectives",
    description: "Learn from students with different majors, backgrounds, and admissions journeys."
  }
];

const FEATURE_COLUMNS = [
  {
    icon: GraduationCap,
    title: "Top university students",
    description: "Learn directly from students at leading universities."
  },
  {
    icon: Users,
    title: "Diverse insights",
    description: "Get advice from mentors with different goals, majors, and experiences."
  },
  {
    icon: MessageCircle,
    title: "Direct communication",
    description: "Message mentors, ask questions, and receive personalized feedback."
  },
  {
    icon: Building2,
    title: "School-specific guidance",
    description: "Understand what actually worked for students at the colleges you're aiming for."
  }
];

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
  return (
    <section className="network-section" aria-labelledby="network-section-heading">
      <div className="network-section__inner">
        <div className="network-section__split">
          <Reveal className="network-section__visual-col">
            <NetworkMessagesVisual />
          </Reveal>

          <div className="network-section__content-col">
            <Reveal>
              <h2 id="network-section-heading" className="network-section__headline">
                Access a network of students from top universities
              </h2>
            </Reveal>

            <ul className="network-section__metrics">
              {METRIC_ROWS.map((row, index) => (
                <li
                  className={`network-section__metric${index < METRIC_ROWS.length - 1 ? " network-section__metric--divided" : ""}`}
                  key={row.title}
                >
                  <Reveal className="network-section__metric-inner" delay={index * 0.06}>
                    <p className="network-section__metric-value">{row.value}</p>
                    <div className="network-section__metric-copy">
                      <h3 className="network-section__metric-title">{row.title}</h3>
                      <p className="network-section__metric-desc">{row.description}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Reveal className="network-section__features-block">
          <h2 className="network-section__subheadline">Built on a network, not a single advisor</h2>

          <ul className="network-section__features">
            {FEATURE_COLUMNS.map((feature, index) => {
              const Icon = feature.icon;
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
