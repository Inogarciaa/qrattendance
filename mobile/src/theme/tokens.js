export const colors = {
  navy: "#0f172a",
  navy2: "#1e293b",
  brand: "#4f46e5",
  brandDark: "#4338ca",
  brandLight: "#6366f1",
  green: "#10b981",
  greenSoft: "#ecfdf5",
  amber: "#f59e0b",
  amberSoft: "#fffbeb",
  red: "#ef4444",
  redSoft: "#fef2f2",
  bg: "#f8fafc",
  surface: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  tint: "#eef2ff",
  white: "#ffffff",
  overlay: "rgba(15, 23, 42, 0.6)",
};

export const statusColors = {
  present: { fg: "#059669", bg: "#ecfdf5", border: "#a7f3d0", label: "Present" },
  late: { fg: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Late" },
  absent: { fg: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Absent" },
  live: { fg: "#059669", bg: "#ecfdf5", border: "#a7f3d0", label: "Live" },
  upcoming: { fg: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe", label: "Upcoming" },
  closed: { fg: "#64748b", bg: "#f1f5f9", border: "#e2e8f0", label: "Closed" },
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
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardElevated: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  floating: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
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
  h1: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.6, color: colors.text },
  h2: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.3, color: colors.text },
  h3: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: -0.2, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  small: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  tiny: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
};
