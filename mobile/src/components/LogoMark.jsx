import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "../theme/tokens";

export function LogoMark({ size = 40, fontSize = 15 }) {
  return (
    <LinearGradient
      colors={["#3b82f6", "#1d4ed8"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.28 },
      ]}
    >
      <Text style={[styles.text, { fontSize }]}>LQ</Text>
    </LinearGradient>
  );
}

export function Wordmark({ light = false, compact = false }) {
  return (
    <View style={styles.row}>
      <LogoMark size={compact ? 32 : 40} fontSize={compact ? 12 : 15} />
      <View>
        <Text style={[styles.brand, { color: light ? colors.white : colors.text }, compact && { fontSize: 18 }]}>
          LacoQR
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
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  text: {
    color: colors.white,
    fontFamily: fonts.extrabold,
    letterSpacing: -0.4,
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
