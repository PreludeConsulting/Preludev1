import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredSession, signIn as authSignIn, signOut as authSignOut, signUp as authSignUp, deleteAccount as authDeleteAccount, verifyAccountPassword as authVerifyAccountPassword } from "../lib/auth.js";
import { acceptPendingParentInvite, storePendingParentInvite } from "../lib/parentLinks.js";
import { getDevBypassUser, getDemoSessionUser, isDevAuthBypassEnabled } from "../lib/devAuthBypass.js";
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
        if (isDevAuthBypassEnabled()) {
          if (!cancelled) setUser(getDevBypassUser());
          return;
        }

        if (useSupabase) {
          const { resolveSupabaseAppUser, onAuthStateChange } = await loadSupabaseAuth();
          try {
            const sessionUser = await resolveSupabaseAppUser();
            if (!cancelled) setUser(sessionUser);
          } catch (err) {
            console.warn("[prelude-auth] Supabase session restore failed:", err?.message || err);
            if (!cancelled) setUser(null);
          }

          try {
            const { data } = onAuthStateChange(async (_event, session) => {
              if (cancelled) return;
              if (!session) {
                setUser(null);
                return;
              }
              try {
                const { resolveSupabaseAppUser: resolveUser } = await loadSupabaseAuth();
                const next = await resolveUser();
                if (!cancelled) setUser(next);
              } catch (err) {
                console.warn("[prelude-auth] Supabase auth state update failed:", err?.message || err);
              }
            });
            subscription = data.subscription;
          } catch (err) {
            console.warn("[prelude-auth] Supabase listener setup failed:", err?.message || err);
          }
        } else {
          try {
            const session = await getStoredSession();
            if (!cancelled) setUser(session);
          } catch (err) {
            console.warn("[prelude-auth] Legacy session restore failed:", err?.message || err);
            if (!cancelled) setUser(null);
          }
        }
      } catch (err) {
        console.warn("[prelude-auth] Auth bootstrap failed:", err?.message || err);
        if (!cancelled) setUser(null);
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

  const signIn = useCallback(async (email, password, options = {}) => {
    setAuthError(null);
    try {
      if (useSupabase) {
        const { logIn } = await loadSupabaseAuth();
        const { user: next, error } = await logIn({ email, password, captchaToken: options.captchaToken });
        if (error) throw new Error(error);
        if (next?.role === "parent") {
          await acceptPendingParentInvite(next.id);
        }
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
        const roleRaw = (payload.role || "STUDENT").toLowerCase();
        const role = roleRaw === "mentor" ? "mentor" : roleRaw === "parent" ? "parent" : "student";
        if (role === "parent" && payload.parentInviteToken) {
          storePendingParentInvite(payload.parentInviteToken);
        }
        const { user: next, error, needsEmailConfirmation } = await supabaseSignUp({
          email: payload.email,
          password: payload.password,
          fullName: fullName || (role === "parent" ? "Parent User" : "Student User"),
          role,
          captchaToken: payload.captchaToken
        });
        if (error) throw new Error(error);
        if (next?.role === "parent") {
          await acceptPendingParentInvite(next.id);
        }
        if (next) {
          setUser(next);
          setSignInOpen(false);
        }
        return {
          ...next,
          emailVerified: Boolean(next?.emailVerified),
          needsEmailConfirmation
        };
      }
      const next = await authSignUp(payload);
      if (next?.id) {
        setUser(next);
        setSignInOpen(false);
      }
      return next;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  }, [useSupabase]);

  const signInAsDemo = useCallback(async (accountKey = "student") => {
    setAuthError(null);
    const next = getDemoSessionUser(accountKey);
    setUser(next);
    setSignInOpen(false);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    closeModals();
    navigate("/", { replace: true });

    try {
      if (useSupabase) {
        const { logOut } = await loadSupabaseAuth();
        await logOut();
      } else {
        await authSignOut();
      }
    } catch (error) {
      console.warn("[prelude-auth] Sign out failed:", error?.message || error);
    }

    setUser(null);
    setSignInOpen(false);
    setAccountOpen(false);
  }, [useSupabase, navigate, closeModals]);

  const verifyAccountPassword = useCallback(
    async (password) => {
      if (!user?.email) throw new Error("You must be signed in to verify your password.");
      setAuthError(null);
      try {
        if (useSupabase) {
          const { verifySupabasePassword } = await loadSupabaseAuth();
          await verifySupabasePassword({ email: user.email, password });
        } else {
          await authVerifyAccountPassword(password);
        }
        return { valid: true };
      } catch (error) {
        setAuthError(error.message);
        throw error;
      }
    },
    [useSupabase, user]
  );

  const deleteAccount = useCallback(
    async (payload) => {
      if (!user?.email) throw new Error("You must be signed in to delete your account.");
      setAuthError(null);
      try {
        if (useSupabase) {
          const { deleteSupabaseAccount } = await loadSupabaseAuth();
          await deleteSupabaseAccount({ ...payload, email: user.email });
        } else {
          await authDeleteAccount(payload);
        }
        return { success: true };
      } catch (error) {
        setAuthError(error.message);
        throw error;
      }
    },
    [useSupabase, user]
  );

  const finishAccountDeletion = useCallback(() => {
    setUser(null);
    closeModals();
    navigate("/", { replace: true });
  }, [navigate, closeModals]);

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
      signInAsDemo,
      signUp,
      signOut,
      verifyAccountPassword,
      deleteAccount,
      finishAccountDeletion,
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
      signInAsDemo,
      signUp,
      signOut,
      verifyAccountPassword,
      deleteAccount,
      finishAccountDeletion,
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
