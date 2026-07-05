import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AURA_SIZE_PX,
  followAlpha,
  lerpPoint,
  pointerCoords
} from "../../lib/auraCursorMotion.js";
import { useReducedMotion } from "../../lib/useReducedMotion.js";

const BUTTON_SELECTOR = "[data-landing-content] button, [data-landing-content] a";

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
  const hoverTargetRef = useRef(null);
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

    const landingButtonForEvent = (event) => {
      const eventTarget = event.target instanceof Element ? event.target.closest(BUTTON_SELECTOR) : null;
      if (eventTarget) return eventTarget;
      const pointTarget = document.elementFromPoint(event.clientX, event.clientY);
      return pointTarget instanceof Element ? pointTarget.closest(BUTTON_SELECTOR) : null;
    };

    const activateButton = (button, event) => {
      hoverTargetRef.current = button;
      activeRef.current = true;
      const coords = pointerCoords(event);
      targetRef.current = coords;
      positionRef.current = coords;
      setVisible(true);
      ensureLoop();
    };

    const onPointerMove = (event) => {
      const button = landingButtonForEvent(event);
      if (!hoverTargetRef.current && button) {
        activateButton(button, event);
        return;
      }
      if (!hoverTargetRef.current) return;
      const coords = pointerCoords(event);
      targetRef.current = coords;
      ensureLoop();
    };

    const onPointerOver = (event) => {
      const button = landingButtonForEvent(event);
      if (!button || button === hoverTargetRef.current) return;
      activateButton(button, event);
    };

    const onPointerOut = (event) => {
      const button = hoverTargetRef.current;
      if (!button) return;
      if (event.relatedTarget instanceof Node && button.contains(event.relatedTarget)) return;
      const pointTarget = document.elementFromPoint(event.clientX, event.clientY);
      const nextButton = pointTarget instanceof Element ? pointTarget.closest(BUTTON_SELECTOR) : null;
      if (nextButton) return;
      hoverTargetRef.current = null;
      activeRef.current = false;
      setVisible(false);
    };

    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      activeRef.current = false;
      hoverTargetRef.current = null;
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
