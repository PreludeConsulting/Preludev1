import { utils } from "animejs";

function queryElements(root) {
  const q = (selector) => root.querySelector(selector);
  const qa = (selector) => [...root.querySelectorAll(selector)];

  return {
    camera: q(".pm-cinematic__camera"),
    openerBeat: q(".pm-cinematic__beat--opener"),
    openerLines: qa(".pm-cinematic__opener-line"),
    wordmarkBeat: q(".pm-cinematic__beat--wordmark"),
    wordmark: q(".pm-cinematic__wordmark"),
    wordmarkGlow: q(".pm-cinematic__wordmark-glow"),
    wordmarkTech: qa(".pm-cinematic__wordmark-tech span"),
    progressLayer: q(".pm-cinematic__layer--progress"),
    progressFill: q(".pm-cinematic__progress-fill"),
    progressGlow: q(".pm-cinematic__progress-glow"),
    progressValue: q(".pm-cinematic__progress-value"),
    assembly: q(".pm-cinematic__assembly"),
    bankScene: q(".pm-cinematic__bank-scene"),
    bankCoins: qa(".pm-cinematic__bank-coin"),
    cashItems: qa(".pm-cinematic__cash-note"),
    gradHats: qa(".pm-cinematic__grad-hat"),
    layoutRoot: q(".pm-cinematic__layout-root"),
    planItem: q(".pm-cinematic__layout-item--plan"),
    planExpand: q(".pm-cinematic__plan-expand"),
    planSheet: q(".pm-cinematic__plan-sheet"),
    planRows: qa(".pm-cinematic__plan-row"),
    mentorTags: qa(".pm-cinematic__mentor-tags li"),
    taskChecks: qa(".pm-cinematic__task-check"),
    rewardPills: qa(".pm-cinematic__reward-pill"),
    glowWarm: q(".pm-cinematic__glow--warm"),
    glowAccent: q(".pm-cinematic__glow--accent"),
    pigMoment: q(".pm-cinematic__pig-moment"),
    pig: q(".pm-cinematic__pig"),
    pigBubble: q(".pm-cinematic__pig-bubble")
  };
}

function applyInitialStates(elements) {
  const hiddenLayers = [
    elements.wordmarkBeat,
    ...elements.wordmarkTech,
    elements.progressLayer,
    elements.assembly,
    elements.planItem,
    elements.planExpand,
    elements.planSheet,
    elements.wordmarkGlow,
    elements.progressGlow,
    elements.progressValue,
    elements.bankScene,
    elements.glowAccent,
    elements.pigMoment,
    elements.pig,
    elements.pigBubble,
    ...elements.bankCoins,
    ...elements.cashItems,
    ...elements.gradHats,
    ...elements.mentorTags,
    ...elements.planRows,
    ...elements.taskChecks,
    ...elements.rewardPills
  ].filter(Boolean);

  utils.set(hiddenLayers, { opacity: 0 });

  if (elements.pig) {
    utils.set(elements.pig, { scale: 0.82, translateY: 18, rotate: -4 });
  }

  if (elements.pigMoment) {
    utils.set(elements.pigMoment, { scale: 0.96, translateY: 10 });
  }

  if (elements.pigBubble) {
    utils.set(elements.pigBubble, { scale: 0.9, translateY: 8 });
  }

  if (elements.openerBeat) {
    utils.set(elements.openerBeat, { opacity: 1 });
  }

  if (elements.openerLines.length) {
    utils.set(elements.openerLines, { opacity: 1, translateY: 0 });
  }

  if (elements.camera) {
    utils.set(elements.camera, { scale: 1, translateY: 0 });
  }

  if (elements.assembly) {
    utils.set(elements.assembly, { opacity: 0, scale: 0.98, translateY: 12 });
  }

  if (elements.planItem) {
    utils.set(elements.planItem, { scale: 0.98, translateY: 14 });
  }

  if (elements.planExpand) {
    utils.set(elements.planExpand, { opacity: 0, scaleY: 0.94, translateY: 8 });
  }

  if (elements.progressFill) {
    utils.set(elements.progressFill, { scaleX: 0 });
  }

  if (elements.bankScene) {
    utils.set(elements.bankScene, { scale: 1, translateY: 0 });
  }

  if (elements.bankCoins.length) {
    utils.set(elements.bankCoins, { translateY: 58, scale: 0.68, rotate: -18 });
  }

  if (elements.cashItems.length) {
    utils.set(elements.cashItems, { translateY: 68, scale: 0.72, rotate: -10 });
  }

  if (elements.gradHats.length) {
    utils.set(elements.gradHats, { translateY: 64, scale: 0.72, rotate: -18 });
  }

  if (elements.mentorTags.length) {
    utils.set(elements.mentorTags, { translateY: 6 });
  }

  if (elements.planRows.length) {
    utils.set(elements.planRows, { translateY: 6 });
  }

  if (elements.taskChecks.length) {
    utils.set(elements.taskChecks, { scale: 0.5, rotate: -12 });
  }

  if (elements.rewardPills.length) {
    utils.set(elements.rewardPills, { scale: 0.92 });
  }

  if (elements.wordmark) {
    utils.set(elements.wordmark, { scale: 1, translateY: 0 });
  }

  if (elements.wordmarkGlow) {
    utils.set(elements.wordmarkGlow, { scale: 0.88 });
  }

  if (elements.wordmarkTech.length) {
    utils.set(elements.wordmarkTech, { scale: 0.72, rotate: 0 });
  }

  if (elements.glowWarm) {
    utils.set(elements.glowWarm, { opacity: 0.32, scale: 1.06 });
  }

  if (elements.glowAccent) {
    utils.set(elements.glowAccent, { scale: 0.9 });
  }
}

export function initPreludeMatchCinematicRuntime(root, { mobile = false } = {}) {
  const elements = queryElements(root);

  applyInitialStates(elements);

  function enterStackedLayout() {
    elements.layoutRoot?.classList.remove("pm-cinematic__layout-root--match");
    elements.layoutRoot?.classList.add("pm-cinematic__layout-root--plan");
  }

  function resetAssemblyLayout() {
    elements.layoutRoot?.classList.remove("pm-cinematic__layout-root--plan");
    elements.layoutRoot?.classList.add("pm-cinematic__layout-root--match");
  }

  function resetInitialStates() {
    resetAssemblyLayout();
    applyInitialStates(elements);
  }

  function showOpener() {
    if (elements.openerBeat) {
      utils.set(elements.openerBeat, { opacity: 1 });
    }
    if (elements.openerLines.length) {
      utils.set(elements.openerLines, { opacity: 1, translateY: 0 });
    }
  }

  function revert() {
    resetAssemblyLayout();
  }

  return {
    mobile,
    elements,
    enterStackedLayout,
    resetAssemblyLayout,
    resetInitialStates,
    showOpener,
    revert
  };
}
