import { useCallback, useState } from "react";
import { useInterfaceSound } from "../../lib/sound/SoundProvider.jsx";

export function useRewardCelebration() {
  const { play, SOUND_EVENTS } = useInterfaceSound();
  const [burst, setBurst] = useState(null);

  const celebrate = useCallback(
    ({ amount = 0, origin = null, label = "" } = {}) => {
      setBurst({ id: Date.now(), amount, origin, label });
      play(SOUND_EVENTS.REWARD_EARNED);
      if (amount > 0) {
        window.setTimeout(() => play(SOUND_EVENTS.COIN_COLLECT), 120);
      }
    },
    [play, SOUND_EVENTS]
  );

  const clearBurst = useCallback(() => setBurst(null), []);

  return { burst, celebrate, clearBurst };
}
