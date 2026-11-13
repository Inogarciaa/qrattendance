import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "../theme/tokens";

export function Avatar({ name = "", size = 44, tone = "light", style }) {
  const label = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  const dark = tone === "dark";

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: dark ? "rgba(255,255,255,0.14)" : colors.tint,
          borderColor: dark ? "rgba(255,255,255,0.22)" : "#dbeafe",
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: dark ? colors.white : colors.brandDark,
            fontSize: size * 0.34,
          },
        ]}
      >
        {label || "?"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  text: {
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
});
