import { ArrowUpRight, Search, User } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Button } from "./ui/button.jsx";
import PreludeLogo from "./PreludeLogo.jsx";

const links = [
  ["nav.links.about", "#home"],
  ["nav.links.admissions", "#how-it-works"],
  ["nav.links.mentoring", "#mentorship"],
  ["nav.links.pricing", "#pricing"],
  ["nav.links.roadmap", "#roadmap"],
  ["nav.links.dashboard", "#dashboard"]
];

export default function Navbar() {
  const { isAuthenticated, user, openSignIn, openAccount } = useAuth();
  const { t } = useLanguage();
  const { scrollY } = useScroll();
  const barOpacity = useTransform(scrollY, [0, 48, 120], [0, 0.78, 0.96]);

  return (
    <header className="nav-bar fixed left-0 right-0 top-0 z-50 px-4 py-5 md:px-8 lg:px-4">
      <motion.div
        aria-hidden="true"
        className="nav-bar__backdrop absolute inset-0 border-b border-foreground/8"
        style={{ opacity: barOpacity }}
      />
      <div className="nav-bar__content relative z-10 mx-auto flex max-w-[118rem] items-center justify-between gap-6">
        <a href="#home" className="nav-bar__logo-link" aria-label={t("nav.homeLabel")}>
          <PreludeLogo className="prelude-logo--nav" />
        </a>

        <div className="flex items-center justify-end gap-4">
          <nav className="hidden items-center gap-5 lg:flex" aria-label={t("nav.primaryLabel")}>
            {links.map(([labelKey, href]) => (
              <a className="ivy-nav-link" href={href} key={labelKey}>
                {t(labelKey)}
              </a>
            ))}
          </nav>

          <a
            href="#preludematch"
            className="hidden text-foreground transition hover:text-primary md:inline-flex"
            aria-label={t("nav.searchLabel")}
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
              {t("nav.signIn")}
            </button>
          )}

          <Button href="#contact" className="rounded-full px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em]">
            {t("nav.getStarted")}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
