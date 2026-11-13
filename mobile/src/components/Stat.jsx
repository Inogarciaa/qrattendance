import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "../theme/tokens";

export function Stat({ value, label, color = colors.text, align = "left" }) {
  return (
    <View style={{ alignItems: align === "center" ? "center" : "flex-start" }}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function StatDivider() {
  return <View style={styles.divider} />;
}

export function DotStat({ value, label, color }) {
  return (
    <View style={styles.dotRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.dotValue}>{value}</Text>
      <Text style={styles.dotLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  value: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    letterSpacing: -0.4,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotValue: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.text,
  },
  dotLabel: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
  },
});
