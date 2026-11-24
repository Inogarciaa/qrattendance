import { StyleSheet, View } from "react-native";

import { colors, radius, shadow, spacing } from "../theme/tokens";

export function Card({
  children,
  style,
  padded = true,
  elevated = false,
  variant = "default",
}) {
  return (
    <View
      style={[
        styles.card,
        elevated ? shadow.cardElevated : shadow.card,
        variant === "tint" && styles.tintCard,
        variant === "dark" && styles.darkCard,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tintCard: {
    backgroundColor: colors.tint,
    borderColor: "#c7d2fe",
  },
  darkCard: {
    backgroundColor: colors.navy,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  padded: {
    padding: spacing.lg,
  },
});
