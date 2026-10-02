// Opt-in auth debug logging, enabled with VITE_AUTH_DEBUG=true.
// No-op when the flag is unset.
//
// Never logs tokens. It logs token *expiry* (`access_token_exp`), the
// gap between refresh attempts, and the status/message of failed
// refreshes — enough to reproduce the Task 1 measurement on the
// deployed URL without opening DevTools.

const flag = import.meta.env.VITE_AUTH_DEBUG;
const enabled = flag === true || flag === "true" || flag === "1";

let lastTokenEventAt = null;
let lastAccessTokenExp = null;
let refreshFailures = 0;

export function isAuthDebugEnabled() {
  return enabled;
}

export function authDebug(event, details = {}) {
  if (!enabled) return;
  console.debug("[auth-debug]", {
    t: new Date().toISOString(),
    event,
    ...details,
  });
}

export function isRateLimitError(error) {
  const status = error?.status ?? error?.response?.status ?? null;
  const message = error?.message ?? "";
  return (
    status === 429 || /too many requests|rate limit/i.test(String(message))
  );
}

export function describeAuthError(error) {
  const status = error?.status ?? error?.response?.status ?? null;
  const message = error?.message ?? String(error ?? "Unknown error");
  return status ? `${message} (HTTP ${status})` : message;
}

// Called for every auth event that carries a session. Records how long
// the SDK waited between token events, which is what makes a stuck ~30s
// refresh loop visible without a network trace.
export function recordTokenEvent(authEvent, session) {
  if (!enabled) return;

  const now = Date.now();
  const exp = session?.access_token_exp ?? null;
  const gapMs = lastTokenEventAt === null ? null : now - lastTokenEventAt;
  lastTokenEventAt = now;

  const rotated = exp !== null && exp !== lastAccessTokenExp;
  lastAccessTokenExp = exp;

  authDebug("token-event", {
    authEvent,
    hasSession: !!session,
    exp: exp === null ? null : new Date(exp * 1000).toISOString(),
    gapMs,
    rotated,
  });
}

export function recordAuthFailure(stage, error) {
  if (!enabled) return;
  refreshFailures += 1;
  authDebug("auth-failure", {
    stage,
    attempt: refreshFailures,
    status: error?.status ?? error?.response?.status ?? null,
    message: error?.message ?? String(error ?? "Unknown error"),
    isRateLimit: isRateLimitError(error),
  });
}