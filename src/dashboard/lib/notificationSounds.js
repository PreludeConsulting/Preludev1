import { loadPreferences } from "./dashboardPreferences.js";

let audioContext = null;
let unlocked = false;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  return audioContext;
}

export function unlockNotificationSounds() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => {
      unlocked = true;
    }).catch(() => {});
    return;
  }
  unlocked = true;
}

if (typeof window !== "undefined") {
  const unlockOnce = () => {
    unlockNotificationSounds();
    window.removeEventListener("pointerdown", unlockOnce);
    window.removeEventListener("keydown", unlockOnce);
  };
  window.addEventListener("pointerdown", unlockOnce, { passive: true });
  window.addEventListener("keydown", unlockOnce, { passive: true });
}

function areNotificationSoundsEnabled() {
  const prefs = loadPreferences();
  return prefs.notificationSounds !== false && !prefs.reduceMotion;
}

function areMessageSoundsEnabled() {
  const prefs = loadPreferences();
  return prefs.mentorMessages !== false && prefs.notificationSounds !== false && !prefs.reduceMotion;
}

function playTone(ctx, { frequency, duration, gain = 0.07, delay = 0, type = "sine" }) {
  const startAt = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  amp.gain.setValueAtTime(0.0001, startAt);
  amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.04);
}

function playIfReady(playFn) {
  const ctx = getAudioContext();
  if (!ctx) return;
  unlockNotificationSounds();
  if (ctx.state !== "running" && !unlocked) return;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => playFn(ctx)).catch(() => {});
    return;
  }
  playFn(ctx);
}

export function playLiveNotificationSound() {
  if (!areNotificationSoundsEnabled()) return;
  playIfReady((ctx) => {
    playTone(ctx, { frequency: 660, duration: 0.12, gain: 0.055 });
    playTone(ctx, { frequency: 880, duration: 0.14, gain: 0.045, delay: 0.08 });
  });
}

export function playIncomingMessageSound() {
  if (!areMessageSoundsEnabled()) return;
  playIfReady((ctx) => {
    playTone(ctx, { frequency: 740, duration: 0.08, gain: 0.05 });
    playTone(ctx, { frequency: 988, duration: 0.1, gain: 0.042, delay: 0.09 });
  });
}
