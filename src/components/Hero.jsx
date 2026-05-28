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
    <section id="home" className="relative overflow-hidden px-4 pb-12 pt-28 md:px-8 md:pb-16 md:pt-32 lg:px-16">
      <div className="hero-waves" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="hero-open-stage mx-auto max-w-6xl text-center">
          <motion.p
            className="mx-auto inline-flex rounded-full border border-foreground/15 bg-background/55 px-4 py-1.5 font-body text-xs font-medium tracking-wide text-foreground/80 shadow-sm backdrop-blur"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Introducing PreludeMatch — mentorship that moves at student speed
          </motion.p>

          <motion.h1
            className="display-heading mx-auto mt-7 max-w-5xl text-6xl md:text-8xl lg:text-[7.25rem]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            Build better applications, faster.
          </motion.h1>

          <motion.p
            className="mx-auto mt-6 max-w-xl font-body text-sm font-light leading-7 text-muted-foreground md:text-base"
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

        <div className="hero-gallery mt-10 grid auto-rows-[15rem] gap-4 md:grid-cols-6 md:auto-rows-[12rem] lg:auto-rows-[14rem]">
          {heroTiles.map((tile, index) => (
            <motion.article
              key={tile.title}
              className={`hero-tile group relative overflow-hidden rounded-[1.75rem] ${
                index === 0
                  ? "md:col-span-3 md:row-span-2"
                  : index === 2
                    ? "md:col-span-3"
                    : "md:col-span-3 lg:col-span-3"
              }`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + index * 0.1, duration: 0.45, ease: "easeOut" }}
            >
              <img
                src={tile.image}
                alt={tile.title}
                className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.045] group-hover:brightness-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/10 to-background/5" aria-hidden="true" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-left text-primary-foreground md:p-6">
                <h2 className="subheading text-3xl md:text-4xl">{tile.title}</h2>
                <p className="mt-2 max-w-sm font-body text-xs leading-5 text-primary-foreground/80 md:text-sm">{tile.text}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
