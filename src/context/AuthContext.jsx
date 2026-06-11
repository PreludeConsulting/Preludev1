import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredSession, signIn as authSignIn, signOut as authSignOut, signUp as authSignUp } from "../lib/auth.js";
import { getPlan } from "../lib/plans.js";
import { isSupabaseConfigured } from "../lib/supabaseConfig.js";

const AuthContext = createContext(null);

async function loadSupabaseAuth() {
  return import("../lib/supabaseAuth.js");
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const useSupabase = isSupabaseConfigured();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [personalizedAiRequest, setPersonalizedAiRequest] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let subscription = null;

    async function bootstrap() {
      try {
        if (useSupabase) {
          const { resolveSupabaseAppUser, onAuthStateChange, getProfile } = await loadSupabaseAuth();
          const sessionUser = await resolveSupabaseAppUser();
          if (!cancelled) setUser(sessionUser);

          const { data } = onAuthStateChange(async (_event, session) => {
            if (cancelled) return;
            if (!session) {
              setUser(null);
              return;
            }
            const { resolveSupabaseAppUser: resolveUser } = await loadSupabaseAuth();
            const next = await resolveUser();
            if (!cancelled) setUser(next);
          });
          subscription = data.subscription;
        } else {
          const session = await getStoredSession();
          if (!cancelled) setUser(session);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [useSupabase]);

  const openSignIn = useCallback(() => {
    setAuthError(null);
    setAccountOpen(false);
    setSignInOpen(false);
    navigate("/login");
  }, [navigate]);

  const openRegister = useCallback(() => {
    setAuthError(null);
    setAccountOpen(false);
    setSignInOpen(false);
    navigate("/register");
  }, [navigate]);

  const openAccount = useCallback(() => {
    setSignInOpen(false);
    setAccountOpen(true);
  }, []);

  const closeModals = useCallback(() => {
    setSignInOpen(false);
    setAccountOpen(false);
    setAuthError(null);
  }, []);

  const signIn = useCallback(async (email, password) => {
    setAuthError(null);
    try {
      if (useSupabase) {
        const { logIn } = await loadSupabaseAuth();
        const { user: next, error } = await logIn({ email, password });
        if (error) throw new Error(error);
        setUser(next);
        setSignInOpen(false);
        return next;
      }
      const next = await authSignIn(email, password);
      setUser(next);
      setSignInOpen(false);
      return next;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  }, [useSupabase]);

  const signUp = useCallback(async (payload) => {
    setAuthError(null);
    try {
      if (useSupabase) {
        const { signUp: supabaseSignUp } = await loadSupabaseAuth();
        const fullName = `${payload.firstName || ""} ${payload.lastName || ""}`.trim();
        const role = (payload.role || "STUDENT").toLowerCase() === "mentor" ? "mentor" : "student";
        const { user: next, error, needsEmailConfirmation } = await supabaseSignUp({
          email: payload.email,
          password: payload.password,
          fullName: fullName || "Student User",
          role
        });
        if (error) throw new Error(error);
        if (next) {
          setUser(next);
          setSignInOpen(false);
        }
        return {
          ...next,
          emailVerified: Boolean(next && !needsEmailConfirmation),
          needsEmailConfirmation
        };
      }
      const next = await authSignUp(payload);
      if (next?.emailVerified) {
        setUser(next);
        setSignInOpen(false);
      }
      return next;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  }, [useSupabase]);

  const signOut = useCallback(async () => {
    if (useSupabase) {
      const { logOut } = await loadSupabaseAuth();
      await logOut();
    } else {
      await authSignOut();
    }
    setUser(null);
    setAccountOpen(false);
  }, [useSupabase]);

  const refreshUser = useCallback(async () => {
    if (useSupabase) {
      const { resolveSupabaseAppUser } = await loadSupabaseAuth();
      const session = await resolveSupabaseAppUser();
      setUser(session);
      return session;
    }
    const session = await getStoredSession();
    setUser(session);
    return session;
  }, [useSupabase]);

  const requestPersonalizedAi = useCallback(() => {
    setPersonalizedAiRequest((n) => n + 1);
  }, []);

  const planDetails = useMemo(() => (user?.plan ? getPlan(user.plan) : null), [user]);

  const saveUserPlan = useCallback(async (planId) => {
    if (!user) throw new Error("You must be signed in to choose a plan.");
    if (useSupabase) {
      const { saveUserPlan: persistPlan } = await loadSupabaseAuth();
      const { error } = await persistPlan(user.id, planId);
      if (error) throw new Error(error);
      const next = {
        ...user,
        plan: planId,
        planSelected: true,
        planName: getPlan(planId).name,
        onboardingStatus: "needs_match",
        matchOnboardingComplete: false
      };
      setUser(next);
      return next;
    }
    // Prisma path: plan is normally set server-side; update local state for onboarding UX.
    const next = { ...user, plan: planId, planSelected: true, planName: getPlan(planId).name };
    setUser(next);
    return next;
  }, [useSupabase, user]);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(user),
      planDetails,
      useSupabase,
      signInOpen,
      accountOpen,
      authError,
      openSignIn,
      openRegister,
      openAccount,
      closeModals,
      signIn,
      signUp,
      signOut,
      saveUserPlan,
      setAuthError,
      personalizedAiRequest,
      requestPersonalizedAi,
      refreshUser
    }),
    [
      user,
      ready,
      planDetails,
      useSupabase,
      signInOpen,
      accountOpen,
      authError,
      openSignIn,
      openRegister,
      openAccount,
      closeModals,
      signIn,
      signUp,
      signOut,
      saveUserPlan,
      personalizedAiRequest,
      requestPersonalizedAi,
      refreshUser
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
