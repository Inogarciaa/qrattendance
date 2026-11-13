import { StyleSheet, Text, View } from "react-native";

import { fonts, radius, statusColors } from "../theme/tokens";
export function StatusBadge({ status, label, dot = true, style }) {
  const palette = statusColors[status] || statusColors.closed;
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: palette.fg }]} /> : null}
      <Text style={[styles.text, { color: palette.fg }]}>{label || palette.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
