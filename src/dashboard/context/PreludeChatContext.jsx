import { createContext, useContext } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { roleFromUser } from "../../lib/dashboardRoutes.js";
import { usePreludeChat } from "../hooks/usePreludeChat.js";
import { useDashboardData } from "./DashboardDataContext.jsx";

const PreludeChatContext = createContext(null);

export function PreludeChatProvider({ children }) {
  const { user } = useAuth();
  const { isGuardianViewMode } = useDashboardData();
  const role = roleFromUser(user);
  const enabled = Boolean(user) && ["student", "mentor", "parent"].includes(role) && !isGuardianViewMode;
  const chat = usePreludeChat({ enabled });

  return (
    <PreludeChatContext.Provider value={{ ...chat, enabled }}>
      {children}
    </PreludeChatContext.Provider>
  );
}

export function usePreludeChatContext() {
  const ctx = useContext(PreludeChatContext);
  if (!ctx) {
    throw new Error("usePreludeChatContext must be used within PreludeChatProvider");
  }
  return ctx;
}

export function usePreludeChatContextOptional() {
  return useContext(PreludeChatContext);
}
