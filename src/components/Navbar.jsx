import { ArrowUpRight, Search, User } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "./ui/button.jsx";

const leftLinks = [
  ["About", "#home"],
  ["Admissions Counseling", "#how-it-works"],
  ["Mentoring", "#mentorship"]
];

const rightLinks = [
  ["Pricing", "#pricing"],
  ["Roadmap", "#roadmap"],
  ["Dashboard", "#dashboard"]
];

export default function Navbar() {
  const { isAuthenticated, user, openSignIn, openAccount } = useAuth();
  const { scrollY } = useScroll();
  const logoOpacity = useTransform(scrollY, [0, 90, 170], [1, 0.55, 0.2]);
  const logoY = useTransform(scrollY, [0, 170], [0, -6]);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 py-5 md:px-8 lg:px-4">
      <div className="mx-auto grid max-w-[118rem] grid-cols-[1fr_auto] items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <nav className="hidden items-center gap-5 justify-self-start lg:flex" aria-label="Primary navigation left">
          {leftLinks.map(([label, href]) => (
            <a className="ivy-nav-link" href={href} key={label}>
              {label}
            </a>
          ))}
        </nav>

        <motion.a
          href="#home"
          className="font-heading text-4xl font-semibold uppercase leading-none tracking-[-0.08em] text-foreground md:text-5xl"
          aria-label="Prelude home"
          style={{ opacity: logoOpacity, y: logoY }}
        >
          Prelude
        </motion.a>

        <div className="flex items-center justify-end gap-4 justify-self-end">
          <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary navigation right">
            {rightLinks.map(([label, href]) => (
              <a className="ivy-nav-link" href={href} key={label}>
                {label}
              </a>
            ))}
          </nav>

          <a
            href="#preludematch"
            className="hidden text-foreground transition hover:text-primary md:inline-flex"
            aria-label="Search Prelude"
          >
            <Search className="h-6 w-6" aria-hidden="true" />
          </a>

          {isAuthenticated ? (
            <button
              type="button"
              onClick={openAccount}
              className="hidden items-center gap-2 border border-foreground/15 bg-background/70 px-4 py-2 font-body text-sm font-semibold text-foreground transition hover:bg-primary/20 sm:inline-flex"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span className="hidden xl:inline">{user.name.split(" ")[0]}</span>
              <span className="hidden rounded-full bg-primary/35 px-2 py-0.5 text-xs text-foreground xl:inline">{user.planName}</span>
            </button>
          ) : (
            <button type="button" onClick={openSignIn} className="ivy-nav-link hidden sm:inline-flex">
              Sign in
            </button>
          )}

          <Button href="#contact" className="rounded-none px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em]">
            Get Started
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
