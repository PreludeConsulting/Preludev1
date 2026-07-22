import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AURA_SIZE_PX,
  followAlpha,
  lerpPoint,
  pointerCoords
} from "../../lib/auraCursorMotion.js";
import { usePreludeMotion } from "../../context/MotionContext.jsx";

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
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    }
    mq.addListener?.(sync);
    return () => mq.removeListener?.(sync);
  }, []);

  return fine;
}

export default function AuraCursor() {
  const { reducedMotion, motionTier, documentVisible } = usePreludeMotion();
  const finePointer = useFinePointer();
  const blobRef = useRef(null);
  const activeRef = useRef(false);
  const targetRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);
  const hoverTargetRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!finePointer || reducedMotion || motionTier !== "full" || !documentVisible) return undefined;

    let pointerMoveAttached = false;

    const stopLoop = () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };

    const paint = () => {
      frameRef.current = 0;
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
      if (dx > 0.4 || dy > 0.4) {
        frameRef.current = requestAnimationFrame(paint);
      }
    };

    const ensureLoop = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(paint);
    };

    const landingButtonForTarget = (target) => {
      return target instanceof Element ? target.closest(BUTTON_SELECTOR) : null;
    };

    const attachPointerMove = () => {
      if (pointerMoveAttached) return;
      document.addEventListener("pointermove", onPointerMove, { passive: true });
      pointerMoveAttached = true;
    };

    const detachPointerMove = () => {
      if (!pointerMoveAttached) return;
      document.removeEventListener("pointermove", onPointerMove);
      pointerMoveAttached = false;
    };

    const activateButton = (button, event) => {
      hoverTargetRef.current = button;
      activeRef.current = true;
      const coords = pointerCoords(event);
      targetRef.current = coords;
      positionRef.current = coords;
      setVisible(true);
      attachPointerMove();
      ensureLoop();
    };

    const onPointerMove = (event) => {
      if (!hoverTargetRef.current) return;
      const coords = pointerCoords(event);
      targetRef.current = coords;
      ensureLoop();
    };

    const onPointerOver = (event) => {
      const button = landingButtonForTarget(event.target);
      if (!button || button === hoverTargetRef.current) return;
      activateButton(button, event);
    };

    const onPointerOut = (event) => {
      const button = hoverTargetRef.current;
      if (!button) return;
      if (event.relatedTarget instanceof Node && button.contains(event.relatedTarget)) return;
      const nextButton = landingButtonForTarget(event.relatedTarget);
      if (nextButton) {
        activateButton(nextButton, event);
        return;
      }
      hoverTargetRef.current = null;
      activeRef.current = false;
      setVisible(false);
      detachPointerMove();
      stopLoop();
    };

    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });

    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      detachPointerMove();
      stopLoop();
      activeRef.current = false;
      hoverTargetRef.current = null;
    };
  }, [documentVisible, finePointer, motionTier, reducedMotion]);

  if (!finePointer || reducedMotion || motionTier !== "full" || !documentVisible) return null;

  return createPortal(
    <div
      ref={blobRef}
      className={`aura-cursor${visible ? " aura-cursor--visible" : ""}`}
      aria-hidden="true"
    />,
    document.body
  );
}
