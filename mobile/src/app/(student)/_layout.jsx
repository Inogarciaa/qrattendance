import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { useApp } from "../../context/AppContext";
import { colors, fonts } from "../../theme/tokens";

const ICONS = {
  qr: ["qr-code", "qr-code-outline"],
  scan: ["scan", "scan-outline"],
  history: ["time", "time-outline"],
  profile: ["person", "person-outline"],
};

function tabIcon(key) {
  const TabIcon = ({ color, size, focused }) => (
    <Ionicons name={ICONS[key][focused ? 0 : 1]} size={size} color={color} />
  );
  TabIcon.displayName = `TabIcon-${key}`;
  return TabIcon;
}

export default function StudentLayout() {
  const { user, accountStatus } = useApp();

  if (!user) return <Redirect href="/" />;
  if (accountStatus && accountStatus !== "ready") return <Redirect href="/" />;
  if (user.role !== "student") return <Redirect href="/" />;

  return (
    <Tabs
      initialRouteName="qr"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.semibold,
          fontSize: 11,
          marginBottom: 6,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="qr" options={{ title: "My QR", tabBarIcon: tabIcon("qr") }} />
      <Tabs.Screen name="scan" options={{ title: "Scan", tabBarIcon: tabIcon("scan") }} />
      <Tabs.Screen name="history" options={{ title: "History", tabBarIcon: tabIcon("history") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: tabIcon("profile") }} />
    </Tabs>
  );
}
