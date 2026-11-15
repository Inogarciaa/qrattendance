import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../components/Button";
import { useApp } from "../context/AppContext";
import { homeRouteFor } from "../lib/routes";
import { colors, fonts, radius, spacing } from "../theme/tokens";

export default function PendingScreen() {
  const { accountStatus, accountEmail, user, refreshAccount, signOut } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState("");

  if (accountStatus === "ready") return <Redirect href="/" />;
  if (accountStatus === null) return <Redirect href="/" />;

  const disabled = accountStatus === "disabled";
  const role = user?.role || null;

  const checkAgain = async () => {
    setChecking(true);
    setNote("");
    try {
      const account = await refreshAccount();
      if (account.status === "ready" && account.user) {
        router.replace(homeRouteFor(account.user));
      } else {
        setNote("Still waiting. Ask your administrator to approve the account.");
      }
    } catch (err) {
      setNote(err?.message || "Could not reach the server.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.badge, disabled && styles.badgeDanger]}>
          <Ionicons
            name={disabled ? "lock-closed-outline" : "time-outline"}
            size={30}
            color={disabled ? colors.red : colors.amber}
          />
        </View>

        <Text style={styles.title}>
          {disabled ? "Account disabled" : "Waiting for approval"}
        </Text>

        <Text style={styles.body}>
          {disabled
            ? "An administrator has disabled this account. Contact the student affairs office if you think this is a mistake."
            : role === "organizer"
              ? "Your organizer details were submitted. An administrator has to approve the account before you can create events or scan students."
              : role === "student"
                ? "Your details were submitted. An administrator has to approve the account before you can show your QR code or check in to events."
                : "Your details were submitted. An administrator has to approve the account before you can use the app."}
        </Text>

        {role ? (
          <View style={styles.roleBox}>
            <Ionicons
              name={role === "organizer" ? "megaphone-outline" : "school-outline"}
              size={15}
              color={colors.muted}
            />
            <Text style={styles.roleText}>
              {role === "organizer" ? "Organizer account" : "Student account"}
            </Text>
          </View>
        ) : null}

        {accountEmail ? (
          <View style={styles.emailBox}>
            <Ionicons name="mail-outline" size={15} color={colors.muted} />
            <Text style={styles.emailText} numberOfLines={1}>
              {accountEmail}
            </Text>
          </View>
        ) : null}

        {note ? (
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={colors.brand} />
            <Text style={styles.noteText}>{note}</Text>
          </View>
        ) : null}

        {!disabled ? (
          <Button
            label="Check again"
            onPress={checkAgain}
            loading={checking}
            style={styles.button}
          />
        ) : null}

        <Button
          label="Log out"
          variant="secondary"
          onPress={async () => {
            await signOut();
            router.replace("/");
          }}
          style={styles.secondary}
        />
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
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDanger: {
    backgroundColor: colors.redSoft,
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
  roleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
  },
  roleText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.tint,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 20,
    maxWidth: 340,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.brandDark,
  },
  button: {
    alignSelf: "stretch",
    marginTop: 26,
  },
  secondary: {
    alignSelf: "stretch",
    marginTop: 10,
  },
});
