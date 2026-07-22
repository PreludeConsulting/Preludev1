import { motion } from "motion/react";
import { X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useLegalModal } from "../context/LegalModalContext.jsx";
import { getLegalDocument, getLegalDocuments } from "../lib/legalContent.js";
import { useDialogFocusTrap } from "../lib/useDialogFocusTrap.js";

export default function LegalModal() {
  const { documentType, legalOpen, openLegal, closeLegal } = useLegalModal();
  const { language } = useLanguage();
  const legalDocuments = getLegalDocuments(language);
  const activeDocument = documentType ? getLegalDocument(documentType, language) : null;
  const dialogRef = useDialogFocusTrap(Boolean(legalOpen && activeDocument), closeLegal);

  if (!legalOpen || !activeDocument) return null;

  const handleClose = (event) => {
    event?.stopPropagation();
    closeLegal();
  };

  return (
    <div className="prelude-modal-backdrop" role="presentation" onClick={closeLegal}>
      <motion.div
        ref={dialogRef}
        className="prelude-modal prelude-legal-modal paper-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        tabIndex={-1}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="prelude-legal-modal__header">
          <div className="prelude-legal-modal__tabs" role="tablist" aria-label="Legal documents">
            {Object.entries(legalDocuments).map(([type, item]) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={documentType === type}
                className={`prelude-legal-modal__tab${documentType === type ? " is-active" : ""}`}
                onClick={() => openLegal(type)}
              >
                {item.title}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="prelude-legal-modal__close"
            onClick={handleClose}
            aria-label="Close legal document"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="prelude-legal-modal__body">
          <header className="prelude-legal-modal__intro">
            <h2 id="legal-modal-title" className="prelude-legal-modal__title">
              {activeDocument.title}
            </h2>
            <p className="prelude-legal-modal__updated">Last updated {activeDocument.updated}</p>
          </header>

          {activeDocument.summary?.length ? (
            <dl className="prelude-legal-modal__summary">
              {activeDocument.summary.map((item) => (
                <div key={item.label} className="prelude-legal-modal__summary-item">
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {activeDocument.sections.map((section) => (
            <section key={section.heading} className="prelude-legal-modal__section">
              <h3 className="prelude-legal-modal__heading">{section.heading}</h3>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="prelude-legal-modal__paragraph">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
