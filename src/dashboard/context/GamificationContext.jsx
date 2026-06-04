import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { levelFromXp } from "../data/gamification.js";

const GamificationContext = createContext(null);

function storageKey(email) {
  return `prelude-gamification-${(email || "guest").toLowerCase()}`;
}

export function GamificationProvider({ children, user, initial }) {
  const [state, setState] = useState(initial || { xp: 0, streak: 0, missions: [], badges: [], activityFeed: [] });
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!initial) return;
    const key = storageKey(user?.email);
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      setState({
        ...initial,
        xp: saved.xp ?? initial.xp,
        streak: saved.streak ?? initial.streak,
        missions: (initial.missions || []).map((m) => ({
          ...m,
          done: saved.completedMissions?.includes(m.id) ?? m.done
        })),
        badges: saved.extraBadges ? [...(initial.badges || []), ...saved.extraBadges] : initial.badges,
        activityFeed: saved.activityFeed?.length ? saved.activityFeed : initial.activityFeed
      });
    } catch {
      setState(initial);
    }
  }, [initial, user?.email]);

  const persist = useCallback(
    (next) => {
      const key = storageKey(user?.email);
      localStorage.setItem(
        key,
        JSON.stringify({
          xp: next.xp,
          streak: next.streak,
          completedMissions: next.missions.filter((m) => m.done).map((m) => m.id),
          activityFeed: next.activityFeed?.slice(0, 12),
          extraBadges: next.badges?.filter((b) => !initial?.badges?.find((x) => x.id === b.id))
        })
      );
    },
    [user?.email, initial?.badges]
  );

  const showToast = useCallback((message, variant = "success") => {
    const id = `toast-${Date.now()}`;
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const completeMission = useCallback(
    (missionId) => {
      setState((prev) => {
        const mission = prev.missions.find((m) => m.id === missionId);
        if (!mission || mission.done) return prev;
        const xpGain = mission.xp || 15;
        const feedItem = {
          id: `feed-${Date.now()}`,
          type: "task",
          text: "Mission complete",
          sub: `+${xpGain} XP · ${mission.title}`,
          time: "Just now"
        };
        const next = {
          ...prev,
          xp: prev.xp + xpGain,
          missions: prev.missions.map((m) => (m.id === missionId ? { ...m, done: true } : m)),
          activityFeed: [feedItem, ...(prev.activityFeed || [])].slice(0, 12)
        };
        persist(next);
        showToast(`Mission complete · +${xpGain} XP`);
        return next;
      });
    },
    [persist, showToast]
  );

  const level = useMemo(() => levelFromXp(state.xp), [state.xp]);

  const value = useMemo(
    () => ({ ...state, level, completeMission, showToast, setState }),
    [state, level, completeMission, showToast]
  );

  return (
    <GamificationContext.Provider value={value}>
      {children}
      <div className="dash-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`dash-toast dash-toast--${t.variant}`}>
            {t.message}
          </div>
        ))}
      </div>
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const ctx = useContext(GamificationContext);
  return ctx;
}
