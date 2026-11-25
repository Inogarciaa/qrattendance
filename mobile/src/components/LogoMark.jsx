import { Image, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "../theme/tokens";

export function LogoMark({ size = 40 }) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.26 },
      ]}
    >
      <Image
        source={require("../../assets/logo-mark.png")}
        style={styles.image}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

export function Wordmark({ light = false, compact = false }) {
  return (
    <View style={styles.row}>
      <LogoMark size={compact ? 32 : 40} />
      <View>
        <Text style={[styles.brand, { color: light ? colors.white : colors.text }, compact && { fontSize: 18 }]}>
          Scanly
        </Text>
        {!compact && (
          <Text style={[styles.tagline, { color: light ? "rgba(255,255,255,0.62)" : colors.muted }]}>
            Dynamic QR Attendance
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    overflow: "hidden",
    backgroundColor: colors.white,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brand: {
    fontFamily: fonts.extrabold,
    fontSize: 21,
    letterSpacing: -0.6,
    lineHeight: 24,
  },
  tagline: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    letterSpacing: 0.2,
    marginTop: 1,
  },
});
