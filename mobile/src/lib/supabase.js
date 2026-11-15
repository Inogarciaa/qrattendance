import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { getItem, removeItem, setItem } from "./storage";

/**
 * Supabase client used only for the Google sign-in handshake and password
 * changes. Every other request goes through the Express API.
 *
 * The publishable (anon) key is safe to ship in the app; the service-role key
 * stays on the server.
 */
const extra = Constants.expoConfig?.extra ?? {};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || "";

export const supabaseConfigured = Boolean(url && anonKey);

const storage = {
  getItem: (key) => getItem(key),
  setItem: (key, value) => setItem(key, value),
  removeItem: (key) => removeItem(key),
};

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        // PKCE keeps the token exchange on the device instead of the redirect URL.
        flowType: "pkce",
        detectSessionInUrl: Platform.OS === "web",
        persistSession: true,
        autoRefreshToken: true,
        storage,
      },
    })
  : null;
