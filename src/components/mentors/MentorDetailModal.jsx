import { useEffect } from "react";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "../../lib/useReducedMotion.js";

export default function MentorDetailModal({ mentor, onClose }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!mentor) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mentor, onClose]);

  return (
    <AnimatePresence>
      {mentor ? (
        <motion.div
          className="mentor-modal__backdrop"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.01 : 0.28, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div
            className="mentor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-modal-title"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.9, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="mentor-modal__close"
              onClick={onClose}
              aria-label="Close mentor details"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="mentor-modal__stamp">
              <span className="mentors-stamp__edge mentors-stamp__edge--large" aria-hidden="true" />
              <span className="mentor-modal__frame">
                <img
                  src={mentor.photo}
                  alt={`${mentor.name}, ${mentor.university}`}
                  style={{
                    objectPosition: mentor.objectPosition,
                    ...(mentor.photoScale
                      ? { transform: `scale(${mentor.photoScale})`, transformOrigin: "center 22%" }
                      : {})
                  }}
                  width={420}
                  height={525}
                />
              </span>
            </div>

            <div className="mentor-modal__caption">
              <p className="mentor-modal__eyebrow">{mentor.specialty}</p>
              <h2 id="mentor-modal-title" className="mentor-modal__name">
                {mentor.name}
              </h2>
              <p className="mentor-modal__school">{mentor.university}</p>
              <p className="mentor-modal__bio">{mentor.description}</p>
              <ul className="mentor-modal__specialties" aria-label="Specialties">
                {mentor.specialties.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link to="/register" className="shopify-hero__cta mentor-modal__cta">
                Match with this mentor
              </Link>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
