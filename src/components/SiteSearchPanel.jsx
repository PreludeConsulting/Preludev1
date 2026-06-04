import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { filterSiteSearch, navigateToSiteResult, SITE_SEARCH_ITEMS } from "../lib/siteSearch.js";

export default function SiteSearchPanel({ open, onClose }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const listId = useId();

  const results = filterSiteSearch(query, SITE_SEARCH_ITEMS, t);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (e.target.closest(".nav-bar__search-btn")) return;
      onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onClose]);

  const handleSelect = (item) => {
    navigateToSiteResult(item);
    onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panelRef}
          id="site-search-dropdown"
          className="site-search"
          role="search"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="site-search__inner">
            <div className="site-search__field">
              <Search className="site-search__icon h-4 w-4" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("nav.searchPlaceholder")}
                className="site-search__input"
                aria-label={t("nav.searchLabel")}
                aria-controls={listId}
                autoComplete="off"
              />
            </div>
            {query.trim() ? (
              <ul id={listId} className="site-search__results" role="listbox">
                {results.length === 0 ? (
                  <li className="site-search__empty">{t("nav.searchNoResults")}</li>
                ) : (
                  results.map((item) => (
                    <li key={item.id} role="option">
                      <button
                        type="button"
                        className="site-search__result"
                        onClick={() => handleSelect(item)}
                      >
                        <span className="site-search__result-label">{t(item.labelKey)}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
