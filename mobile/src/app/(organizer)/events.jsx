import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getEvents } from "../../api/client";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { DotStat } from "../../components/Stat";
import { StatusBadge } from "../../components/StatusBadge";
import { useApp } from "../../context/AppContext";
import { colors, fonts, radius, spacing } from "../../theme/tokens";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "closed", label: "Closed" },
];

export default function OrganizerEventsScreen() {
  const { user } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

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

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter((event) => event.status === filter)),
    [events, filter]
  );

  const liveCount = events.filter((event) => event.status === "live").length;

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openEvent = (event) => {
    if (event.status !== "live") return;
    router.push({ pathname: "/(organizer)/scan", params: { eventId: event.id } });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Events" subtitle={user?.program || user?.schoolId}>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{liveCount}</Text>
            <Text style={styles.headerStatLabel}>Live</Text>
          </View>
          <View style={styles.headerDivider} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{events.length}</Text>
            <Text style={styles.headerStatLabel}>Assigned</Text>
          </View>
        </View>
      </ScreenHeader>

      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : error && events.length === 0 ? (
        <View style={styles.loading}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
          <Pressable onPress={onRefresh} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 28 },
            filtered.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-clear-outline"
              title="No events here"
              message={
                filter === "all"
                  ? "You have not been assigned to any event yet."
                  : "Nothing matches this filter."
              }
            />
          }
          renderItem={({ item }) => <EventCard event={item} onPress={() => openEvent(item)} router={router} />}
        />
      )}
    </View>
  );
}

function EventCard({ event, onPress, router }) {
  const live = event.status === "live";
  const total = event.enrolled || 1;
  const progress = Math.min(100, Math.round(((event.present + event.late) / total) * 100));

  return (
    <Pressable
      onPress={onPress}
      disabled={!live}
      style={({ pressed }) => [pressed && live && styles.pressed]}
      accessibilityRole={live ? "button" : undefined}
      accessibilityLabel={live ? `Open scanner for ${event.title}` : event.title}
    >
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <StatusBadge status={event.status} />
          <Text style={styles.date}>{event.date}</Text>
        </View>

        <Text style={styles.cardTitle}>{event.title}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.muted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {event.venue || "—"}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Text style={styles.metaText}>{event.time}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <DotStat value={event.present} label="present" color={colors.green} />
          <DotStat value={event.late} label="late" color={colors.amber} />
          <DotStat value={event.absent} label="absent" color={colors.red} />
          <Text style={styles.percent}>{progress}%</Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%`, backgroundColor: live ? colors.green : colors.brand },
            ]}
          />
        </View>

        {live ? (
          <View style={styles.scanCta}>
            <Ionicons name="scan-outline" size={14} color={colors.brand} />
            <Text style={styles.scanCtaText}>Open scanner</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push({ pathname: "/(organizer)/gatekeepers", params: { eventId: event.id } })}
          style={styles.gatekeepersBtn}
          accessibilityRole="button"
          accessibilityLabel={`Manage gatekeepers for ${event.title}`}
        >
          <Ionicons name="people-outline" size={14} color={colors.brand} />
          <Text style={styles.gatekeepersBtnText}>Gatekeepers</Text>
        </Pressable>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  headerStat: {
    flex: 1,
    alignItems: "center",
  },
  headerStatValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: colors.white,
  },
  headerStatLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: 1,
  },
  headerDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingTop: 14,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brandDark,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
  chipTextActive: {
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.red,
    textAlign: "center",
  },
  retry: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.tint,
  },
  retryText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.brand,
  },
  list: {
    padding: spacing.xl,
    paddingTop: 14,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  card: {
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  date: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: colors.text,
    marginTop: 10,
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  percent: {
    marginLeft: "auto",
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.muted,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.bg,
    overflow: "hidden",
    marginTop: 10,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  scanCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 14,
  },
  scanCtaText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.brand,
  },
  gatekeepersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  gatekeepersBtnText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.brand,
  },
});
