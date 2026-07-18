import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "../../lib/useReducedMotion.js";

const STAMP_ROTATIONS = [-8, -4, 0, 4, 8];
const FAN_STEP = 184;

const SPRING_EXPAND = { type: "spring", stiffness: 460, damping: 30, mass: 0.48 };
const SPRING_COLLAPSE = { type: "spring", stiffness: 280, damping: 32, mass: 0.72 };
const SPRING_ENTRANCE = { type: "spring", stiffness: 380, damping: 28, mass: 0.7 };

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getFanOffsets(count) {
  const mid = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => (index - mid) * FAN_STEP);
}

const STACK_LAYOUT = [
  { x: -18, y: -38, rotate: -8, scale: 0.93 },
  { x: 18, y: -28, rotate: 6, scale: 0.95 },
  { x: -14, y: -18, rotate: -4, scale: 0.96 },
  { x: 14, y: -9, rotate: 4, scale: 0.98 },
  { x: 0, y: 0, rotate: 0, scale: 1 }
];

function useFinePointerHover() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 901px)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 901px)");
    const onChange = () => setEnabled(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return enabled;
}

export default function MentorStampDeck({ mentors, onSelectMentor }) {
  const reducedMotion = useReducedMotion();
  const finePointerHover = useFinePointerHover();
  const deckRef = useRef(null);
  const [deckHovered, setDeckHovered] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);

  const deckExpanded = finePointerHover && deckHovered;
  const frontIndex = mentors.length - 1;
  const fanOffsets = getFanOffsets(mentors.length);
  const expansion = deckExpanded ? 1 : 0;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleCardEnter = (index) => {
    if (!finePointerHover) return;
    setDeckHovered(true);
    setHoveredIndex(index);
  };

  const handleDeckLeave = (event) => {
    if (deckRef.current?.contains(event.relatedTarget)) return;
    setDeckHovered(false);
    setHoveredIndex(null);
  };

  return (
    <div
      ref={deckRef}
      className={`mentors-stamp-deck${deckExpanded ? " is-expanded" : ""}`}
      aria-label="Prelude mentors"
      onMouseLeave={handleDeckLeave}
    >
      {mentors.map((mentor, index) => {
        const isHovered = finePointerHover && hoveredIndex === index;
        const isFront = index === frontIndex;
        const stack = STACK_LAYOUT[index] ?? STACK_LAYOUT[STACK_LAYOUT.length - 1];
        const fanX = fanOffsets[index] ?? 0;
        const fanRotate = STAMP_ROTATIONS[index] ?? 0;
        const fanY = isHovered ? -14 : -4;

        const x = lerp(stack.x, fanX, expansion);
        const y = lerp(stack.y, fanY, expansion);
        const rotate = lerp(
          stack.rotate,
          fanRotate + (isHovered ? fanRotate * 0.12 : 0),
          expansion
        );
        const scale = lerp(stack.scale, isHovered ? 1.06 : 1, expansion);
        const zIndex = isHovered ? 30 : 10 + index;

        return (
          <motion.button
            key={mentor.name}
            type="button"
            className={`mentors-stamp${isHovered ? " is-hovered" : ""}${isFront ? " is-front" : ""}`}
            style={{ zIndex }}
            initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.9 }}
            animate={{
              opacity: 1,
              x,
              y,
              rotate,
              scale
            }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : hasMounted
                  ? deckExpanded
                    ? SPRING_EXPAND
                    : SPRING_COLLAPSE
                  : { ...SPRING_ENTRANCE, delay: 0.04 + index * 0.04 }
            }
            onMouseEnter={() => handleCardEnter(index)}
            onFocus={() => handleCardEnter(index)}
            onClick={() => onSelectMentor(mentor)}
            aria-label={`View ${mentor.name}, ${mentor.university}`}
          >
            <span className="mentors-stamp__edge" aria-hidden="true" />
            <span className="mentors-stamp__frame">
              <span className="mentors-stamp__photo">
                <img
                  src={mentor.photo}
                  alt=""
                  style={{
                    objectPosition: mentor.objectPosition,
                    ...(mentor.photoScale
                      ? { transform: `scale(${mentor.photoScale})`, transformOrigin: "center 22%" }
                      : {})
                  }}
                  width={200}
                  height={250}
                  loading="eager"
                  decoding="async"
                />
              </span>
              {(deckExpanded || isFront) ? (
                <span className="mentors-stamp__meta">
                  <span className="mentors-stamp__name">{mentor.name}</span>
                  <span className="mentors-stamp__school">{mentor.university}</span>
                  <span className="mentors-stamp__tag">{mentor.specialty}</span>
                </span>
              ) : null}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
