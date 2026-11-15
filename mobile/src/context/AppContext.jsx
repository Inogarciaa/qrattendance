import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  adoptPendingSupabaseSession,
  clearSession,
  completeOnboarding as completeOnboardingRequest,
  fetchAccount,
  getApiBase,
  loadApiBase,
  login as loginRequest,
  loginWithEmail as loginWithEmailRequest,
  restoreSession,
  setApiBase,
  signInWithGoogle as signInWithGoogleRequest,
} from "../api/client";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  // "ready" | "onboarding" | "pending" | "disabled", or null when signed out.
  const [accountStatus, setAccountStatus] = useState(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [booting, setBooting] = useState(true);
  const [apiBase, setApiBaseState] = useState(() => getApiBase());

  const applyAccount = useCallback((account) => {
    setUser(account?.user ?? null);
    setAccountStatus(account?.status ?? null);
    setAccountEmail(account?.email ?? account?.user?.email ?? "");
    return account;
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      await loadApiBase();
      if (active) setApiBaseState(getApiBase());

      let stored = await restoreSession();

      // A Google redirect on web completes in Supabase, not through our API.
      if (!stored?.access_token) {
        stored = await adoptPendingSupabaseSession();
      }

      if (!stored?.access_token) {
        if (active) setBooting(false);
        return;
      }

      if (stored.user && active) setUser(stored.user);

      try {
        const account = await fetchAccount();
        if (active) applyAccount(account);
      } catch (err) {
        if (err?.status === 401) {
          await clearSession();
          if (active) applyAccount(null);
        } else if (active && stored.user) {
          // Offline: keep the cached profile instead of logging out.
          setAccountStatus("ready");
        }
      } finally {
        if (active) setBooting(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [applyAccount]);

  const finishSignIn = useCallback(
    async (next) => {
      if (!next) return null;
      const account = await fetchAccount();
      applyAccount(account);
      return account;
    },
    [applyAccount]
  );

  const signIn = useCallback(
    async ({ schoolId, birthdate }) => {
      const next = await loginRequest({ schoolId, birthdate });
      await finishSignIn(next);
      return next.user;
    },
    [finishSignIn]
  );

  const signInWithEmail = useCallback(
    async ({ email, password }) => {
      const next = await loginWithEmailRequest({ email, password });
      await finishSignIn(next);
      return next.user;
    },
    [finishSignIn]
  );

  const signInWithGoogle = useCallback(async () => {
    const next = await signInWithGoogleRequest();
    if (!next) return null; // Web completes after the redirect.
    const account = await fetchAccount();
    applyAccount(account);
    return account;
  }, [applyAccount]);

  const completeOnboarding = useCallback(
    async (details) => {
      const result = await completeOnboardingRequest(details);
      setUser(null);
      setAccountStatus(result?.status || "pending");
      return result;
    },
    []
  );

  const refreshAccount = useCallback(async () => {
    const account = await fetchAccount();
    applyAccount(account);
    return account;
  }, [applyAccount]);

  const signOut = useCallback(async () => {
    await clearSession();
    applyAccount(null);
  }, [applyAccount]);

  const updateApiBase = useCallback(async (value) => {
    const next = await setApiBase(value);
    setApiBaseState(next);
    return next;
  }, []);

  const refreshUser = useCallback(async () => {
    const account = await refreshAccount();
    return account.user;
  }, [refreshAccount]);

  const value = useMemo(
    () => ({
      user,
      accountStatus,
      accountEmail,
      booting,
      apiBase,
      signIn,
      signInWithEmail,
      signInWithGoogle,
      completeOnboarding,
      refreshAccount,
      refreshUser,
      signOut,
      updateApiBase,
    }),
    [
      user,
      accountStatus,
      accountEmail,
      booting,
      apiBase,
      signIn,
      signInWithEmail,
      signInWithGoogle,
      completeOnboarding,
      refreshAccount,
      refreshUser,
      signOut,
      updateApiBase,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return context;
}
