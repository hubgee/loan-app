import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { supabase } from "../api/supabaseClient";
import {
  authDebug,
  describeAuthError,
  recordAuthFailure,
  recordTokenEvent,
} from "./authDebug";

const AuthContext = createContext(null);

const PROFILE_COLUMNS = "id, role, is_active, created_at, updated_at";

async function readProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export function AuthProvider({ children }) {
  // status is an explicit state machine:
  //   "initializing" — first read in flight, nothing is known yet
  //   "authenticated" — session AND profile are both good
  //   "anonymous"     — there is genuinely no session
  //   "error"         — the session may well be alive, but a read failed
  //
  // "error" is deliberately NOT the same as "anonymous". A 429 on token
  // refresh is recoverable; treating it as a sign-out is what turned a
  // rate limit into a logout loop that consumed more quota each round.
  const [status, setStatus] = useState("initializing");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState(null);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // The ONLY two transitions that clear a user.
  const goAnonymous = useCallback(() => {
    setUser(null);
    setProfile(null);
    setAuthError(null);
    setStatus("anonymous");
  }, []);

  // Never clears the user. A failure is surfaced, not acted upon.
  const goError = useCallback((stage, error) => {
    recordAuthFailure(stage, error);
    setAuthError(describeAuthError(error));
    setStatus("error");
  }, []);

  // Single place where a session becomes auth state. Returns the
  // profile so login()/refresh() can hand it back to their callers.
  const resolveSession = useCallback(
    async (session, stage) => {
      const sessionUser = session?.user ?? null;

      if (!sessionUser) {
        goAnonymous();
        return { user: null, profile: null, error: null };
      }

      setUser(sessionUser);

      try {
        const nextProfile = await readProfile(sessionUser.id);
        setProfile(nextProfile);
        setAuthError(null);
        setStatus("authenticated");
        return { user: sessionUser, profile: nextProfile, error: null };
      } catch (error) {
        goError(stage, error);
        return { user: sessionUser, profile: null, error };
      }
    },
    [goAnonymous, goError]
  );

  useEffect(() => {
    let cancelled = false;

    // Registered synchronously in the effect body, BEFORE any await, so
    // the cleanup below always has a real subscription to remove. The
    // old code registered after two awaits while cleanup read a variable
    // that was still undefined, so the listener outlived the component.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;

        recordTokenEvent(event, session);
        authDebug("auth-event", { event, hasSession: !!session });

        // INITIAL_SESSION is ignored on purpose: `initialize()` below
        // reads the session exactly once. Honouring it here would mean
        // two profile reads racing on every page load.
        if (event === "INITIAL_SESSION") return;

        switch (event) {
          case "SIGNED_IN":
          case "USER_UPDATED": {
            // No Supabase call synchronously inside this callback — the
            // SDK is holding its auth lock here. Defer one tick.
            setTimeout(() => {
              if (!cancelled) resolveSession(session, event);
            }, 0);
            break;
          }

          case "TOKEN_REFRESHED": {
            // Only the access token rotated. Identity, role and
            // activation cannot have changed, so there is deliberately
            // no profile query here — that query per refresh was a
            // load-bearing source of extra network traffic.
            if (!session?.user) return;
            if (
              statusRef.current === "anonymous" ||
              statusRef.current === "initializing"
            ) {
              setTimeout(() => {
                if (!cancelled) resolveSession(session, event);
              }, 0);
              return;
            }
            setUser(session.user);
            if (statusRef.current === "error") {
              // Auth is demonstrably working again.
              setAuthError(null);
              setStatus("authenticated");
            }
            break;
          }

          case "SIGNED_OUT": {
            // A revoked or explicitly ended session. No error rides
            // along with it, so this is a real sign-out.
            setTimeout(() => {
              if (!cancelled) goAnonymous();
            }, 0);
            break;
          }

          default:
            break;
        }
      }
    );

    const initialize = async () => {
      try {
        // No timeout. A slow response is slow, it is not a sign-out —
        // and the old 8s timeout produced exactly the reported symptom
        // on a cold start.
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error) throw error;
        await resolveSession(data.session ?? null, "getSession");
      } catch (error) {
        if (!cancelled) goError("getSession", error);
      }
    };

    initialize();

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [resolveSession, goAnonymous, goError]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      recordAuthFailure("signInWithPassword", error);
      throw error;
    }

    const session = data.session ?? null;
    if (!session?.user) {
      return { user: data.user ?? null, profile: null };
    }

    const { user: sessionUser, profile, error: profileError } =
      await resolveSession(session, "login-profile");

    // Keep the `{ user, profile }` contract AdminLogin.jsx and
    // Login.jsx already depend on.
    if (profileError) throw profileError;
    return { user: sessionUser, profile };
  };

  const signup = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      recordAuthFailure("signUp", error);
      throw error;
    }

    // With "Auto Confirm User" on, a session comes back immediately and
    // the DB trigger has already created the inactive profile row.
    if (data.session?.user) {
      const { user: sessionUser, profile } = await resolveSession(
        data.session,
        "signup-profile"
      );
      return { user: sessionUser, profile };
    }

    // Email confirmation required: no session yet.
    goAnonymous();
    return { user: data.user ?? null, profile: null };
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      goAnonymous();
    } catch (error) {
      // The session is left alone and the failure is surfaced, so the
      // UI can never look signed-out while state says otherwise.
      goError("signOut", error);
    }
  };

  // Re-reads the profile through getUser(), which hits the server. Used
  // by the /pending "I've been activated" button.
  const refresh = async () => {
    try {
      const {
        data: { user: current },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      const { profile: nextProfile } = await resolveSession(
        current ? { user: current } : null,
        "refresh"
      );
      return nextProfile;
    } catch (error) {
      recordAuthFailure("getUser", error);
      setAuthError(describeAuthError(error));
      return null;
    }
  };

  // Recovery path for the retry screen. Never navigates.
  const retryAuth = useCallback(async () => {
    setStatus("initializing");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      await resolveSession(data.session ?? null, "retry");
    } catch (error) {
      goError("retry", error);
    }
  }, [resolveSession, goError]);

  const isAdmin = profile?.role === "admin";
  const isActive = profile?.is_active === true;

  return (
    <AuthContext.Provider
      value={{
        status,
        isInitializing: status === "initializing",
        user,
        profile,
        authError,
        isAdmin,
        isActive,
        login,
        signup,
        logout,
        refresh,
        retryAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };