import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
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
  blurAmount = 5,
  borderColor = "green",
  glowColor = "rgba(0, 255, 0, 0.6)",
  animationDuration = 0.5,
  pauseBetweenAnimations = 1
}) => {
  const words = sentence.split(separator);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastActiveIndex, setLastActiveIndex] = useState(null);
  const containerRef = useRef(null);
  const wordRefs = useRef([]);
  const [focusRect, setFocusRect] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (manualMode || reducedMotion) return undefined;

    const interval = setInterval(
      () => {
        setCurrentIndex((prev) => (prev + 1) % words.length);
      },
      (animationDuration + pauseBetweenAnimations) * 1000
    );

    return () => clearInterval(interval);
  }, [manualMode, animationDuration, pauseBetweenAnimations, words.length, reducedMotion]);

  useEffect(() => {
    if (currentIndex === null || currentIndex === -1) return undefined;
    if (!wordRefs.current[currentIndex] || !containerRef.current) return undefined;

    const updateFocusRect = () => {
      const parentRect = containerRef.current?.getBoundingClientRect();
      const activeRect = wordRefs.current[currentIndex]?.getBoundingClientRect();

      if (!parentRect || !activeRect) return;

      setFocusRect({
        x: activeRect.left - parentRect.left,
        y: activeRect.top - parentRect.top,
        width: activeRect.width,
        height: activeRect.height
      });
    };

    updateFocusRect();

    const resizeObserver = new ResizeObserver(updateFocusRect);
    resizeObserver.observe(containerRef.current);
    wordRefs.current.forEach((node) => {
      if (node) resizeObserver.observe(node);
    });

    window.addEventListener("resize", updateFocusRect);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateFocusRect);
    };
  }, [currentIndex, words.length]);

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
    <div className="focus-container" ref={containerRef}>
      {words.map((word, index) => {
        const trimmedWord = word.trim();
        const isActive = reducedMotion ? true : index === currentIndex;
        const item = CARD_ITEMS[index];

        return (
          <span
            key={trimmedWord}
            ref={(element) => {
              wordRefs.current[index] = element;
            }}
            className={[
              "focus-word",
              manualMode ? "manual" : "",
              isActive ? "active" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              filter: isActive ? "blur(0px)" : `blur(${blurAmount}px)`,
              "--border-color": borderColor,
              "--glow-color": glowColor,
              transition: `filter ${animationDuration}s ease`
            }}
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
                  loading="eager"
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

      {!reducedMotion ? (
        <motion.div
          className="focus-frame"
          animate={{
            x: focusRect.x,
            y: focusRect.y,
            width: focusRect.width,
            height: focusRect.height,
            opacity: currentIndex >= 0 ? 1 : 0
          }}
          transition={{
            duration: animationDuration,
            ease: "easeInOut"
          }}
          style={{
            "--border-color": borderColor,
            "--glow-color": glowColor
          }}
        >
          <span className="corner top-left" />
          <span className="corner top-right" />
          <span className="corner bottom-left" />
          <span className="corner bottom-right" />
        </motion.div>
      ) : null}
    </div>
  );
};

export default TrueFocus;
