import { ArrowUpRight, Menu, Search, X } from "lucide-react";
import AccountMenuButton from "./AccountMenuButton.jsx";
import UserMenuDropdown from "./UserMenuDropdown.jsx";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NAV_LINKS } from "../data/navLinks.js";
import AppLink from "./AppLink.jsx";
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
    <header className={`nav-bar fixed left-0 right-0 top-0 z-50 px-4 py-5 md:px-8 lg:px-4${isAuthenticated ? " nav-bar--authenticated" : ""}`}>
      <motion.div
        aria-hidden="true"
        className="nav-bar__backdrop absolute inset-0 border-b border-foreground/8"
        style={{ opacity: barOpacity }}
      />
      <div className="nav-bar__content relative z-10 mx-auto max-w-[118rem]">
        <div className="nav-bar__row">
          <AppLink href="#home" className="nav-bar__logo-link shrink-0" aria-label={t("nav.homeLabel")}>
            <PreludeLogo className="prelude-logo--nav" />
          </AppLink>

          <nav className="nav-bar__center hidden items-center gap-5 sm:flex" aria-label={t("nav.primaryLabel")}>
            {NAV_LINKS.map(({ labelKey, href }) => (
              <AppLink className="ivy-nav-link" href={href} key={labelKey}>
                {t(labelKey)}
              </AppLink>
            ))}
          </nav>

          <div className="nav-bar__actions flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <div id="site-search-panel" className="nav-bar__search-wrap">
              <button
                type="button"
                onClick={toggleSearch}
                className="nav-bar__search-btn inline-flex text-foreground transition hover:text-primary"
                aria-label={t("nav.searchLabel")}
                aria-expanded={searchOpen}
                aria-controls="site-search-dropdown"
              >
                <Search className="h-6 w-6" aria-hidden="true" />
              </button>
              <SiteSearchPanel open={searchOpen} onClose={closeSearch} />
            </div>

            {isAuthenticated ? (
              <div className="nav-bar__account hidden min-w-0 sm:block">
                <UserMenuDropdown className="w-full" />
              </div>
            ) : (
            <AppLink href="/login" className="ivy-nav-link hidden shrink-0 sm:inline-flex">
              {t("nav.signIn")}
            </AppLink>
          )}

          {!isAuthenticated ? (
          <Button as={Link} to="/contact#book-call" className="nav-bar__cta shrink-0 rounded-full px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] sm:px-5">
              {t("sections.cta.primary")}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}

            <button
              type="button"
              className="nav-bar__menu-btn inline-flex rounded-full p-2 text-foreground transition hover:bg-foreground/[0.05] sm:hidden"
              onClick={toggleMobile}
              aria-label={mobileOpen ? t("nav.menuCloseLabel") : t("nav.menuOpenLabel")}
              aria-expanded={mobileOpen}
              aria-controls="nav-mobile-menu"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.nav
              id="nav-mobile-menu"
              className="nav-bar__mobile-menu paper-card sm:hidden"
              aria-label={t("nav.primaryLabel")}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {NAV_LINKS.map(({ labelKey, href }) => (
                <AppLink
                  className="nav-bar__mobile-link ivy-nav-link"
                  href={href}
                  key={labelKey}
                  onClick={closeMobile}
                >
                  {t(labelKey)}
                </AppLink>
              ))}
              {!isAuthenticated ? (
                <div className="nav-bar__mobile-auth">
                  <AppLink href="/login" className="nav-bar__mobile-link ivy-nav-link" onClick={closeMobile}>
                    {t("nav.signIn")}
                  </AppLink>
                  <Button as={Link} to="/contact#book-call" className="nav-bar__mobile-cta w-full" onClick={closeMobile}>
                    {t("sections.cta.primary")}
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <div className="nav-bar__mobile-auth">
                  <AccountMenuButton
                    onClick={() => {
                      closeMobile();
                      openAccount();
                    }}
                    className="w-full"
                  />
                </div>
              )}
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
