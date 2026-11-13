import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { studentScanEvent } from "../../mock/data";
import { colors, fonts, radius, spacing } from "../../theme/tokens";

const OUTCOMES = [
  {
    kind: "present",
    title: "Check-in confirmed",
    message: "You're marked present for this event.",
    time: "8:04 AM",
  },
  {
    kind: "late",
    title: "Checked in late",
    message: "You're in, but this event marks you as late.",
    time: "8:37 AM",
  },
  {
    kind: "duplicate",
    title: "Already checked in",
    message: "This QR was already used. Duplicate scans are ignored.",
    time: "8:04 AM",
  },
];

export default function StudentScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null);
  const outcomeIndex = useRef(0);
  const scanLock = useRef(false);

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

  const handleScan = () => {
    if (scanLock.current || !scanning) return;
    scanLock.current = true;
    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const outcome = OUTCOMES[outcomeIndex.current % OUTCOMES.length];
    outcomeIndex.current += 1;
    setResult(outcome);
  };

  const scanAgain = () => {
    scanLock.current = false;
    setResult(null);
    setScanning(true);
  };

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permission, { paddingTop: insets.top + 24 }]}>
        <View style={styles.permissionIcon}>
          <Ionicons name="camera-outline" size={30} color={colors.brand} />
        </View>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionText}>
          LacoQR uses your camera to scan event attendance QR codes. Nothing is
          recorded or uploaded in this prototype.
        </Text>
        <Button
          label="Allow camera"
          icon="camera-outline"
          onPress={requestPermission}
          style={styles.permissionButton}
        />
        <Button
          label="Simulate check-in instead"
          variant="secondary"
          icon="scan-outline"
          onPress={handleScan}
          style={styles.permissionSecondary}
        />

        <ResultSheet
          result={result}
          onClose={scanAgain}
          onHistory={() => {
            scanLock.current = false;
            setResult(null);
            setScanning(true);
            router.push("/(student)/history");
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanning ? handleScan : undefined}
      />

      <View style={styles.overlay}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={styles.eyebrow}>STUDENT CHECK-IN</Text>
            <Text style={styles.title}>Scan event QR</Text>
          </View>
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
          <View style={styles.eventChip}>
            <View style={styles.liveDot} />
            <Text style={styles.eventChipText}>{studentScanEvent.title}</Text>
          </View>
          <Text style={styles.hint}>Align the QR code inside the frame</Text>
          <Pressable onPress={handleScan} style={styles.simulate} accessibilityLabel="Simulate a QR scan">
            <Ionicons name="scan" size={16} color={colors.white} />
            <Text style={styles.simulateText}>Simulate scan</Text>
          </Pressable>
        </View>
      </View>

      <ResultSheet
        result={result}
        onClose={scanAgain}
        onHistory={() => {
          setResult(null);
          setScanning(true);
          router.push("/(student)/history");
        }}
      />
    </View>
  );
}

function Corner({ style }) {
  return <View style={[styles.corner, style]} />;
}

function ResultSheet({ result, onClose, onHistory }) {
  const insets = useSafeAreaInsets();
  const visible = Boolean(result);

  const tone = {
    present: { color: colors.green, bg: colors.greenSoft, icon: "checkmark" },
    late: { color: colors.amber, bg: colors.amberSoft, icon: "time" },
    duplicate: { color: colors.red, bg: colors.redSoft, icon: "alert" },
  }[result?.kind || "present"];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 22 }]}>
          <View style={styles.handle} />
          <View style={[styles.resultIcon, { backgroundColor: tone.bg }]}>
            <Ionicons name={tone.icon} size={30} color={tone.color} />
          </View>
          <Text style={styles.resultTitle}>{result?.title}</Text>
          <Text style={styles.resultMessage}>{result?.message}</Text>

          <View style={styles.resultEvent}>
            <View style={styles.resultEventTop}>
              <Text style={styles.resultEventTitle} numberOfLines={2}>
                {studentScanEvent.title}
              </Text>
              <StatusBadge
                status={result?.kind === "duplicate" ? "absent" : result?.kind}
                label={result?.kind === "duplicate" ? "Duplicate" : undefined}
              />
            </View>
            <View style={styles.resultMetaRow}>
              <Ionicons name="location-outline" size={14} color={colors.muted} />
              <Text style={styles.resultMeta}>{studentScanEvent.venue}</Text>
            </View>
            <View style={styles.resultMetaRow}>
              <Ionicons name="time-outline" size={14} color={colors.muted} />
              <Text style={styles.resultMeta}>
                {studentScanEvent.date} · {result?.time}
              </Text>
            </View>
          </View>

          <Button
            label={result?.kind === "duplicate" ? "Scan another code" : "Done"}
            onPress={onClose}
            icon={result?.kind === "duplicate" ? "scan-outline" : "checkmark"}
            style={styles.sheetButton}
          />
          <Button
            label="View attendance history"
            variant="ghost"
            size="md"
            onPress={onHistory}
          />
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
  },
  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  permissionTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: colors.text,
    marginTop: 20,
    textAlign: "center",
  },
  permissionText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
  },
  permissionButton: {
    alignSelf: "stretch",
    marginTop: 24,
  },
  permissionSecondary: {
    alignSelf: "stretch",
    marginTop: 10,
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
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: "rgba(255,255,255,0.55)",
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: colors.white,
    marginTop: 3,
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
  hint: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: "rgba(255,255,255,0.6)",
    marginTop: 14,
  },
  simulate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  simulateText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.white,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xxl,
    paddingTop: 12,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    marginBottom: 18,
  },
  resultIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  resultTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: colors.text,
    textAlign: "center",
    marginTop: 14,
  },
  resultMessage: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
    marginTop: 5,
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
  },
  sheetButton: {
    marginTop: 18,
  },
});
