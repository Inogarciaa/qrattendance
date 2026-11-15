import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getEvents, getMyAttendance } from "../api/client";
import { useApp } from "../context/AppContext";
import { colors, fonts, radius, spacing } from "../theme/tokens";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Card } from "./Card";
import { ScreenHeader } from "./ScreenHeader";

const PROFILE_SETTINGS = [
  { id: "notifications", label: "Notifications", icon: "notifications-outline", detail: "On" },
  { id: "security", label: "Security", icon: "shield-checkmark-outline", detail: "School ID login" },
  { id: "help", label: "Help & Support", icon: "help-circle-outline", detail: "" },
  { id: "about", label: "About LacoQR", icon: "information-circle-outline", detail: "v1.0.0" },
];

export function ProfileScreen() {
  const { user, signOut } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState(null);

  const isStudent = user?.role === "student";

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          if (isStudent) {
            const records = await getMyAttendance();
            const present = records.filter((record) => record.status === "present").length;
            const late = records.filter((record) => record.status === "late").length;
            const onTime = records.length ? Math.round((present / records.length) * 100) : 0;
            if (active) setStats({ first: records.length, second: onTime, third: late });
          } else {
            const events = await getEvents();
            const scans = events.reduce((sum, event) => sum + event.present + event.late, 0);
            const enrolled = events.reduce((sum, event) => sum + (event.enrolled || 0), 0);
            const turnout = enrolled ? Math.round((scans / enrolled) * 100) : 0;
            if (active) setStats({ first: events.length, second: scans, third: turnout });
          }
        } catch {
          if (active) setStats(null);
        }
      })();

      return () => {
        active = false;
      };
    }, [isStudent])
  );

  const handleLogout = () => {
    Alert.alert("Log out?", "You will return to the sign-in screen.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);
  };

  const handleSetting = () => {
    Alert.alert("Coming soon", "This setting is not available yet.");
  };

  const statValue = (key, suffix = "") =>
    stats ? `${stats[key]}${suffix}` : "—";

  return (
    <View style={styles.screen}>
      <ScreenHeader tone="navy">
        <View style={styles.hero}>
          <Avatar name={user?.name} size={64} tone="dark" />
          <View style={styles.heroText}>
            <Text style={styles.name}>{user?.name}</Text>
            <View style={styles.rolePill}>
              <Ionicons
                name={isStudent ? "school-outline" : "shield-checkmark-outline"}
                size={12}
                color={colors.white}
              />
              <Text style={styles.roleText}>{isStudent ? "Student" : "Organizer"}</Text>
            </View>
            <Text style={styles.schoolId}>{user?.schoolId}</Text>
          </View>
        </View>
      </ScreenHeader>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.statsCard}>
          {isStudent ? (
            <>
              <StatBlock value={statValue("first")} label="Attended" />
              <View style={styles.divider} />
              <StatBlock value={statValue("second", "%")} label="On time" />
              <View style={styles.divider} />
              <StatBlock value={statValue("third")} label="Late" />
            </>
          ) : (
            <>
              <StatBlock value={statValue("first")} label="Events" />
              <View style={styles.divider} />
              <StatBlock value={statValue("second")} label="Scans" />
              <View style={styles.divider} />
              <StatBlock value={statValue("third", "%")} label="Turnout" />
            </>
          )}
        </Card>

        <Text style={styles.sectionLabel}>Account</Text>
        <Card padded={false} style={styles.listCard}>
          <InfoRow icon="id-card-outline" label="School ID" value={user?.schoolId} />
          <InfoRow icon="book-outline" label="Program" value={user?.program || "—"} />
          {isStudent && user?.yearLevel ? (
            <InfoRow icon="layers-outline" label="Year level" value={`Year ${user.yearLevel}`} />
          ) : (
            <InfoRow icon="shield-outline" label="Role" value={isStudent ? "Student" : "Organizer"} />
          )}
          <InfoRow icon="mail-outline" label="Email" value={user?.email || "—"} last />
        </Card>

        <Text style={styles.sectionLabel}>Preferences</Text>
        <Card padded={false} style={styles.listCard}>
          {PROFILE_SETTINGS.map((item, index) => (
            <SettingRow
              key={item.id}
              item={item}
              last={index === PROFILE_SETTINGS.length - 1}
              onPress={handleSetting}
            />
          ))}
        </Card>

        <Button
          label="Log out"
          variant="danger"
          onPress={handleLogout}
          style={styles.logout}
        />
      </ScrollView>
    </View>
  );
}

function StatBlock({ value, label }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, last }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.brand} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SettingRow({ item, last, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowBorder,
        pressed && { backgroundColor: colors.bg },
      ]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={item.icon} size={16} color={colors.brand} />
      </View>
      <Text style={styles.rowLabel}>{item.label}</Text>
      {item.detail ? <Text style={styles.rowDetail}>{item.detail}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 8,
  },
  heroText: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.white,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
  },
  roleText: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.white,
  },
  schoolId: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    marginTop: 5,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 18,
    paddingBottom: 16,
    marginTop: -26,
  },
  statBlock: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: colors.text,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    textAlign: "center",
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 2,
  },
  listCard: {
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  rowValue: {
    maxWidth: "52%",
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
    textAlign: "right",
  },
  rowDetail: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
  logout: {
    marginTop: 24,
  },
});
