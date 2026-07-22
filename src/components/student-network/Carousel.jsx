import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Circle, Code, FileText, Layers, Layout } from "lucide-react";
import { usePreludeMotion } from "../../context/MotionContext.jsx";
import { useViewportActivity } from "../../lib/motion/useViewportActivity.js";

import "./Carousel.css";

const DEFAULT_ITEMS = [
  {
    title: "Text Animations",
    description: "Cool text animations for your projects.",
    id: 1,
    icon: <FileText className="carousel-icon" aria-hidden="true" />
  },
  {
    title: "Animations",
    description: "Smooth animations for your projects.",
    id: 2,
    icon: <Circle className="carousel-icon" aria-hidden="true" />
  },
  {
    title: "Components",
    description: "Reusable components for your projects.",
    id: 3,
    icon: <Layers className="carousel-icon" aria-hidden="true" />
  },
  {
    title: "Backgrounds",
    description: "Beautiful backgrounds and patterns for your projects.",
    id: 4,
    icon: <Layout className="carousel-icon" aria-hidden="true" />
  },
  {
    title: "Common UI",
    description: "Common UI components are coming soon!",
    id: 5,
    icon: <Code className="carousel-icon" aria-hidden="true" />
  }
];

const DRAG_BUFFER = 0;
const VELOCITY_THRESHOLD = 500;
const GAP = 16;
const CONTAINER_PADDING = 16;

function resizeEntryInlineSize(entry) {
  const contentBox = Array.isArray(entry?.contentBoxSize)
    ? entry.contentBoxSize[0]
    : entry?.contentBoxSize;
  const width = contentBox?.inlineSize ?? entry?.contentRect?.width;
  return Number.isFinite(width) && width > 0 ? width : null;
}

function measuredContentWidth(element, fallbackWidth) {
  if (!element?.clientWidth || typeof getComputedStyle !== "function") return fallbackWidth;
  const styles = getComputedStyle(element);
  const horizontalPadding =
    (Number.parseFloat(styles.paddingLeft) || 0) +
    (Number.parseFloat(styles.paddingRight) || 0);
  return Math.max(1, element.clientWidth - horizontalPadding);
}

function CarouselItem({ item, index, itemWidth, round }) {
  return (
    <div
      key={`${item?.id ?? index}-${index}`}
      className={`carousel-item ${round ? "round" : ""}`}
      style={{
        width: itemWidth,
        height: round ? itemWidth : "24rem",
        ...(round && { borderRadius: "50%" })
      }}
    >
      <div className={`carousel-item-header ${round ? "round" : ""}`}>
        <span className="carousel-icon-container">{item.icon}</span>
      </div>
      <div className="carousel-item-content">
        <div className="carousel-item-title-row">
          <div className="carousel-item-copy">
            <div className="carousel-item-title">{item.title}</div>
            <p className="carousel-item-description">{item.description}</p>
          </div>
          {item.emblem ? (
            <img
              src={item.emblem}
              alt=""
              className="carousel-item-emblem"
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Carousel({
  items = DEFAULT_ITEMS,
  baseWidth = 300,
  autoplay = false,
  autoplayDelay = 3000,
  pauseOnHover = false,
  loop = false,
  round = false
}) {
  const fallbackItemWidth = Math.max(1, baseWidth - CONTAINER_PADDING * 2);
  const [itemWidth, setItemWidth] = useState(fallbackItemWidth);
  const trackItemOffset = itemWidth + GAP;
  const itemsForRender = useMemo(() => {
    if (!loop) return items;
    if (items.length === 0) return [];
    return [items[items.length - 1], ...items, items[0]];
  }, [items, loop]);

  const [position, setPosition] = useState(loop ? 1 : 0);
  const [isHovered, setIsHovered] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const containerRef = useRef(null);
  const jumpFrameRef = useRef(0);
  const { reducedMotion, motionTier } = usePreludeMotion();
  const { active } = useViewportActivity(containerRef, { rootMargin: "120px 0px" });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const updateWidth = (nextWidth) => {
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;
      setItemWidth((currentWidth) =>
        Math.abs(currentWidth - nextWidth) < 0.5 ? currentWidth : nextWidth
      );
    };

    updateWidth(measuredContentWidth(container, fallbackItemWidth));

    if (typeof ResizeObserver === "undefined") {
      const onResize = () => updateWidth(measuredContentWidth(container, fallbackItemWidth));
      window.addEventListener("resize", onResize, { passive: true });
      return () => window.removeEventListener("resize", onResize);
    }

    const observer = new ResizeObserver(([entry]) => {
      updateWidth(resizeEntryInlineSize(entry) ?? measuredContentWidth(container, fallbackItemWidth));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fallbackItemWidth]);

  useEffect(() => {
    if (pauseOnHover && containerRef.current) {
      const container = containerRef.current;
      const handleMouseEnter = () => setIsHovered(true);
      const handleMouseLeave = () => setIsHovered(false);
      container.addEventListener("mouseenter", handleMouseEnter);
      container.addEventListener("mouseleave", handleMouseLeave);
      return () => {
        container.removeEventListener("mouseenter", handleMouseEnter);
        container.removeEventListener("mouseleave", handleMouseLeave);
      };
    }
  }, [pauseOnHover]);

  useEffect(() => {
    if (!autoplay || !active || reducedMotion || itemsForRender.length <= 1) return undefined;
    if (pauseOnHover && isHovered) return undefined;

    const timer = setInterval(() => {
      setPosition((prev) => Math.min(prev + 1, itemsForRender.length - 1));
    }, motionTier === "lite" ? Math.round(autoplayDelay * 1.5) : autoplayDelay);

    return () => clearInterval(timer);
  }, [active, autoplay, autoplayDelay, isHovered, motionTier, pauseOnHover, reducedMotion, itemsForRender.length]);

  useEffect(() => {
    const startingPosition = loop ? 1 : 0;
    setPosition(startingPosition);
  }, [items.length, loop]);

  useEffect(() => {
    if (!loop && position > itemsForRender.length - 1) {
      setPosition(Math.max(0, itemsForRender.length - 1));
    }
  }, [itemsForRender.length, loop, position]);

  const effectiveTransition = isJumping || reducedMotion || !active
    ? { duration: 0 }
    : { duration: motionTier === "lite" ? 0.34 : 0.45, ease: [0.22, 1, 0.36, 1] };

  useEffect(() => () => cancelAnimationFrame(jumpFrameRef.current), []);

  const handleAnimationStart = () => {
    setIsAnimating(true);
  };

  const handleAnimationComplete = () => {
    if (!loop || itemsForRender.length <= 1) {
      setIsAnimating(false);
      return;
    }
    const lastCloneIndex = itemsForRender.length - 1;

    if (position === lastCloneIndex) {
      setIsJumping(true);
      const target = 1;
      setPosition(target);
      jumpFrameRef.current = requestAnimationFrame(() => {
        setIsJumping(false);
        setIsAnimating(false);
      });
      return;
    }

    if (position === 0) {
      setIsJumping(true);
      const target = items.length;
      setPosition(target);
      jumpFrameRef.current = requestAnimationFrame(() => {
        setIsJumping(false);
        setIsAnimating(false);
      });
      return;
    }

    setIsAnimating(false);
  };

  const handleDragEnd = (_, info) => {
    const { offset, velocity } = info;
    const direction =
      offset.x < -DRAG_BUFFER || velocity.x < -VELOCITY_THRESHOLD
        ? 1
        : offset.x > DRAG_BUFFER || velocity.x > VELOCITY_THRESHOLD
          ? -1
          : 0;

    if (direction === 0) return;

    setPosition((prev) => {
      const next = prev + direction;
      const max = itemsForRender.length - 1;
      return Math.max(0, Math.min(next, max));
    });
  };

  const dragProps = loop
    ? {}
    : {
        dragConstraints: {
          left: -trackItemOffset * Math.max(itemsForRender.length - 1, 0),
          right: 0
        }
      };

  const activeIndex =
    items.length === 0
      ? 0
      : loop
        ? (position - 1 + items.length) % items.length
        : Math.min(position, items.length - 1);

  return (
    <div
      ref={containerRef}
      className={`carousel-container ${round ? "round" : ""}`}
      data-motion-active={active ? "true" : "false"}
      style={{
        width: `${baseWidth}px`,
        ...(round && { height: `${baseWidth}px`, borderRadius: "50%" })
      }}
    >
      <motion.div
        className="carousel-track"
        drag={isAnimating || reducedMotion || !active ? false : "x"}
        {...dragProps}
        style={{
          width: itemWidth,
          gap: `${GAP}px`
        }}
        onDragEnd={handleDragEnd}
        animate={{ x: -(position * trackItemOffset) }}
        transition={effectiveTransition}
        onAnimationStart={handleAnimationStart}
        onAnimationComplete={handleAnimationComplete}
      >
        {itemsForRender.map((item, index) => (
          <CarouselItem
            key={`${item?.id ?? index}-${index}`}
            item={item}
            index={index}
            itemWidth={itemWidth}
            round={round}
          />
        ))}
      </motion.div>
      <div className={`carousel-indicators-container ${round ? "round" : ""}`}>
        <div className="carousel-indicators">
          {items.map((_, index) => (
            <motion.button
              type="button"
              key={index}
              className={`carousel-indicator ${activeIndex === index ? "active" : "inactive"}`}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={activeIndex === index}
              animate={{
                scale: activeIndex === index ? 1.2 : 1
              }}
              onClick={() => setPosition(loop ? index + 1 : index)}
              transition={{ duration: 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
