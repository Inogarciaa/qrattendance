import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getEvent, getGatekeepers, searchGatekeeperCandidates, addGatekeeper, removeGatekeeper } from "../../api/client";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, fonts, radius, spacing } from "../../theme/tokens";

export default function GatekeepersScreen({ route }) {
  const { params } = route;
  const eventId = params?.eventId;

  const [event, setEvent] = useState(null);
  const [gatekeepers, setGatekeepers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [addingId, setAddingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [searchDebounce, setSearchDebounce] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const [eventData, gatekeepersData] = await Promise.all([
        getEvent(eventId),
        getGatekeepers(eventId),
      ]);
      setEvent(eventData);
      setGatekeepers(gatekeepersData.gatekeepers || []);
      setError("");
    } catch (err) {
      setError(err?.message || "Could not load gatekeepers.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {};
    }, [load])
  );

  const debouncedSearch = useCallback((text) => {
    setQuery(text);
    if (searchDebounce) clearTimeout(searchDebounce);
    if (!text || text.length < 2) {
      setCandidates([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await searchGatekeeperCandidates(eventId, text);
        setCandidates(data.candidates || []);
      } catch {
        setCandidates([]);
      }
    }, 300);
    setSearchDebounce(timer);
  }, [eventId, searchDebounce]);

  const handleAdd = async (candidate) => {
    Keyboard.dismiss();
    setAddingId(candidate.id);
    setQuery("");
    setCandidates([]);
    try {
      const data = await addGatekeeper(eventId, candidate.id);
      const gatekeeper = data.gatekeeper;
      setGatekeepers((current) => [
        ...current,
        {
          profile_id: gatekeeper.profile_id,
          full_name: gatekeeper.full_name,
          school_id: gatekeeper.school_id,
          expires_at: gatekeeper.expires_at,
        },
      ]);
    } catch (err) {
      Alert.alert("Could not add gatekeeper", err?.message || "Please try again.");
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = (gatekeeper) => {
    Alert.alert(
      "Remove gatekeeper?",
      `${gatekeeper.full_name} will lose scanner access for this event.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemovingId(gatekeeper.profile_id);
            try {
              await removeGatekeeper(eventId, gatekeeper.profile_id);
              setGatekeepers((current) =>
                current.filter((g) => g.profile_id !== gatekeeper.profile_id)
              );
            } catch (err) {
              Alert.alert("Could not remove", err?.message || "Please try again.");
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]
    );
  };

  const isClosed = event?.status === "completed" || event?.status === "cancelled";
  const gatekeeperCount = gatekeepers.length;
  const canAdd = !isClosed && gatekeeperCount < 25;

  const expiryLabel = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (!eventId) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Gatekeepers" subtitle="Event ID missing" />
        <View style={styles.loading}>
          <Text style={styles.errorText}>No event selected.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Gatekeepers"
        subtitle={event?.title || "Loading…"}
        right={
          canAdd ? (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{gatekeeperCount} / 25</Text>
            </View>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.loading}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          <View style={styles.infoCard}>
            <Card style={styles.infoCardInner}>
              <View style={styles.infoRow}>
                <Ionicons name="information-circle-outline" size={18} color={colors.brand} />
                <Text style={styles.infoText}>
                  Students added here can scan for <strong>{event.title}</strong> without
                  becoming organizers. Access ends one hour after the event.
                </Text>
              </View>
              {isClosed && (
                <Text style={styles.closedNote}>
                  This event is closed. No new gatekeepers can be added.
                </Text>
              )}
              {!isClosed && gatekeeperCount >= 25 && (
                <Text style={styles.closedNote}>
                  Maximum of 25 gatekeepers reached.
                </Text>
              )}
            </Card>
          </View>

          <View style={styles.searchSection}>
            <Card style={styles.searchCard}>
              <Text style={styles.sectionTitle}>Add gatekeeper</Text>
              <View style={styles.searchInputWrapper}>
                <Ionicons name="search-outline" size={18} color={colors.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search student by name or ID"
                  value={query}
                  onChangeText={debouncedSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoCompleteType="off"
                  disabled={!canAdd}
                  placeholderTextColor={colors.muted}
                />
              </View>
              {!canAdd && (
                <Text style={styles.searchDisabled}>
                  {isClosed
                    ? "Event is closed — no new gatekeepers can be added."
                    : "Maximum of 25 gatekeepers reached."}
                </Text>
              )}
              {candidates.length > 0 && (
                <View style={styles.candidatesList}>
                  {candidates.map((candidate) => (
                    <Pressable
                      key={candidate.id}
                      onPress={() => handleAdd(candidate)}
                      disabled={addingId === candidate.id}
                      style={styles.candidateRow}
                      accessibilityRole="button"
                    >
                      <View style={styles.candidateInfo}>
                        <Text style={styles.candidateName}>{candidate.full_name}</Text>
                        <Text style={styles.candidateMeta}>
                          {candidate.school_id}
                          {candidate.program?.code && ` · ${candidate.program.code}`}
                        </Text>
                      </View>
                      {addingId === candidate.id ? (
                        <ActivityIndicator size="small" color={colors.brand} />
                      ) : (
                        <Ionicons name="add-circle-outline" size={22} color={colors.brand} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </Card>
          </View>

          <View style={styles.listSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Current gatekeepers {gatekeeperCount ? `(${gatekeeperCount})` : ""}
              </Text>
            </View>
            <Card style={styles.listCard}>
              {gatekeepers.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="No gatekeepers yet"
                  message="Search for a student above to add temporary scanner access."
                />
              ) : (
                <FlatList
                  data={gatekeepers}
                  keyExtractor={(item) => item.profile_id}
                  ListHeaderComponent={
                    <View style={styles.listHeader}>
                      <Text style={styles.listHeaderCell}>Student</Text>
                      <Text style={styles.listHeaderCell}>Expires</Text>
                      <Text style={styles.listHeaderCell} />
                    </View>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handleRemove(item)}
                      disabled={removingId === item.profile_id}
                      style={styles.listRow}
                      accessibilityRole="button"
                    >
                      <View style={styles.listCell}>
                        <Text style={styles.listName}>{item.full_name}</Text>
                        <Text style={styles.listMeta}>{item.school_id}</Text>
                      </View>
                      <Text style={styles.listCell}>{expiryLabel(item.expires_at)}</Text>
                      <View style={styles.listAction}>
                        {removingId === item.profile_id ? (
                          <ActivityIndicator size="small" color={colors.red} />
                        ) : (
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color={colors.red}
                          />
                        )}
                      </View>
                    </Pressable>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.listDivider} />}
                />
              )}
            </Card>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
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
  headerBadge: {
    backgroundColor: colors.navy,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  headerBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.white,
  },
  infoCard: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  infoCardInner: {
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  closedNote: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.red,
    marginTop: 8,
  },
  searchSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  searchCard: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    marginBottom: 10,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 10,
  },
  searchDisabled: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 8,
  },
  candidatesList: {
    marginTop: 10,
    maxHeight: 200,
  },
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: 6,
  },
  candidateInfo: {
    flex: 1,
  },
  candidateName: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
  },
  candidateMeta: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  listSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 28,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  listCard: {
    padding: 0,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listHeaderCell: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.muted,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  listCell: {
    flex: 1,
  },
  listName: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
  },
  listMeta: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  listAction: {
    paddingHorizontal: spacing.sm,
  },
  listDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
});