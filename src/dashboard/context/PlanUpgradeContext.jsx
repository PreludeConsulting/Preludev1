import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Modal } from "../components/ui/index.jsx";
import PlanLockedFeature from "../components/product/PlanLockedFeature.jsx";
import { getFeatureLockCopy } from "../../lib/planFeatures.js";

const PlanUpgradeContext = createContext(null);

export function PlanUpgradeProvider({ children }) {
  const [featureKey, setFeatureKey] = useState("");

  const openUpgrade = useCallback((nextFeature) => {
    setFeatureKey(nextFeature || "");
  }, []);

  const closeUpgrade = useCallback(() => {
    setFeatureKey("");
  }, []);

  const value = useMemo(
    () => ({
      openUpgrade,
      closeUpgrade,
      activeFeature: featureKey
    }),
    [closeUpgrade, featureKey, openUpgrade]
  );

  const copy = featureKey ? getFeatureLockCopy(featureKey) : null;

  return (
    <PlanUpgradeContext.Provider value={value}>
      {children}
      <Modal open={Boolean(featureKey)} onClose={closeUpgrade} title={copy?.title || "Upgrade to unlock"}>
        {featureKey ? <PlanLockedFeature feature={featureKey} actionLabel="Upgrade Plan" /> : null}
      </Modal>
    </PlanUpgradeContext.Provider>
  );
}

export function usePlanUpgrade() {
  const ctx = useContext(PlanUpgradeContext);
  if (!ctx) {
    return {
      openUpgrade: () => {},
      closeUpgrade: () => {},
      activeFeature: ""
    };
  }
  return ctx;
}
