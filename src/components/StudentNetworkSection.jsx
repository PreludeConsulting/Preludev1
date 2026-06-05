import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext.jsx";
import AnimatedChatDemo from "./student-network/AnimatedChatDemo.jsx";
import NetworkGraphic from "./student-network/NetworkGraphic.jsx";

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

export default function StudentNetworkSection() {
  const { t } = useLanguage();

  return (
    <section className="student-network-section" aria-labelledby="student-network-heading">
      <div className="student-network-section__inner">
        <Reveal className="student-network-section__intro">
          <h2 id="student-network-heading" className="student-network-section__headline">
            A whole team helping you succeed.
          </h2>
        </Reveal>

        <div className="student-network-section__panels">
          <Reveal className="student-network-panel student-network-panel--network" delay={0.06}>
            <h3 className="student-network-panel__title">Learn from different experiences</h3>
            <p className="student-network-panel__caption">
              Talk to students who understand exactly what you&apos;re going through.
            </p>
            <NetworkGraphic />
          </Reveal>

          <Reveal className="student-network-panel student-network-panel--chat" delay={0.12}>
            <h3 className="student-network-panel__title">
              Need help now? Your mentor is always within reach
            </h3>
            <AnimatedChatDemo />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
