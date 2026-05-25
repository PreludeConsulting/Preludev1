import { ArrowUpRight, Play } from "lucide-react";
import { motion } from "motion/react";
import BlurText from "./BlurText.jsx";
import { Button } from "./ui/button.jsx";

const mediaBase = import.meta.env.BASE_URL;
const mentorImage = `${mediaBase}media/mentor-lounge.png`;
const trustLabels = [
  "Dream-school mentors",
  "Essay clarity",
  "Identity-first strategy",
  "Scholarship planning",
  "FAFSA guidance",
  "CSS Profile support",
  "Target-school insight",
  "Parent visibility",
  "Direct messaging",
  "Application momentum",
  "Roadmap milestones",
  "Interview confidence"
];

export default function Hero() {
  return (
    <section id="home" className="relative min-h-[760px] overflow-hidden pt-24 md:pt-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,hsl(var(--accent)/0.23),transparent_26%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)))]" />
      <div className="absolute -right-36 top-16 h-[34rem] w-[48rem] rotate-[-12deg] rounded-[48%] bg-primary/15 blur-3xl" aria-hidden="true" />
      <div className="absolute left-8 top-40 h-56 w-28 rotate-12 rounded-full bg-accent/20 blur-2xl md:left-28" aria-hidden="true" />
      <div className="absolute bottom-16 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-[50%] bg-secondary/35 blur-3xl" aria-hidden="true" />
      <div className="absolute inset-y-0 left-[18%] hidden w-px vertical-rule md:block" aria-hidden="true" />
      <div className="absolute inset-y-0 right-[14%] hidden w-px vertical-rule lg:block" aria-hidden="true" />

      <div className="section-shell relative grid min-h-[620px] items-center gap-10 lg:grid-cols-[1fr_0.68fr] lg:gap-14">
        <div className="max-w-4xl">
          <div className="section-badge mb-6">Peer-powered college consulting.</div>
          <h1 className="max-w-3xl font-heading text-6xl italic leading-[0.85] tracking-[-3px] text-foreground md:text-7xl lg:text-[5.5rem]">
            <BlurText text="Your college" delay={105} />{" "}
            <span className="brush-accent">
              <BlurText text="story" delay={105} />
            </span>{" "}
            <BlurText text="starts here." delay={105} />
          </h1>
          <motion.p
            className="mt-6 max-w-2xl font-body text-base font-light leading-8 text-muted-foreground md:text-lg"
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
          >
            Start the college journey with clarity, confidence, and purpose. Prelude connects students with relatable
            mentors, personalized admissions support, and practical financial guidance - helping them discover their
            story and build the foundation for the future they want.
          </motion.p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="#mentorship">
              Find Your Mentor
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button href="#how-it-works" variant="secondary">
              <Play className="h-4 w-4" aria-hidden="true" />
              See How It Works
            </Button>
          </div>

          <div className="mt-10 max-w-3xl">
            <p className="mb-4 font-body text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Built for students aiming higher
            </p>
            <div className="paper-card marquee-card rounded-2xl py-3">
              <div className="marquee-track">
                {[...trustLabels, ...trustLabels].map((label, index) => (
                  <span
                    className="rounded-full border border-foreground/10 bg-background/45 px-3 py-1.5 font-body text-xs text-foreground/75"
                    key={`${label}-${index}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <motion.aside
          className="paper-card rounded-[2rem] p-6 md:p-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.7, ease: "easeOut" }}
          aria-label="Prelude mission statement"
        >
          <div className="media-frame mb-8 h-52 rounded-[1.5rem] border border-foreground/10">
            <img
              src={mentorImage}
              alt="A calm mentorship conversation in a Japanese-inspired study lounge"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="font-heading text-3xl italic leading-tight text-foreground md:text-4xl">
            A beginning that sets the tone for what follows.
          </p>
          <p className="mt-5 body-copy">
            Prelude helps students discover their unique story, prepare with intention, and move toward college with
            mentorship that feels human, current, and clear.
          </p>
        </motion.aside>
      </div>
    </section>
  );
}
