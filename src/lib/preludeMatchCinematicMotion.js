import {
  createTimeline,
  cubicBezier,
  stagger,
  spring,
  utils
} from "animejs";

export const PRELUDE_MATCH_CINEMATIC_DURATION_MS = 24000;
export const CINEMATIC_EASE = cubicBezier(0.16, 1, 0.3, 1);
export const CINEMATIC_EASE_SOFT = cubicBezier(0.22, 1, 0.36, 1);
export const CINEMATIC_WORDMARK_SPRING = spring({ stiffness: 210, damping: 16 });
export const CINEMATIC_PIG_SPRING = spring({ stiffness: 240, damping: 12 });
export const CINEMATIC_LOOP_BRIDGE_MS = 1600;
export const CINEMATIC_LOOP_RESUME_AT_MS = 700;

export const CINEMATIC_LABELS = {
  opener: "opener",
  openerHold: "openerHold",
  openerOut: "openerOut",
  mentorReveal: "mentorReveal",
  mentorHold: "mentorHold",
  progressShow: "progressShow",
  progressFill: "progressFill",
  progressHide: "progressHide",
  assemblyShow: "assemblyShow",
  tasksEnter: "tasksEnter",
  meetingEnter: "meetingEnter",
  rewardShow: "rewardShow",
  coinsEnter: "coinsEnter",
  groupExit: "groupExit",
  wordmark: "wordmark",
  loopBridge: "loopBridge",
  end: "end"
};

export const CINEMATIC_TIMES = {
  opener: 0,
  openerHold: 800,
  openerOut: 2200,
  mentorReveal: 2200,
  mentorHold: 3800,
  progressShow: 7000,
  progressFill: 7200,
  progressHide: 9200,
  assemblyShow: 9000,
  tasksEnter: 9140,
  meetingEnter: 9020,
  coinsEnter: 9600,
  rewardShow: 11200,
  groupExit: 18000,
  wordmark: 19400,
  loopBridge: 22400,
  end: 24000
};

export const CINEMATIC_TIMES_MOBILE = {
  ...CINEMATIC_TIMES,
  progressHide: 8800,
  assemblyShow: 8600,
  meetingEnter: 8620,
  tasksEnter: 8740,
  coinsEnter: null,
  rewardShow: 10400,
  groupExit: 15800,
  wordmark: 17200,
  loopBridge: 20200,
  end: 22200
};

export const PRELUDE_MATCH_CINEMATIC_DURATION_MS_MOBILE = CINEMATIC_TIMES_MOBILE.end;
export const CINEMATIC_LOOP_BRIDGE_AT_MS = CINEMATIC_TIMES.loopBridge;
export const CINEMATIC_LOOP_BRIDGE_AT_MS_MOBILE = CINEMATIC_TIMES_MOBILE.loopBridge;

/** @deprecated use CINEMATIC_TIMES */
export const CINEMATIC_PHASES = {
  opener: { start: 0, in: 1200, hold: 1800, out: 1000 },
  mentorReveal: { start: 4000, in: 1400, hold: 3600 },
  progressShow: { start: 10000, in: 600 },
  progressFill: { start: 10400, duration: 1600 },
  progressHide: { start: 14000, duration: 600 },
  assemblyShow: { start: 15000, duration: 600 },
  mentorAssembly: { start: 15000, in: 1200 },
  tasksEnter: { start: 15300, in: 1200 },
  coinsEnter: { start: 18000, in: 1200 },
  groupExit: { start: 22000, duration: 1800 },
  wordmark: { start: 23600, in: 1000, hold: 3400 }
};

export const CINEMATIC_PHASES_MOBILE = {
  ...CINEMATIC_PHASES,
  coinsEnter: null,
  groupExit: { start: 19800, duration: 1530 },
  wordmark: { start: 21330, in: 850, hold: 2890 },
  progressHide: { start: 11900, duration: 510 },
  assemblyShow: { start: 12750, duration: 510 },
  mentorAssembly: { start: 12750, in: 1020 },
  tasksEnter: { start: 13050, in: 1020 }
};


function labelTimeline(timeline, times) {
  Object.entries(CINEMATIC_LABELS).forEach(([key, name]) => {
    if (times[key] != null) timeline.label(name, times[key]);
  });
}

function addTargets(timeline, targets, params, position) {
  if (!targets?.length) return timeline;
  return timeline.add(targets, params, position);
}

function addOpener(timeline, runtime) {
  const { elements } = runtime;
  const { openerBeat, openerLines } = elements;
  if (!openerBeat || !openerLines.length) return;

  timeline
    .add(
      openerLines,
      {
        translateY: [10, 0],
        opacity: [0.88, 1],
        duration: 650,
        delay: stagger(90, { from: "first" })
      },
      CINEMATIC_LABELS.opener
    )
    .add(
      openerLines,
      {
        opacity: [1, 0],
        translateY: [0, -10],
        duration: 520,
        ease: CINEMATIC_EASE_SOFT,
        delay: stagger(45, { from: "last" })
      },
      `${CINEMATIC_LABELS.openerOut}-=520`
    )
    .add(
      openerBeat,
      { opacity: [1, 0], duration: 240, ease: CINEMATIC_EASE_SOFT },
      `${CINEMATIC_LABELS.openerOut}-=240`
    );
}

function addAtmosphere(timeline, runtime, mobile) {
  const { glowWarm, glowAccent } = runtime.elements;
  if (!glowWarm) return;

  timeline
    .add(
      glowWarm,
      {
        opacity: [0.32, 0.55],
        scale: [1.06, 1],
        duration: 1200,
        ease: CINEMATIC_EASE_SOFT
      },
      CINEMATIC_LABELS.opener
    )
    .add(
      glowWarm,
      { opacity: [0.48, 0.64], duration: 1000 },
      CINEMATIC_LABELS.wordmark
    );

  if (!glowAccent) return;

  timeline
    .add(
      glowAccent,
      {
        opacity: [0, 0.78],
        scale: [0.9, 1.1],
        duration: 2200
      },
      CINEMATIC_LABELS.progressShow
    )
    .add(glowAccent, { opacity: [0.78, 0], duration: 600 }, CINEMATIC_LABELS.progressHide);

  if (!mobile) {
    timeline.add(glowWarm, { opacity: 0.42, duration: 800 }, CINEMATIC_LABELS.coinsEnter);
  }
}

// Fractions of the mentorReveal->loopBridge span given to each beat's camera
// move. One continuous, single-direction push that settles per beat and returns
// to rest for a seamless loop, instead of scale reversals that fight crossfades.
const CAMERA_BEAT_FRACTIONS = [0.25, 0.2084, 0.2916, 0.25];

function addCameraMotion(timeline, runtime, times) {
  const { camera } = runtime.elements;
  if (!camera) return;

  const span = times.loopBridge - times.mentorReveal;
  const [mentorSpan, progressSpan, assemblySpan, restSpan] = CAMERA_BEAT_FRACTIONS.map(
    (fraction) => Math.round(span * fraction)
  );

  timeline.add(
    camera,
    {
      keyframes: [
        { scale: 1, translateY: 0, duration: 0 },
        { scale: 1.035, translateY: -3, duration: mentorSpan },
        { scale: 1.02, translateY: -1, duration: progressSpan },
        { scale: 1.05, translateY: -4, duration: assemblySpan },
        { scale: 1, translateY: 0, duration: restSpan }
      ],
      ease: CINEMATIC_EASE_SOFT
    },
    CINEMATIC_LABELS.mentorReveal
  );
}

function addMentorReveal(timeline, runtime) {
  const { assembly, planItem, mentorTags } = runtime.elements;
  if (!assembly || !planItem) return;

  const revealAt = `${CINEMATIC_LABELS.mentorReveal}-=180`;

  timeline
    .add(
      assembly,
      { opacity: [0, 1], scale: [0.98, 1], translateY: [14, 0], duration: 620, ease: CINEMATIC_EASE_SOFT },
      revealAt
    )
    .add(
      planItem,
      {
        opacity: [0, 1],
        scale: [0.98, 1],
        translateY: [16, 0],
        duration: 620,
        ease: CINEMATIC_EASE_SOFT
      },
      revealAt
    );

  addTargets(
    timeline,
    mentorTags,
    {
      opacity: [0, 1],
      translateY: [8, 0],
      duration: 380,
      delay: stagger(45)
    },
    `${CINEMATIC_LABELS.mentorReveal}+=700`
  );
}

function addProgressDetail(timeline, runtime, times) {
  const { assembly, progressLayer, progressFill, progressGlow, progressValue } = runtime.elements;
  if (!progressLayer || !progressFill) return;

  const fillDuration = times.progressHide - times.progressFill;

  timeline
    .add(
      assembly,
      { opacity: [1, 0.5], scale: [1, 0.99], duration: 420, ease: CINEMATIC_EASE_SOFT },
      CINEMATIC_LABELS.progressShow
    )
    .add(
      progressLayer,
      {
        opacity: [0, 1],
        scale: [0.94, 1],
        translateY: [12, 0],
        duration: 430,
        ease: CINEMATIC_EASE_SOFT
      },
      CINEMATIC_LABELS.progressShow
    )
    .add(
      progressFill,
      { scaleX: [0, 1], duration: fillDuration },
      CINEMATIC_LABELS.progressFill
    )
    .add(
      progressGlow,
      {
        opacity: [0, 1],
        scaleX: [0, 1],
        duration: fillDuration
      },
      CINEMATIC_LABELS.progressFill
    )
    .add(
      progressValue,
      {
        opacity: [0, 1],
        innerHTML: [0, 100],
        modifier: (value) => `${utils.round(0)(value)}%`,
        duration: fillDuration
      },
      CINEMATIC_LABELS.progressFill
    )
    .add(
      progressLayer,
      { opacity: [1, 0], scale: [1, 1.02], duration: 420, ease: CINEMATIC_EASE_SOFT },
      CINEMATIC_LABELS.progressHide
    )
    .add(
      assembly,
      { opacity: [0.5, 1], scale: [0.99, 1], duration: 460, ease: CINEMATIC_EASE_SOFT },
      `${CINEMATIC_LABELS.progressHide}-=300`
    )
    .add(progressGlow, { opacity: [1, 0], duration: 380, ease: CINEMATIC_EASE_SOFT }, CINEMATIC_LABELS.progressHide);
}

function addAssembly(timeline, runtime, mobile) {
  const { layoutRoot, planItem, planExpand, planSheet, planRows, mentorTags, taskChecks, rewardPills } = runtime.elements;
  if (!planItem || !planExpand) return;

  const expandAt = CINEMATIC_LABELS.assemblyShow;
  timeline
    .add(
      layoutRoot,
      {
        onBegin: () => runtime.enterStackedLayout?.(),
        opacity: [1, 1],
        duration: 1
      },
      expandAt
    )
    .add(
      mentorTags,
      { opacity: [1, 0], translateY: [0, -4], duration: 280, ease: CINEMATIC_EASE_SOFT },
      expandAt
    )
    .add(
      planExpand,
      {
        opacity: [0, 1],
        translateY: [8, 0],
        scaleY: [0.94, 1],
        duration: 680,
        ease: CINEMATIC_EASE_SOFT
      },
      expandAt
    )
    .add(
      planItem,
      { translateY: [0, -4], duration: 680, ease: CINEMATIC_EASE_SOFT },
      expandAt
    )
    .add(
      planSheet,
      { opacity: [0, 1], duration: 420, ease: CINEMATIC_EASE_SOFT },
      `${expandAt}+=120`
    );

  addTargets(
    timeline,
    planRows,
    {
      opacity: [0, 1],
      translateY: [6, 0],
      duration: 380,
      delay: stagger(110, { from: "first" }),
      ease: CINEMATIC_EASE_SOFT
    },
    `${expandAt}+=220`
  );

  if (taskChecks.length) {
    addTargets(
      timeline,
      taskChecks.slice(0, 1),
      {
        opacity: [0, 1],
        scale: [
          { to: 1.12, duration: 200, ease: CINEMATIC_EASE },
          { to: 1, duration: 420, ease: CINEMATIC_WORDMARK_SPRING }
        ],
        duration: 460
      },
      `${expandAt}+=560`
    );
  }

  if (!mobile && rewardPills.length) {
    addTargets(
      timeline,
      rewardPills,
      {
        opacity: [0, 1],
        scale: [0.92, 1],
        duration: 340,
        delay: stagger(90, { from: "first" })
      },
      `${expandAt}+=700`
    );
  }
}

function addBankScene(timeline, runtime) {
  const { bankScene, bankCoins, cashItems, gradHats } = runtime.elements;
  if (!bankScene) return;

  const bankAt = `${CINEMATIC_LABELS.groupExit}+=80`;
  const bankOutAt = `${CINEMATIC_LABELS.wordmark}+=420`;

  timeline
    .add(
      bankScene,
      {
        opacity: [0, 1],
        duration: 180,
        ease: CINEMATIC_EASE_SOFT
      },
      bankAt
    );

  addTargets(
    timeline,
    bankCoins,
    {
      opacity: [0, 1, 1, 0],
      translateY: [58, -34, -132, -202],
      translateX: [0, 0, 14, 34],
      scale: [0.68, 1.08, 1.12, 0.92],
      rotate: [-18, 10, 28, 52],
      duration: 1450,
      delay: stagger(48, { from: "center" }),
      ease: CINEMATIC_EASE_SOFT
    },
    `${bankAt}+=20`
  );

  addTargets(
    timeline,
    cashItems,
    {
      opacity: [0, 1, 1, 0],
      translateY: [68, -26, -138, -210],
      translateX: [0, 0, -14, -36],
      scale: [0.72, 1.06, 1.08, 0.92],
      rotate: [-10, -4, -22, -42],
      duration: 1500,
      delay: stagger(62, { from: "first" }),
      ease: CINEMATIC_EASE_SOFT
    },
    `${bankAt}+=70`
  );

  addTargets(
    timeline,
    gradHats,
    {
      opacity: [0, 1, 1, 0],
      translateY: [64, -42, -142, -218],
      translateX: [0, 0, 12, 30],
      scale: [0.72, 1.04, 1.12, 0.9],
      rotate: [-18, 8, 24, 48],
      duration: 1550,
      delay: stagger(74, { from: "last" }),
      ease: CINEMATIC_EASE_SOFT
    },
    `${bankAt}+=130`
  );

  timeline.add(
    bankScene,
    { opacity: [1, 0], duration: 320, ease: CINEMATIC_EASE_SOFT },
    bankOutAt
  );
}

function addExitAndWordmark(timeline, runtime) {
  const { assembly, pigMoment, wordmarkBeat, wordmark, wordmarkGlow, wordmarkTech } = runtime.elements;
  if (!wordmarkBeat || !wordmark) return;

  timeline
    .add(
      assembly,
      { opacity: [1, 0], scale: [1, 0.94], translateY: [0, 12], duration: 520, ease: CINEMATIC_EASE_SOFT },
      CINEMATIC_LABELS.groupExit
    )
    .add(
      pigMoment,
      { opacity: [1, 0], scale: [1, 0.96], translateY: [0, 8], duration: 420, ease: CINEMATIC_EASE_SOFT },
      CINEMATIC_LABELS.groupExit
    )
    .add(
      wordmarkBeat,
      { opacity: [0, 1], duration: 460, ease: CINEMATIC_EASE_SOFT },
      `${CINEMATIC_LABELS.wordmark}-=220`
    )
    .add(
      wordmark,
      {
        scale: [
          { to: 1.14, ease: CINEMATIC_EASE, duration: 320 },
          { to: 1.02, ease: CINEMATIC_WORDMARK_SPRING, duration: 520 }
        ],
        translateY: [8, 0]
      },
      `${CINEMATIC_LABELS.wordmark}-=120`
    )
    .add(
      wordmarkGlow,
      { opacity: [0, 0.72], scale: [0.9, 1.08], duration: 520 },
      `${CINEMATIC_LABELS.wordmark}-=160`
    );

  addTargets(
    timeline,
    wordmarkTech,
    {
      opacity: [0, 1, 0.35],
      scale: [0.84, 1.12, 1.2],
      rotate: [0, 10, 18],
      duration: 720,
      delay: stagger(60, { from: "center" }),
      ease: CINEMATIC_EASE_SOFT
    },
    `${CINEMATIC_LABELS.wordmark}-=250`
  );
}

function addPigMoment(timeline, runtime, mobile) {
  const { pig, pigBubble, pigMoment } = runtime.elements;
  if (!pig) return;

  const enterAt = mobile ? `${CINEMATIC_LABELS.assemblyShow}+=1200` : CINEMATIC_LABELS.rewardShow;

  timeline
    .add(
      pigMoment,
      {
        opacity: [0, 1],
        scale: [0.96, 1],
        translateY: [10, 0],
        duration: 320,
        ease: CINEMATIC_EASE_SOFT
      },
      enterAt
    )
    .add(
      pig,
      {
        opacity: [0, 1],
        translateY: [
          { to: -6, ease: CINEMATIC_EASE, duration: 200 },
          { to: 0, ease: CINEMATIC_PIG_SPRING, duration: 460 }
        ],
        scale: [
          { to: 1.06, ease: CINEMATIC_EASE, duration: 200 },
          { to: 1, ease: CINEMATIC_PIG_SPRING, duration: 460 }
        ],
        rotate: [
          { to: 3, ease: CINEMATIC_EASE, duration: 200 },
          { to: 0, ease: CINEMATIC_PIG_SPRING, duration: 460 }
        ]
      },
      enterAt
    )
    .add(
      pigBubble,
      {
        opacity: [0, 1],
        scale: [0.92, 1],
        translateY: [6, 0],
        duration: 280,
        ease: CINEMATIC_EASE_SOFT
      },
      `${enterAt}+=220`
    )
    .add(
      pig,
      {
        translateY: [0, -4, 0],
        rotate: [0, -2, 0],
        duration: 520,
        ease: CINEMATIC_EASE_SOFT
      },
      `${enterAt}+=800`
    )
    .add(pigBubble, { opacity: [1, 0], duration: 220, ease: CINEMATIC_EASE_SOFT }, `${CINEMATIC_LABELS.groupExit}-=60`);
}

function addLoopBridge(timeline, runtime, mobile) {
  const { openerBeat, openerLines, wordmarkBeat, wordmarkGlow, wordmarkTech, glowWarm } = runtime.elements;
  const endMs = mobile ? CINEMATIC_TIMES_MOBILE.end : CINEMATIC_TIMES.end;
  const bridgeMs = endMs - (mobile ? CINEMATIC_TIMES_MOBILE.loopBridge : CINEMATIC_TIMES.loopBridge);

  timeline
    .add(
      wordmarkBeat,
      { opacity: [1, 0], scale: [1, 0.96], duration: bridgeMs },
      CINEMATIC_LABELS.loopBridge
    )
    .add(wordmarkGlow, { opacity: [0.8, 0], duration: bridgeMs }, CINEMATIC_LABELS.loopBridge)
    .add(wordmarkTech, { opacity: [0.35, 0], duration: bridgeMs }, CINEMATIC_LABELS.loopBridge)
    .add(glowWarm, { opacity: [0.64, 0.34], duration: bridgeMs }, CINEMATIC_LABELS.loopBridge)
    .add(openerBeat, { opacity: [0, 1], duration: 1 }, CINEMATIC_LABELS.loopBridge);

  runtime.showOpener?.();

  addTargets(
    timeline,
    openerLines,
    {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: bridgeMs,
      delay: stagger(90, { from: "first" })
    },
    CINEMATIC_LABELS.loopBridge
  );
}

/**
 * Single coordinated anime.js timeline for the hero film loop.
 * Call `.init()` before `.play()` so all from-states render immediately.
 */
export function buildPreludeMatchCinematicTimeline({
  mobile = false,
  lite = false,
  runtime = null,
  onLoop,
  onLoopReset
} = {}) {
  if (!runtime?.elements) {
    throw new Error("PreludeMatch cinematic requires an initialized runtime");
  }

  const times = mobile ? CINEMATIC_TIMES_MOBILE : CINEMATIC_TIMES;

  const timeline = createTimeline({
    autoplay: false,
    defaults: { ease: CINEMATIC_EASE },
    onComplete: () => {
      onLoopReset?.();
      onLoop?.();
      runtime.showOpener?.();
      timeline.seek(CINEMATIC_LOOP_RESUME_AT_MS);
      timeline.play();
    }
  });

  labelTimeline(timeline, times);
  if (!lite) {
    addAtmosphere(timeline, runtime, mobile);
    addCameraMotion(timeline, runtime, times);
  }
  addOpener(timeline, runtime);
  addMentorReveal(timeline, runtime);
  addProgressDetail(timeline, runtime, times);
  addAssembly(timeline, runtime, mobile);
  addPigMoment(timeline, runtime, mobile);
  if (!lite) addBankScene(timeline, runtime);
  addExitAndWordmark(timeline, runtime);
  addLoopBridge(timeline, runtime, mobile);

  return timeline;
}

export function getCinematicDurationMs(mobile = false) {
  return mobile ? PRELUDE_MATCH_CINEMATIC_DURATION_MS_MOBILE : PRELUDE_MATCH_CINEMATIC_DURATION_MS;
}
