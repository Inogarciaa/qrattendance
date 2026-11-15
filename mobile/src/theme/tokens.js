export const colors = {
  navy: "#0f172a",
  navy2: "#1e293b",
  brand: "#2563eb",
  brandDark: "#1d4ed8",
  brandLight: "#3b82f6",
  green: "#059669",
  greenSoft: "#ecfdf5",
  amber: "#d97706",
  amberSoft: "#fffbeb",
  red: "#dc2626",
  redSoft: "#fef2f2",
  bg: "#f6f7f9",
  surface: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  border: "#e9edf2",
  tint: "#eff4ff",
  white: "#ffffff",
  overlay: "rgba(15, 23, 42, 0.55)",
};

export const statusColors = {
  present: { fg: colors.green, bg: colors.greenSoft, label: "Present" },
  late: { fg: colors.amber, bg: colors.amberSoft, label: "Late" },
  absent: { fg: colors.red, bg: colors.redSoft, label: "Absent" },
  live: { fg: colors.green, bg: colors.greenSoft, label: "Live" },
  upcoming: { fg: colors.brand, bg: colors.tint, label: "Upcoming" },
  closed: { fg: colors.muted, bg: "#f3f4f6", label: "Closed" },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 12,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
  floating: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
  },
};

export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

export const type = {
  h1: { fontFamily: fonts.bold, fontSize: 25, letterSpacing: -0.7, color: colors.text },
  h2: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.text },
  h3: { fontFamily: fonts.semibold, fontSize: 15.5, letterSpacing: -0.2, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  small: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  tiny: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
};
