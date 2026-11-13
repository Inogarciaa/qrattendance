import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, spacing } from "../theme/tokens";

export function ScreenHeader({
  title,
  subtitle,
  right,
  showBack = false,
  children,
  tone = "navy",
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const light = tone === "navy";

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 10,
          backgroundColor: light ? colors.navy : colors.surface,
          borderBottomColor: light ? "rgba(255,255,255,0.08)" : colors.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={[styles.back, !light && { backgroundColor: colors.bg }]}
            >
              <Ionicons name="chevron-back" size={20} color={light ? colors.white : colors.text} />
            </Pressable>
          ) : null}
          <View style={styles.titleBlock}>
            {title ? (
              <Text style={[styles.title, { color: light ? colors.white : colors.text }]} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text
                style={[
                  styles.subtitle,
                  { color: light ? "rgba(255,255,255,0.66)" : colors.muted },
                ]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {right ? <View>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 2,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
});
