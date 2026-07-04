import { createTimeline } from "animejs";

export const MAP_MOTION_MS = {
  draw: 420,
  /** Delay between each edge start — match draw for one-by-one growth. */
  stagger: 420,
  pulse: 2200
};

/** Extra scroll runway while the section stays pinned (~35px per edge). */
export const MAP_PIN_SCROLL_VH = 155;

/** Navbar clearance for sticky pin top (~5.5rem). */
export const MAP_NAV_CLEARANCE_PX = 88;

export const MAP_EASE = "out(4)";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function getAbsoluteTop(el) {
  const rect = el.getBoundingClientRect();
  return rect.top + window.scrollY;
}

function readStickyTopPx(stageEl) {
  if (!stageEl || typeof window === "undefined") return 0;
  const top = getComputedStyle(stageEl).top;
  if (top.endsWith("px")) return parseFloat(top) || 0;
  if (top.endsWith("vh")) return (parseFloat(top) / 100) * window.innerHeight;
  return 0;
}

/** Only mounted SVG path elements can be measured and drawn. */
function isDrawableEdge(el) {
  return Boolean(el) && typeof el.getTotalLength === "function";
}

function restingEdgeOpacity(el) {
  return el?.classList?.contains?.("network-map__edge--showcase") ? "0.52" : "0.52";
}

function prepareEdge(el) {
  if (!isDrawableEdge(el)) return 0;
  const length = el.getTotalLength();
  el.style.strokeDasharray = `${length}`;
  el.style.strokeDashoffset = `${length}`;
  el.style.opacity = "0";
  return length;
}

export function resetNetworkEdges(edgeEls) {
  edgeEls.filter(isDrawableEdge).forEach((el) => prepareEdge(el));
}

export function snapNetworkVisible(edgeEls) {
  edgeEls.filter(isDrawableEdge).forEach((el) => {
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = "0";
    el.style.opacity = restingEdgeOpacity(el);
    el.style.filter = "";
    el.classList?.remove("network-map__edge--drawing", "network-map__edge--drawn");
  });
}

/**
 * Scroll-scrubbed sequential draw — one edge at a time with a shooting-star ease.
 * @param {number} progress 0–1 across all edges
 */
export function applyNetworkDrawProgress(edgeEls, progress) {
  const edges = edgeEls.filter(isDrawableEdge);
  const count = edges.length;
  if (count === 0) return;

  const p = clamp(progress);

  edges.forEach((el, index) => {
    const length = el.getTotalLength();
    const segment = 1 / count;
    const edgeStart = index * segment;
    const localT = clamp((p - edgeStart) / segment);
    const eased = easeOutCubic(localT);

    const isDrawing = localT > 0 && localT < 1;
    const isDrawn = localT >= 1;

    el.classList?.toggle("network-map__edge--drawing", isDrawing);
    el.classList?.toggle("network-map__edge--drawn", isDrawn);

    if (isDrawn) {
      el.style.strokeDasharray = `${length}`;
      el.style.strokeDashoffset = "0";
      el.style.opacity = restingEdgeOpacity(el);
      el.style.filter = "";
      return;
    }

    if (isDrawing) {
      const head = Math.max(18, length * 0.14);
      el.style.strokeDasharray = `${head} ${length}`;
      el.style.strokeDashoffset = `${length * (1 - eased) + head * 0.5}`;
      el.style.opacity = String(0.55 + eased * 0.35);
      el.style.filter = "drop-shadow(0 0 6px rgb(167 139 250 / 0.5))";
      return;
    }

    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    el.style.opacity = "0.1";
    el.style.filter = "";
  });
}

/** Progress (0–1) through the sticky pin runway. */
export function getMapPinScrollProgress(spacerEl, stageEl) {
  if (!spacerEl || !stageEl) return 0;

  const scrollRange = spacerEl.offsetHeight - stageEl.offsetHeight;
  if (scrollRange <= 0) return 1;

  const stickyTopPx = readStickyTopPx(stageEl);
  const pinStart = getAbsoluteTop(spacerEl) - stickyTopPx;
  return clamp((window.scrollY - pinStart) / scrollRange);
}

export function measureMapPinSpacer(stageEl, pinScrollVh = MAP_PIN_SCROLL_VH) {
  if (!stageEl || typeof window === "undefined") return;
  const stageHeight = stageEl.offsetHeight;
  const pinScrollPx = (pinScrollVh / 100) * window.innerHeight;
  return {
    stageHeight,
    stageHalf: stageHeight / 2,
    pinScrollPx,
    totalHeight: stageHeight + pinScrollPx
  };
}

export function runNetworkDrawTimeline({
  edgeEls,
  reducedMotion = false,
  onComplete,
  timing = MAP_MOTION_MS
} = {}) {
  const edges = edgeEls.filter(isDrawableEdge);

  if (reducedMotion || edges.length === 0) {
    snapNetworkVisible(edges);
    onComplete?.();
    return null;
  }

  edges.forEach((el) => prepareEdge(el));

  const tl = createTimeline({ defaults: { ease: MAP_EASE } });
  edges.forEach((el, index) => {
    tl.add(
      el,
      {
        strokeDashoffset: { from: el.getTotalLength(), to: 0 },
        opacity: { from: 0, to: 0.52 },
        duration: timing.draw
      },
      index * timing.stagger
    );
  });

  if (onComplete) {
    tl.then(onComplete);
  }

  return tl;
}

function isMapInLockZone(mapEl) {
  if (!mapEl) return false;
  const rect = mapEl.getBoundingClientRect();
  return rect.top < window.innerHeight * 0.72 && rect.bottom > window.innerHeight * 0.28;
}

function isMapVisible(mapEl) {
  if (!mapEl) return false;
  const rect = mapEl.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

/** Scroll progress (0–1) while the draw target moves through the viewport. */
export function getNetworkMapDrawProgress(scrollTarget) {
  if (!scrollTarget || typeof window === "undefined") return 0;

  const rect = scrollTarget.getBoundingClientRect();
  const vh = window.innerHeight;
  const start = vh * 0.82;
  const end = vh * 0.18;
  const span = start - end + rect.height * 0.45;

  if (span <= 0) return 1;
  return clamp((start - rect.top) / span);
}

/**
 * Viewport scroll draw — no sticky pin, no spacer height changes, no scroll jumps.
 * Edges reveal as the map block scrolls through the viewport.
 */
export function attachNetworkMapViewportDraw({
  scrollTarget,
  mapEl,
  edgeEls = [],
  reducedMotion = false,
  onDrawActive,
  onProgress,
  onComplete
} = {}) {
  const edges = edgeEls.filter(isDrawableEdge);

  if (reducedMotion) {
    snapNetworkVisible(edges);
    onComplete?.();
    return { revert() {} };
  }

  if (typeof window === "undefined" || !scrollTarget || edges.length === 0) {
    return { revert() {} };
  }

  let frame = 0;
  let lastProgress = -1;
  let hasCompleted = false;
  let drawActive = false;

  const syncFromScroll = () => {
    const progress = getNetworkMapDrawProgress(scrollTarget);
    const inView = isMapVisible(mapEl);
    const shouldDraw = inView && progress > 0.02 && progress < 0.998;

    if (shouldDraw !== drawActive) {
      drawActive = shouldDraw;
      onDrawActive?.(drawActive);
    }

    if (!inView && hasCompleted) {
      mapEl?.classList.remove("network-map--animating");
      return;
    }

    if (Math.abs(progress - lastProgress) < 0.002) return;
    lastProgress = progress;

    applyNetworkDrawProgress(edges, progress);
    onProgress?.(progress);

    if (progress >= 0.998 && !hasCompleted) {
      hasCompleted = true;
      snapNetworkVisible(edges);
      onComplete?.();
    }
  };

  const onScrollFrame = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncFromScroll);
  };

  resetNetworkEdges(edges);
  syncFromScroll();

  window.addEventListener("scroll", onScrollFrame, { passive: true });
  window.addEventListener("resize", onScrollFrame, { passive: true });

  return {
    revert() {
      window.removeEventListener("scroll", onScrollFrame);
      window.removeEventListener("resize", onScrollFrame);
      cancelAnimationFrame(frame);
      mapEl?.classList.remove("network-map--animating");
    }
  };
}

/**
 * Sticky pin + scroll-scrubbed draw. Scroll pauses on the map while edges draw in.
 */
export function attachNetworkMapScrollPin({
  pinSpacerEl,
  pinStageEl,
  mapEl,
  edgeEls = [],
  reducedMotion = false,
  onPinChange,
  onProgress,
  onComplete
} = {}) {
  const edges = edgeEls.filter(isDrawableEdge);

  if (reducedMotion) {
    snapNetworkVisible(edges);
    onComplete?.();
    return { revert() {} };
  }

  if (typeof window === "undefined" || !pinSpacerEl || !pinStageEl || !mapEl) {
    return { revert() {} };
  }

  if (edges.length === 0) {
    return { revert() {} };
  }

  let frame = 0;
  let lastProgress = -1;
  let isPinned = false;
  let hasCompleted = false;
  let lockedPinScrollPx = 0;

  const syncPinMetrics = ({ force = false } = {}) => {
    if (hasCompleted) return;

    if (!force && pinSpacerEl.classList.contains("network-map-pin--metrics-ready")) {
      return;
    }

    const metrics = measureMapPinSpacer(pinStageEl);
    if (!metrics) return;

    lockedPinScrollPx = metrics.pinScrollPx;
    pinStageEl.style.top = `${MAP_NAV_CLEARANCE_PX}px`;
    pinSpacerEl.style.setProperty("--map-stage-height", `${metrics.stageHeight}px`);
    pinSpacerEl.style.setProperty("--map-pin-scroll", `${metrics.pinScrollPx}px`);
    pinSpacerEl.style.height = `${metrics.totalHeight}px`;
    pinSpacerEl.classList.add("network-map-pin--metrics-ready");
  };

  const collapsePinRunway = ({ compensateScroll = false } = {}) => {
    const stageHeight = pinStageEl.offsetHeight;
    const runwayPx = lockedPinScrollPx || 0;

    pinSpacerEl.style.height = `${stageHeight}px`;
    pinSpacerEl.style.setProperty("--map-pin-scroll", "0px");
    pinSpacerEl.classList.remove("network-map-pin--metrics-ready");

    if (compensateScroll && runwayPx > 0) {
      window.scrollTo(0, Math.max(0, window.scrollY - runwayPx));
    }
  };

  const releasePin = () => {
    if (!isPinned) return;
    isPinned = false;
    pinSpacerEl.classList.remove("network-map-pin--active");
    onPinChange?.(false);
  };

  const syncFromScroll = () => {
    if (hasCompleted) {
      releasePin();
      return;
    }

    const progress = getMapPinScrollProgress(pinSpacerEl, pinStageEl);
    const inZone = isMapInLockZone(mapEl);
    const shouldPin = inZone && progress > 0.001 && progress < 0.998;

    if (shouldPin !== isPinned) {
      isPinned = shouldPin;
      pinSpacerEl.classList.toggle("network-map-pin--active", isPinned);
      onPinChange?.(isPinned);
    }

    if (Math.abs(progress - lastProgress) < 0.001) return;
    lastProgress = progress;

    applyNetworkDrawProgress(edges, progress);
    onProgress?.(progress);

    if (progress >= 0.998 && !hasCompleted) {
      hasCompleted = true;
      snapNetworkVisible(edges);
      pinSpacerEl.classList.add("network-map-pin--complete");
      releasePin();
      onComplete?.();
    }
  };

  const onScrollFrame = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncFromScroll);
  };

  const onResize = () => {
    syncPinMetrics({ force: true });
    syncFromScroll();
  };

  resetNetworkEdges(edges);
  syncPinMetrics({ force: true });
  syncFromScroll();

  window.addEventListener("scroll", onScrollFrame, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  return {
    collapseRunway() {
      if (!hasCompleted) return;
      collapsePinRunway({ compensateScroll: false });
    },
    revert() {
      window.removeEventListener("scroll", onScrollFrame);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
      pinSpacerEl.classList.remove(
        "network-map-pin--active",
        "network-map-pin--complete",
        "network-map-pin--metrics-ready"
      );
      pinSpacerEl.style.removeProperty("height");
      pinSpacerEl.style.removeProperty("--map-stage-height");
      pinSpacerEl.style.removeProperty("--map-pin-scroll");
      pinStageEl.style.removeProperty("top");
    }
  };
}

/** @deprecated Use attachNetworkMapScrollPin */
export function attachNetworkMapScrollLock(options = {}) {
  return attachNetworkMapScrollPin(options);
}

function getScrollSectionProgress(target) {
  if (!target || typeof window === "undefined") return 0;
  const rect = target.getBoundingClientRect();
  const viewport = window.innerHeight;
  const total = viewport + rect.height;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (viewport - rect.top) / total));
}

/** Scroll-scrubbed edge draw — kept for tests. */
export function attachNetworkMapScrollDraw({
  edgeEls,
  scrollTarget,
  reducedMotion = false,
  onProgress
} = {}) {
  const edges = edgeEls.filter(isDrawableEdge);
  if (!scrollTarget || edges.length === 0) {
    return { revert() {} };
  }

  if (reducedMotion) {
    snapNetworkVisible(edges);
    return { revert() {} };
  }

  let frame = 0;
  let lastProgress = -1;

  const syncFromScroll = () => {
    const progress = Math.min(1, getScrollSectionProgress(scrollTarget) * 2.4);
    if (Math.abs(progress - lastProgress) < 0.008) return;
    lastProgress = progress;

    edges.forEach((el) => {
      const length = el.getTotalLength();
      el.style.strokeDasharray = `${length}`;
      el.style.strokeDashoffset = `${length * (1 - progress)}`;
      el.style.opacity = String(0.38 + progress * 0.14);
    });
    onProgress?.(progress, progress > 0 && progress < 1);
  };

  const onScrollFrame = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncFromScroll);
  };

  syncFromScroll();
  window.addEventListener("scroll", onScrollFrame, { passive: true });
  window.addEventListener("resize", onScrollFrame, { passive: true });

  return {
    revert() {
      window.removeEventListener("scroll", onScrollFrame);
      window.removeEventListener("resize", onScrollFrame);
      cancelAnimationFrame(frame);
    }
  };
}

/** One draw-in per viewport entry; idle pulse is handled via CSS on the edges group. */
export function runNetworkDrawCycle({ edgeEls, reducedMotion = false, onComplete } = {}) {
  const edges = edgeEls.filter(isDrawableEdge);
  if (reducedMotion || edges.length === 0) {
    snapNetworkVisible(edges);
    return null;
  }

  let drawTimeline = null;

  const stopDraw = () => {
    if (drawTimeline) {
      drawTimeline.cancel();
      drawTimeline = null;
    }
  };

  drawTimeline = runNetworkDrawTimeline({
    edgeEls: edges,
    reducedMotion: false,
    onComplete: () => {
      drawTimeline = null;
      onComplete?.();
    }
  });

  return {
    cancel() {
      stopDraw();
    }
  };
}

/** @deprecated Use runNetworkDrawCycle — kept for test compatibility. */
export function runNetworkCycleLoop(options) {
  return runNetworkDrawCycle(options);
}

export function cancelNetworkMapTimeline(timelineRef) {
  const active = timelineRef?.current;
  if (!active) return;
  active.cancel?.();
  timelineRef.current = null;
}
