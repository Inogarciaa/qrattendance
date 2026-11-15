import * as Location from "expo-location";

/**
 * A fix that takes longer than this is treated as "no fix". A concrete building
 * can keep the GPS busy for a while, and check-in must never hang on it.
 */
const FIX_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Best-effort foreground location fix for self check-in.
 *
 * Resolves to `{ latitude, longitude, accuracy, mocked }` on success, or
 * `{ error }` with one of:
 *   - `denied`      the student declined (or previously declined) permission
 *   - `unavailable` location services are switched off on the device
 *   - `timeout`     no fix within FIX_TIMEOUT_MS
 *   - `failed`      the platform threw
 *
 * The caller never blocks on this. The server decides what a missing fix means:
 * the check-in still succeeds, it is just recorded as unverified.
 */
export async function captureLocationFix() {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) return { error: "unavailable" };

    const current = await Location.getForegroundPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      const requested = await Location.requestForegroundPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") return { error: "denied" };

    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      FIX_TIMEOUT_MS
    );
    if (!position) return { error: "timeout" };

    const { latitude, longitude, accuracy } = position.coords;
    return {
      latitude,
      longitude,
      accuracy: typeof accuracy === "number" ? accuracy : null,
      mocked: position.mocked === true,
    };
  } catch {
    return { error: "failed" };
  }
}

/** Short human explanation for a failed fix, used in the result sheet. */
export const LOCATION_ERROR_MESSAGES = {
  denied: "Location permission is off, so this check-in was saved without a location check.",
  unavailable: "Location services are off, so this check-in was saved without a location check.",
  timeout: "We could not get a location fix in time, so this check-in was saved without one.",
  failed: "We could not read your location, so this check-in was saved without one.",
};
