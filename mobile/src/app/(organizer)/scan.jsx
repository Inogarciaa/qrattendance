import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  confirmScan,
  getEvent,
  getOrganizingEvents,
  getEvents,
  parseStudentQr,
  previewScan,
} from "../../api/client";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenHeader } from "../../components/ScreenHeader";
import { DotStat } from "../../components/Stat";
import { StatusBadge } from "../../components/StatusBadge";
import { formatTimestamp } from "../../lib/format";
import { colors, fonts, radius, spacing } from "../../theme/tokens";

/**
 * The gatekeeper camera. Organizers reach it from their Events tab; students
 * with a temporary grant open the same screen from the gatekeeper route, which
 * is why the event list source is a prop instead of a hard-coded call.
 */
export default function OrganizerScanScreen({ tempAccess = false }) {
  const { eventId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const listEvents = tempAccess ? getOrganizingEvents : getEvents;

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [manualId, setManualId] = useState(null);
  const [dismissedParam, setDismissedParam] = useState(null);
  const [torch, setTorch] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [scanError, setScanError] = useState("");

  const scanLock = useRef(false);
  const errorTimer = useRef(null);

  const paramId = typeof eventId === "string" && eventId ? eventId : null;

  const load = useCallback(async () => {
    try {
      const data = await listEvents();
      setEvents(data);
      setEventsError("");
    } catch (err) {
      setEventsError(err?.message || "Could not load your events.");
    } finally {
      setEventsLoading(false);
    }
  }, [listEvents]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const data = await listEvents();
          if (active) {
            setEvents(data);
            setEventsError("");
          }
        } catch (err) {
          if (active) setEventsError(err?.message || "Could not load your events.");
        } finally {
          if (active) setEventsLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [listEvents])
  );

  useEffect(
    () => () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    },
    []
  );

  // A route param opens this screen for a specific event; changing events
  // dismisses it so the picker is shown instead of snapping back.
  const activeId = manualId ?? (paramId && paramId !== dismissedParam ? paramId : null);
  const event = activeId ? events.find((item) => item.id === activeId) || null : null;

  const showError = useCallback((message) => {
    setScanError(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setScanError(""), 4500);
  }, []);

  const resetScanner = () => {
    scanLock.current = false;
    setCandidate(null);
    setPhase("idle");
  };

  const changeEvent = () => {
    scanLock.current = false;
    setManualId(null);
    setDismissedParam(paramId);
    setCandidate(null);
    setPhase("idle");
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (scanLock.current || phase !== "idle" || !event) return;

    const token = parseStudentQr(data);
    if (!token) {
      scanLock.current = true;
      showError("That is an event QR. Scan the student's personal QR instead.");
      setTimeout(() => {
        scanLock.current = false;
      }, 1500);
      return;
    }

    scanLock.current = true;
    setPhase("loading");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const preview = await previewScan({ eventId: event.id, token });
      setCandidate({
        token,
        name: preview.student.full_name,
        schoolId: preview.student.school_id,
        program: preview.student.program?.code || "",
        yearLevel: preview.student.year_level,
        photoUrl: preview.student.photo_url || null,
        status: preview.predicted_status,
        duplicate: preview.already_checked_in,
        time: preview.existing?.scanned_at
          ? formatTimestamp(preview.existing.scanned_at)
          : "",
      });
      setPhase("verifying");
    } catch (err) {
      showError(err?.message || "Could not verify that code.");
      scanLock.current = false;
      setPhase("idle");
    }
  };

  const handleConfirm = async () => {
    if (!candidate?.token || candidate.duplicate || phase === "saving") return;

    setPhase("saving");
    try {
      const result = await confirmScan({ eventId: event.id, token: candidate.token });
      setCandidate((current) => ({
        ...current,
        status: result.attendance.status,
        time: formatTimestamp(result.attendance.scanned_at),
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPhase("success");

      const detail = await getEvent(event.id);
      setEvents((list) =>
        list.map((item) =>
          item.id === event.id
            ? {
                ...item,
                present: detail.present,
                late: detail.late,
                absent: detail.absent,
                enrolled: detail.enrolled,
              }
            : item
        )
      );
    } catch (err) {
      if (err?.status === 409) {
        const existing = err.payload?.existing;
        setCandidate((current) => ({
          ...current,
          duplicate: true,
          status: existing?.status || current.status,
          time: existing?.scanned_at
            ? formatTimestamp(existing.scanned_at)
            : current.time,
        }));
        setPhase("verifying");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else {
        showError(err?.message || "Could not save that check-in.");
        resetScanner();
      }
    }
  };

  if (!event) {
    return (
      <EventPicker
        events={events}
        loading={eventsLoading}
        error={eventsError}
        emptyTitle={tempAccess ? "No gatekeeper access" : undefined}
        emptyText={
          tempAccess
            ? "Your organizer access for this event has ended. Ask an admin to assign you again."
            : undefined
        }
        onRetry={load}
        onSelect={(id) => {
          setManualId(id);
          setCandidate(null);
          setPhase("idle");
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
          <Ionicons name="camera-outline" size={28} color={colors.brand} />
        </View>
        <Text style={styles.permissionTitle}>Camera access</Text>
        <Text style={styles.permissionText}>
          Allow camera access to verify student QR codes.
        </Text>
        <Button
          label="Allow camera"
          onPress={requestPermission}
          style={styles.permissionButton}
        />
        {tempAccess ? null : (
          <Button
            label="Choose another event"
            variant="secondary"
            onPress={changeEvent}
            style={styles.permissionSecondary}
          />
        )}
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
        onBarcodeScanned={phase === "idle" ? handleBarcodeScanned : undefined}
      />

      <View style={styles.overlay}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={1}>
              {event.title}
            </Text>
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
          {tempAccess ? null : (
            <Pressable onPress={changeEvent} style={styles.changeEvent} hitSlop={8}>
              <Ionicons name="swap-horizontal" size={13} color="rgba(255,255,255,0.65)" />
              <Text style={styles.changeEventText}>Change event</Text>
            </Pressable>
          )}
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
                <Text style={styles.loadingText}>Verifying code…</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.mask} />
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 26 }]}>
          <Text style={styles.hint}>Point the camera at the student&apos;s personal QR code.</Text>

          <View style={styles.countsRow}>
            <DotStat value={event.present} label="present" color={colors.green} />
            <DotStat value={event.late} label="late" color={colors.amber} />
            <DotStat value={event.absent} label="absent" color={colors.red} />
          </View>

          {scanError ? (
            <View style={styles.scanError}>
              <Ionicons name="alert-circle" size={15} color={colors.white} />
              <Text style={styles.scanErrorText}>{scanError}</Text>
            </View>
          ) : null}
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

function EventPicker({ events, loading, error, emptyTitle, emptyText, onRetry, onSelect }) {
  const liveEvents = events.filter((item) => item.status === "live");
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.pickerScreen}>
      <ScreenHeader title="Scan" subtitle="Set up gatekeeper check-in" />
      <View style={[styles.pickerContent, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.pickerLabel}>Live events</Text>

        {loading ? (
          <View style={styles.pickerLoading}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : error && events.length === 0 ? (
          <Card style={styles.pickerEmpty}>
            <Ionicons name="cloud-offline-outline" size={22} color={colors.red} />
            <Text style={styles.pickerEmptyText}>{error}</Text>
            <Button label="Try again" variant="soft" size="md" onPress={onRetry} />
          </Card>
        ) : liveEvents.length === 0 ? (
          <Card style={styles.pickerEmpty}>
            <Ionicons name="calendar-outline" size={22} color={colors.muted} />
            <Text style={styles.pickerEmptyText}>
              {emptyTitle || "No live events right now."}
            </Text>
            <Text style={styles.pickerEmptyHint}>
              {emptyText || "Scanners become available when an event starts."}
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
                  <StatusBadge status="live" />
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
                <Ionicons name="checkmark" size={28} color={colors.green} />
              </View>
              <Text style={styles.resultTitle}>Attendance recorded</Text>
              <View style={styles.resultStudent}>
                <Text style={styles.resultName}>{candidate?.name}</Text>
                <StatusBadge status={candidate?.status} />
              </View>
              {candidate?.time ? <Text style={styles.resultTime}>Checked in at {candidate.time}</Text> : null}
              <Text style={styles.resultEvent}>
                {event.title} · {event.venue}
              </Text>
              <View style={styles.countsCard}>
                <DotStat value={event.present} label="present" color={colors.green} />
                <DotStat value={event.late} label="late" color={colors.amber} />
                <DotStat value={event.absent} label="absent" color={colors.red} />
              </View>
              <Button label="Scan next" onPress={onNext} style={styles.sheetButton} />
            </>
          ) : (
            <>
              <View style={styles.studentRow}>
                <Avatar name={candidate?.name} uri={candidate?.photoUrl} size={52} />
                <View style={styles.studentText}>
                  <Text style={styles.studentName}>{candidate?.name || "Reading…"}</Text>
                  <Text style={styles.studentMeta}>
                    {[candidate?.schoolId, candidate?.program, candidate?.yearLevel ? `Year ${candidate.yearLevel}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                {candidate ? <StatusBadge status={candidate.status} /> : null}
              </View>

              <View style={styles.eventBox}>
                <Text style={styles.eventBoxTitle}>{event.title}</Text>
                <Text style={styles.eventBoxMeta}>
                  {event.venue} · {event.date}
                </Text>
              </View>

              {duplicate ? (
                <View style={styles.warning}>
                  <Ionicons name="warning" size={16} color={colors.red} />
                  <Text style={styles.warningText}>
                    Already checked in{candidate?.time ? ` at ${candidate.time}` : ""}.
                  </Text>
                </View>
              ) : null}

              {duplicate ? (
                <Button
                  label="Scan next"
                  variant="secondary"
                  onPress={onNext}
                  style={styles.sheetButton}
                />
              ) : (
                <Button
                  label={phase === "saving" ? "Saving…" : "Confirm check-in"}
                  onPress={onConfirm}
                  loading={phase === "saving"}
                  disabled={!candidate}
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
  title: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: -0.4,
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
    color: "rgba(255,255,255,0.65)",
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
    fontSize: 12,
    color: colors.white,
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
  scanError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: "rgba(220, 38, 38, 0.92)",
  },
  scanErrorText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 16,
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
    fontSize: 13,
    color: colors.text,
    marginBottom: 10,
    marginLeft: 2,
  },
  pickerLoading: {
    paddingVertical: 32,
    alignItems: "center",
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
  pickerEmptyHint: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
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
    fontFamily: fonts.semibold,
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
    flex: 1,
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
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  studentText: {
    flex: 1,
  },
  studentName: {
    fontFamily: fonts.bold,
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
    padding: 14,
    marginTop: 16,
  },
  eventBoxTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
  },
  eventBoxMeta: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.redSoft,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.red,
  },
  sheetButton: {
    marginTop: 18,
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
    marginBottom: 10,
  },
  resultStudent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 6,
  },
  resultName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  resultTime: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 16,
  },
  resultEvent: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  countsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: 12,
    marginTop: 8,
  },
});
