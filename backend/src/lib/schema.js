const { admin } = require("./supabase");

const RECHECK_MS = 30_000;

/**
 * Builds a cached "does this column exist yet?" probe.
 *
 * The API accepts new features in migrations (0005 approval, 0006 geofence)
 * before the SQL has been run on the project, so every read of the new columns
 * goes through one of these probes. A missing column is only remembered for a
 * short while, so applying the SQL takes effect without restarting the API.
 */
function columnProbe({ table, column, migration, enabled }) {
  // -1 = never checked, 0 = missing, 1 = present.
  let state = -1;
  let checkedAt = 0;
  let warned = false;

  return async function probe() {
    if (state === 1) return true;
    if (state === 0 && Date.now() - checkedAt < RECHECK_MS) return false;

    const { error } = await admin.from(table).select(column).limit(1);
    state = error ? 0 : 1;
    checkedAt = Date.now();

    if (state === 0 && !warned) {
      warned = true;
      console.warn(`[schema] ${table}.${column} is missing — run supabase/migrations/${migration}`);
    }
    if (state === 1 && warned) {
      warned = false;
      console.log(`[schema] ${table}.${column} detected — ${enabled}`);
    }

    return state === 1;
  };
}

/**
 * Migration 0005 adds `profiles.approved_at` for the self-signup approval queue.
 * Until it is applied, the rest of the API keeps working: profiles are read
 * without the column and every existing account counts as approved.
 */
const hasApprovalColumn = columnProbe({
  table: "profiles",
  column: "approved_at",
  migration: "0005_signup_approval.sql",
  enabled: "approval queue is enabled",
});

/**
 * Migration 0006 adds the geofence columns to `events` and `attendance`.
 * Until it is applied, self check-in skips the fence instead of failing, and
 * events are selected without the geo fields.
 */
const hasGeofenceColumns = columnProbe({
  table: "events",
  column: "geofence_radius_m",
  migration: "0006_geofence.sql",
  enabled: "venue geofencing is enabled",
});

/**
 * Migration 0008 adds the temporary organizer tables. Until it is applied,
 * grants and requests are simply unavailable: canScan keeps its old meaning
 * and the mobile/dashboard entry points stay hidden.
 */
const hasTempOrganizerTables = columnProbe({
  table: "event_temp_organizers",
  column: "expires_at",
  migration: "0008_temp_organizers.sql",
  enabled: "temporary organizer access is enabled",
});

module.exports = { hasApprovalColumn, hasGeofenceColumns, hasTempOrganizerTables };
