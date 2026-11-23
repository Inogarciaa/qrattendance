import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/tokens";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { refreshSession } = useApp();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function handleCallback() {
      try {
        // Give Supabase client a moment to pick up the auth code from the deep link
        await new Promise((r) => setTimeout(r, 1000));
        await refreshSession();
        if (!active) return;
        router.replace("/");
      } catch (err) {
        if (!active) return;
        setError(err.message || "Failed to complete Google sign-in.");
      }
    }
    handleCallback();
    return () => {
      active = false;
    };
  }, [router, refreshSession]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {error ? (
          <>
            <Text style={styles.title}>Sign-in Error</Text>
            <Text style={styles.error}>{error}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={styles.title}>Completing sign-in…</Text>
            <Text style={styles.subtitle}>Please wait while we log you in.</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  error: {
    color: "#f87171",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
