import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { useApp } from "../../context/AppContext";
import { colors, fonts } from "../../theme/tokens";

const ICONS = {
  events: ["calendar", "calendar-outline"],
  code: ["qr-code", "qr-code-outline"],
  scan: ["scan", "scan-outline"],
  profile: ["person", "person-outline"],
};

function tabIcon(key) {
  const TabIcon = ({ color, size, focused }) => (
    <Ionicons name={ICONS[key][focused ? 0 : 1]} size={size} color={color} />
  );
  TabIcon.displayName = `TabIcon-${key}`;
  return TabIcon;
}

export default function OrganizerLayout() {
  const { user, accountStatus } = useApp();

  if (!user) return <Redirect href="/" />;
  if (accountStatus && accountStatus !== "ready") return <Redirect href="/" />;
  // Never redirect into the student group: index.jsx picks the right home for
  // the role, so a staff account cannot bounce between the two tab groups.
  if (user.role !== "organizer") return <Redirect href="/" />;

  return (
    <Tabs
      initialRouteName="events"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 10.5,
          marginBottom: 3,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="events" options={{ title: "Events", tabBarIcon: tabIcon("events") }} />
      <Tabs.Screen name="code" options={{ title: "Event QR", tabBarIcon: tabIcon("code") }} />
      <Tabs.Screen name="scan" options={{ title: "Scan", tabBarIcon: tabIcon("scan") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: tabIcon("profile") }} />
    </Tabs>
  );
}
