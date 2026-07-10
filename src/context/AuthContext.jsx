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
import { clearLocalUserData, clearSupabaseAuthStorage, readPendingOAuthAccountDeletion } from "../lib/accountDeletionFlow.js";
import { resumePendingOAuthAccountDeletion } from "../lib/pendingAccountDeletion.js";
import { getDevBypassUser, getDemoSessionUser, isDevAuthBypassEnabled } from "../lib/devAuthBypass.js";
import { getPlan, normalizePlanId } from "../lib/plans.js";
import { isSupabaseConfigured } from "../lib/supabaseConfig.js";
import { checkLoginVerification, clearLoginAssurance, sendLoginVerificationCode } from "../lib/loginVerification.js";
import {
  clearPendingPromoRedemption,
  readPendingPromoRedemption,
  redeemPromoCodeAtSignup
} from "../lib/promoCodes.js";

export const AuthContext = createContext(null);

async function loadSupabaseAuth() {
  return import("../lib/supabaseAuth.js");
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const useSupabase = isSupabaseConfigured();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [loginVerified, setLoginVerified] = useState(false);
  const [loginVerificationLoading, setLoginVerificationLoading] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [personalizedAiRequest, setPersonalizedAiRequest] = useState(0);
  const oauthDeletionResumeRef = useRef(false);
  const initialAuthCompleteRef = useRef(false);
  const verificationRequestRef = useRef(null);
  const authStateRefreshRef = useRef(null);
  const postAuthLinkageRef = useRef({ userId: null, ran: false });

  const runPostAuthLinkage = useCallback(
    async (nextUser) => {
      if (!useSupabase) return;
      if (!nextUser?.id || !nextUser?.role) return;

      const normalizedRole = String(nextUser.role || "").toLowerCase();
      const alreadyRanForUser =
        postAuthLinkageRef.current.ran && postAuthLinkageRef.current.userId === nextUser.id;
      if (alreadyRanForUser) return;

      postAuthLinkageRef.current = { userId: nextUser.id, ran: true };

      try {
        if (normalizedRole === "parent") {
          await acceptPendingParentInvite(nextUser.id);
        } else if (normalizedRole === "student") {
          await connectPendingParentEmailForStudent({
            studentId: nextUser.id,
            studentName: nextUser.name || nextUser.email
          });
          const pendingPromo = readPendingPromoRedemption(nextUser.email);
          if (pendingPromo?.code) {
            try {
              const { getSupabase } = await import("../lib/supabase.js");
              const session = await getSupabase()?.auth.getSession();
              await redeemPromoCodeAtSignup({
                code: pendingPromo.code,
                email: nextUser.email,
                userId: nextUser.id,
                accessToken: session?.data?.session?.access_token || null
              });
              clearPendingPromoRedemption(nextUser.email);
            } catch (promoError) {
              console.warn("[prelude-promo] pending redemption skipped:", promoError?.message || promoError);
            }
          }
        }
      } catch (err) {
        // Best-effort: never block auth/session restore on invite linking.
        console.warn("[prelude-parent] post-auth linkage skipped:", err?.message || err);
      }
    },
    [useSupabase]
  );

  const refreshLoginVerification = useCallback(async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!useSupabase) {
      setLoginVerified(true);
      return { verified: true };
    }
    if (verificationRequestRef.current) return verificationRequestRef.current;

    if (!silent) setLoginVerificationLoading(true);
    verificationRequestRef.current = (async () => {
      try {
        const result = await checkLoginVerification();
        setLoginVerified(Boolean(result.verified));
        return result;
      } catch (error) {
        if (!silent) setLoginVerified(false);
        return { verified: false, error: error.message };
      } finally {
        if (!silent) setLoginVerificationLoading(false);
        verificationRequestRef.current = null;
      }
    })();

    return verificationRequestRef.current;
  }, [useSupabase]);

  const refreshSupabaseUserSilently = useCallback(async () => {
    if (authStateRefreshRef.current) return authStateRefreshRef.current;
    authStateRefreshRef.current = (async () => {
      const { resolveSupabaseAppUser } = await loadSupabaseAuth();
      const next = await resolveSupabaseAppUser();
      setUser((current) => next || current);
      let refreshed = next;
      if (next) {
        await runPostAuthLinkage(next);
        refreshed = (await resolveSupabaseAppUser()) || next;
        if (refreshed) setUser(refreshed);
        const verification = await refreshLoginVerification({ silent: true });
        setLoginVerified((current) => verification.error ? current : Boolean(verification.verified));
      }
      return refreshed;
    })().finally(() => {
      authStateRefreshRef.current = null;
    });
    return authStateRefreshRef.current;
  }, [refreshLoginVerification, runPostAuthLinkage]);

  const clearAuthenticatedSession = useCallback(() => {
    setUser(null);
    setLoginVerified(false);
    if (!initialAuthCompleteRef.current) setLoginVerificationLoading(false);
  }, []);

  useEffect(() => {
    if (!ready) {
      initialAuthCompleteRef.current = false;
    }
  }, [ready]);

  useEffect(() => {
    function handleAvatarUpdated(event) {
      const avatarUrl = event.detail?.avatarUrl || "";
      setUser((current) => current ? { ...current, avatarUrl: avatarUrl || null } : current);
    }
    window.addEventListener("prelude:avatar-updated", handleAvatarUpdated);
    return () => window.removeEventListener("prelude:avatar-updated", handleAvatarUpdated);
  }, []);

  const beginLoginVerification = useCallback(async () => {
    if (!useSupabase) {
      setLoginVerified(true);
      return { verified: true };
    }
    const current = await refreshLoginVerification();
    if (current.verified) return current;
    try {
      const challenge = await sendLoginVerificationCode();
      setLoginVerified(false);
      return { verified: false, codeSent: true, ...challenge };
    } catch (error) {
      if (error?.payload?.error === "email_unconfirmed") {
        setLoginVerified(false);
        return { verified: false, emailUnconfirmed: true, error: error.message };
      }
      throw error;
    }
  }, [refreshLoginVerification, useSupabase]);

  useEffect(() => {
    let cancelled = false;
    let subscription = null;

    async function bootstrap() {
      try {
        if (isDevAuthBypassEnabled()) {
          if (!cancelled) {
            setUser(getDevBypassUser());
            setLoginVerified(true);
            initialAuthCompleteRef.current = true;
          }
          return;
        }

        if (useSupabase) {
          const { resolveSupabaseAppUser, onAuthStateChange } = await loadSupabaseAuth();
          try {
            const sessionUser = await resolveSupabaseAppUser();
            if (!cancelled) {
              setUser(sessionUser);
              if (sessionUser) {
                await runPostAuthLinkage(sessionUser);
                const refreshed = await resolveSupabaseAppUser();
                if (!cancelled && refreshed) setUser(refreshed);
                const verification = await refreshLoginVerification();
                if (!cancelled) setLoginVerified(Boolean(verification.verified));
              } else {
                setLoginVerified(false);
              }
            }
          } catch (err) {
            console.warn("[prelude-auth] Supabase session restore failed:", err?.message || err);
            if (!cancelled) {
              setUser(null);
              setLoginVerified(false);
            }
          }

          try {
            const { data } = onAuthStateChange(async (event, session) => {
              if (cancelled) return;
              if (!session) {
                if (event === "SIGNED_OUT" || event === "USER_DELETED") {
                  clearAuthenticatedSession();
                  postAuthLinkageRef.current = { userId: null, ran: false };
                }
                return;
              }
              try {
                await refreshSupabaseUserSilently();
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
            if (!cancelled) {
              setUser(session);
              setLoginVerified(Boolean(session));
            }
          } catch (err) {
            console.warn("[prelude-auth] Legacy session restore failed:", err?.message || err);
            if (!cancelled) {
              setUser(null);
              setLoginVerified(false);
            }
          }
        }
      } catch (err) {
        console.warn("[prelude-auth] Auth bootstrap failed:", err?.message || err);
        if (!cancelled) {
          setUser(null);
          setLoginVerified(false);
        }
      } finally {
        if (!cancelled) {
          initialAuthCompleteRef.current = true;
          setReady(true);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [clearAuthenticatedSession, refreshLoginVerification, refreshSupabaseUserSilently, runPostAuthLinkage, useSupabase]);

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
        const verification = await beginLoginVerification();
        next.requiresLoginVerification = !verification.verified;
        next.challengeId = verification.challengeId || "";
        setUser(next);
        setLoginVerified(Boolean(verification.verified));
        setSignInOpen(false);
        return next;
      }
      const next = await authSignIn(email, password);
      setUser(next);
      setLoginVerified(true);
      setSignInOpen(false);
      return next;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  }, [beginLoginVerification, useSupabase]);

  const signUp = useCallback(async (payload) => {
    setAuthError(null);
    try {
      if (useSupabase) {
        const { signUp: supabaseSignUp } = await loadSupabaseAuth();
        const fullName = `${payload.firstName || ""} ${payload.lastName || ""}`.trim() || (payload.name || "").trim();
        const roleRaw = payload.role ? payload.role.toLowerCase() : "";
        const role = roleRaw === "mentor" ? "mentor" : roleRaw === "parent" ? "parent" : roleRaw === "student" ? "student" : null;
        if (!role) {
          throw new Error("Please choose Student, Mentor, or Parent before creating your account.");
        }
        if (role === "parent" && payload.parentInviteToken) {
          storePendingParentInvite(payload.parentInviteToken);
        }
        const { user: next, userId, accessToken, error, needsEmailConfirmation } = await supabaseSignUp({
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
          const verification = await beginLoginVerification();
          next.requiresLoginVerification = !verification.verified;
          next.challengeId = verification.challengeId || "";
          setUser(next);
          setLoginVerified(Boolean(verification.verified));
          setSignInOpen(false);
        }
        return {
          ...next,
          id: next?.id || userId,
          accessToken: accessToken || null,
          emailVerified: Boolean(next?.emailVerified),
          needsEmailConfirmation,
          requiresLoginVerification: Boolean(next?.requiresLoginVerification),
          challengeId: next?.challengeId || ""
        };
      }
      const next = await authSignUp(payload);
      if (next?.id) {
        setUser(next);
        setLoginVerified(true);
        setSignInOpen(false);
      }
      return next;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  }, [beginLoginVerification, useSupabase]);

  const signInAsDemo = useCallback(async (accountKey = "student") => {
    setAuthError(null);
    const next = getDemoSessionUser(accountKey);
    setUser(next);
    setLoginVerified(true);
    setSignInOpen(false);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    closeModals();
    navigate("/", { replace: true });

    try {
      if (useSupabase) {
        await clearLoginAssurance();
        const { logOut } = await loadSupabaseAuth();
        await logOut();
      } else {
        await authSignOut();
      }
    } catch (error) {
      console.warn("[prelude-auth] Sign out failed:", error?.message || error);
    }

    setUser(null);
    setLoginVerified(false);
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
    const deletedId = user?.id;
    const deletedEmail = user?.email;
    if (deletedId || deletedEmail) {
      clearLocalUserData(deletedId, deletedEmail);
      clearSupabaseAuthStorage();
    }
    setUser(null);
    setLoginVerified(false);
    closeModals();
    navigate("/", { replace: true });
  }, [navigate, closeModals, user?.email, user?.id]);

  const refreshUser = useCallback(async () => {
    if (useSupabase) {
      const { resolveSupabaseAppUser } = await loadSupabaseAuth();
      const session = await resolveSupabaseAppUser();
      setUser(session);
      if (session) {
        const verification = await refreshLoginVerification();
        setLoginVerified(Boolean(verification.verified));
      } else {
        setLoginVerified(false);
      }
      return session;
    }
    const session = await getStoredSession();
    setUser(session);
    setLoginVerified(Boolean(session));
    return session;
  }, [refreshLoginVerification, useSupabase]);

  const requestPersonalizedAi = useCallback(() => {
    setPersonalizedAiRequest((n) => n + 1);
  }, []);

  const planId = useMemo(() => normalizePlanId(user?.plan), [user?.plan]);
  const planDetails = useMemo(() => (planId ? getPlan(planId) : null), [planId]);

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
      loginVerified,
      loginVerificationLoading,
      verificationRequired: Boolean(user && !loginVerified),
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
      refreshUser,
      refreshLoginVerification,
      beginLoginVerification
    }),
    [
      user,
      ready,
      loginVerified,
      loginVerificationLoading,
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
      refreshUser,
      refreshLoginVerification,
      beginLoginVerification
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
