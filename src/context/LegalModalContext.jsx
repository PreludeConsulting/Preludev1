import { createContext, useCallback, useContext, useMemo, useState } from "react";

const LegalModalContext = createContext(null);

export function LegalModalProvider({ children }) {
  const [documentType, setDocumentType] = useState(null);

  const openLegal = useCallback((type) => {
    if (type === "privacy" || type === "terms") {
      setDocumentType(type);
    }
  }, []);

  const closeLegal = useCallback(() => {
    setDocumentType(null);
  }, []);

  const value = useMemo(
    () => ({
      documentType,
      legalOpen: documentType !== null,
      openLegal,
      closeLegal
    }),
    [documentType, openLegal, closeLegal]
  );

  return <LegalModalContext.Provider value={value}>{children}</LegalModalContext.Provider>;
}

export function useLegalModal() {
  const ctx = useContext(LegalModalContext);
  if (!ctx) throw new Error("useLegalModal must be used within LegalModalProvider");
  return ctx;
}
