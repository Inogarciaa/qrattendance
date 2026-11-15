import { Ionicons } from "@expo/vector-icons";
import * as Brightness from "expo-brightness";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  buildStudentQrPayload,
  getEvents,
  issueStudentToken,
} from "../../api/client";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CountdownRing } from "../../components/CountdownRing";
import { useApp } from "../../context/AppContext";
import { useQrToken } from "../../hooks/useQrToken";
import { formatClock } from "../../lib/format";
import { colors, fonts, radius, spacing } from "../../theme/tokens";

export default function StudentQrScreen() {
  const { user } = useApp();
  const insets = useSafeAreaInsets();
  const [liveEvents, setLiveEvents] = useState([]);
  const [eventsError, setEventsError] = useState("");

  const { token, secondsLeft, expired, windowSeconds, progress, loading, error, generate } =
    useQrToken({ issue: issueStudentToken });
  const previousBrightness = useRef(null);
  const hasCode = Boolean(token);

  // A fresh code every time the student opens this tab.
  useFocusEffect(
    useCallback(() => {
      generate();

      let active = true;
      getEvents()
        .then((events) => {
          if (active) {
            setLiveEvents(events.filter((event) => event.status === "live"));
            setEventsError("");
          }
        })
        .catch((err) => {
          if (active) setEventsError(err?.message || "Could not load events.");
        });

      return () => {
        active = false;
      };
    }, [generate])
  );

  useFocusEffect(
    useCallback(() => {
      if (!hasCode) return undefined;
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
    }, [hasCode])
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <View style={styles.heroText}>
          <Text style={styles.name} numberOfLines={1}>
            {user?.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {user?.schoolId}
            {user?.programCode ? ` · ${user.programCode}` : ""}
            {user?.yearLevel ? ` · Year ${user.yearLevel}` : ""}
          </Text>
        </View>
        <Avatar name={user?.name} size={44} tone="dark" />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.qrCard}>
          {hasCode ? (
            <>
              <View style={styles.qrWrap}>
                <QRCode
                  value={buildStudentQrPayload(token)}
                  size={212}
                  color={colors.navy}
                  backgroundColor={colors.white}
                  quietZone={6}
                />
              </View>

              <View style={styles.timerRow}>
                <CountdownRing progress={progress} seconds={secondsLeft} />
                <Text style={styles.timerTitle}>
                  {secondsLeft <= 5 ? "Refreshing code…" : `New code in ${secondsLeft}s`}
                </Text>
                <Pressable
                  onPress={generate}
                  hitSlop={10}
                  disabled={loading}
                  accessibilityLabel="Generate a new QR code"
                  style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="refresh" size={18} color={colors.brand} />
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.generator}>
              <View style={styles.generatorFrame}>
                <Ionicons name="qr-code-outline" size={52} color={colors.brand} />
              </View>
              <Text style={styles.generatorText}>
                {error
                  ? error
                  : expired
                    ? "Code expired."
                    : `Codes are valid for ${windowSeconds} seconds.`}
              </Text>
              <Button
                label={loading ? "Generating…" : expired ? "Generate new QR" : "Generate QR"}
                onPress={generate}
                loading={loading}
                style={styles.generatorButton}
              />
            </View>
          )}
        </Card>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Live now</Text>
          <Text style={styles.sectionCount}>{liveEvents.length}</Text>
        </View>

        {liveEvents.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="calendar-clear-outline" size={20} color={colors.muted} />
            <Text style={styles.emptyText}>
              {eventsError || "No events are open for scanning right now."}
            </Text>
          </Card>
        ) : (
          liveEvents.map((event) => (
            <Card key={event.id} style={styles.liveEvent} padded={false}>
              <View style={styles.liveAccent} />
              <View style={styles.liveBody}>
                <Text style={styles.liveTitle} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={styles.liveMeta} numberOfLines={1}>
                  {event.venue} · until {formatClock(event.endTime)}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
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
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.xl,
    paddingBottom: 32,
  },
  heroText: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: -0.6,
    color: colors.white,
  },
  meta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    marginTop: 3,
  },
  content: {
    padding: spacing.xl,
    paddingTop: 0,
  },
  qrCard: {
    marginTop: -20,
    padding: 20,
    alignItems: "center",
  },
  qrWrap: {
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  generator: {
    alignItems: "center",
    alignSelf: "stretch",
    paddingVertical: 8,
  },
  generatorFrame: {
    width: 212,
    height: 212,
    borderRadius: radius.lg,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  generatorText: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 10,
  },
  generatorButton: {
    alignSelf: "stretch",
    marginTop: 16,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    alignSelf: "stretch",
  },
  timerTitle: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  refresh: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  sectionCount: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
  },
  emptyText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  liveEvent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 0,
    marginBottom: 10,
    overflow: "hidden",
  },
  liveAccent: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: colors.green,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  liveBody: {
    flex: 1,
  },
  liveTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.text,
  },
  liveMeta: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
});
