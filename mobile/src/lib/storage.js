import { Platform } from "react-native";

/**
 * Small persistence helper.
 *
 * Native builds use expo-secure-store (encrypted keychain / keystore). Web has
 * no secure store, so it falls back to localStorage — the dashboard already
 * keeps its session there.
 */
const isWeb = Platform.OS === "web";

async function getSecureStore() {
  // Imported lazily so the web bundle never touches the native module.
  return import("expo-secure-store");
}

export async function getItem(key) {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  try {
    const SecureStore = await getSecureStore();
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key, value) {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Storage can be unavailable in private browsing; sessions then live in memory only.
    }
    return;
  }

  try {
    const SecureStore = await getSecureStore();
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Ignore: the in-memory session still works for this app run.
  }
}

export async function removeItem(key) {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Ignore.
    }
    return;
  }

  try {
    const SecureStore = await getSecureStore();
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore.
  }
}
