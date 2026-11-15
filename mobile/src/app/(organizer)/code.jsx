import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { buildEventQrPayload, getEvents, issueEventToken } from "../../api/client";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CountdownRing } from "../../components/CountdownRing";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { useQrToken } from "../../hooks/useQrToken";
import { colors, fonts, radius, spacing } from "../../theme/tokens";

export default function OrganizerCodeScreen() {
  const { eventId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickedId, setPickedId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getEvents();
      setEvents(data);
      setError("");
    } catch (err) {
      setError(err?.message || "Could not load your events.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const data = await getEvents();
          if (active) {
            setEvents(data);
            setError("");
          }
        } catch (err) {
          if (active) setError(err?.message || "Could not load your events.");
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  const liveEvents = useMemo(() => events.filter((item) => item.status === "live"), [events]);
  const paramId = typeof eventId === "string" && eventId ? eventId : null;
  const event =
    liveEvents.find((item) => item.id === (paramId || pickedId)) || liveEvents[0] || null;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Event QR" subtitle="Students scan this code to check in" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : event ? (
          <Card style={styles.qrCard}>
            <View style={styles.eventTop}>
              <StatusBadge status="live" />
              <Text style={styles.eventDate}>{event.date}</Text>
            </View>

            <Text style={styles.eventTitle} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={styles.eventMeta} numberOfLines={1}>
              {event.venue} · {event.time}
            </Text>

            {liveEvents.length > 1 ? (
              <Pressable
                onPress={() => setPickerOpen(true)}
                hitSlop={8}
                style={({ pressed }) => [styles.change, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="swap-horizontal" size={14} color={colors.brand} />
                <Text style={styles.changeText}>Change event</Text>
              </Pressable>
            ) : null}

            <View style={styles.divider} />

            <QrPanel key={event.id} event={event} />
          </Card>
        ) : (
          <EmptyState
            icon="calendar-clear-outline"
            title="No live events"
            message={
              error || "An event QR can be generated once an event is live."
            }
            actionLabel={error ? "Try again" : undefined}
            onAction={load}
          />
        )}
      </ScrollView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Live events</Text>
            {liveEvents.map((item, index) => {
              const selected = item.id === event?.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setPickedId(item.id);
                    setPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.sheetRow,
                    index < liveEvents.length - 1 && styles.sheetRowBorder,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.sheetRowText} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function QrPanel({ event }) {
  const issue = useCallback(() => issueEventToken(event.id), [event.id]);
  const { token, secondsLeft, windowSeconds, progress, loading, error, generate } = useQrToken({
    issue,
  });
  const hasCode = Boolean(token);

  // The display code is meant to be projected, so it starts on its own and
  // every rotation is requested through the API.
  useEffect(() => {
    generate();
  }, [generate]);

  if (!hasCode) {
    return (
      <View style={styles.generator}>
        <View style={styles.generatorFrame}>
          <Ionicons
            name={error ? "alert-circle-outline" : "qr-code-outline"}
            size={56}
            color={error ? colors.red : colors.brand}
          />
        </View>
        <Text style={[styles.generatorText, error && styles.generatorError]}>
          {error || `Students scan this code. It rotates every ${windowSeconds} seconds.`}
        </Text>
        <Button
          label={error ? "Try again" : "Generate QR"}
          onPress={generate}
          loading={loading}
          style={styles.generatorButton}
        />
      </View>
    );
  }

  return (
    <>
      <View style={styles.qrWrap}>
        <QRCode
          value={buildEventQrPayload(event.id, token)}
          size={236}
          color={colors.navy}
          backgroundColor={colors.white}
          quietZone={6}
        />
      </View>

      <View style={styles.timerRow}>
        <CountdownRing progress={progress} seconds={secondsLeft} />
        <Text style={styles.timerTitle}>
          {secondsLeft <= 5 ? "Rotating code…" : `New code in ${secondsLeft}s`}
        </Text>
        <Pressable
          onPress={generate}
          hitSlop={10}
          disabled={loading}
          accessibilityLabel="Rotate the event QR code now"
          style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="refresh" size={18} color={colors.brand} />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.xl,
  },
  loading: {
    paddingVertical: 48,
    alignItems: "center",
  },
  qrCard: {
    padding: 18,
  },
  eventTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventDate: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
  },
  eventTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
    color: colors.text,
    marginTop: 10,
  },
  eventMeta: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 4,
  },
  change: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  changeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.brand,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  generator: {
    alignItems: "center",
    alignSelf: "stretch",
    paddingVertical: 4,
  },
  generatorFrame: {
    width: 236,
    height: 236,
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
    paddingHorizontal: 8,
  },
  generatorError: {
    color: colors.red,
  },
  generatorButton: {
    alignSelf: "stretch",
    marginTop: 16,
  },
  qrWrap: {
    alignSelf: "center",
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
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
  backdrop: {
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
    marginBottom: 18,
  },
  sheetTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 6,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
  },
  sheetRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetRowText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: colors.text,
  },
});
