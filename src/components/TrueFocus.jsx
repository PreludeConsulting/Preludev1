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
  const wordRefs = useRef([]);
  const frameRef = useRef(null);
  const frameAnimationRef = useRef(null);
  const lastRectRef = useRef(null);
  const { reducedMotion, motionTier } = usePreludeMotion();
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

  useEffect(() => {
    if (currentIndex === null || currentIndex === -1) return undefined;
    if (!wordRefs.current[currentIndex] || !containerRef.current) return undefined;

    let frameId = 0;
    const updateFocusRect = () => {
      const parentRect = containerRef.current?.getBoundingClientRect();
      const activeRect = wordRefs.current[currentIndex]?.getBoundingClientRect();
      const frame = frameRef.current;

      if (!parentRect || !activeRect || !frame) return;

      const next = {
        x: activeRect.left - parentRect.left,
        y: activeRect.top - parentRect.top,
        width: activeRect.width,
        height: activeRect.height
      };
      const previous = lastRectRef.current;
      lastRectRef.current = next;

      frameAnimationRef.current?.cancel();
      frame.style.width = `${next.width}px`;
      frame.style.height = `${next.height}px`;
      frame.style.opacity = "1";

      if (!previous || reducedMotion || !active) {
        frame.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
        frame.style.willChange = "auto";
        return;
      }

      frame.style.willChange = "transform, opacity";
      if (typeof frame.animate !== "function") {
        frame.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
        frame.style.willChange = "auto";
        return;
      }

      const animation = frame.animate(
        [
          {
            transform: `translate3d(${previous.x}px, ${previous.y}px, 0) scale(${previous.width / next.width}, ${previous.height / next.height})`
          },
          { transform: `translate3d(${next.x}px, ${next.y}px, 0) scale(1, 1)` }
        ],
        {
          duration: motionTier === "lite" ? Math.min(animationDuration * 1000, 360) : animationDuration * 1000,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards"
        }
      );
      frameAnimationRef.current = animation;
      animation.finished
        .catch(() => undefined)
        .finally(() => {
          if (frameAnimationRef.current !== animation) return;
          frame.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
          frame.style.willChange = "auto";
          animation.cancel();
          frameAnimationRef.current = null;
        });
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateFocusRect);
    };

    scheduleUpdate();

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(containerRef.current);
    wordRefs.current.forEach((node) => {
      if (node) resizeObserver?.observe(node);
    });

    window.addEventListener("resize", scheduleUpdate, { passive: true });

    return () => {
      cancelAnimationFrame(frameId);
      frameAnimationRef.current?.cancel();
      frameAnimationRef.current = null;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [active, animationDuration, currentIndex, motionTier, reducedMotion, words.length]);

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

      {!reducedMotion ? (
        <div
          ref={frameRef}
          className="focus-frame"
          style={{
            "--border-color": borderColor,
            "--glow-color": glowColor,
            opacity: currentIndex >= 0 ? 1 : 0
          }}
        >
          <span className="corner top-left" />
          <span className="corner top-right" />
          <span className="corner bottom-left" />
          <span className="corner bottom-right" />
        </div>
      ) : null}
    </div>
  );
};

export default TrueFocus;
