import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getEvents, getMyAttendance, removePhoto, uploadPhoto } from "../api/client";
import { useApp } from "../context/AppContext";
import { colors, fonts, radius, shadow, spacing } from "../theme/tokens";
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

// The picker returns JPEG data whenever `base64` is on.
const PICKER_OPTIONS = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.6,
  base64: true,
};

export function ProfileScreen() {
  const { user, signOut, refreshUser } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notice, setNotice] = useState("");

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

  const savePhoto = async (asset) => {
    if (!asset?.base64) {
      setNotice("That photo could not be read. Try a JPEG or PNG.");
      return;
    }

    setPhotoBusy(true);
    try {
      await uploadPhoto({ base64: asset.base64, mimeType: "image/jpeg" });
      await refreshUser();
      setNotice("Photo updated.");
    } catch (err) {
      setNotice(err?.message || "Could not save that photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const pickPhoto = async (fromCamera) => {
    setSheet(null);
    setNotice("");

    try {
      if (fromCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setNotice("Allow camera access if you want to take a profile photo.");
          return;
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);

      if (result.canceled) return;
      await savePhoto(result.assets?.[0]);
    } catch (err) {
      setNotice(err?.message || "The photo picker could not open.");
    }
  };

  const dropPhoto = async () => {
    setSheet(null);
    setNotice("");

    setPhotoBusy(true);
    try {
      await removePhoto();
      await refreshUser();
      setNotice("Profile photo removed.");
    } catch (err) {
      setNotice(err?.message || "Could not remove the photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const confirmLogout = async () => {
    setSheet(null);
    setLoggingOut(true);
    try {
      await signOut();
      router.replace("/");
    } finally {
      setLoggingOut(false);
    }
  };

  const statValue = (key, suffix = "") => (stats ? `${stats[key]}${suffix}` : "—");

  return (
    <View style={styles.screen}>
      <ScreenHeader tone="navy">
        <View style={styles.hero}>
          <Pressable
            onPress={() => setSheet("photo")}
            disabled={photoBusy}
            accessibilityRole="button"
            accessibilityLabel={user?.photoUrl ? "Change profile photo" : "Add profile photo"}
            style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.8 }]}
          >
            <Avatar name={user?.name} uri={user?.photoUrl} size={64} tone="dark" />
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={11} color={colors.white} />
            </View>
            {photoBusy ? (
              <View style={styles.avatarBusy}>
                <ActivityIndicator color={colors.white} size="small" />
              </View>
            ) : null}
          </Pressable>

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
        {notice ? (
          <Pressable
            onPress={() => setNotice("")}
            style={styles.notice}
            accessibilityRole="alert"
          >
            <Ionicons name="information-circle" size={16} color={colors.brandDark} />
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

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
              onPress={() => setNotice("That setting is not available yet.")}
            />
          ))}
        </Card>

        <Button
          label="Log out"
          variant="danger"
          onPress={() => setSheet("logout")}
          loading={loggingOut}
          style={styles.logout}
        />
      </ScrollView>

      <Sheet
        visible={sheet === "photo"}
        title="Profile photo"
        bottomInset={insets.bottom}
        onClose={() => setSheet(null)}
      >
        <SheetRow
          icon="camera-outline"
          label="Take a photo"
          onPress={() => pickPhoto(true)}
        />
        <SheetRow
          icon="images-outline"
          label="Choose from library"
          onPress={() => pickPhoto(false)}
        />
        {user?.photoUrl ? (
          <SheetRow
            icon="trash-outline"
            label="Remove photo"
            destructive
            onPress={dropPhoto}
          />
        ) : null}
        <SheetRow icon="close-outline" label="Cancel" onPress={() => setSheet(null)} last />
      </Sheet>

      <Sheet
        visible={sheet === "logout"}
        title="Log out of LacoQR?"
        bottomInset={insets.bottom}
        onClose={() => setSheet(null)}
      >
        <Text style={styles.sheetBody}>You will return to the sign-in screen.</Text>
        <SheetRow icon="close-outline" label="Cancel" onPress={() => setSheet(null)} />
        <SheetRow
          icon="log-out-outline"
          label="Log out"
          destructive
          onPress={confirmLogout}
          last
        />
      </Sheet>
    </View>
  );
}

function Sheet({ visible, title, bottomInset = 0, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheetCard, { paddingBottom: spacing.lg + bottomInset }]}
          onPress={() => {}}
        >
          <View style={styles.sheetHandle} />
          {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetRow({ icon, label, onPress, destructive, last }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetRow,
        !last && styles.sheetRowBorder,
        pressed && { backgroundColor: colors.bg },
      ]}
      accessibilityRole="button"
    >
      <Ionicons
        name={icon}
        size={18}
        color={destructive ? colors.red : colors.text}
      />
      <Text style={[styles.sheetLabel, destructive && { color: colors.red }]}>{label}</Text>
    </Pressable>
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
  avatarWrap: {
    width: 64,
    height: 64,
  },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
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
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.tint,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.brandDark,
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
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadow.floating,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 6,
  },
  sheetBody: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    marginBottom: 10,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 15,
  },
  sheetRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
});
