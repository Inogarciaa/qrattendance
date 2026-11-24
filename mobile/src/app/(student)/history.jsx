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

import { getMyAttendance } from "../../api/client";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { dayParts } from "../../lib/format";
import { colors, fonts, radius, spacing } from "../../theme/tokens";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "present", label: "Present" },
  { id: "late", label: "Late" },
];

export default function StudentHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getMyAttendance();
      setRecords(data);
      setError("");
    } catch (err) {
      setError(err?.message || "Could not load your attendance history.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const data = await getMyAttendance();
          if (active) {
            setRecords(data);
            setError("");
          }
        } catch (err) {
          if (active) setError(err?.message || "Could not load your attendance history.");
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(
    () => (filter === "all" ? records : records.filter((item) => item.status === filter)),
    [records, filter]
  );

  const counts = useMemo(
    () => ({
      present: records.filter((item) => item.status === "present").length,
      late: records.filter((item) => item.status === "late").length,
    }),
    [records]
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="History" />

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.green }]}>{counts.present}</Text>
          <Text style={styles.summaryLabel}>Present</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.amber }]}>{counts.late}</Text>
          <Text style={styles.summaryLabel}>Late</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{records.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>

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
      ) : error && records.length === 0 ? (
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
              icon="time-outline"
              title="No records"
              message={
                filter === "all"
                  ? "Check in to an event and it will appear here."
                  : "You have no records with this status."
              }
              actionLabel={filter === "all" ? "Open scanner" : undefined}
              onAction={() => router.push("/(student)/scan")}
            />
          }
          renderItem={({ item }) => <HistoryCard record={item} />}
        />
      )}
    </View>
  );
}

function HistoryCard({ record }) {
  const { month, day } = dayParts(record.dateISO);

  return (
    <Card style={styles.card}>
      <View style={styles.dateBlock}>
        <Text style={styles.dateMonth}>{month}</Text>
        <Text style={styles.dateDay}>{day}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {record.title}
          </Text>
          <StatusBadge status={record.status} />
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.muted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {record.venue || "—"}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="log-in-outline" size={13} color={colors.muted} />
          <Text style={styles.metaText}>
            {record.timeIn}
            {record.method === "self_service" ? " · self check-in" : ""}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontFamily: fonts.bold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: colors.text,
  },
  summaryLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingTop: 16,
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
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    marginBottom: 10,
  },
  dateBlock: {
    width: 46,
    height: 50,
    borderRadius: radius.sm,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  dateMonth: {
    fontFamily: fonts.semibold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: colors.brand,
    textTransform: "uppercase",
  },
  dateDay: {
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: -0.4,
    color: colors.brandDark,
  },
  cardBody: {
    flex: 1,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  metaText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
  },
});
