/** Interface sound event keys. */
export const SOUND_EVENTS = {
  CLICK: "click",
  HEART: "heart",
  MESSAGE_SENT: "messageSent",
  CALENDAR_SUCCESS: "calendarSuccess",
  SAVE_SUCCESS: "saveSuccess",
  TASK_COMPLETE: "taskComplete",
  REWARD_EARNED: "rewardEarned",
  COIN_COLLECT: "coinCollect"
};

let audioContext = null;
let unlocked = false;
const lastPlayed = new Map();
const MIN_GAP_MS = 90;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

export function unlockInterfaceAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => { unlocked = true; }).catch(() => {});
    return;
  }
  unlocked = true;
}

if (typeof window !== "undefined") {
  const once = () => {
    unlockInterfaceAudio();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once, { passive: true });
  window.addEventListener("keydown", once, { passive: true });
}

function tone(ctx, { frequency, duration = 0.1, gain = 0.05, delay = 0, type = "sine" }) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

const SOUND_SCRIPTS = {
  [SOUND_EVENTS.CLICK]: (ctx) => tone(ctx, { frequency: 520, duration: 0.05, gain: 0.028 }),
  [SOUND_EVENTS.HEART]: (ctx) => {
    tone(ctx, { frequency: 440, duration: 0.07, gain: 0.04 });
    tone(ctx, { frequency: 660, duration: 0.09, gain: 0.035, delay: 0.06 });
  },
  [SOUND_EVENTS.MESSAGE_SENT]: (ctx) => {
    tone(ctx, { frequency: 620, duration: 0.07, gain: 0.038 });
    tone(ctx, { frequency: 880, duration: 0.09, gain: 0.03, delay: 0.07 });
  },
  [SOUND_EVENTS.CALENDAR_SUCCESS]: (ctx) => {
    tone(ctx, { frequency: 523, duration: 0.1, gain: 0.04 });
    tone(ctx, { frequency: 659, duration: 0.12, gain: 0.034, delay: 0.08 });
    tone(ctx, { frequency: 784, duration: 0.14, gain: 0.028, delay: 0.16 });
  },
  [SOUND_EVENTS.SAVE_SUCCESS]: (ctx) => {
    tone(ctx, { frequency: 600, duration: 0.08, gain: 0.035 });
    tone(ctx, { frequency: 750, duration: 0.1, gain: 0.03, delay: 0.07 });
  },
  [SOUND_EVENTS.TASK_COMPLETE]: (ctx) => {
    tone(ctx, { frequency: 500, duration: 0.08, gain: 0.04 });
    tone(ctx, { frequency: 700, duration: 0.1, gain: 0.036, delay: 0.07 });
    tone(ctx, { frequency: 900, duration: 0.1, gain: 0.028, delay: 0.14 });
  },
  [SOUND_EVENTS.REWARD_EARNED]: (ctx) => {
    tone(ctx, { frequency: 587, duration: 0.1, gain: 0.042 });
    tone(ctx, { frequency: 740, duration: 0.12, gain: 0.038, delay: 0.09 });
    tone(ctx, { frequency: 988, duration: 0.14, gain: 0.032, delay: 0.18 });
  },
  [SOUND_EVENTS.COIN_COLLECT]: (ctx) => {
    tone(ctx, { frequency: 880, duration: 0.06, gain: 0.04, type: "triangle" });
    tone(ctx, { frequency: 1100, duration: 0.08, gain: 0.032, delay: 0.05, type: "triangle" });
  }
};

export function playSoundEvent(event, { enabled = true } = {}) {
  if (!enabled || typeof window === "undefined") return;
  const now = Date.now();
  const last = lastPlayed.get(event) || 0;
  if (now - last < MIN_GAP_MS) return;
  lastPlayed.set(event, now);

  const ctx = getCtx();
  if (!ctx) return;
  unlockInterfaceAudio();

  const run = (context) => {
    const fn = SOUND_SCRIPTS[event];
    if (fn) fn(context);
  };

  if (ctx.state === "suspended") {
    ctx.resume().then(() => run(ctx)).catch(() => {});
    return;
  }
  if (ctx.state !== "running" && !unlocked) return;
  run(ctx);
}
