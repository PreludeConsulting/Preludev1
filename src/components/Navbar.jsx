import { ArrowUpRight, User } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "./ui/button.jsx";

const links = [
  ["Home", "#home"],
  ["PreludeMatch", "#preludematch"],
  ["Mentorship", "#mentorship"],
  ["Pricing", "#pricing"],
  ["Roadmap", "#roadmap"],
  ["Dashboard", "#dashboard"]
];

export default function Navbar() {
  const { isAuthenticated, user, openSignIn, openAccount } = useAuth();
  const { scrollY } = useScroll();
  const logoOpacity = useTransform(scrollY, [0, 90, 170], [1, 0.35, 0]);
  const logoY = useTransform(scrollY, [0, 170], [0, -8]);

  return (
    <header className="fixed left-0 right-0 top-4 z-50 px-4 md:px-8 lg:px-16">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <motion.a
          href="#home"
          className="display-heading text-3xl"
          aria-label="Prelude home"
          style={{ opacity: logoOpacity, y: logoY }}
        >
          Prelude
        </motion.a>

        <nav className="paper-card hidden rounded-full px-2 py-1 md:flex" aria-label="Primary navigation">
          {links.map(([label, href]) => (
            <a
              className="rounded-full px-3 py-2 font-body text-sm font-medium text-foreground/80 transition hover:bg-foreground/[0.04] hover:text-foreground"
              href={href}
              key={label}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2 justify-self-end">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={openAccount}
              className="paper-card inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm font-medium text-foreground transition hover:bg-foreground/[0.04]"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{user.planName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openSignIn}
              className="hidden rounded-full px-4 py-2 font-body text-sm font-medium text-foreground/80 transition hover:bg-foreground/[0.04] sm:inline"
            >
              Sign in
            </button>
          )}
          <Button href="#contact" className="px-4 py-2">
            Get Started
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
