import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius } from "../theme/tokens";

const VARIANTS = {
  primary: {
    backgroundColor: colors.brand,
    borderColor: colors.brandDark,
    label: colors.white,
    icon: colors.white,
  },
  navy: {
    backgroundColor: colors.navy,
    borderColor: colors.navy2,
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
    borderColor: "#c7d2fe",
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

const HEIGHTS = { lg: 50, md: 42, sm: 36 };

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

  const handlePress = (e) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics is non-critical
    }
    onPress?.(e);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handlePress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHTS[size],
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          transform: [{ scale: pressed && !inactive ? 0.98 : 1 }],
        },
        variant === "primary" && styles.primaryShadow,
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
              { color: palette.label, fontSize: size === "sm" ? 12.5 : 14.5 },
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
  primaryShadow: {
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  smallPadding: {
    paddingHorizontal: 12,
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
    letterSpacing: -0.2,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.45,
  },
});
