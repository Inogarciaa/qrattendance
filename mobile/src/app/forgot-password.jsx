import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { forgotPassword, resetPassword } from "../api/client";
import { Button } from "../components/Button";
import { useApp } from "../context/AppContext";
import { homeRouteFor } from "../lib/routes";
import { colors, fonts, radius, spacing } from "../theme/tokens";

const RESEND_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshAccount } = useApp();

  const [step, setStep] = useState("email"); // "email" | "code" | "done"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const codeInput = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    if (busy) return;
    if (!email.trim()) {
      setError("Enter the email on your account.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await forgotPassword(email.trim());
      setStep("code");
      setNotice(`If ${email.trim()} has an account, a 6-digit code is on its way.`);
      setCooldown(RESEND_SECONDS);
      setTimeout(() => codeInput.current?.focus?.(), 350);
    } catch (err) {
      setError(err?.message || "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setError("");
    try {
      await forgotPassword(email.trim());
      setNotice("A new code was sent. Older codes no longer work.");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err?.message || "Could not resend the code.");
    }
  };

  const submit = async () => {
    if (busy) return;

    if (code.replace(/\D/g, "").length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await resetPassword({ email: email.trim(), code: code.trim(), password });
      setStep("done");

      // The API returns a ready session, so go straight to the app.
      try {
        const account = await refreshAccount();
        if (account.status === "ready" && account.user) {
          router.replace(homeRouteFor(account.user));
          return;
        }
      } catch {
        // Fall back to the sign-in screen below.
      }
    } catch (err) {
      setError(err?.message || "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.back}
            accessibilityLabel="Back to sign in"
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={styles.backText}>Sign in</Text>
          </Pressable>

          <Text style={styles.title}>
            {step === "done" ? "Password updated" : "Reset your password"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "email"
              ? "We'll email you a 6-digit code to confirm it's you."
              : step === "code"
                ? "Enter the code from the email and choose a new password."
                : "You can sign in with your new password now."}
          </Text>

          {step === "email" ? (
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
                  returnKeyType="go"
                  onSubmitEditing={sendCode}
                  style={styles.input}
                />
              </View>
            </>
          ) : null}

          {step === "code" ? (
            <>
              <View style={styles.codeBox}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.green} />
                <Text style={styles.codeBoxText}>{notice}</Text>
              </View>

              <Text style={styles.label}>6-digit code</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="keypad-outline" size={18} color={colors.muted} />
                <TextInput
                  ref={codeInput}
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/[^\d]/g, "").slice(0, 6))}
                  placeholder="123456"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  maxLength={6}
                  style={[styles.input, styles.codeInput]}
                />
              </View>

              <Text style={styles.label}>New password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showPassword}
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

              <Text style={styles.label}>Confirm new password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                <TextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Repeat the password"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  style={styles.input}
                />
              </View>

              <Pressable onPress={resend} hitSlop={8} style={styles.resend} disabled={cooldown > 0}>
                <Text style={[styles.resendText, cooldown > 0 && styles.resendMuted]}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend code"}
                </Text>
              </Pressable>
            </>
          ) : null}

          {step === "done" ? (
            <View style={styles.doneBox}>
              <Ionicons name="checkmark-circle" size={20} color={colors.green} />
              <Text style={styles.doneText}>
                Your password was changed. Sign in with your email and the new password.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.error} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={16} color={colors.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === "email" ? (
            <Button label="Send code" onPress={sendCode} loading={busy} style={styles.submit} />
          ) : null}

          {step === "code" ? (
            <Button label="Set new password" onPress={submit} loading={busy} style={styles.submit} />
          ) : null}

          {step === "done" ? (
            <Button
              label="Back to sign in"
              onPress={() => router.replace("/")}
              style={styles.submit}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    marginBottom: 18,
  },
  backText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
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
    marginBottom: 22,
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
    backgroundColor: colors.surface,
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
  codeInput: {
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: 8,
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.greenSoft,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 18,
  },
  codeBoxText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.green,
  },
  resend: {
    alignSelf: "flex-start",
    marginTop: -6,
    marginBottom: 8,
    paddingVertical: 6,
  },
  resendText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.brand,
  },
  resendMuted: {
    color: colors.muted,
  },
  doneBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.greenSoft,
    borderRadius: radius.md,
    padding: 14,
  },
  doneText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.green,
  },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.redSoft,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 4,
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
    marginTop: 10,
  },
});
