import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clearIntendedRole, fetchHealth, setIntendedRole } from "../api/client";
import { Button } from "../components/Button";
import { DateField } from "../components/DateField";
import { LogoMark } from "../components/LogoMark";
import { useApp } from "../context/AppContext";
import { birthdateError, maskSchoolId, schoolIdError } from "../lib/inputMasks";
import { homeRouteFor } from "../lib/routes";
import { supabaseConfigured } from "../lib/supabase";
import { colors, fonts, radius, spacing } from "../theme/tokens";

export default function LoginScreen() {
  const {
    user,
    accountStatus,
    signIn,
    signInWithEmail,
    signInWithGoogle,
    apiBase,
    updateApiBase,
  } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState("school");
  const [schoolId, setSchoolId] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState("");
  const [serverOpen, setServerOpen] = useState(false);

  if (accountStatus === "onboarding") return <Redirect href="/onboarding" />;
  if (accountStatus === "pending" || accountStatus === "disabled") {
    return <Redirect href="/pending" />;
  }
  if (user) {
    return <Redirect href={homeRouteFor(user)} />;
  }

  const handleSignIn = async () => {
    if (pending) return;

    if (mode === "email") {
      if (!email.trim() || !password) {
        setError("Enter your email and password.");
        return;
      }
    } else {
      const idProblem = schoolId ? schoolIdError(schoolId) : "Enter your school ID.";
      if (idProblem) {
        setError(idProblem);
        return;
      }
      const dateProblem = birthdate ? birthdateError(birthdate) : "Enter your birthdate.";
      if (dateProblem) {
        setError(dateProblem);
        return;
      }
    }

    setPending(true);
    setError("");

    try {
      const account =
        mode === "email"
          ? await signInWithEmail({ email: email.trim(), password })
          : await signIn({ schoolId: schoolId.trim(), birthdate: birthdate.trim() });
      router.replace(homeRouteFor(account));
    } catch (err) {
      setError(err?.message || "Could not sign in.");
    } finally {
      setPending(false);
    }
  };

  const handleGoogle = async (role = null) => {
    if (googlePending) return;

    setGooglePending(true);
    setError("");

    try {
      await setIntendedRole(role);
      const account = await signInWithGoogle();
      // On web the browser leaves for Google and the session resumes on return.
      if (!account) return;

      if (account.status === "ready" && account.user) {
        await clearIntendedRole();
        router.replace(homeRouteFor(account.user));
      }
    } catch (err) {
      if (err?.status !== 499) setError(err?.message || "Google sign-in failed.");
    } finally {
      setGooglePending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.top, { paddingTop: insets.top + 40 }]}>
            <LogoMark size={44} />
            <Text style={styles.brand}>Scanly</Text>
          </View>

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]}>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>
              Use your school ID, or continue with the Google account you signed up with.
            </Text>

            {supabaseConfigured ? (
              <>
                <Button
                  label="Continue with Google"
                  icon="logo-google"
                  variant="secondary"
                  onPress={() => handleGoogle(null)}
                  loading={googlePending}
                  style={styles.google}
                />
                <Text style={styles.googleHint}>
                  Use the same Google account you signed up with.
                </Text>
              </>
            ) : null}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.tabs}>
              <Pressable
                onPress={() => {
                  setMode("school");
                  setError("");
                }}
                style={[styles.tab, mode === "school" && styles.tabActive]}
              >
                <Text style={[styles.tabText, mode === "school" && styles.tabTextActive]}>
                  School ID
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMode("email");
                  setError("");
                }}
                style={[styles.tab, mode === "email" && styles.tabActive]}
              >
                <Text style={[styles.tabText, mode === "email" && styles.tabTextActive]}>
                  Email
                </Text>
              </Pressable>
            </View>

            {mode === "school" ? (
              <>
                <Text style={styles.label}>School ID</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="id-card-outline" size={18} color={colors.muted} />
                  <TextInput
                    value={schoolId}
                    onChangeText={(value) => {
                      setSchoolId(maskSchoolId(value));
                      setError("");
                    }}
                    placeholder="2023-0142"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    keyboardType="number-pad"
                    maxLength={9}
                    returnKeyType="next"
                    style={styles.input}
                  />
                </View>

                <Text style={styles.label}>Birthdate</Text>
                <DateField
                  value={birthdate}
                  onChange={(value) => {
                    setBirthdate(value);
                    setError("");
                  }}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={colors.muted} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@gmail.com"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    returnKeyType="next"
                    style={styles.input}
                  />
                </View>

                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Your password"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    secureTextEntry={!showPassword}
                    returnKeyType="go"
                    onSubmitEditing={handleSignIn}
                    style={styles.input}
                  />
                  <Pressable
                    onPress={() => setShowPassword((value) => !value)}
                    hitSlop={10}
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => router.push("/forgot-password")}
                  hitSlop={8}
                  style={styles.forgot}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              </>
            )}

            {error ? (
              <View style={styles.error} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={16} color={colors.red} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              label="Continue"
              onPress={handleSignIn}
              loading={pending}
              style={styles.submit}
            />

            {supabaseConfigured ? (
              <View style={styles.signupCard}>
                <Text style={styles.signupTitle}>New to Scanly?</Text>
                <Text style={styles.signupHint}>
                  Create an account with Google. An administrator approves new accounts
                  before they can check in.
                </Text>
                <View style={styles.signupButtons}>
                  <Button
                    label="Sign up as student"
                    icon="school-outline"
                    variant="soft"
                    size="md"
                    onPress={() => handleGoogle("student")}
                    disabled={googlePending}
                    style={styles.signupButton}
                    labelStyle={styles.signupButtonLabel}
                  />
                  <Button
                    label="Sign up as organizer"
                    icon="megaphone-outline"
                    variant="soft"
                    size="md"
                    onPress={() => handleGoogle("organizer")}
                    disabled={googlePending}
                    style={styles.signupButton}
                    labelStyle={styles.signupButtonLabel}
                  />
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={() => setServerOpen(true)}
              style={({ pressed }) => [styles.serverRow, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Change server address"
            >
              <Ionicons name="server-outline" size={15} color={colors.muted} />
              <Text style={styles.serverText} numberOfLines={1}>
                Server: {apiBase}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={colors.muted} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ServerSheet
        visible={serverOpen}
        current={apiBase}
        onClose={() => setServerOpen(false)}
        onSave={async (value) => {
          const next = await updateApiBase(value);
          setServerOpen(false);
          setError("");
          return next;
        }}
      />
    </View>
  );
}

function ServerSheet({ visible, current, onClose, onSave }) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(current);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const next = await onSave(value);
      setValue(next);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await onSave(value);
      const health = await fetchHealth();
      setStatus({
        ok: true,
        message: `Connected · ${health.mode} mode · database ${health.database}`,
      });
    } catch (err) {
      setStatus({ ok: false, message: err?.message || "Could not reach that server." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheetModal, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Server</Text>
          <Text style={styles.sheetHint}>
            The address of the Scanly API this phone should talk to. Use your computer&apos;s
            tunnel URL when the dashboard runs on a laptop.
          </Text>

          <View style={styles.inputWrap}>
            <Ionicons name="link-outline" size={18} color={colors.muted} />
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="https://your-tunnel.trycloudflare.com"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
            />
          </View>

          {status ? (
            <View style={[styles.statusBox, status.ok ? styles.statusOk : styles.statusBad]}>
              <Ionicons
                name={status.ok ? "checkmark-circle" : "alert-circle"}
                size={16}
                color={status.ok ? colors.green : colors.red}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: status.ok ? colors.green : colors.red },
                ]}
              >
                {status.message}
              </Text>
            </View>
          ) : null}

          <Button label="Save" onPress={save} loading={saving} style={styles.sheetButton} />
          <Button label="Save and test" variant="secondary" onPress={test} disabled={saving} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  scroll: {
    flexGrow: 1,
  },
  top: {
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingBottom: 36,
  },
  brand: {
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: -0.6,
    color: colors.white,
    marginTop: 12,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xxl,
    paddingTop: 28,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    letterSpacing: -0.7,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginTop: 6,
  },
  google: {
    marginTop: 20,
  },
  googleHint: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 8,
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  tabText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.text,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.text,
    marginBottom: 7,
    marginLeft: 2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14.5,
    color: colors.text,
    height: "100%",
  },
  forgot: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 6,
    paddingVertical: 4,
  },
  forgotText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.brand,
  },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.redSoft,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.red,
  },
  submit: {
    marginTop: 4,
  },
  createRow: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 6,
  },
  signupCard: {
    marginTop: 22,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signupTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  signupHint: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 4,
  },
  signupButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  signupButton: {
    flex: 1,
    paddingHorizontal: 8,
  },
  signupButtonLabel: {
    fontSize: 11.5,
    textAlign: "center",
  },
  createText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.muted,
  },
  createLink: {
    fontFamily: fonts.semibold,
    color: colors.brand,
  },
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 18,
    paddingVertical: 10,
  },
  serverText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheetModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xxl,
    paddingTop: 12,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: 18,
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: colors.text,
  },
  sheetHint: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 6,
    marginBottom: 16,
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 4,
  },
  statusOk: {
    backgroundColor: colors.greenSoft,
  },
  statusBad: {
    backgroundColor: colors.redSoft,
  },
  statusText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  sheetButton: {
    marginTop: 16,
    marginBottom: 10,
  },
});
