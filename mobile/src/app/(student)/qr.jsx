import { Ionicons } from "@expo/vector-icons";
import * as Brightness from "expo-brightness";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { Avatar } from "../../components/Avatar";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";
import { useApp } from "../../context/AppContext";
import { useTokenRotation } from "../../hooks/useTokenRotation";
import { colors, fonts, radius, spacing } from "../../theme/tokens";

export default function StudentQrScreen() {
  const { user } = useApp();
  const insets = useSafeAreaInsets();
  const { token, secondsLeft, progress, refresh } = useTokenRotation();
  const previousBrightness = useRef(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const boost = async () => {
        if (Platform.OS === "web") return;
        try {
          const current = await Brightness.getBrightnessAsync();
          if (mounted) previousBrightness.current = current;
          await Brightness.setBrightnessAsync(1);
        } catch {
          // Brightness is a nice-to-have; ignore unsupported devices.
        }
      };

      boost();

      return () => {
        mounted = false;
        if (Platform.OS === "web") return;
        const restore = async () => {
          try {
            if (Platform.OS === "android") {
              await Brightness.restoreSystemBrightnessAsync();
            } else if (previousBrightness.current != null) {
              await Brightness.setBrightnessAsync(previousBrightness.current);
            }
          } catch {
            // Ignore restore failures.
          }
        };
        restore();
      };
    }, []),
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>STUDENT ATTENDANCE PASS</Text>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.meta}>
              {user?.schoolId} · {user?.programCode} · Year {user?.yearLevel}
            </Text>
          </View>
          <Avatar name={user?.name} size={48} tone="dark" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.qrCard}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.cardTitle}>Your check-in code</Text>
              <Text style={styles.cardSubtitle}>Show this to the organizer</Text>
            </View>
            <StatusBadge status="live" label="Active" />
          </View>

          <View style={styles.qrWrap}>
            <QRCode
              value={token}
              size={216}
              color={colors.navy}
              backgroundColor={colors.white}
              quietZone={6}
            />
          </View>

          <View style={styles.timerRow}>
            <CountdownRing progress={progress} seconds={secondsLeft} />
            <View style={styles.timerText}>
              <Text style={styles.timerTitle}>
                {secondsLeft <= 5 ? "Refreshing code…" : `Refreshes in ${secondsLeft}s`}
              </Text>
              <Text style={styles.timerSubtitle}>
                Rotates automatically to prevent screenshots
              </Text>
            </View>
            <Pressable
              onPress={refresh}
              hitSlop={10}
              accessibilityLabel="Refresh QR code"
              style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="refresh" size={18} color={colors.brand} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={15} color={colors.muted} />
            <Text style={styles.infoText}>Valid for 30 seconds</Text>
            <View style={styles.infoDot} />
            <Ionicons name="shield-checkmark-outline" size={15} color={colors.muted} />
            <Text style={styles.infoText}>Single use</Text>
          </View>
        </Card>

        <View style={styles.tip}>
          <View style={styles.tipIcon}>
            <Ionicons name="bulb-outline" size={18} color={colors.brand} />
          </View>
          <Text style={styles.tipText}>
            Turn your screen toward the scanner at the entrance. Keep the app
            open — screenshots and shared codes will be rejected.
          </Text>
        </View>

        <View style={styles.eventRow}>
          <Text style={styles.sectionLabel}>TODAY&apos;S LIVE EVENTS</Text>
          <Text style={styles.sectionCount}>2</Text>
        </View>
        <Card style={styles.liveEvent} padded={false}>
          <View style={styles.liveAccent} />
          <View style={styles.liveBody}>
            <Text style={styles.liveTitle}>University General Assembly 2026</Text>
            <Text style={styles.liveMeta}>LCCB Gymnasium · until 11:00 AM</Text>
          </View>
          <StatusBadge status="live" label="Live" />
        </Card>
        <Card style={styles.liveEvent} padded={false}>
          <View style={styles.liveAccent} />
          <View style={styles.liveBody}>
            <Text style={styles.liveTitle}>BSIT Capstone Defense Briefing</Text>
            <Text style={styles.liveMeta}>AVR 2, IT Building · until 4:00 PM</Text>
          </View>
          <StatusBadge status="live" label="Live" />
        </Card>
      </ScrollView>
    </View>
  );
}

function CountdownRing({ progress, seconds }) {
  const size = 52;
  const stroke = 4;
  const radiusValue = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusValue}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusValue}
          stroke={seconds <= 5 ? colors.amber : colors.brand}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringText}>{seconds}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  hero: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.xl,
    paddingBottom: 34,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroText: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: "rgba(255,255,255,0.5)",
  },
  name: {
    fontFamily: fonts.extrabold,
    fontSize: 23,
    letterSpacing: -0.6,
    color: colors.white,
    marginTop: 4,
  },
  meta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 3,
  },
  content: {
    padding: spacing.xl,
    paddingTop: 0,
  },
  qrCard: {
    marginTop: -22,
    padding: 18,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: colors.text,
  },
  cardSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
  qrWrap: {
    alignSelf: "center",
    padding: 14,
    marginTop: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
  },
  timerText: {
    flex: 1,
  },
  timerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.text,
  },
  timerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  refresh: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
  },
  infoDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginHorizontal: 3,
  },
  tip: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.tint,
    borderRadius: radius.md,
    padding: 13,
    marginTop: 14,
  },
  tipIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.brandDark,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.muted,
  },
  sectionCount: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.brand,
  },
  liveEvent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    paddingLeft: 0,
    marginBottom: 8,
    overflow: "hidden",
  },
  liveAccent: {
    width: 4,
    alignSelf: "stretch",
    backgroundColor: colors.green,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  liveBody: {
    flex: 1,
  },
  liveTitle: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.text,
  },
  liveMeta: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.muted,
    marginTop: 2,
  },
});
