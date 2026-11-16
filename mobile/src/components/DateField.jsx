import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatEventDate } from "../lib/format";
import { colors, fonts, radius, shadow, spacing } from "../theme/tokens";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// The API accepts ages 10-100, so the calendar only offers dates in that window.
const MIN_AGE = 10;
const MAX_AGE = 100;

function iso(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseIso(value) {
  const [year, month, day] = String(value || "")
    .split("-")
    .map(Number);
  if (!year || !month || !day) return null;
  return { year, month: month - 1, day };
}

/** First and last selectable days: today minus 10 and today minus 100 years. */
function limits() {
  const now = new Date();
  const min = new Date(now.getFullYear() - MAX_AGE, now.getMonth(), now.getDate());
  const max = new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
  return { min, max };
}

/** Calendar picker for a birthdate; keeps the same outlined field as the inputs. */
export function DateField({ value, onChange, placeholder = "Select your birthdate" }) {
  const [open, setOpen] = useState(false);
  const parsed = parseIso(value);
  const { min, max } = useMemo(() => limits(), []);

  const [view, setView] = useState(() => ({
    year: parsed ? parsed.year : new Date().getFullYear() - 18,
    month: parsed ? parsed.month : 0,
  }));
  const [yearPicker, setYearPicker] = useState(false);

  const years = useMemo(() => {
    const list = [];
    for (let year = max.getFullYear(); year >= min.getFullYear(); year -= 1) {
      list.push(year);
    }
    return list;
  }, [min, max]);

  const showPicker = () => {
    const next = parseIso(value);
    setView({
      year: next ? next.year : new Date().getFullYear() - 18,
      month: next ? next.month : 0,
    });
    setYearPicker(false);
    setOpen(true);
  };

  const select = (day) => {
    onChange(iso(view.year, view.month, day));
    setOpen(false);
  };

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const startOffset = new Date(view.year, view.month, 1).getDay();
  const cells = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const atMin = view.year === min.getFullYear() && view.month === min.getMonth();
  const atMax = view.year === max.getFullYear() && view.month === max.getMonth();

  const shiftMonth = (delta) => {
    setView((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  return (
    <>
      <Pressable
        onPress={showPicker}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
        accessibilityRole="button"
        accessibilityLabel={
          value ? `Birthdate ${formatEventDate(value)}, change` : "Choose your birthdate"
        }
      >
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatEventDate(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              {yearPicker ? (
                <Text style={styles.heading}>Choose a year</Text>
              ) : (
                <>
                  <Pressable
                    onPress={() => shiftMonth(-1)}
                    disabled={atMin}
                    hitSlop={8}
                    style={[styles.arrow, atMin && styles.arrowOff]}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                  >
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={atMin ? colors.border : colors.text}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => setYearPicker(true)}
                    style={styles.titleWrap}
                    accessibilityRole="button"
                    accessibilityLabel="Change year"
                  >
                    <Text style={styles.heading}>{MONTHS[view.month]}</Text>
                    <View style={styles.yearChip}>
                      <Text style={styles.yearText}>{view.year}</Text>
                      <Ionicons name="chevron-down" size={12} color={colors.brand} />
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => shiftMonth(1)}
                    disabled={atMax}
                    hitSlop={8}
                    style={[styles.arrow, atMax && styles.arrowOff]}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={atMax ? colors.border : colors.text}
                    />
                  </Pressable>
                </>
              )}
            </View>

            {yearPicker ? (
              <ScrollView style={styles.years} contentContainerStyle={styles.yearsInner}>
                {years.map((year) => {
                  const active = year === view.year;
                  return (
                    <Pressable
                      key={year}
                      onPress={() => {
                        setView((current) => ({ ...current, year }));
                        setYearPicker(false);
                      }}
                      style={[styles.yearCell, active && styles.yearCellActive]}
                      accessibilityRole="button"
                      accessibilityLabel={`Year ${year}`}
                    >
                      <Text style={[styles.yearCellText, active && styles.yearCellTextActive]}>
                        {year}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <>
                <View style={styles.weekRow}>
                  {WEEKDAYS.map((day, index) => (
                    <Text key={`${day}-${index}`} style={styles.weekday}>
                      {day}
                    </Text>
                  ))}
                </View>

                <View style={styles.grid}>
                  {cells.map((day, index) => {
                    if (!day) {
                      return <View key={`pad-${index}`} style={styles.cell} />;
                    }

                    const disabled =
                      new Date(view.year, view.month, day) < min ||
                      new Date(view.year, view.month, day) > max;

                    const selected =
                      parsed &&
                      parsed.year === view.year &&
                      parsed.month === view.month &&
                      parsed.day === day;

                    return (
                      <View key={day} style={styles.cell}>
                        <Pressable
                          onPress={() => select(day)}
                          disabled={disabled}
                          style={[styles.day, selected && styles.dayActive]}
                          accessibilityRole="button"
                          accessibilityLabel={`${MONTHS[view.month]} ${day}, ${view.year}`}
                          accessibilityState={{ selected: Boolean(selected), disabled }}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              disabled && styles.dayTextOff,
                              selected && styles.dayTextActive,
                            ]}
                          >
                            {day}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.footer}>
              <Pressable
                onPress={() => (yearPicker ? setYearPicker(false) : setOpen(false))}
                hitSlop={8}
                style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>{yearPicker ? "Back" : "Cancel"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  fieldPressed: {
    backgroundColor: colors.tint,
  },
  value: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14.5,
    color: colors.text,
  },
  placeholder: {
    color: "#9ca3af",
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.floating,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    minHeight: 40,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  arrowOff: {
    opacity: 0.5,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heading: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
  },
  yearChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.tint,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  yearText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.brand,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.muted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    paddingVertical: 3,
  },
  day: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dayActive: {
    backgroundColor: colors.brand,
  },
  dayText: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: colors.text,
  },
  dayTextOff: {
    color: "#c7cdd6",
  },
  dayTextActive: {
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  years: {
    maxHeight: 260,
  },
  yearsInner: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  yearCell: {
    width: "25%",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  yearCellActive: {
    backgroundColor: colors.tint,
  },
  yearCellText: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: colors.text,
  },
  yearCellTextActive: {
    fontFamily: fonts.semibold,
    color: colors.brand,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.md,
  },
  cancel: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.muted,
  },
});
