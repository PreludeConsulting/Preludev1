import { AnimatePresence, motion } from "motion/react";
import { HERO_PROFILE_PLACEHOLDERS } from "../../data/heroMentorMatch.js";
import { cn } from "../../lib/utils.js";

const FIELDS = [
  { key: "grade", label: "Grade level" },
  { key: "stage", label: "College process stage" },
  { key: "major", label: "Intended major" },
  { key: "schools", label: "Target schools" },
  { key: "concern", label: "Biggest concern" },
  { key: "mentorStyle", label: "Preferred mentor style" },
  { key: "priority", label: "First priority" }
];

export default function StudentProfileSummary({ profile, highlightedKey, reducedMotion }) {
  return (
    <aside className="hero-mm-profile" aria-label="Live student profile summary">
      <p className="hero-mm-profile__eyebrow">Your profile is taking shape</p>
      <h3 className="hero-mm-profile__title">Student Profile</h3>
      <ul className="hero-mm-profile__list">
        {FIELDS.map(({ key, label }) => {
          const value = profile[key] ?? HERO_PROFILE_PLACEHOLDERS[key];
          const isPlaceholder = !profile[key] || profile[key] === HERO_PROFILE_PLACEHOLDERS[key];
          const flash = highlightedKey === key;

          return (
            <li
              key={key}
              className={cn("hero-mm-profile__row", flash && "hero-mm-profile__row--flash")}
            >
              <span className="hero-mm-profile__label">{label}</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={value}
                  className={cn("hero-mm-profile__value", isPlaceholder && "hero-mm-profile__value--muted")}
                  initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {value}
                  {flash && !isPlaceholder ? (
                    <motion.span
                      className="hero-mm-profile__check"
                      initial={reducedMotion ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      aria-hidden="true"
                    >
                      ✓
                    </motion.span>
                  ) : null}
                </motion.span>
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
