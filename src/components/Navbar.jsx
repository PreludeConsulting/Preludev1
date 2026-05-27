import { ArrowUpRight } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { Button } from "./ui/button.jsx";

const links = [
  ["Home", "#home"],
  ["Mentorship", "#mentorship"],
  ["Pricing", "#pricing"],
  ["Roadmap", "#roadmap"]
];

export default function Navbar() {
  const { scrollY } = useScroll();
  const logoOpacity = useTransform(scrollY, [0, 90, 170], [1, 0.35, 0]);
  const logoY = useTransform(scrollY, [0, 170], [0, -8]);

  return (
    <header className="fixed left-0 right-0 top-4 z-50 px-4 md:px-8 lg:px-16">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <motion.a
          href="#home"
          className="font-heading text-3xl tracking-tight text-white"
          aria-label="Prelude home"
          style={{ opacity: logoOpacity, y: logoY }}
        >
          Prelude
        </motion.a>

        <nav className="hidden rounded-full border border-white/15 bg-black/40 px-2 py-1 backdrop-blur md:flex" aria-label="Primary navigation">
          {links.map(([label, href]) => (
            <a
              className="rounded-full px-3 py-2 font-body text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              href={href}
              key={label}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="justify-self-end">
          <Button href="#contact" className="border-white/15 bg-white text-black hover:bg-white/90 px-4 py-2">
            Get Started
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
