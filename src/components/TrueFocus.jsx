import { useEffect, useRef, useState } from "react";
import { usePreludeMotion } from "../context/MotionContext.jsx";
import { useViewportActivity } from "../lib/motion/useViewportActivity.js";
import "./TrueFocus.css";

const mediaBase = import.meta.env.BASE_URL;

const CARD_ITEMS = [
  {
    src: `${mediaBase}media/parents/time-saved-route.png?v=3`,
    alt: "Car route from home to school",
    width: 1024,
    height: 614,
    eyebrow: "TIME SAVED",
    value: "14 hrs",
    detail: "saved driving this month"
  },
  {
    src: `${mediaBase}media/parents/potential-aid-docs.png?v=2`,
    alt: "Scholarship and financial aid documents totaling $24,650",
    width: 1024,
    height: 596,
    eyebrow: "POTENTIAL AID",
    value: "$24,650",
    detail: "identified opportunities"
  },
  {
    src: `${mediaBase}media/parents/essay-review.png?v=3`,
    alt: "Essay review with comments and mentor feedback",
    width: 1024,
    height: 618,
    eyebrow: "NEXT UP",
    value: "Essay Review",
    detail: "May 20 | 7:00 PM"
  }
];

const TrueFocus = ({
  sentence = "True Focus",
  separator = " ",
  manualMode = false,
  blurAmount: _blurAmount = 5,
  borderColor = "green",
  glowColor = "rgba(0, 255, 0, 0.6)",
  animationDuration = 0.5,
  pauseBetweenAnimations = 1
}) => {
  const words = sentence.split(separator);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastActiveIndex, setLastActiveIndex] = useState(null);
  const containerRef = useRef(null);
  const { reducedMotion } = usePreludeMotion();
  const { active } = useViewportActivity(containerRef, { rootMargin: "120px 0px" });

  useEffect(() => {
    if (manualMode || reducedMotion || !active) return undefined;

    const interval = setInterval(
      () => {
        setCurrentIndex((prev) => (prev + 1) % words.length);
      },
      (animationDuration + pauseBetweenAnimations) * 1000
    );

    return () => clearInterval(interval);
  }, [active, manualMode, animationDuration, pauseBetweenAnimations, words.length, reducedMotion]);

  const handleMouseEnter = (index) => {
    if (manualMode) {
      setLastActiveIndex(index);
      setCurrentIndex(index);
    }
  };

  const handleMouseLeave = () => {
    if (manualMode) {
      setCurrentIndex(lastActiveIndex);
    }
  };

  return (
    <div className="focus-container" ref={containerRef} data-motion-active={active ? "true" : "false"}>
      {words.map((word, index) => {
        const trimmedWord = word.trim();
        const isActive = reducedMotion ? true : index === currentIndex;
        const item = CARD_ITEMS[index];

        return (
          <span
            key={trimmedWord}
            className={[
              "focus-word",
              manualMode ? "manual" : "",
              isActive ? "active" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ "--border-color": borderColor, "--glow-color": glowColor }}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
          >
            {item ? (
              <>
                <img
                  src={item.src}
                  alt=""
                  className="focus-word__visual"
                  width={item.width}
                  height={item.height}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  aria-hidden="true"
                />
                <span className="focus-word__copy">
                  <span className="focus-word__eyebrow">{item.eyebrow}</span>
                  <span className="focus-word__value">{item.value}</span>
                  <span className="focus-word__detail">{item.detail}</span>
                </span>
              </>
            ) : null}
          </span>
        );
      })}
    </div>
  );
};

export default TrueFocus;
