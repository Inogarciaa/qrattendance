export const colors = {
  navy: "#0f1c3f",
  navy2: "#162350",
  brand: "#2563eb",
  brandDark: "#1d4ed8",
  brandLight: "#3b82f6",
  green: "#10b981",
  greenSoft: "#ecfdf5",
  amber: "#f59e0b",
  amberSoft: "#fffbeb",
  red: "#ef4444",
  redSoft: "#fef2f2",
  bg: "#f0f4f8",
  surface: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  tint: "#eff6ff",
  white: "#ffffff",
  overlay: "rgba(15, 28, 63, 0.62)",
};

export const statusColors = {
  present: { fg: colors.green, bg: colors.greenSoft, label: "Present" },
  late: { fg: colors.amber, bg: colors.amberSoft, label: "Late" },
  absent: { fg: colors.red, bg: colors.redSoft, label: "Absent" },
  live: { fg: colors.green, bg: colors.greenSoft, label: "Live" },
  upcoming: { fg: colors.brand, bg: colors.tint, label: "Upcoming" },
  closed: { fg: colors.muted, bg: "#f1f5f9", label: "Closed" },
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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  floating: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
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
  h1: { fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.6, color: colors.text },
  h2: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: colors.text },
  h3: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.2, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  small: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  tiny: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.8, color: colors.muted },
};
