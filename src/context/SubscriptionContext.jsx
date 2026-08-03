import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchMySubscription } from "../lib/billingMembership.js";
import { useAuth } from "./AuthContext.jsx";

const SubscriptionContext = createContext(null);

const SYNC_ATTEMPTS = 8;
const SYNC_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SubscriptionProvider({ children }) {
  const { user, ready, refreshUser } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      return null;
    }
    const role = String(user.role || "").toLowerCase();
    if (role !== "student" && role !== "parent") {
      setSubscription(null);
      return null;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await fetchMySubscription();
      if (requestId !== requestIdRef.current) return null;
      setSubscription(result);
      return result;
    } catch (err) {
      if (requestId !== requestIdRef.current) return null;
      setError(err.message || "We couldn’t load your subscription.");
      return null;
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!ready) return undefined;
    load();
    return undefined;
  }, [ready, load]);

  const syncAfterStripe = useCallback(
    async ({ expectActivePlanId = null, expectIsActive = null } = {}) => {
      setSyncing(true);
      setError("");
      let latest = null;
      try {
        for (let attempt = 0; attempt < SYNC_ATTEMPTS; attempt += 1) {
          latest = await load();
          await refreshUser?.().catch(() => null);
          const planMatch =
            expectActivePlanId == null ||
            String(latest?.activePlanId || "").toLowerCase() === String(expectActivePlanId).toLowerCase();
          const activeMatch = expectIsActive == null || Boolean(latest?.isActive) === Boolean(expectIsActive);
          if (latest && planMatch && activeMatch) break;
          await sleep(SYNC_DELAY_MS);
        }
      } finally {
        setSyncing(false);
      }
      return latest;
    },
    [load, refreshUser]
  );

  const value = useMemo(
    () => ({
      subscription,
      loading,
      syncing,
      error,
      refreshSubscription: load,
      syncAfterStripe,
      isActive: Boolean(subscription?.isActive),
      activePlanId: subscription?.activePlanId || "basic"
    }),
    [subscription, loading, syncing, error, load, syncAfterStripe]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    return {
      subscription: null,
      loading: false,
      syncing: false,
      error: "",
      refreshSubscription: async () => null,
      syncAfterStripe: async () => null,
      isActive: false,
      activePlanId: "basic"
    };
  }
  return ctx;
}
