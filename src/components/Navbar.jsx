import { ArrowUpRight, Menu, Search, User, X } from "lucide-react";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { NAV_LINKS } from "../data/navLinks.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Button } from "./ui/button.jsx";
import PreludeLogo from "./PreludeLogo.jsx";
import SiteSearchPanel from "./SiteSearchPanel.jsx";

export default function Navbar() {
  const { isAuthenticated, user, openSignIn, openAccount } = useAuth();
  const { t } = useLanguage();
  const { scrollY } = useScroll();
  const barOpacity = useTransform(scrollY, [0, 48, 120], [0, 0.78, 0.96]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const toggleSearch = () => {
    setMobileOpen(false);
    setSearchOpen((open) => !open);
  };

  const toggleMobile = () => {
    setSearchOpen(false);
    setMobileOpen((open) => !open);
  };

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeMobile();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, closeMobile]);

  return (
    <header className="nav-bar fixed left-0 right-0 top-0 z-50 px-4 py-5 md:px-8 lg:px-4">
      <motion.div
        aria-hidden="true"
        className="nav-bar__backdrop absolute inset-0 border-b border-foreground/8"
        style={{ opacity: barOpacity }}
      />
      <div className="nav-bar__content relative z-10 mx-auto max-w-[118rem]">
        <div className="nav-bar__row flex items-center gap-4">
          <a href="#home" className="nav-bar__logo-link shrink-0" aria-label={t("nav.homeLabel")}>
            <PreludeLogo className="prelude-logo--nav" />
          </a>

          <nav className="nav-bar__center hidden items-center gap-5 lg:flex" aria-label={t("nav.primaryLabel")}>
            {NAV_LINKS.map(({ labelKey, href }) => (
              <a className="ivy-nav-link" href={href} key={labelKey}>
                {t(labelKey)}
              </a>
            ))}
          </nav>

          <div className="nav-bar__actions ml-auto flex items-center justify-end gap-3 sm:gap-4">
            <button
              type="button"
              onClick={toggleSearch}
              className="nav-bar__search-btn inline-flex text-foreground transition hover:text-primary"
              aria-label={t("nav.searchLabel")}
              aria-expanded={searchOpen}
              aria-controls="site-search-panel"
            >
              <Search className="h-6 w-6" aria-hidden="true" />
            </button>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={openAccount}
                className="hidden items-center gap-2 border border-primary/20 bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 sm:inline-flex"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                <span className="hidden xl:inline">{user.name.split(" ")[0]}</span>
                <span className="hidden rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs text-primary-foreground xl:inline">
                  {user.planName}
                </span>
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

            <button
              type="button"
              className="nav-bar__menu-btn inline-flex rounded-full p-2 text-foreground transition hover:bg-foreground/[0.05] lg:hidden"
              onClick={toggleMobile}
              aria-label={mobileOpen ? t("nav.menuCloseLabel") : t("nav.menuOpenLabel")}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <div id="site-search-panel">
          <SiteSearchPanel open={searchOpen} onClose={closeSearch} />
        </div>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.nav
              className="nav-bar__mobile-menu paper-card lg:hidden"
              aria-label={t("nav.primaryLabel")}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {NAV_LINKS.map(({ labelKey, href }) => (
                <a className="nav-bar__mobile-link ivy-nav-link" href={href} key={labelKey} onClick={closeMobile}>
                  {t(labelKey)}
                </a>
              ))}
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
