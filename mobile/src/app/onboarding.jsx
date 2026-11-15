import { Ionicons } from "@expo/vector-icons";
import { Redirect, Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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

import { clearIntendedRole, getIntendedRole } from "../api/client";
import { Button } from "../components/Button";
import { useApp } from "../context/AppContext";
import { colors, fonts, radius, spacing } from "../theme/tokens";

// These four are both the degree programs and the organizer departments.
const DEPARTMENTS = ["SBIT", "ARFIEN", "SSLATE", "SHTM"];
const YEARS = [1, 2, 3, 4, 5];

const ROLES = [
  { key: "student", label: "Student", icon: "school-outline" },
  { key: "organizer", label: "Organizer", icon: "megaphone-outline" },
];

const COPY = {
  student: {
    title: "Complete your student profile",
    subtitle: (email) =>
      `Signed up as ${email || "your Google account"}. We need these details to match you with your class before an administrator approves the account.`,
  },
  organizer: {
    title: "Complete your organizer profile",
    subtitle: (email) =>
      `Signed up as ${email || "your Google account"}. Your department is only used on your profile; the venue fence is set by the administrator on each event.`,
  },
};

export default function OnboardingScreen() {
  const { accountEmail, accountStatus, completeOnboarding, signOut } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [role, setRole] = useState("student");
  const [schoolId, setSchoolId] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [yearLevel, setYearLevel] = useState(null);
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // The login screen records which sign-up button was pressed; a web redirect
  // reloads the app, so the choice comes back from storage.
  useEffect(() => {
    let active = true;
    getIntendedRole().then((stored) => {
      if (active) setRole(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  // Only reachable with a Google session that has no profile yet.
  if (!accountStatus || accountStatus === "ready" || accountStatus === "disabled") {
    return <Redirect href="/" />;
  }
  if (accountStatus === "pending") return <Redirect href="/pending" />;

  const isOrganizer = role === "organizer";
  const copy = COPY[role] || COPY.student;

  const submit = async () => {
    if (busy) return;

    const complete =
      schoolId.trim() &&
      fullName.trim() &&
      department &&
      birthdate.trim() &&
      (isOrganizer || yearLevel);

    if (!complete) {
      setError(
        isOrganizer
          ? "Fill in every field so an administrator can review your account."
          : "Fill in every field so we can match you to your record."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const result = await completeOnboarding({
        role,
        school_id: schoolId.trim(),
        full_name: fullName.trim(),
        program_code: department,
        year_level: isOrganizer ? undefined : yearLevel,
        birthdate: birthdate.trim(),
      });

      await clearIntendedRole();

      if (result?.status === "pending") {
        router.replace("/pending");
        return;
      }
      router.replace("/");
    } catch (err) {
      setError(err?.message || "Could not save your details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.badge}>
            <Ionicons
              name={isOrganizer ? "megaphone-outline" : "person-add-outline"}
              size={26}
              color={colors.brand}
            />
          </View>

          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle(accountEmail)}</Text>

          <Text style={styles.label}>Signing up as</Text>
          <View style={styles.roles}>
            {ROLES.map(({ key, label, icon }) => {
              const active = role === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setRole(key);
                    setError("");
                    if (key === "organizer") setYearLevel(null);
                  }}
                  style={[styles.role, active && styles.roleActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={icon}
                    size={18}
                    color={active ? colors.brand : colors.muted}
                  />
                  <Text style={[styles.roleText, active && styles.roleTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Full name</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color={colors.muted} />
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Maria Santos"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              autoComplete="name"
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>School ID</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="id-card-outline" size={18} color={colors.muted} />
            <TextInput
              value={schoolId}
              onChangeText={setSchoolId}
              placeholder="2023-0142"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>{isOrganizer ? "Department" : "Program"}</Text>
          <View style={styles.chips}>
            {DEPARTMENTS.map((code) => (
              <Pressable
                key={code}
                onPress={() => setDepartment(code)}
                style={[styles.chip, department === code && styles.chipActive]}
              >
                <Text style={[styles.chipText, department === code && styles.chipTextActive]}>
                  {code}
                </Text>
              </Pressable>
            ))}
          </View>

          {isOrganizer ? null : (
            <>
              <Text style={styles.label}>Year level</Text>
              <View style={styles.chips}>
                {YEARS.map((year) => (
                  <Pressable
                    key={year}
                    onPress={() => setYearLevel(year)}
                    style={[styles.chip, yearLevel === year && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, yearLevel === year && styles.chipTextActive]}>
                      Year {year}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>Birthdate</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="calendar-outline" size={18} color={colors.muted} />
            <TextInput
              value={birthdate}
              onChangeText={setBirthdate}
              placeholder="2003-04-12"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
              style={styles.input}
            />
          </View>

          {error ? (
            <View style={styles.error} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={16} color={colors.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button label="Submit for approval" onPress={submit} loading={busy} style={styles.submit} />

          <Pressable
            onPress={async () => {
              await clearIntendedRole();
              await signOut();
              router.replace("/");
            }}
            style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cancelText}>Use a different account</Text>
          </Pressable>
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
  badge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    letterSpacing: -0.7,
    color: colors.text,
    marginTop: 18,
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
  roles: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  role: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleActive: {
    backgroundColor: colors.tint,
    borderColor: colors.brand,
  },
  roleText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.muted,
  },
  roleTextActive: {
    color: colors.brandDark,
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
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.tint,
    borderColor: colors.brand,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.muted,
  },
  chipTextActive: {
    color: colors.brandDark,
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
  cancel: {
    alignSelf: "center",
    marginTop: 18,
    paddingVertical: 8,
  },
  cancelText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.muted,
  },
});
