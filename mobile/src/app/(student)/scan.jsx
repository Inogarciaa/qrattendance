import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getEvent, getEvents, parseEventQr, selfCheckIn } from "../../api/client";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { formatTimestamp } from "../../lib/format";
import { captureLocationFix, LOCATION_ERROR_MESSAGES } from "../../lib/location";
import { colors, fonts, radius, spacing } from "../../theme/tokens";

export default function StudentScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [notice, setNotice] = useState("");

  const scanLock = useRef(false);
  const noticeTimer = useRef(null);

  const [lineY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lineY, {
          toValue: 1,
          duration: 2100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(lineY, {
          toValue: 0,
          duration: 2100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [lineY]);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getEvents()
        .then((events) => {
          if (active) setLiveEvents(events.filter((event) => event.status === "live"));
        })
        .catch(() => {
          if (active) setLiveEvents([]);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const showNotice = (message) => {
    setNotice(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (scanLock.current || busy) return;

    const parsed = parseEventQr(data);
    if (!parsed) {
      scanLock.current = true;
      showNotice("That is a student QR. Scan the event code shown by the organizer.");
      setTimeout(() => {
        scanLock.current = false;
      }, 1800);
      return;
    }

    scanLock.current = true;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Ask for the event details and a location fix at the same time so the
    // GPS wait does not add to the round trip. A failed fix is not fatal.
    const [event, fix] = await Promise.all([
      getEvent(parsed.eventId).catch(() => null),
      captureLocationFix(),
    ]);

    try {
      const response = await selfCheckIn({
        eventId: parsed.eventId,
        token: parsed.token,
        location: fix.error ? null : fix,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      const flagged = response.location?.applied && response.location.verified === false;
      setResult({
        kind: response.attendance.status,
        title: response.attendance.status === "late" ? "Checked in late" : "Checked in",
        message: flagged
          ? LOCATION_ERROR_MESSAGES[fix.error] ||
            "Saved without location verification — we could not confirm you were at the venue."
          : null,
        time: formatTimestamp(response.attendance.scanned_at),
        event,
      });
    } catch (err) {
      const duplicate = err?.status === 409 && /already/i.test(err?.message || "");
      const notLive = err?.status === 409 && !duplicate;
      const outside = err?.payload?.code === "out_of_area" || err?.code === "out_of_area";

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setResult({
        kind: duplicate ? "duplicate" : outside ? "outside" : notLive ? "closed" : "error",
        title: duplicate
          ? "Already checked in"
          : outside
            ? "You are outside the venue"
            : notLive
              ? "Check-in closed"
              : "Could not check in",
        message: outside
          ? `${err.message}. Move closer to the venue and scan again.`
          : notLive
            ? "This event is not accepting check-ins right now."
            : err?.message || "Something went wrong. Please try again.",
        time:
          duplicate && err.payload?.existing?.scanned_at
            ? formatTimestamp(err.payload.existing.scanned_at)
            : "",
        event,
      });
    } finally {
      setBusy(false);
      setScanning(false);
    }
  };

  const scanAgain = () => {
    scanLock.current = false;
    setResult(null);
    setScanning(true);
  };

  const openHistory = () => {
    scanLock.current = false;
    setResult(null);
    setScanning(true);
    router.push("/(student)/history");
  };

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permission}>
        <View style={styles.permissionIcon}>
          <Ionicons name="camera-outline" size={28} color={colors.brand} />
        </View>
        <Text style={styles.permissionTitle}>Camera access</Text>
        <Text style={styles.permissionText}>
          Allow camera access to scan event QR codes.
        </Text>
        <Button
          label="Allow camera"
          onPress={requestPermission}
          style={styles.permissionButton}
        />
      </View>
    );
  }

  const liveEvent = liveEvents[0] || null;

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
      />

      <View style={styles.overlay}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.title}>Scan QR</Text>
          <Pressable
            onPress={() => setTorch((value) => !value)}
            style={[styles.torch, torch && styles.torchActive]}
            accessibilityLabel="Toggle flashlight"
          >
            <Ionicons
              name={torch ? "flash" : "flash-outline"}
              size={20}
              color={torch ? colors.navy : colors.white}
            />
          </Pressable>
        </View>

        <View style={styles.middle}>
          <View style={styles.mask} />
          <View style={styles.frame}>
            <Corner style={{ top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 }} />
            <Corner style={{ top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 }} />
            <Corner style={{ bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 }} />
            <Corner style={{ bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 }} />
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [
                    {
                      translateY: lineY.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 226],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
          <View style={styles.mask} />
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 30 }]}>
          {busy ? (
            <View style={styles.checking}>
              <ActivityIndicator color={colors.white} size="small" />
              <Text style={styles.checkingText}>Checking your location…</Text>
            </View>
          ) : (
            <Text style={styles.hint}>Scan the rotating code shown at the venue.</Text>
          )}

          {liveEvent ? (
            <View style={styles.eventChip}>
              <View style={styles.liveDot} />
              <Text style={styles.eventChipText} numberOfLines={1}>
                {liveEvent.title}
              </Text>
            </View>
          ) : null}

          {notice ? (
            <View style={styles.notice}>
              <Ionicons name="alert-circle" size={15} color={colors.white} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <ResultSheet result={result} onClose={scanAgain} onHistory={openHistory} />
    </View>
  );
}

function Corner({ style }) {
  return <View style={[styles.corner, style]} />;
}

function ResultSheet({ result, onClose, onHistory }) {
  const insets = useSafeAreaInsets();
  const visible = Boolean(result);
  const duplicate = result?.kind === "duplicate";

  const tone =
    {
      present: { color: colors.green, bg: colors.greenSoft, icon: "checkmark" },
      late: { color: colors.amber, bg: colors.amberSoft, icon: "time" },
      duplicate: { color: colors.amber, bg: colors.amberSoft, icon: "information-circle" },
      outside: { color: colors.red, bg: colors.redSoft, icon: "location-outline" },
      closed: { color: colors.muted, bg: "#f3f4f6", icon: "lock-closed" },
      error: { color: colors.red, bg: colors.redSoft, icon: "alert-circle" },
    }[result?.kind] || { color: colors.red, bg: colors.redSoft, icon: "alert-circle" };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 22 }]}>
          <View style={styles.handle} />
          <View style={[styles.resultIcon, { backgroundColor: tone.bg }]}>
            <Ionicons name={tone.icon} size={28} color={tone.color} />
          </View>
          <Text style={styles.resultTitle}>{result?.title}</Text>

          {result?.event ? (
            <View style={styles.resultEvent}>
              <View style={styles.resultEventTop}>
                <Text style={styles.resultEventTitle} numberOfLines={2}>
                  {result.event.title}
                </Text>
                <StatusBadge
                  status={duplicate ? "absent" : result?.kind}
                  label={
                    duplicate
                      ? "Duplicate"
                      : result?.kind === "outside"
                        ? "Outside venue"
                        : result?.kind === "closed"
                          ? "Closed"
                          : result?.kind === "error"
                            ? "Failed"
                            : undefined
                  }
                />
              </View>
              <View style={styles.resultMetaRow}>
                <Ionicons name="location-outline" size={14} color={colors.muted} />
                <Text style={styles.resultMeta} numberOfLines={1}>
                  {result.event.venue || "—"}
                </Text>
              </View>
              <View style={styles.resultMetaRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.muted} />
                <Text style={styles.resultMeta}>
                  {result.event.date}
                  {result.time ? ` · ${result.time}` : ""}
                </Text>
              </View>
            </View>
          ) : null}

          {result?.message ? <Text style={styles.resultMessage}>{result.message}</Text> : null}
          {duplicate ? (
            <Text style={styles.resultMessage}>This event is already checked in for you.</Text>
          ) : null}

          <Button label={duplicate ? "Scan another" : "Done"} onPress={onClose} style={styles.sheetButton} />
          <Button label="View history" variant="ghost" size="md" onPress={onHistory} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  permission: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionIcon: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    fontFamily: fonts.bold,
    fontSize: 21,
    letterSpacing: -0.5,
    color: colors.text,
    marginTop: 20,
    textAlign: "center",
  },
  permissionText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
  },
  permissionButton: {
    alignSelf: "stretch",
    marginTop: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: 18,
    backgroundColor: "rgba(6, 12, 30, 0.55)",
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 21,
    letterSpacing: -0.5,
    color: colors.white,
  },
  torch: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  torchActive: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  middle: {
    flexDirection: "row",
    alignItems: "center",
  },
  mask: {
    flex: 1,
    height: 250,
    backgroundColor: "rgba(6, 12, 30, 0.55)",
  },
  frame: {
    width: 250,
    height: 250,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: colors.white,
    borderRadius: 2,
  },
  scanLine: {
    position: "absolute",
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(96, 165, 250, 0.95)",
    shadowColor: "#60a5fa",
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  bottom: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: "rgba(6, 12, 30, 0.55)",
  },
  hint: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    marginBottom: 14,
    maxWidth: 280,
  },
  checking: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  checkingText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  eventChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  eventChipText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: "rgba(220, 38, 38, 0.92)",
    maxWidth: 320,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.white,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xxl,
    paddingTop: 12,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: 20,
  },
  resultIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  resultTitle: {
    fontFamily: fonts.bold,
    fontSize: 21,
    letterSpacing: -0.5,
    color: colors.text,
    textAlign: "center",
    marginTop: 14,
    marginBottom: 18,
  },
  resultEvent: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 14,
    gap: 7,
  },
  resultEventTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 2,
  },
  resultEventTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.text,
    letterSpacing: -0.1,
  },
  resultMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resultMeta: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
  },
  resultMessage: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
    marginTop: 12,
  },
  sheetButton: {
    marginTop: 18,
  },
});
