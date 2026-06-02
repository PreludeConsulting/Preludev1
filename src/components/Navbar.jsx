import { ArrowUpRight, Search, User } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "./ui/button.jsx";

const links = [
  ["About", "#home"],
  ["Admissions Counseling", "#how-it-works"],
  ["Mentoring", "#mentorship"],
  ["Pricing", "#pricing"],
  ["Roadmap", "#roadmap"],
  ["Dashboard", "#dashboard"]
];

export default function Navbar() {
  const { isAuthenticated, user, openSignIn, openAccount } = useAuth();
  const { scrollY } = useScroll();
  const logoOpacity = useTransform(scrollY, [0, 90, 170], [1, 0.55, 0.2]);
  const logoY = useTransform(scrollY, [0, 170], [0, -6]);
  const barOpacity = useTransform(scrollY, [0, 48, 120], [0, 0.78, 0.96]);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 py-5 md:px-8 lg:px-4">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 border-b border-foreground/10 bg-background/95 shadow-[0_18px_55px_rgba(34,36,118,0.10)] backdrop-blur-xl"
        style={{ opacity: barOpacity }}
      />
      <div className="relative z-10 mx-auto flex max-w-[118rem] items-center justify-between gap-6">
        <motion.a
          href="#home"
          className="border-2 border-primary bg-background/80 px-3 py-2 font-heading text-3xl font-semibold uppercase leading-none tracking-[-0.08em] text-foreground shadow-[6px_6px_0_0_#786aff] backdrop-blur md:text-4xl"
          aria-label="Prelude home"
          style={{ opacity: logoOpacity, y: logoY }}
        >
          Prelude
        </motion.a>

        <div className="flex items-center justify-end gap-4">
          <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary navigation">
            {links.map(([label, href]) => (
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
              className="hidden items-center gap-2 border border-primary/20 bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 sm:inline-flex"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span className="hidden xl:inline">{user.name.split(" ")[0]}</span>
              <span className="hidden rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs text-primary-foreground xl:inline">{user.planName}</span>
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
