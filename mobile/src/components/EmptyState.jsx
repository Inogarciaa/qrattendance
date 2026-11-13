import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "./Button";
import { colors, fonts } from "../theme/tokens";

export function EmptyState({ icon = "calendar-outline", title, message, actionLabel, onAction }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={colors.brand} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel ? (
        <Button label={actionLabel} onPress={onAction} variant="soft" size="md" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
    textAlign: "center",
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
  },
  action: {
    marginTop: 18,
    paddingHorizontal: 22,
  },
});
