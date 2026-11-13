import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Card } from "./Card";
import { ScreenHeader } from "./ScreenHeader";
import { useApp } from "../context/AppContext";
import { profileSettings } from "../mock/data";
import { colors, fonts, radius, spacing } from "../theme/tokens";

export function ProfileScreen() {
  const { user, signOut } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isStudent = user?.role === "student";

  const handleLogout = () => {
    Alert.alert("Log out of LacoQR?", "You will return to the role selection screen.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          signOut();
          router.replace("/");
        },
      },
    ]);
  };

  const handleSetting = (item) => {
    Alert.alert(item.label, "This is a UI prototype — settings are not wired up yet.");
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Profile"
        subtitle={isStudent ? "Student account" : "Organizer account"}
        tone="navy"
      >
        <View style={styles.hero}>
          <Avatar name={user?.name} size={62} tone="dark" />
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
              <StatBlock value="12" label="Events attended" />
              <View style={styles.divider} />
              <StatBlock value="92%" label="On-time rate" />
              <View style={styles.divider} />
              <StatBlock value="1" label="Late record" />
            </>
          ) : (
            <>
              <StatBlock value="8" label="Events managed" />
              <View style={styles.divider} />
              <StatBlock value="526" label="Scans today" />
              <View style={styles.divider} />
              <StatBlock value="99.2%" label="Accuracy" />
            </>
          )}
        </Card>

        <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>
        <Card padded={false} style={styles.listCard}>
          <InfoRow icon="id-card-outline" label="School ID" value={user?.schoolId} />
          <InfoRow icon="book-outline" label="Program" value={user?.program} />
          {isStudent ? (
            <InfoRow icon="layers-outline" label="Year & Section" value={`Year ${user?.yearLevel} · ${user?.section}`} />
          ) : (
            <InfoRow icon="briefcase-outline" label="Position" value={user?.position} />
          )}
          <InfoRow icon="mail-outline" label="Email" value={user?.email} last />
        </Card>

        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <Card padded={false} style={styles.listCard}>
          {profileSettings.map((item, index) => (
            <SettingRow
              key={item.id}
              item={item}
              last={index === profileSettings.length - 1}
              onPress={() => handleSetting(item)}
            />
          ))}
        </Card>

        <View style={styles.demoNote}>
          <Ionicons name="flask-outline" size={16} color={colors.brand} />
          <Text style={styles.demoText}>
            Prototype build · all data is mocked. No real attendance is recorded.
          </Text>
        </View>

        <Button
          label="Log out"
          icon="log-out-outline"
          variant="danger"
          onPress={handleLogout}
          style={styles.logout}
        />
        <Text style={styles.version}>LacoQR Mobile · v1.0.0</Text>
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
        <Ionicons name={icon} size={17} color={colors.brand} />
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
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Ionicons name={item.icon} size={17} color={colors.brand} />
      </View>
      <Text style={styles.rowLabel}>{item.label}</Text>
      {item.detail ? <Text style={styles.rowDetail}>{item.detail}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </View>
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
    marginTop: 20,
  },
  heroText: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.white,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
  },
  roleText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.white,
    textTransform: "uppercase",
  },
  schoolId: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.62)",
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
    paddingVertical: 16,
    marginTop: -38,
  },
  statBlock: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontFamily: fonts.extrabold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: colors.text,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
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
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.muted,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
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
    width: 30,
    height: 30,
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
  demoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.tint,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 22,
  },
  demoText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.brandDark,
  },
  logout: {
    marginTop: 20,
  },
  version: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginTop: 16,
  },
});
