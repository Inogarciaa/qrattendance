import { useCallback, useEffect, useMemo, useState } from "react";
import Field from "../../components/ui/Field";
import Icon from "../../components/ui/Icon";
import StatusBadge from "../../components/ui/StatusBadge";
import Avatar from "../../components/ui/Avatar";
import {
  fetchEvent,
  fetchEvents,
  fetchLiveDashboard,
  fetchReports,
  updateEvent,
} from "../../lib/api";
import { formatTime, toMinutes } from "../../lib/format";
import LocationPicker from "../events/LocationPicker";

const REFRESH_MS = 20000;

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function timeLabel(value) {
  if (!value) return "—";
  if (/^\d{1,2}:\d{2}/.test(value)) return formatTime(toMinutes(value));
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

export default function DashboardPage({ onNavigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationForm, setLocationForm] = useState({
    latitude: "",
    longitude: "",
    radius: "100",
  });
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState("");

  const load = useCallback(async () => {
    const [liveData, eventData] = await Promise.all([
      fetchLiveDashboard(),
      fetchEvents(),
    ]);
    setDashboard(liveData);
    setEvents(eventData.events || []);
    setError("");
    return { liveData, eventData };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async (initial = false) => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load the dashboard.");
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    };

    run(true);
    const timer = setInterval(() => run(false), REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [load]);

  const live = dashboard?.live?.[0] ?? null;
  const activeId = selectedId ?? live?.event?.id ?? events[0]?.id ?? null;

  useEffect(() => {
    if (!activeId) return undefined;

    let cancelled = false;
    Promise.all([
      fetchEvent(activeId),
      fetchReports({ event_id: activeId }),
    ])
      .then(([eventDetail, report]) => {
        if (cancelled) return;
        setDetail(eventDetail);
        setRecords(report.records || []);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setRecords([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, dashboard]);

  const selectedEvent =
    detail?.event ?? events.find((event) => event.id === activeId) ?? null;

  const counts = useMemo(() => {
    const tally = detail?.tally || { present: 0, late: 0, absent: 0 };
    const enrolled = detail?.enrolled ?? 0;
    const event = detail?.event;
    // Before an event starts, "absent" means "not yet arrived" and would show
    // the whole audience as absent. Only derive it once scanning is underway.
    const started = event ? ["live", "closed", "completed"].includes(event.status) : false;
    return {
      enrolled,
      present: tally.present || 0,
      late: tally.late || 0,
      absent: started
        ? Math.max(0, enrolled - (tally.present || 0) - (tally.late || 0))
        : tally.absent || 0,
    };
  }, [detail]);

  const percentage = counts.enrolled
    ? Math.round(((counts.present + counts.late) / counts.enrolled) * 100)
    : 0;

  const scanned = records.filter((record) => record.status !== "absent").length;

  const fenced = selectedEvent?.latitude !== null && selectedEvent?.latitude !== undefined;

  const openLocation = () => {
    setLocationForm({
      latitude: fenced ? String(selectedEvent.latitude) : "",
      longitude: fenced ? String(selectedEvent.longitude) : "",
      radius:
        selectedEvent?.geofence_radius_m !== null &&
        selectedEvent?.geofence_radius_m !== undefined
          ? String(selectedEvent.geofence_radius_m)
          : "100",
    });
    setLocationError("");
    setLocationOpen(true);
  };

  const refreshDetail = async (eventId) => {
    const [eventDetail, report] = await Promise.all([
      fetchEvent(eventId),
      fetchReports({ event_id: eventId }),
    ]);
    setDetail(eventDetail);
    setRecords(report.records || []);
  };

  const saveLocation = async () => {
    if (!selectedEvent || locationBusy) return;

    const hasLat = locationForm.latitude.trim() !== "";
    const hasLon = locationForm.longitude.trim() !== "";
    if (hasLat !== hasLon) {
      setLocationError("Enter both coordinates, or use Clear pin to remove the fence.");
      return;
    }

    const payload = { latitude: null, longitude: null };

    if (hasLat) {
      const latitude = Number(locationForm.latitude);
      const longitude = Number(locationForm.longitude);
      const radius = Number(locationForm.radius);

      if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) {
        setLocationError("Latitude must be between -90 and 90.");
        return;
      }
      if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) {
        setLocationError("Longitude must be between -180 and 180.");
        return;
      }
      if (!Number.isFinite(radius) || radius < 25 || radius > 1000) {
        setLocationError("Radius must be between 25 and 1000 metres.");
        return;
      }

      payload.latitude = latitude;
      payload.longitude = longitude;
      payload.geofence_radius_m = Math.round(radius);
    }

    setLocationBusy(true);
    setLocationError("");
    try {
      await updateEvent(selectedEvent.id, payload);
      await refreshDetail(selectedEvent.id);
      await load();
      setLocationOpen(false);
    } catch (err) {
      setLocationError(err.message || "Could not save the venue location.");
    } finally {
      setLocationBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Loading dashboard…</h2>
        <p style={{ margin: 0, color: "var(--mu)", fontSize: 13 }}>
          Reading events and attendance from the API.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Dashboard unavailable</h2>
        <p style={{ margin: "0 0 14px", color: "var(--mu)", fontSize: 13 }}>{error}</p>
        <button
          type="button"
          className="btn p"
          onClick={() => {
            setLoading(true);
            load()
              .catch((err) => setError(err.message || "Could not load the dashboard."))
              .finally(() => setLoading(false));
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      {live ? (
        <div className="live-wrap">
          <div className="live-header">
            <div className="live-tag">
              <span className="live-dot" />
              &nbsp;LIVE NOW
            </div>
            <div className="live-title">{live.event.name}</div>
            <div className="live-sub">
              {live.event.venue} &nbsp;·&nbsp; {timeLabel(live.event.start_time)} –{" "}
              {timeLabel(live.event.end_time)}
            </div>
            <div className="live-kpis">
              <div className="live-kpi">
                <span className="live-kpi-val">{live.counts.enrolled}</span>
                <span className="live-kpi-label">Enrolled</span>
              </div>
              <div className="live-kpi green">
                <span className="live-kpi-val">{live.counts.present}</span>
                <span className="live-kpi-label">Present</span>
              </div>
              <div className="live-kpi amber">
                <span className="live-kpi-val">{live.counts.late}</span>
                <span className="live-kpi-label">Late</span>
              </div>
              <div className="live-kpi red">
                <span className="live-kpi-val">{live.counts.absent}</span>
                <span className="live-kpi-label">Absent</span>
              </div>
            </div>
          </div>
          <div className="live-body">
            <div className="live-body-head">
              <h3>Recent Scans</h3>
              <span className="live-refresh">
                <svg
                  className="spin-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Live &nbsp;·&nbsp; {live.attendance_rate}% attendance rate
                {dashboard?.mode === "local" ? " · local data" : ""}
              </span>
            </div>
            <div className="scan-feed">
              {live.recent_scans.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--mu)",
                    padding: "20px 0",
                    fontSize: 13,
                  }}
                >
                  Waiting for the first scan…
                </div>
              )}
              {live.recent_scans.map((entry, index) => (
                <div className="scan-item" key={`${entry.student?.school_id || index}-${index}`}>
                  <Avatar
                    name={entry.student?.full_name}
                    photoUrl={entry.student?.photo_url}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="scan-name">{entry.student?.full_name || "Unknown student"}</div>
                    <div className="scan-prog">{entry.student?.program?.code || "—"}</div>
                  </div>
                  <StatusBadge status={capitalize(entry.status)} />
                  <span className="scan-time">{timeLabel(entry.scanned_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="no-live">
          <div className="no-live-icon">
            <Icon name="bel" />
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>No live event right now</div>
          <div style={{ color: "var(--mu)", fontSize: 13, marginTop: 4 }}>
            Nothing is being scanned at the moment. This card switches to live
            attendance automatically when an event starts.
          </div>

          {dashboard?.next ? (
            <div
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid var(--br)",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "var(--mu)",
                }}
              >
                Next event
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 6 }}>
                {dashboard.next.name}
              </div>
              <div style={{ color: "var(--mu)", fontSize: 13, marginTop: 2 }}>
                {dateLabel(dashboard.next.event_date)} ·{" "}
                {timeLabel(dashboard.next.start_time)} – {timeLabel(dashboard.next.end_time)} ·{" "}
                {dashboard.next.venue}
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid var(--br)",
                color: "var(--mu)",
                fontSize: 13,
              }}
            >
              No events have been created yet.
            </div>
          )}

          <button
            type="button"
            className="btn p"
            style={{ marginTop: 16 }}
            onClick={() => onNavigate?.("Create Event")}
          >
            Create event
          </button>
        </div>
      )}

      {events.length > 0 && (
        <>
          <div className="db-hero">
            <div style={{ zIndex: 1 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  opacity: 0.55,
                  margin: "0 0 6px",
                }}
              >
                Attendance Overview
              </p>
              <h1>{selectedEvent ? selectedEvent.name : "—"}</h1>
              <p>
                {selectedEvent
                  ? dateLabel(selectedEvent.event_date)
                  : "Select an event below"}
              </p>
              <div className="db-hero-foot">
                <span className="db-hero-fence">
                  <Icon name="pin" />
                  {fenced
                    ? `Fence ${selectedEvent.geofence_radius_m ?? 100} m`
                    : "No location fence"}
                </span>
                {selectedEvent ? (
                  <button type="button" className="db-hero-action" onClick={openLocation}>
                    Change location
                  </button>
                ) : null}
              </div>
            </div>
            <div className="db-hero-badge">
              <b>{percentage}%</b>
              <span>Attendance rate</span>
            </div>
          </div>

          <div className="ev-tabs">
            {events.map((event) => (
              <button
                key={event.id}
                type="button"
                className={
                  "ev-tab" +
                  (activeId === event.id ? " active" : "") +
                  (live?.event?.id === event.id ? " ev-tab-live" : "")
                }
                onClick={() => setSelectedId(event.id)}
              >
                {event.name}
              </button>
            ))}
          </div>

          <div className="st">
            {[
              { key: "present", label: "Present", icon: "chk", className: "kpi-present" },
              { key: "late", label: "Late", icon: "bel", className: "kpi-late" },
              { key: "absent", label: "Absent", icon: "out", className: "kpi-absent" },
            ].map(({ key, label, icon, className }) => (
              <div className={"card " + className} key={key}>
                <div className="kpi-icon">
                  <Icon name={icon} />
                </div>
                <div className="kpi-label">{label}</div>
                <b>{counts[key]}</b>
                <div style={{ fontSize: 12, color: "var(--mu)", marginTop: 2 }}>
                  {counts.enrolled
                    ? Math.round((counts[key] / counts.enrolled) * 100)
                    : 0}
                  % of enrolled
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="row" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 15 }}>Check-in Log</h2>
                <p style={{ margin: 0, color: "var(--mu)", fontSize: 13 }}>
                  All scanned students for{" "}
                  <strong>{selectedEvent ? selectedEvent.name : "this event"}</strong>.
                </p>
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--mu)",
                  background: "var(--bg)",
                  padding: "4px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--br)",
                }}
              >
                {scanned} scanned
              </span>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Program</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {records
                    .filter((record) => record.status !== "absent")
                    .map((record, index) => (
                      <tr key={record.id || index}>
                        <td>
                          <div className="who">
                            <Avatar
                              name={record.student?.full_name}
                              photoUrl={record.student?.photo_url}
                            />
                            {record.student?.full_name || "Unknown student"}
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--mu)",
                            }}
                          >
                            {record.student?.program?.code || "—"}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={capitalize(record.status)} />
                        </td>
                        <td
                          style={{
                            fontVariantNumeric: "tabular-nums",
                            color: "var(--mu)",
                            fontSize: 13,
                          }}
                        >
                          {timeLabel(record.scanned_at)}
                        </td>
                      </tr>
                    ))}
                  {scanned === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          textAlign: "center",
                          color: "var(--mu)",
                          padding: "32px 0",
                        }}
                      >
                        No check-ins yet for this event.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {locationOpen && selectedEvent && (
        <div className="ov" onClick={() => setLocationOpen(false)}>
          <div
            className="dlg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-title"
            style={{ maxWidth: 640 }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="location-title">Venue location</h2>
            <p>
              Students who scan the event QR must be inside this circle. Organizers
              scanning student codes are never blocked by it.
            </p>

            <LocationPicker
              latitude={locationForm.latitude.trim() === "" ? null : Number(locationForm.latitude)}
              longitude={
                locationForm.longitude.trim() === "" ? null : Number(locationForm.longitude)
              }
              radius={Number(locationForm.radius) || 100}
              onChange={({ latitude, longitude }) =>
                setLocationForm((prev) => ({
                  ...prev,
                  latitude: latitude.toFixed(6),
                  longitude: longitude.toFixed(6),
                }))
              }
            />

            <div className="g">
              <Field id="loc-latitude" label="Latitude">
                <input
                  id="loc-latitude"
                  type="number"
                  placeholder="e.g. 8.485700"
                  value={locationForm.latitude}
                  onChange={(event) =>
                    setLocationForm({ ...locationForm, latitude: event.target.value })
                  }
                />
              </Field>
              <Field id="loc-longitude" label="Longitude">
                <input
                  id="loc-longitude"
                  type="number"
                  placeholder="e.g. 124.639300"
                  value={locationForm.longitude}
                  onChange={(event) =>
                    setLocationForm({ ...locationForm, longitude: event.target.value })
                  }
                />
              </Field>
              <Field id="loc-radius" label="Radius (metres)">
                <input
                  id="loc-radius"
                  type="number"
                  placeholder="100"
                  value={locationForm.radius}
                  onChange={(event) =>
                    setLocationForm({ ...locationForm, radius: event.target.value })
                  }
                />
              </Field>
            </div>

            {locationError && (
              <span className="err" role="alert">
                {locationError}
              </span>
            )}

            <div className="acts" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setLocationForm({ latitude: "", longitude: "", radius: "100" })}
                disabled={locationBusy}
              >
                Clear pin
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setLocationOpen(false)}
                disabled={locationBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn p"
                onClick={saveLocation}
                disabled={locationBusy}
              >
                {locationBusy ? "Saving…" : "Save location"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
