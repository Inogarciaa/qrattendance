/**
 * One place that decides which screen a signed-in account belongs on.
 *
 * The mobile app is only for students and organizers. Anything else (staff,
 * or a role the app does not know yet) goes to the staff-only screen instead of
 * into a tab group, which would otherwise bounce between the two layouts.
 */
export const STUDENT_HOME = "/(student)/qr";
export const ORGANIZER_HOME = "/(organizer)/events";
export const STAFF_HOME = "/staff-only";

export function isMobileRole(role) {
  return role === "student" || role === "organizer";
}

export function homeRouteFor(user) {
  if (!user) return "/";
  if (user.role === "student") return STUDENT_HOME;
  if (user.role === "organizer") return ORGANIZER_HOME;
  return STAFF_HOME;
}
