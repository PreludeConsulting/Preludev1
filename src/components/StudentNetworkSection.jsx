import { motion } from "motion/react";
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
  return (
    <section className="student-network-section" aria-labelledby="student-network-heading">
      <div className="student-network-section__inner">
        <Reveal className="student-network-section__intro">
          <h2 id="student-network-heading" className="student-network-section__headline">
            How Prelude&apos;s student network changes college guidance
          </h2>
          <p className="student-network-section__subheadline">
            Instead of relying on outdated consultants, students get direct access to modern college mentors who
            recently lived through the admissions process.
          </p>
        </Reveal>

        <div className="student-network-section__panels">
          <Reveal className="student-network-panel" delay={0.06}>
            <h3 className="student-network-panel__title">Real students. Real insight.</h3>
            <p className="student-network-panel__desc">
              Prelude connects high schoolers with college students who understand today&apos;s admissions process,
              campus culture, majors, essays, and student life firsthand.
            </p>
            <NetworkGraphic />
          </Reveal>

          <Reveal className="student-network-panel student-network-panel--chat" delay={0.12}>
            <h3 className="student-network-panel__title">Help when you need it</h3>
            <p className="student-network-panel__desc">
              Questions do not wait for the next scheduled meeting. Prelude mentors can step in, message back, and
              suggest a call when a student needs real support.
            </p>
            <AnimatedChatDemo />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
