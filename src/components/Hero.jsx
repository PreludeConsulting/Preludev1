import { ArrowUpRight, Play } from "lucide-react";
import { motion } from "motion/react";
import BlurText from "./BlurText.jsx";
import { Button } from "./ui/button.jsx";

const mediaBase = import.meta.env.BASE_URL;
const heroTiles = [
  {
    image: `${mediaBase}media/roadmap-dashboard.png`,
    title: "Roadmap",
    text: "Milestones and deadlines students can actually follow."
  },
  {
    image: `${mediaBase}media/mentor-lounge.png`,
    title: "Mentorship",
    text: "1-on-1 support from students at your target schools."
  },
  {
    image: `${mediaBase}media/impact-desk.png`,
    title: "Strategy",
    text: "Narrative, essays, and application planning in one place."
  },
  {
    image: `${mediaBase}media/mentor-lounge-loop.gif`,
    title: "Momentum",
    text: "Stay consistent with direct messaging and progress tracking."
  }
];

export default function Hero() {
  return (
    <section id="home" className="relative overflow-hidden px-4 pb-8 pt-28 md:px-8 md:pt-32 lg:px-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,hsl(var(--accent)/0.18),transparent_30%),radial-gradient(circle_at_88%_24%,hsl(var(--primary)/0.16),transparent_32%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.65))]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="hero-stage paper-card mx-auto max-w-4xl rounded-[2.25rem] px-6 py-14 text-center md:px-12 md:py-16">
          <div className="mx-auto inline-flex rounded-full border border-foreground/15 bg-background/55 px-4 py-1.5 font-body text-xs font-medium tracking-wide text-muted-foreground">
            Introducing PreludeMatch — find your mentor faster
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl font-heading text-5xl italic leading-[0.88] tracking-[-2px] text-foreground md:text-7xl lg:text-[5.3rem]">
            <BlurText text="Build your" delay={90} /> <BlurText text="college story" delay={90} />{" "}
            <span className="brush-accent">
              <BlurText text="with confidence" delay={90} />
            </span>
          </h1>
          <motion.p
            className="mx-auto mt-6 max-w-2xl font-body text-base font-light leading-8 text-muted-foreground md:text-lg"
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
          >
            Prelude helps students shape standout applications with peer mentorship, identity-first advising, and clear
            financial planning — all in one personalized roadmap.
          </motion.p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="#mentorship">
              Start for Free
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button href="#how-it-works" variant="secondary">
              <Play className="h-4 w-4" aria-hidden="true" />
              See How It Works
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {heroTiles.map((tile, index) => (
            <motion.article
              key={tile.title}
              className="paper-card overflow-hidden rounded-2xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + index * 0.1, duration: 0.45, ease: "easeOut" }}
            >
              <div className="media-frame h-40">
                <img src={tile.image} alt={tile.title} className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <h2 className="font-heading text-2xl italic leading-none">{tile.title}</h2>
                <p className="mt-2 font-body text-xs leading-5 text-muted-foreground">{tile.text}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
