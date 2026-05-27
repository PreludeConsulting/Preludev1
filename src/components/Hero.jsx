import { ArrowUpRight, Play } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button.jsx";

const mediaBase = import.meta.env.BASE_URL;
const heroTiles = [
  {
    image: `${mediaBase}media/roadmap-dashboard.png`,
    title: "Roadmap",
    text: "Guided milestones and deadline clarity in one view."
  },
  {
    image: `${mediaBase}media/mentor-lounge.png`,
    title: "Mentorship",
    text: "Pair with students who already attend your target schools."
  },
  {
    image: `${mediaBase}media/impact-desk.png`,
    title: "Application Studio",
    text: "Essays, activities, and financial planning that stay connected."
  },
  {
    image: `${mediaBase}media/mentor-lounge-loop.gif`,
    title: "Momentum",
    text: "Daily progress signals that keep students and families aligned."
  }
];

export default function Hero() {
  return (
    <section id="home" className="relative overflow-hidden px-4 pb-10 pt-28 md:px-8 md:pt-32 lg:px-16">
      <div className="hero-waves" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="hero-dark-stage mx-auto max-w-5xl rounded-[2rem] px-6 py-14 text-center md:px-12 md:py-16">
          <motion.p
            className="mx-auto inline-flex rounded-full border border-foreground/15 bg-background/55 px-4 py-1.5 font-body text-xs font-medium tracking-wide text-foreground/80"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Introducing PreludeMatch — mentorship that moves at student speed
          </motion.p>

          <motion.h1
            className="mx-auto mt-6 max-w-3xl font-heading text-5xl leading-[0.9] tracking-[-1.5px] text-foreground md:text-7xl lg:text-[5.25rem]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            Build better applications, faster.
          </motion.h1>

          <motion.p
            className="mx-auto mt-6 max-w-2xl font-body text-base font-light leading-8 text-muted-foreground md:text-lg"
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.6, ease: "easeOut" }}
          >
            Prelude combines peer mentorship, personalized strategy, and financial guidance so students can shape
            standout college stories with confidence and consistency.
          </motion.p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="#preludematch">
              Start PreludeMatch
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
              className="hero-tile overflow-hidden rounded-2xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + index * 0.1, duration: 0.45, ease: "easeOut" }}
            >
              <div className="media-frame h-40">
                <img src={tile.image} alt={tile.title} className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <h2 className="font-heading text-2xl leading-none text-foreground">{tile.title}</h2>
                <p className="mt-2 font-body text-xs leading-5 text-muted-foreground">{tile.text}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
