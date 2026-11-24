/**
 * Sanity checks for the geofence maths and policy.
 *
 * Run with `npm run geo:check` from backend/. There is no test runner in this
 * project, so this stays a plain Node script with assertions.
 */
const assert = require("node:assert/strict");

const {
  distanceMeters,
  evaluateGeofence,
  parseFix,
  parseGeoInput,
  MAX_ACCURACY_M,
} = require("../src/lib/geo");

/** One degree of latitude is a constant distance on a sphere. */
const METERS_PER_DEGREE = (Math.PI * 6371008.8) / 180;
const VENUE = { latitude: 14.6, longitude: 121.0 };
const event = { latitude: VENUE.latitude, longitude: VENUE.longitude, geofence_radius_m: 100 };

function north(meters) {
  return { latitude: VENUE.latitude + meters / METERS_PER_DEGREE, longitude: VENUE.longitude };
}

/* ------------------------------------------------------------ distance ---- */

assert.ok(Math.abs(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }) - METERS_PER_DEGREE) < 1);
assert.equal(Math.round(distanceMeters(VENUE, VENUE)), 0);
assert.ok(distanceMeters(VENUE, north(100)) > 99 && distanceMeters(VENUE, north(100)) < 101);

// Symmetry: order of the arguments must not matter.
assert.ok(
  Math.abs(distanceMeters(VENUE, north(500)) - distanceMeters(north(500), VENUE)) < 1e-6
);

/* -------------------------------------------------------------- policy ---- */

// No coordinates on the event: the fence does not exist.
const unfenced = evaluateGeofence({ geofence_radius_m: 100 }, north(5000));
assert.equal(unfenced.applied, false);
assert.equal(unfenced.allowed, true);
assert.equal(unfenced.verified, null);

// No fix: rejected. Omitting GPS used to count as present.
const noFix = evaluateGeofence(event, null);
assert.equal(noFix.allowed, false);
assert.equal(noFix.verified, false);
assert.equal(noFix.reason, "location_required");

// Fix too imprecise to trust: rejected, even if the coordinates are far away.
const rough = evaluateGeofence(event, { ...north(5000), accuracy: MAX_ACCURACY_M + 1, mocked: false });
assert.equal(rough.allowed, false);
assert.equal(rough.reason, "location_unverified");

// Mocked location: rejected, and distance is not recorded.
const mocked = evaluateGeofence(event, { ...north(5000), accuracy: 5, mocked: true });
assert.equal(mocked.allowed, false);
assert.equal(mocked.reason, "location_mocked");
assert.equal(mocked.distance_m, null);

// A precise fix with no accuracy figure is not evidence.
const noAccuracy = evaluateGeofence(event, { ...north(10), accuracy: null, mocked: false });
assert.equal(noAccuracy.allowed, false);
assert.equal(noAccuracy.reason, "location_unverified");

// Inside the fence.
const inside = evaluateGeofence(event, { ...north(40), accuracy: 8, mocked: false });
assert.equal(inside.allowed, true);
assert.equal(inside.verified, true);
assert.equal(inside.reason, null);
assert.ok(inside.distance_m > 39 && inside.distance_m < 41);

// Exactly on the boundary passes, one metre beyond it fails.
const edge = evaluateGeofence(event, { ...north(100), accuracy: 4, mocked: false });
assert.equal(edge.allowed, true);
assert.equal(edge.verified, true);
const beyond = evaluateGeofence(event, { ...north(101), accuracy: 4, mocked: false });
assert.equal(beyond.allowed, false);
assert.equal(beyond.reason, "out_of_area");

// Accuracy is reported back so the row says how good the evidence was.
assert.equal(inside.accuracy_m, 8);
assert.equal(beyond.radius_m, 100);

/* --------------------------------------------------------- request body ---- */

assert.equal(parseFix({}), null);
assert.equal(parseFix({ latitude: "abc", longitude: 1 }), null);
assert.equal(parseFix({ latitude: 999, longitude: 1 }), null);
assert.deepEqual(parseFix({ latitude: 14.6, longitude: 121, accuracy: 12, mocked: true }), {
  latitude: 14.6,
  longitude: 121,
  accuracy: 12,
  mocked: true,
});
assert.equal(parseFix({ latitude: 14.6, longitude: 121 }).accuracy, null);

/* -------------------------------------------------------- event payload ---- */

assert.equal(parseGeoInput({ latitude: 14.6 }).ok, false, "latitude alone is rejected");
assert.equal(parseGeoInput({ latitude: 14.6, longitude: 121, geofence_radius_m: 10 }).ok, false);
assert.equal(parseGeoInput({ latitude: 91, longitude: 121 }).ok, false);
assert.deepEqual(parseGeoInput({ latitude: 14.6, longitude: 121, geofence_radius_m: 150 }), {
  ok: true,
  payload: { latitude: 14.6, longitude: 121, geofence_radius_m: 150 },
});
assert.deepEqual(parseGeoInput({ latitude: null, longitude: null }), {
  ok: true,
  payload: { latitude: null, longitude: null },
});
assert.deepEqual(parseGeoInput({ name: "No location" }), { ok: true, payload: {} });

console.log("geofence checks passed");
