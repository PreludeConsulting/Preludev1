import { playSoundEvent, SOUND_EVENTS } from "../../lib/sound/soundEvents.js";
import { loadPreferences } from "./dashboardPreferences.js";

export { unlockInterfaceAudio as unlockNotificationSounds } from "../../lib/sound/soundEvents.js";

function soundsOn() {
  const prefs = loadPreferences();
  return prefs.interfaceSounds !== false && prefs.notificationSounds !== false && !prefs.reduceMotion;
}

export function playLiveNotificationSound() {
  playSoundEvent(SOUND_EVENTS.REWARD_EARNED, { enabled: soundsOn() });
}

export function playIncomingMessageSound() {
  playSoundEvent(SOUND_EVENTS.MESSAGE_SENT, { enabled: soundsOn() });
}
