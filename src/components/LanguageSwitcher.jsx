import { Check, Globe2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function LanguageSwitcher() {
  const { language, languages, setLanguage, t, languageFeatureEnabled } = useLanguage();
  const [open, setOpen] = useState(false);
  const switcherRef = useRef(null);
  const activeLanguage = languages.find(({ code }) => code === language) ?? languages[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (!switcherRef.current?.contains(event.target)) setOpen(false);
    }

    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleSelect(nextLanguage) {
    setLanguage(nextLanguage);
    setOpen(false);
  }

  if (!languageFeatureEnabled) return null;

  return (
    <div className="language-switcher" ref={switcherRef}>
      {open ? (
        <div className="language-switcher__menu" role="menu" aria-label={t("languageSwitcher.menuLabel")}>
          {languages.map(({ code, label, shortLabel }) => {
            const selected = code === language;
            return (
              <button
                type="button"
                className="language-switcher__option"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => handleSelect(code)}
                key={code}
              >
                <span className="language-switcher__code">{shortLabel}</span>
                <span>{label}</span>
                {selected ? <Check className="language-switcher__check" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        className="language-switcher__button"
        aria-label={t("languageSwitcher.buttonLabel")}
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <Globe2 className="h-4 w-4" aria-hidden="true" />
        <span>{activeLanguage.shortLabel}</span>
      </button>
    </div>
  );
}
