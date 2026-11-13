import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../components/Button";
import { LogoMark } from "../components/LogoMark";
import { useApp } from "../context/AppContext";
import { demoCredentials } from "../mock/data";
import { colors, fonts, radius, shadow, spacing } from "../theme/tokens";

export default function LoginScreen() {
  const { user, signIn } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [schoolId, setSchoolId] = useState(demoCredentials.schoolId);
  const [birthdate, setBirthdate] = useState(demoCredentials.birthdate);
  const [pendingRole, setPendingRole] = useState(null);

  if (user) {
    return (
      <Redirect
        href={user.role === "student" ? "/(student)/qr" : "/(organizer)/events"}
      />
    );
  }

  const handleSignIn = (role) => {
    setPendingRole(role);
    signIn(role);
    router.replace(role === "student" ? "/(student)/qr" : "/(organizer)/events");
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
          <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
            <View style={styles.brandRow}>
              <LogoMark size={46} fontSize={17} />
              <View>
                <Text style={styles.brand}>LacoQR</Text>
                <Text style={styles.tagline}>Dynamic QR Attendance</Text>
              </View>
            </View>

            <Text style={styles.headline}>Attendance,{"\n"}in a single scan.</Text>
            <Text style={styles.heroText}>
              Secure, rotating QR codes for every event — built for students and
              organizers of LCCB.
            </Text>

            <View style={styles.heroBadges}>
              <View style={styles.heroBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#a7f3d0" />
                <Text style={styles.heroBadgeText}>Anti-proxy</Text>
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="refresh" size={13} color="#bfdbfe" />
                <Text style={styles.heroBadgeText}>30s rotation</Text>
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="flash" size={13} color="#fde68a" />
                <Text style={styles.heroBadgeText}>Real-time</Text>
              </View>
            </View>
          </View>

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Sign in</Text>
            <Text style={styles.sheetSubtitle}>
              Use your school ID and birthdate, or jump straight in with a demo
              role.
            </Text>

            <Text style={styles.label}>School ID</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="id-card-outline" size={18} color={colors.muted} />
              <TextInput
                value={schoolId}
                onChangeText={setSchoolId}
                placeholder="2023-0000"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Birthdate</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="calendar-outline" size={18} color={colors.muted} />
              <TextInput
                value={birthdate}
                onChangeText={setBirthdate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <View style={styles.demoNote}>
              <Ionicons name="information-circle" size={15} color={colors.brand} />
              <Text style={styles.demoText}>
                Prototype mode — the fields are prefilled and any value works.
              </Text>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>CHOOSE A DEMO ROLE</Text>
              <View style={styles.line} />
            </View>

            <Button
              label="Continue as Student"
              icon="school-outline"
              onPress={() => handleSignIn("student")}
              loading={pendingRole === "student"}
              style={styles.roleButton}
            />
            <Button
              label="Continue as Organizer"
              icon="shield-checkmark-outline"
              variant="secondary"
              onPress={() => handleSignIn("organizer")}
              loading={pendingRole === "organizer"}
              style={styles.roleButton}
            />

            <Text style={styles.footer}>
              LacoQR · College of Information Technology
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
  hero: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 30,
    backgroundColor: colors.navy,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brand: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    letterSpacing: -0.7,
    color: colors.white,
    lineHeight: 27,
  },
  tagline: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.3,
    color: "rgba(255,255,255,0.58)",
    marginTop: 1,
  },
  headline: {
    fontFamily: fonts.extrabold,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -1.1,
    color: colors.white,
    marginTop: 30,
  },
  heroText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255,255,255,0.62)",
    marginTop: 10,
    maxWidth: 320,
  },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: "rgba(255,255,255,0.82)",
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: spacing.xxl,
    paddingTop: 12,
    marginTop: -6,
    ...shadow.floating,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    marginBottom: 18,
  },
  sheetTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 23,
    letterSpacing: -0.6,
    color: colors.text,
  },
  sheetSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 18,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.text,
    marginBottom: 6,
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
    marginBottom: 14,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
    height: "100%",
  },
  demoNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.tint,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  demoText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.brandDark,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 18,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: fonts.semibold,
    fontSize: 9.5,
    letterSpacing: 1,
    color: colors.muted,
  },
  roleButton: {
    marginBottom: 10,
  },
  footer: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.muted,
    textAlign: "center",
    marginTop: 14,
  },
});
