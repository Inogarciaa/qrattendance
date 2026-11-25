import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../components/Button";
import { useApp } from "../context/AppContext";
import { isMobileRole } from "../lib/routes";
import { colors, fonts, radius, spacing } from "../theme/tokens";

/**
 * Shown when a session belongs to an account the mobile app cannot serve
 * (admins and superadmins work on the web dashboard). Keeping this as its own
 * screen is what stops such a session from bouncing between the tab groups.
 */
export default function StaffOnlyScreen() {
  const { user, accountStatus, accountEmail, signOut } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (accountStatus && accountStatus !== "ready") return <Redirect href="/" />;
  if (user && isMobileRole(user.role)) return <Redirect href="/" />;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badge}>
          <Ionicons name="desktop-outline" size={30} color={colors.brand} />
        </View>

        <Text style={styles.title}>Use the web dashboard</Text>

        <Text style={styles.body}>
          This account is a staff account. Admins and superadmins manage events, students and
          reports from the Scanly dashboard on a computer. The phone app is only for students
          and organizers.
        </Text>

        {accountEmail ? (
          <View style={styles.emailBox}>
            <Ionicons name="mail-outline" size={15} color={colors.muted} />
            <Text style={styles.emailText} numberOfLines={1}>
              {accountEmail}
            </Text>
          </View>
        ) : null}

        <Button
          label="Log out"
          onPress={async () => {
            await signOut();
            router.replace("/");
          }}
          style={styles.button}
        />

        <Text style={styles.hint}>
          Signing in with the school ID of a student or organizer account opens the app.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    letterSpacing: -0.7,
    color: colors.text,
    marginTop: 22,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 340,
  },
  emailBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 20,
    maxWidth: "100%",
  },
  emailText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
  button: {
    alignSelf: "stretch",
    marginTop: 26,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.muted,
    textAlign: "center",
    marginTop: 16,
    maxWidth: 320,
  },
});
