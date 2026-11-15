/**
 * Geofence helpers for self-service check-in.
 *
 * The rotating QR already proves the code is fresh; a fence adds the one thing
 * it cannot prove — that the phone doing the scanning is at the venue. That is
 * what makes a forwarded screenshot useless.
 *
 * Policy decisions live here so the route stays readable:
 *   - an event without coordinates has no fence at all;
 *   - a missing, mocked or too-imprecise fix is accepted but flagged, because
 *     locking a student out over a bad GPS reading inside a concrete building
 *     is a worse failure than an unverified row;
 *   - only a trustworthy fix outside the radius is rejected.
 */

const EARTH_RADIUS_M = 6371008.8;

/** Wider than this and the fix cannot place the phone honestly. */
const MAX_ACCURACY_M = 50;

const DEFAULT_RADIUS_M = 100;
const MIN_RADIUS_M = 25;
const MAX_RADIUS_M = 1000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Great-circle distance in metres between two `{latitude, longitude}` points.
 * Haversine is accurate to a few metres at campus scale, which is well inside
 * the fence radii we allow.
 */
function distanceMeters(from, to) {
  const lat1 = toRadians(Number(from.latitude));
  const lat2 = toRadians(Number(to.latitude));
  const dLat = lat2 - lat1;
  const dLon = toRadians(Number(to.longitude) - Number(from.longitude));

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when the event carries usable coordinates, i.e. a fence is active. */
function isFenced(event) {
  if (!event) return false;
  if (event.latitude === null || event.latitude === undefined) return false;
  if (event.longitude === null || event.longitude === undefined) return false;
  return Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude));
}

function fenceRadius(event) {
  const value = Number(event?.geofence_radius_m);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RADIUS_M;
}

/**
 * Reads the location part of a request body.
 *
 * Returns `null` when the caller sent nothing usable, so the fence can flag the
 * check-in instead of blocking it. Anything that claims to be a coordinate but
 * is not a number is rejected outright — that is a client bug, not bad GPS.
 */
function parseFix(body = {}) {
  if (body.latitude === undefined && body.longitude === undefined) return null;

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const accuracy = Number(body.accuracy);
  return {
    latitude,
    longitude,
    accuracy: hasValue(body.accuracy) && Number.isFinite(accuracy) ? accuracy : null,
    mocked: body.mocked === true,
  };
}

/**
 * Decides whether a self check-in may proceed.
 *
 * @returns {{
 *   applied: boolean,      // a fence exists for this event
 *   allowed: boolean,      // the check-in may be saved
 *   verified: true|false|null, // attendance.location_verified
 *   reason: string|null,   // scan_attempts.reason
 *   distance_m: number|null,
 *   accuracy_m: number|null,
 *   radius_m: number|null,
 *   mocked: boolean,
 * }}
 */
function evaluateGeofence(event, fix) {
  const untouched = {
    applied: false,
    allowed: true,
    verified: null,
    reason: null,
    distance_m: null,
    accuracy_m: null,
    radius_m: null,
    mocked: false,
  };

  if (!isFenced(event)) return untouched;

  const radius = fenceRadius(event);
  const unverified = {
    applied: true,
    allowed: true,
    verified: false,
    reason: "location_unverified",
    distance_m: null,
    accuracy_m: fix?.accuracy ?? null,
    radius_m: radius,
    mocked: Boolean(fix?.mocked),
  };

  if (!fix) return unverified;
  if (fix.mocked) return unverified;
  if (fix.accuracy !== null && fix.accuracy > MAX_ACCURACY_M) return unverified;

  const distance = round(distanceMeters(event, fix));

  if (distance > radius) {
    return {
      applied: true,
      allowed: false,
      verified: false,
      reason: "out_of_area",
      distance_m: distance,
      accuracy_m: fix.accuracy,
      radius_m: radius,
      mocked: false,
    };
  }

  return {
    applied: true,
    allowed: true,
    verified: true,
    reason: null,
    distance_m: distance,
    accuracy_m: fix.accuracy,
    radius_m: radius,
    mocked: false,
  };
}

function hasValue(raw) {
  return raw !== undefined && raw !== null && String(raw).trim() !== "";
}

/**
 * Validates the admin-supplied venue location for POST/PUT /events.
 *
 * `payload` only contains the keys the caller actually sent, so a partial
 * update never resets the fence by accident.
 */
function parseGeoInput(body = {}) {
  const payload = {};
  const hasLat = hasValue(body.latitude);
  const hasLon = hasValue(body.longitude);

  if (hasLat !== hasLon) {
    return { ok: false, error: "Provide both latitude and longitude, or neither" };
  }

  if (hasLat) {
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return { ok: false, error: "latitude must be between -90 and 90" };
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return { ok: false, error: "longitude must be between -180 and 180" };
    }
    payload.latitude = round(latitude, 6);
    payload.longitude = round(longitude, 6);
  } else if (body.latitude !== undefined || body.longitude !== undefined) {
    // Explicit null/"" clears the fence.
    payload.latitude = null;
    payload.longitude = null;
  }

  if (hasValue(body.geofence_radius_m)) {
    const radius = Number(body.geofence_radius_m);
    if (!Number.isFinite(radius) || radius < MIN_RADIUS_M || radius > MAX_RADIUS_M) {
      return {
        ok: false,
        error: `geofence_radius_m must be between ${MIN_RADIUS_M} and ${MAX_RADIUS_M}`,
      };
    }
    payload.geofence_radius_m = Math.round(radius);
  }

  return { ok: true, payload };
}

module.exports = {
  EARTH_RADIUS_M,
  MAX_ACCURACY_M,
  DEFAULT_RADIUS_M,
  MIN_RADIUS_M,
  MAX_RADIUS_M,
  distanceMeters,
  isFenced,
  fenceRadius,
  parseFix,
  evaluateGeofence,
  parseGeoInput,
};
