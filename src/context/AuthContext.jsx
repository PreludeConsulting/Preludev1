import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getStoredSession, signIn as authSignIn, signOut as authSignOut, signUp as authSignUp } from "../lib/auth.js";
import { getPlan } from "../lib/plans.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [personalizedAiRequest, setPersonalizedAiRequest] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getStoredSession().then((session) => {
      if (!cancelled) setUser(session);
    }).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openSignIn = useCallback(() => {
    setAuthError(null);
    setAccountOpen(false);
    setSignInOpen(true);
  }, []);

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
      const next = await authSignIn(email, password);
      setUser(next);
      setSignInOpen(false);
      return next;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const signUp = useCallback(async (payload) => {
    setAuthError(null);
    try {
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
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setAccountOpen(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const session = await getStoredSession();
    setUser(session);
    return session;
  }, []);

  const requestPersonalizedAi = useCallback(() => {
    setPersonalizedAiRequest((n) => n + 1);
  }, []);

  const planDetails = useMemo(() => (user ? getPlan(user.plan) : null), [user]);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(user),
      planDetails,
      signInOpen,
      accountOpen,
      authError,
      openSignIn,
      openAccount,
      closeModals,
      signIn,
      signUp,
      signOut,
      setAuthError,
      personalizedAiRequest,
      requestPersonalizedAi,
      refreshUser
    }),
    [
      user,
      ready,
      planDetails,
      signInOpen,
      accountOpen,
      authError,
      openSignIn,
      openAccount,
      closeModals,
      signIn,
      signUp,
      signOut,
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
