import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius } from "../theme/tokens";

const VARIANTS = {
  primary: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    label: colors.white,
    icon: colors.white,
  },
  navy: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
    label: colors.white,
    icon: colors.white,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    label: colors.text,
    icon: colors.brand,
  },
  soft: {
    backgroundColor: colors.tint,
    borderColor: colors.tint,
    label: colors.brandDark,
    icon: colors.brandDark,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    label: colors.brand,
    icon: colors.brand,
  },
  danger: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    label: colors.red,
    icon: colors.red,
  },
};

const HEIGHTS = { lg: 54, md: 46, sm: 38 };

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  iconRight,
  size = "lg",
  loading = false,
  disabled = false,
  style,
  labelStyle,
}) {
  const palette = VARIANTS[variant] || VARIANTS.primary;
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHTS[size],
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        size === "sm" && styles.smallPadding,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.icon} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={size === "sm" ? 15 : 18} color={palette.icon} /> : null}
          <Text
            style={[
              styles.label,
              { color: palette.label, fontSize: size === "sm" ? 13 : 15 },
              labelStyle,
            ]}
          >
            {label}
          </Text>
          {iconRight ? (
            <Ionicons name={iconRight} size={size === "sm" ? 15 : 18} color={palette.icon} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  smallPadding: {
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    fontFamily: fonts.semibold,
    letterSpacing: 0.1,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
