import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button.jsx";

export default function Hero() {
  return (
    <section id="home" className="ivy-hero relative flex min-h-screen items-center overflow-hidden px-5 pb-14 pt-28 md:px-10 md:pb-20 md:pt-32 lg:px-16">
      <div className="ivy-hero__wash" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center text-center">
        <motion.p
          className="font-body text-sm font-semibold text-foreground md:text-base"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          Peer-Powered College Admissions Counseling
        </motion.p>

        <motion.h1
          className="ivy-display mt-16 max-w-4xl text-[4.5rem] font-extrabold uppercase leading-[0.84] tracking-[-0.045em] text-foreground md:mt-20 md:text-[7.75rem] lg:text-[8.75rem]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.6, ease: "easeOut" }}
        >
          Prelude: The modern college mentor network
        </motion.h1>

        <motion.p
          className="mt-8 max-w-md font-serif text-base leading-6 text-foreground md:text-lg md:leading-7"
          initial={{ filter: "blur(10px)", opacity: 0, y: 18 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.6, ease: "easeOut" }}
        >
          At Prelude, students work with near-peer mentors, personalized strategy tools, and practical financial
          guidance to build standout college applications with confidence.
        </motion.p>

        <motion.div
          className="mt-14 flex flex-col items-center gap-6"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.5, ease: "easeOut" }}
        >
          <span className="h-24 w-px bg-foreground/55" aria-hidden="true" />
          <Button href="#preludematch" className="rounded-none px-7 py-4 text-xs font-extrabold uppercase tracking-[0.18em]">
            Let&apos;s get started
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
