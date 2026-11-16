import { Redirect } from "expo-router";

import OrganizerScanScreen from "../(organizer)/scan";
import { useApp } from "../../context/AppContext";

/**
 * A student with a temporary organizer grant opens this route from My QR.
 * The scanner screen is the organizer one with a different event source; the
 * server still enforces the grant on every preview and confirm, so this guard
 * only keeps other roles out of the screen.
 */
export default function GatekeeperScreen() {
  const { user, accountStatus } = useApp();

  if (!user) return <Redirect href="/" />;
  if (accountStatus && accountStatus !== "ready") return <Redirect href="/" />;
  if (user.role !== "student") return <Redirect href="/" />;

  return <OrganizerScanScreen tempAccess />;
}
