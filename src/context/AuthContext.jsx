import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredSession, signIn as authSignIn, signOut as authSignOut, signUp as authSignUp, deleteAccount as authDeleteAccount, verifyAccountPassword as authVerifyAccountPassword } from "../lib/auth.js";
import {
  acceptPendingParentInvite,
  connectPendingParentEmailForStudent,
  connectStudentParentEmail,
  storePendingParentEmailConnect,
  storePendingParentInvite
} from "../lib/parentLinks.js";
import { readPendingOAuthAccountDeletion } from "../lib/accountDeletionFlow.js";
import { resumePendingOAuthAccountDeletion } from "../lib/pendingAccountDeletion.js";
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
  const oauthDeletionResumeRef = useRef(false);

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

  useEffect(() => {
    if (!ready || !useSupabase || !user?.id) return;
    if (!readPendingOAuthAccountDeletion()) return;
    if (oauthDeletionResumeRef.current) return;

    let cancelled = false;
    oauthDeletionResumeRef.current = true;

    (async () => {
      try {
        const result = await resumePendingOAuthAccountDeletion({
          user,
          search: window.location.search,
          hash: window.location.hash,
          deleteAccount: async () => {
            const { deleteSupabaseAccountAfterOAuth } = await loadSupabaseAuth();
            await deleteSupabaseAccountAfterOAuth();
            setUser(null);
          }
        });

        if (cancelled) return;

        if (result.handled) {
          if (window.location.hash || window.location.search.includes("error")) {
            window.history.replaceState({}, "", window.location.pathname);
          }
          setSignInOpen(false);
          setAccountOpen(false);
          navigate("/", { replace: true });
        } else {
          oauthDeletionResumeRef.current = false;
        }
      } catch (err) {
        if (!cancelled) {
          setAuthError(err.message || "Account deletion could not be completed.");
          oauthDeletionResumeRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, useSupabase, user?.id, navigate]);

  const signIn = useCallback(async (email, password, options = {}) => {
    setAuthError(null);
    try {
      if (useSupabase) {
        const { logIn } = await loadSupabaseAuth();
        const { user: next, error } = await logIn({ email, password, captchaToken: options.captchaToken });
        if (error) throw new Error(error);
        if (next?.role === "parent") {
          await acceptPendingParentInvite(next.id);
        } else if (next?.role === "student") {
          await connectPendingParentEmailForStudent({
            studentId: next.id,
            studentName: next.name || next.email
          });
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
        const fullName = `${payload.firstName || ""} ${payload.lastName || ""}`.trim() || (payload.name || "").trim();
        const roleRaw = payload.role ? payload.role.toLowerCase() : "";
        const role = roleRaw === "mentor" ? "mentor" : roleRaw === "parent" ? "parent" : roleRaw === "student" ? "student" : null;
        if (role === "parent" && payload.parentInviteToken) {
          storePendingParentInvite(payload.parentInviteToken);
        }
        const { user: next, userId, error, needsEmailConfirmation } = await supabaseSignUp({
          email: payload.email,
          password: payload.password,
          fullName: fullName || (role === "parent" ? "Parent User" : "Prelude User"),
          role,
          captchaToken: payload.captchaToken
        });
        if (error) throw new Error(error);
        const parentEmail = (payload.parentEmail || "").trim();
        if (role === "student" && parentEmail) {
          if (next?.id) {
            await connectStudentParentEmail({
              studentId: next.id,
              studentName: fullName || "Student",
              parentEmail,
              sendEmail: true
            });
          } else if (userId) {
            storePendingParentEmailConnect(userId, parentEmail);
          }
        }
        if (next?.role === "parent") {
          await acceptPendingParentInvite(next.id);
        } else if (next?.role === "student") {
          await connectPendingParentEmailForStudent({
            studentId: next.id,
            studentName: fullName || next?.name || payload.email
          });
        }
        if (next) {
          setUser(next);
          setSignInOpen(false);
        }
        return {
          ...next,
          id: next?.id || userId,
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
          const {
            deleteSupabaseAccount,
            deleteSupabaseAccountAfterOAuth,
            startOAuthAccountDeletionReauth
          } = await loadSupabaseAuth();

          if (payload?.verificationMethod === "oauth") {
            await deleteSupabaseAccountAfterOAuth();
          } else {
            await deleteSupabaseAccount({ ...payload, email: user.email });
          }
        } else {
          await authDeleteAccount(payload);
        }
        setUser(null);
        return { success: true };
      } catch (error) {
        setAuthError(error.message);
        throw error;
      }
    },
    [useSupabase, user]
  );

  const startOAuthAccountDeletionVerification = useCallback(async () => {
    if (!user?.email) throw new Error("You must be signed in to delete your account.");
    if (!useSupabase) {
      throw new Error("Google verification is only available for Supabase accounts.");
    }
    const { startOAuthAccountDeletionReauth } = await loadSupabaseAuth();
    return startOAuthAccountDeletionReauth({
      user,
      returnPath: window.location.pathname
    });
  }, [useSupabase, user]);

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
      startOAuthAccountDeletionVerification,
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
      startOAuthAccountDeletionVerification,
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
