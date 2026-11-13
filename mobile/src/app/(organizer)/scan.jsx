import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { DotStat } from "../../components/Stat";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { confirmScan, previewScan } from "../../api/client";
import { useApp } from "../../context/AppContext";
import { colors, fonts, radius, spacing } from "../../theme/tokens";

export default function OrganizerScanScreen() {
  const { eventId } = useLocalSearchParams();
  const router = useRouter();
  const { events, getEvent, confirmAttendance } = useApp();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const paramId = typeof eventId === "string" && eventId ? eventId : null;
  const [pickedId, setPickedId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [torch, setTorch] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [phase, setPhase] = useState("idle");
  const scanIndex = useRef(0);
  const scanLock = useRef(false);

  const activeId = paramId || (pickerOpen ? null : pickedId);
  const event = activeId ? getEvent(activeId) : null;

  const changeEvent = () => {
    scanLock.current = false;
    setPickerOpen(true);
    setCandidate(null);
    setPhase("idle");
    if (paramId) router.setParams({ eventId: "" });
  };

  const handleScan = async () => {
    if (scanLock.current || phase !== "idle") return;
    scanLock.current = true;
    setPhase("loading");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const index = scanIndex.current;
    scanIndex.current += 1;
    try {
      const next = await previewScan({ candidateIndex: index });
      setCandidate(next);
      setPhase("verifying");
    } catch {
      scanLock.current = false;
      setPhase("idle");
    }
  };

  const handleConfirm = async () => {
    if (!candidate || candidate.duplicate) return;
    setPhase("saving");
    await confirmScan({ student: candidate });
    confirmAttendance(event.id, candidate.status);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPhase("success");
  };

  const resetScanner = () => {
    scanLock.current = false;
    setCandidate(null);
    setPhase("idle");
  };

  if (!activeId || !event) {
    return (
      <EventPicker
        events={events}
        onSelect={(id) => {
          setPickedId(id);
          setPickerOpen(false);
          setPhase("idle");
          setCandidate(null);
        }}
      />
    );
  }

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permission}>
        <View style={styles.permissionIcon}>
          <Ionicons name="camera-outline" size={30} color={colors.brand} />
        </View>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionText}>
          LacoQR uses your camera to verify student attendance QR codes.
        </Text>
        <Button
          label="Allow camera"
          icon="camera-outline"
          onPress={requestPermission}
          style={styles.permissionButton}
        />
        <Button
          label="Simulate student scan"
          variant="secondary"
          icon="scan-outline"
          onPress={handleScan}
          style={styles.permissionSecondary}
        />

        <VerifySheet
          candidate={candidate}
          phase={phase}
          event={event}
          onCancel={resetScanner}
          onConfirm={handleConfirm}
          onNext={resetScanner}
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
        onBarcodeScanned={phase === "idle" ? handleScan : undefined}
      />

      <View style={styles.overlay}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <View style={styles.topRow}>
            <View style={styles.topText}>
              <Text style={styles.eyebrow}>ORGANIZER · VERIFY ATTENDANCE</Text>
              <Text style={styles.title} numberOfLines={1}>
                {event.title}
              </Text>
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
          <Pressable onPress={changeEvent} style={styles.changeEvent} hitSlop={8}>
            <Ionicons name="swap-horizontal" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={styles.changeEventText}>Change event</Text>
          </Pressable>
        </View>

        <View style={styles.middle}>
          <View style={styles.mask} />
          <View style={styles.frame}>
            <View style={[styles.corner, { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 }]} />
            <View style={[styles.corner, { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 }]} />
            <View style={[styles.corner, { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 }]} />
            <View style={[styles.corner, { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 }]} />
            {phase === "loading" ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={colors.white} />
                <Text style={styles.loadingText}>Reading code…</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.mask} />
        </View>

        <View style={styles.bottom}>
          <View style={styles.countsRow}>
            <DotStat value={event.present} label="present" color={colors.green} />
            <DotStat value={event.late} label="late" color={colors.amber} />
            <DotStat value={event.absent} label="absent" color={colors.red} />
          </View>
          <Text style={styles.hint}>Point the camera at the student&apos;s QR code</Text>
          <Pressable onPress={handleScan} style={styles.simulate} accessibilityLabel="Simulate a student scan">
            <Ionicons name="scan" size={16} color={colors.white} />
            <Text style={styles.simulateText}>Simulate scan</Text>
          </Pressable>
        </View>
      </View>

      <VerifySheet
        candidate={candidate}
        phase={phase}
        event={event}
        onCancel={resetScanner}
        onConfirm={handleConfirm}
        onNext={resetScanner}
      />
    </View>
  );
}

function EventPicker({ events, onSelect }) {
  const liveEvents = events.filter((item) => item.status === "live");
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.pickerScreen}>
      <ScreenHeader title="Scan Attendance" subtitle="Select a live event to start verifying" />
      <View style={[styles.pickerContent, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.pickerLabel}>LIVE EVENTS</Text>
        {liveEvents.length === 0 ? (
          <Card style={styles.pickerEmpty}>
            <Ionicons name="calendar-outline" size={22} color={colors.muted} />
            <Text style={styles.pickerEmptyText}>
              No live events right now. Check the Events tab for what&apos;s next.
            </Text>
          </Card>
        ) : (
          liveEvents.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item.id)}
              style={({ pressed }) => [pressed && { opacity: 0.88 }]}
            >
              <Card style={styles.pickerCard}>
                <View style={styles.pickerCardTop}>
                  <StatusBadge status="live" label="Live" />
                  <Ionicons name="chevron-forward" size={17} color={colors.muted} />
                </View>
                <Text style={styles.pickerTitle}>{item.title}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={13} color={colors.muted} />
                  <Text style={styles.metaText}>{item.venue}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={13} color={colors.muted} />
                  <Text style={styles.metaText}>{item.time}</Text>
                </View>
                <View style={styles.pickerCounts}>
                  <DotStat value={item.present} label="present" color={colors.green} />
                  <DotStat value={item.late} label="late" color={colors.amber} />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

function VerifySheet({ candidate, phase, event, onCancel, onConfirm, onNext }) {
  const insets = useSafeAreaInsets();
  const visible = phase === "verifying" || phase === "saving" || phase === "success";
  const success = phase === "success";
  const duplicate = Boolean(candidate?.duplicate);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={phase === "verifying" ? onCancel : undefined} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 22 }]}>
          <View style={styles.handle} />

          {success ? (
            <>
              <View style={[styles.resultIcon, { backgroundColor: colors.greenSoft }]}>
                <Ionicons name="checkmark" size={30} color={colors.green} />
              </View>
              <Text style={styles.resultTitle}>Attendance recorded</Text>
              <Text style={styles.resultMessage}>
                {candidate?.name} is marked {candidate?.status} for this event.
              </Text>
              <View style={styles.countsCard}>
                <DotStat value={event.present} label="present" color={colors.green} />
                <DotStat value={event.late} label="late" color={colors.amber} />
                <DotStat value={event.absent} label="absent" color={colors.red} />
              </View>
              <Button label="Scan next student" icon="scan-outline" onPress={onNext} style={styles.sheetButton} />
            </>
          ) : (
            <>
              <Text style={styles.sheetLabel}>STUDENT VERIFICATION</Text>

              <View style={styles.studentRow}>
                <Avatar name={candidate?.name} size={54} />
                <View style={styles.studentText}>
                  <Text style={styles.studentName}>{candidate?.name || "Reading…"}</Text>
                  <Text style={styles.studentMeta}>
                    {candidate?.schoolId} · {candidate?.program} · Year {candidate?.yearLevel}
                  </Text>
                </View>
                {candidate ? <StatusBadge status={candidate.status} /> : null}
              </View>

              <View style={styles.eventBox}>
                <Text style={styles.eventBoxLabel}>CHECKING IN TO</Text>
                <Text style={styles.eventBoxTitle}>{event.title}</Text>
                <Text style={styles.eventBoxMeta}>
                  {event.venue} · {event.date}
                </Text>
              </View>

              {duplicate ? (
                <View style={styles.warning}>
                  <Ionicons name="warning" size={17} color={colors.red} />
                  <Text style={styles.warningText}>
                    This student already checked in. Duplicate scans are ignored.
                  </Text>
                </View>
              ) : (
                <View style={styles.infoNote}>
                  <Ionicons name="shield-checkmark-outline" size={15} color={colors.brand} />
                  <Text style={styles.infoNoteText}>
                    Confirm only if the student matches the ID shown above.
                  </Text>
                </View>
              )}

              {duplicate ? (
                <Button label="Scan next student" variant="secondary" icon="scan-outline" onPress={onNext} style={styles.sheetButton} />
              ) : (
                <Button
                  label={phase === "saving" ? "Saving…" : "Confirm attendance"}
                  icon="checkmark"
                  onPress={onConfirm}
                  loading={phase === "saving"}
                  disabled={!candidate || phase === "loading"}
                  style={styles.sheetButton}
                />
              )}
              <Button
                label="Cancel"
                variant="ghost"
                size="md"
                onPress={onCancel}
                disabled={phase === "saving"}
              />
            </>
          )}
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
    paddingTop: 80,
  },
  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
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
    paddingHorizontal: spacing.xl,
    paddingBottom: 14,
    backgroundColor: "rgba(6, 12, 30, 0.55)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topText: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.55)",
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    letterSpacing: -0.4,
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
  changeEvent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  changeEventText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
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
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: colors.white,
    borderRadius: 2,
  },
  loadingOverlay: {
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.white,
  },
  bottom: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: "rgba(6, 12, 30, 0.55)",
  },
  countsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
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
  pickerScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pickerContent: {
    padding: spacing.xl,
  },
  pickerLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.muted,
    marginBottom: 10,
    marginLeft: 2,
  },
  pickerEmpty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 30,
  },
  pickerEmptyText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
  },
  pickerCard: {
    marginBottom: 10,
  },
  pickerCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: colors.text,
    marginTop: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
  },
  pickerCounts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
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
    marginBottom: 16,
  },
  sheetLabel: {
    fontFamily: fonts.semibold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: colors.muted,
    marginBottom: 12,
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  studentText: {
    flex: 1,
  },
  studentName: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    letterSpacing: -0.4,
    color: colors.text,
  },
  studentMeta: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
  eventBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 13,
    marginTop: 16,
  },
  eventBoxLabel: {
    fontFamily: fonts.semibold,
    fontSize: 8.5,
    letterSpacing: 1,
    color: colors.muted,
  },
  eventBoxTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    marginTop: 3,
  },
  eventBoxMeta: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.muted,
    marginTop: 2,
  },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.redSoft,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.red,
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
  },
  infoNoteText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.muted,
  },
  sheetButton: {
    marginTop: 18,
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
  countsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
});
