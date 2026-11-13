import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { getAttendanceHistory } from "../../api/client";
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

  const load = useCallback(async () => {
    const data = await getAttendanceHistory();
    setRecords(data);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await getAttendanceHistory();
      if (active) {
        setRecords(data);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(
    () => (filter === "all" ? records : records.filter((item) => item.status === filter)),
    [records, filter],
  );

  const counts = useMemo(
    () => ({
      present: records.filter((item) => item.status === "present").length,
      late: records.filter((item) => item.status === "late").length,
    }),
    [records],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Attendance History"
        subtitle={`${records.length} records · AY 2026–2027`}
        right={
          <View style={styles.headerIcon}>
            <Ionicons name="calendar-outline" size={18} color={colors.white} />
          </View>
        }
      />

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
              title="No records yet"
              message={
                filter === "all"
                  ? "Scan an event QR code to start building your attendance history."
                  : `You have no ${filter} records this semester.`
              }
              actionLabel={filter === "all" ? "Go to scanner" : undefined}
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
  const [month, day] = record.date.split(" ");

  return (
    <Card style={styles.card}>
      <View style={styles.dateBlock}>
        <Text style={styles.dateMonth}>{month}</Text>
        <Text style={styles.dateDay}>{day.replace(",", "")}</Text>
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
            {record.venue}
          </Text>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.metaRow}>
            <Ionicons name="log-in-outline" size={13} color={colors.muted} />
            <Text style={styles.metaText}>Time in {record.timeIn}</Text>
          </View>
          <View style={styles.method}>
            <Text style={styles.methodText}>{record.method}</Text>
          </View>
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
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontFamily: fonts.extrabold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: colors.text,
  },
  summaryLabel: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.muted,
    marginTop: 1,
  },
  summaryDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.border,
  },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingTop: 14,
  },
  chip: {
    paddingHorizontal: 14,
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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    padding: 13,
    marginBottom: 10,
  },
  dateBlock: {
    width: 46,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  dateMonth: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: colors.brand,
    textTransform: "uppercase",
  },
  dateDay: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    letterSpacing: -0.5,
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
    fontSize: 13,
    lineHeight: 17,
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  method: {
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  methodText: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: colors.muted,
  },
});
