import { Search } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { bindFocusTrap } from "../lib/focusTrap.js";
import { filterSiteSearch, navigateToSiteResult, SITE_SEARCH_ITEMS } from "../lib/siteSearch.js";

export default function SiteSearchPanel({ open, onClose, triggerRef }) {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const listId = useId();

  const results = filterSiteSearch(query, SITE_SEARCH_ITEMS, t);

  const handleSelect = useCallback((item) => {
    navigateToSiteResult(item, { pathname: location.pathname, navigate });
    onClose();
  }, [location.pathname, navigate, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(-1);
      return;
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setActiveIndex(results.length ? 0 : -1);
  }, [query, results.length]);

  useEffect(() => {
    if (!open) return undefined;

    let releaseTrap = () => {};
    const frame = requestAnimationFrame(() => {
      releaseTrap = bindFocusTrap(panelRef.current, {
        onEscape: onClose,
        returnFocusRef: triggerRef,
        isolatePage: false
      });
    });

    const onKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      }
    };

    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (e.target.closest(".nav-bar__search-btn")) return;
      onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      cancelAnimationFrame(frame);
      releaseTrap();
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [activeIndex, handleSelect, onClose, open, results, triggerRef]);

  if (!open) return null;

  return (
        <div
          ref={panelRef}
          id="site-search-dropdown"
          className="site-search"
          role="dialog"
          aria-label={t("nav.searchLabel")}
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
                aria-expanded={results.length > 0}
                aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
                role="combobox"
                autoComplete="off"
              />
            </div>
            <ul id={listId} className="site-search__results" role="listbox" aria-label={t("nav.searchResultsLabel")}>
              {query.trim() ? (
                results.length ? (
                  results.map((item, index) => (
                    <li
                      key={item.id}
                      id={`${listId}-option-${index}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      className={index === activeIndex ? "site-search__result site-search__result--active" : "site-search__result"}
                    >
                      <button type="button" className="site-search__result-btn" onClick={() => handleSelect(item)}>
                        <span className="site-search__result-label">{t(item.labelKey)}</span>
                        {item.hintKey ? <span className="site-search__result-hint">{t(item.hintKey)}</span> : null}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="site-search__empty" role="presentation">{t("nav.searchNoResults")}</li>
                )
              ) : (
                <li className="site-search__hint" role="presentation">{t("nav.searchHint")}</li>
              )}
            </ul>
          </div>
        </div>
  );
}
