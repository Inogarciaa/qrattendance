import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "../../components/Card";
import { DotStat } from "../../components/Stat";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
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
  const { user, events } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter((event) => event.status === filter)),
    [events, filter],
  );

  const liveCount = events.filter((event) => event.status === "live").length;
  const scansToday = events
    .filter((event) => event.status !== "upcoming")
    .reduce((sum, event) => sum + event.present + event.late, 0);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  const openEvent = (event) => {
    if (event.status !== "live") return;
    router.push({ pathname: "/(organizer)/scan", params: { eventId: event.id } });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Assigned Events"
        subtitle={`${user?.name} · ${user?.position}`}
        right={
          <View style={styles.headerIcon}>
            <Ionicons name="notifications-outline" size={18} color={colors.white} />
          </View>
        }
      >
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{liveCount}</Text>
            <Text style={styles.headerStatLabel}>Live now</Text>
          </View>
          <View style={styles.headerDivider} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{scansToday}</Text>
            <Text style={styles.headerStatLabel}>Checked in</Text>
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
            message="Nothing matches this filter right now. Try another tab."
          />
        }
        renderItem={({ item }) => <EventCard event={item} onPress={() => openEvent(item)} />}
      />
    </View>
  );
}

function EventCard({ event, onPress }) {
  const live = event.status === "live";
  const closed = event.status === "closed";
  const total = event.capacity || 1;
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
            {event.venue}
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
          <Text style={styles.capacity}>of {event.capacity}</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: live ? colors.green : colors.brand }]} />
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.organizer}>{event.organizer}</Text>
          {live ? (
            <View style={styles.scanCta}>
              <Ionicons name="scan-outline" size={13} color={colors.brand} />
              <Text style={styles.scanCtaText}>Open scanner</Text>
            </View>
          ) : (
            <Text style={styles.closedHint}>
              {closed ? "Attendance closed" : "Not started"}
            </Text>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    paddingVertical: 10,
  },
  headerStat: {
    flex: 1,
    alignItems: "center",
  },
  headerStatValue: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.white,
  },
  headerStatLabel: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: "rgba(255,255,255,0.55)",
    marginTop: 1,
  },
  headerDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingTop: 14,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.muted,
  },
  chipTextActive: {
    color: colors.white,
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
    fontSize: 11,
    color: colors.muted,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: colors.text,
    marginTop: 9,
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
  capacity: {
    marginLeft: "auto",
    fontFamily: fonts.medium,
    fontSize: 10.5,
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
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 11,
    gap: 10,
  },
  organizer: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.muted,
  },
  scanCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scanCtaText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.brand,
  },
  closedHint: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.muted,
  },
});
