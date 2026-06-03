import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANGUAGE, LANGUAGES, translations } from "../lib/translations.js";

const STORAGE_KEY = "prelude-language";
const LanguageContext = createContext(null);

function isSupportedLanguage(language) {
  return LANGUAGES.some(({ code }) => code === language);
}

function readStoredLanguage() {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

function getNestedValue(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => {
    function setLanguage(nextLanguage) {
      if (isSupportedLanguage(nextLanguage)) setLanguageState(nextLanguage);
    }

    function t(path, replacements = {}) {
      const valueForLanguage = getNestedValue(translations[language], path);
      const fallback = getNestedValue(translations[DEFAULT_LANGUAGE], path);
      const resolved = valueForLanguage ?? fallback ?? path;

      if (typeof resolved !== "string") return resolved;

      return Object.entries(replacements).reduce(
        (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
        resolved
      );
    }

    return {
      language,
      languages: LANGUAGES,
      setLanguage,
      t
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
