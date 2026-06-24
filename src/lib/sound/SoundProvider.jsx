import { createContext, useCallback, useContext, useMemo } from "react";
import { loadPreferences } from "../../dashboard/lib/dashboardPreferences.js";
import { playSoundEvent, SOUND_EVENTS, unlockInterfaceAudio } from "./soundEvents.js";
import { usePreludeMotion } from "../../context/MotionContext.jsx";

const SoundContext = createContext(null);

export function SoundProvider({ children }) {
  const { reducedMotion } = usePreludeMotion();

  const soundsEnabled = useCallback(() => {
    const prefs = loadPreferences();
    return prefs.interfaceSounds !== false && prefs.notificationSounds !== false && !prefs.reduceMotion && !reducedMotion;
  }, [reducedMotion]);

  const play = useCallback(
    (event) => {
      playSoundEvent(event, { enabled: soundsEnabled() });
    },
    [soundsEnabled]
  );

  const unlock = useCallback(() => unlockInterfaceAudio(), []);

  const value = useMemo(
    () => ({ play, unlock, soundsEnabled: soundsEnabled(), SOUND_EVENTS }),
    [play, unlock, soundsEnabled]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useInterfaceSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    return {
      play: () => {},
      unlock: () => {},
      soundsEnabled: false,
      SOUND_EVENTS
    };
  }
  return ctx;
}
