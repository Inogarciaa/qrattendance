import { useCallback, useEffect, useState } from "react";

import { makeMockToken } from "../lib/format";

/**
 * Produces a rotating mock token with a visible countdown.
 *
 * The token is replaced a few seconds before it expires, which mirrors the
 * backend's 30-second QR window while avoiding codes that expire mid-scan.
 */
export function useTokenRotation({
  windowSeconds = 30,
  rotateAfterSeconds = 25,
  prefix = "LQ-STU",
} = {}) {
  const [token, setToken] = useState(() => makeMockToken(prefix));
  const [secondsLeft, setSecondsLeft] = useState(windowSeconds);

  const refresh = useCallback(() => {
    setToken(makeMockToken(prefix));
    setSecondsLeft(windowSeconds);
  }, [prefix, windowSeconds]);

  useEffect(() => {
    const rotateAt = windowSeconds - rotateAfterSeconds;

    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        const next = current - 1;
        if (next <= rotateAt) {
          setToken(makeMockToken(prefix));
          return windowSeconds;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [prefix, windowSeconds, rotateAfterSeconds]);

  return {
    token,
    secondsLeft,
    progress: secondsLeft / windowSeconds,
    refresh,
  };
}
