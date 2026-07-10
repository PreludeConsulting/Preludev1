import { createContext, useCallback, useContext, useMemo, useState } from "react";
import UpgradeLockModal from "../components/product/UpgradeLockModal.jsx";
import { STUDENT_DASHBOARD_BASE } from "../../lib/dashboardRoutes.js";

const PlanUpgradeContext = createContext(null);

export function PlanUpgradeProvider({ children }) {
  const [featureKey, setFeatureKey] = useState("");

  const openUpgrade = useCallback((nextFeature) => {
    setFeatureKey(nextFeature || "rewards");
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

  return (
    <PlanUpgradeContext.Provider value={value}>
      {children}
      <UpgradeLockModal
        open={Boolean(featureKey)}
        featureKey={featureKey || "rewards"}
        onClose={closeUpgrade}
        upgradeHref={`${STUDENT_DASHBOARD_BASE}/billing`}
      />
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
