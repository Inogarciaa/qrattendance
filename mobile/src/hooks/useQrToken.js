import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Issues real rotating QR tokens through the API.
 *
 * `issue` is an async function returning the API payload
 * `{ token, expires_at, window_seconds }`. With `auto` enabled the hook rotates
 * the code as soon as the server-side window lapses, which is what the event
 * display needs. Pass `auto: false` when the screen should wait for the user to
 * request another code, like the student's personal QR.
 */
export function useQrToken({ issue, auto = true } = {}) {
  const [token, setToken] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [windowSeconds, setWindowSeconds] = useState(30);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const issueRef = useRef(issue);
  const generatingRef = useRef(false);
  const mountedRef = useRef(true);

  // Keep the latest issue callback without touching the ref during render.
  useEffect(() => {
    issueRef.current = issue;
  }, [issue]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const generate = useCallback(async () => {
    if (!issueRef.current || generatingRef.current) return;
    generatingRef.current = true;
    if (mountedRef.current) {
      setLoading(true);
      setError("");
    }

    try {
      const result = await issueRef.current();
      if (!mountedRef.current) return;

      const deadline = result?.expires_at
        ? new Date(result.expires_at).getTime()
        : Date.now() + 30000;
      const window = result?.window_seconds || Math.max(1, Math.round((deadline - Date.now()) / 1000));

      setToken(result?.token ?? null);
      setWindowSeconds(window);
      setExpiresAt(deadline);
      setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
      setExpired(false);
    } catch (err) {
      if (mountedRef.current) {
        setToken(null);
        setExpiresAt(null);
        setError(err?.message || "Could not generate a QR code.");
        setExpired(true);
      }
    } finally {
      generatingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setToken(null);
    setExpiresAt(null);
    setSecondsLeft(0);
    setExpired(true);
  }, []);

  useEffect(() => {
    if (!token || !expiresAt) return undefined;

    const tick = () => {
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining > 0) return;

      // Stop this countdown before requesting the next token so a failing
      // request cannot spin a one-per-second retry loop.
      setToken(null);
      setExpiresAt(null);
      if (auto) {
        generate();
      } else {
        setExpired(true);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [token, expiresAt, auto, generate]);

  return {
    token,
    secondsLeft,
    expired,
    windowSeconds,
    progress: windowSeconds > 0 ? Math.min(1, secondsLeft / windowSeconds) : 0,
    loading,
    error,
    generate,
    clear,
  };
}
