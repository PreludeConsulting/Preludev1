import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AURA_SIZE_PX,
  followAlpha,
  lerpPoint,
  pointerCoords
} from "../../lib/auraCursorMotion.js";
import { useReducedMotion } from "../../lib/useReducedMotion.js";

const ZONE_SELECTOR = "[data-aura-zone]";

function useFinePointer() {
  const [fine, setFine] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFine(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return fine;
}

export default function AuraCursor() {
  const reducedMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const blobRef = useRef(null);
  const activeRef = useRef(false);
  const targetRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!finePointer || reducedMotion) return undefined;

    const paint = () => {
      const blob = blobRef.current;
      if (!blob) return;

      const alpha = followAlpha(undefined, reducedMotion);
      const next = lerpPoint(
        positionRef.current.x,
        positionRef.current.y,
        targetRef.current.x,
        targetRef.current.y,
        alpha
      );
      positionRef.current = next;
      blob.style.transform = `translate3d(${next.x - AURA_SIZE_PX / 2}px, ${next.y - AURA_SIZE_PX / 2}px, 0)`;

      const dx = Math.abs(next.x - targetRef.current.x);
      const dy = Math.abs(next.y - targetRef.current.y);
      if (activeRef.current || dx > 0.4 || dy > 0.4) {
        frameRef.current = requestAnimationFrame(paint);
      } else {
        frameRef.current = 0;
      }
    };

    const ensureLoop = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(paint);
    };

    const onPointerMove = (event) => {
      const coords = pointerCoords(event);
      targetRef.current = coords;
      if (!activeRef.current) return;
      ensureLoop();
    };

    const onZoneEnter = (event) => {
      const zone = event.currentTarget;
      zone.classList.add("aura-zone--active");
      activeRef.current = true;
      const coords = pointerCoords(event);
      targetRef.current = coords;
      positionRef.current = coords;
      setVisible(true);
      ensureLoop();
    };

    const onZoneLeave = (event) => {
      event.currentTarget.classList.remove("aura-zone--active");
      activeRef.current = false;
      setVisible(false);
    };

    const zones = Array.from(document.querySelectorAll(ZONE_SELECTOR));
    zones.forEach((zone) => {
      zone.addEventListener("pointerenter", onZoneEnter);
      zone.addEventListener("pointerleave", onZoneLeave);
      zone.addEventListener("pointermove", onPointerMove);
    });

    return () => {
      zones.forEach((zone) => {
        zone.removeEventListener("pointerenter", onZoneEnter);
        zone.removeEventListener("pointerleave", onZoneLeave);
        zone.removeEventListener("pointermove", onPointerMove);
        zone.classList.remove("aura-zone--active");
      });
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      activeRef.current = false;
    };
  }, [finePointer, reducedMotion]);

  if (!finePointer || reducedMotion) return null;

  return createPortal(
    <div
      ref={blobRef}
      className={`aura-cursor${visible ? " aura-cursor--visible" : ""}`}
      aria-hidden="true"
    />,
    document.body
  );
}
