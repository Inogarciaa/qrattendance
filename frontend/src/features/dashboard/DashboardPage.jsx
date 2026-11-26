import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Field from "../../components/ui/Field";
import Icon from "../../components/ui/Icon";
import StatusBadge from "../../components/ui/StatusBadge";
import Avatar from "../../components/ui/Avatar";
import {
  addTempOrganizer,
  addTempOrganizerGroup,
  archiveEntity,
  fetchEvent,
  fetchEvents,
  fetchLiveDashboard,
  fetchOfficerGroups,
  fetchReports,
  fetchTempOrganizers,
  removeTempOrganizer,
  searchStudents,
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

function expiryLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const current = Number(prevRef.current) || 0;
    const target = Number(value) || 0;
    prevRef.current = value;
    if (current === target) return;

    const diff = target - current;
    const duration = 600;
    const start = performance.now();

    let frameId;
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(current + diff * ease));
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return <span>{display}</span>;
}

export default function DashboardPage({ onNavigate, user, toast }) {
  const isSuperadmin = user?.role === "superadmin";
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
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [tempOrganizers, setTempOrganizers] = useState([]);
  const [accessEnabled, setAccessEnabled] = useState(true);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessQuery, setAccessQuery] = useState("");
  const [accessResults, setAccessResults] = useState([]);
  const [accessSearching, setAccessSearching] = useState(false);
  const [accessBusyId, setAccessBusyId] = useState("");
  const [accessError, setAccessError] = useState("");
  const [officerGroups, setOfficerGroups] = useState([]);
  const [groupChoice, setGroupChoice] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);

  const load = useCallback(async () => {
    const [liveData, eventData] = await Promise.all([
      fetchLiveDashboard(),
      fetchEvents(),
    ]);
    setDashboard(liveData);
    // Only show live or scheduled events
    const activeEvents = (eventData.events || []).filter(
      (event) => ["live", "scheduled"].includes(event.status)
    );
    setEvents(activeEvents);
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

  const loadTempOrganizers = useCallback(async (eventId) => {
    if (!eventId) return;

    try {
      const data = await fetchTempOrganizers(eventId);
      setTempOrganizers(data.organizers || []);
      setAccessEnabled(true);
      setAccessError("");
    } catch (err) {
      setTempOrganizers([]);
      if (err.status === 503) {
        setAccessEnabled(false);
      } else {
        setAccessError(err.message || "Could not load gatekeeper access.");
      }
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setAccessOpen(false);
    setAccessQuery("");
    setAccessResults([]);
    setGroupChoice("");
    loadTempOrganizers(activeId);
  }, [activeId, loadTempOrganizers]);

  // Groups are optional: a project without migration 0009 just shows no picker.
  useEffect(() => {
    let active = true;

    fetchOfficerGroups()
      .then((data) => {
        if (active) setOfficerGroups(data.groups || []);
      })
      .catch(() => {
        if (active) setOfficerGroups([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const grantGroupAccess = async () => {
    if (!activeId || !groupChoice) return;

    setGroupBusy(true);
    setAccessError("");
    try {
      await addTempOrganizerGroup(activeId, groupChoice);
      setGroupChoice("");
      await loadTempOrganizers(activeId);
    } catch (err) {
      setAccessError(err.message || "Could not add the group.");
    } finally {
      setGroupBusy(false);
    }
  };

  const searchAccessCandidates = async () => {
    const q = accessQuery.trim();
    if (!q || !activeId) return;

    setAccessSearching(true);
    setAccessError("");
    try {
      const data = await searchStudents({ q });
      const granted = new Set(tempOrganizers.map((row) => row.profile?.id));
      setAccessResults(
        (data.students || [])
          .filter((student) => !granted.has(student.id))
          .slice(0, 8)
      );
    } catch (err) {
      setAccessError(err.message || "Could not search students.");
    } finally {
      setAccessSearching(false);
    }
  };

  const grantAccess = async (student) => {
    if (!activeId) return;

    setAccessBusyId(student.id);
    setAccessError("");
    try {
      await addTempOrganizer(activeId, student.id);
      setAccessResults([]);
      setAccessQuery("");
      await loadTempOrganizers(activeId);
    } catch (err) {
      setAccessError(err.message || "Could not grant access.");
    } finally {
      setAccessBusyId("");
    }
  };

  const revokeAccess = async (student) => {
    if (!activeId) return;

    const name = student.profile?.full_name || "this student";
    if (!window.confirm(`Remove ${name}'s gatekeeper access for this event?`)) return;

    setAccessBusyId(student.profile?.id || "");
    setAccessError("");
    try {
      await removeTempOrganizer(activeId, student.profile?.id);
      await loadTempOrganizers(activeId);
    } catch (err) {
      setAccessError(err.message || "Could not remove access.");
    } finally {
      setAccessBusyId("");
    }
  };

  const counts = useMemo(() => {
    const tally = detail?.tally || { present: 0, late: 0, absent: 0 };
    const enrolled = detail?.enrolled ?? 0;
    const event = detail?.event;
    // Absent should only count students explicitly marked absent while live/upcoming,
    // and only compute unmatched as absent when the event is completed or closed.
    const isFinished = event ? ["closed", "completed"].includes(event.status) : false;
    return {
      enrolled,
      present: tally.present || 0,
      late: tally.late || 0,
      absent: isFinished
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

  const archiveEvent = async () => {
    if (!selectedEvent || archiveBusy) return;

    const confirmed = window.confirm(
      `Archive “${selectedEvent.name}”? It disappears from the dashboard and the mobile app. Attendance records are kept, and a superadmin can restore it from the Archive page.`
    );
    if (!confirmed) return;

    setArchiveBusy(true);
    setArchiveError("");
    try {
      await archiveEntity("events", selectedEvent.id);
      setSelectedId(null);
      setDetail(null);
      setRecords([]);
      await load();
      toast?.(`${selectedEvent.name} archived.`);
    } catch (err) {
      setArchiveError(err.message || "Could not archive this event.");
    } finally {
      setArchiveBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card" style={{ padding: 32 }}>
          <div className="skeleton skel-title" style={{ width: "35%", height: 26 }} />
          <div className="skeleton skel-text" style={{ width: "55%" }} />
          <div className="skeleton skel-text" style={{ width: "30%" }} />
        </div>
        <div className="st">
          <div className="card">
            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 8, marginBottom: 14 }} />
            <div className="skeleton skel-text" style={{ width: "45%" }} />
            <div className="skeleton" style={{ width: "60%", height: 36, marginTop: 8 }} />
          </div>
          <div className="card">
            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 8, marginBottom: 14 }} />
            <div className="skeleton skel-text" style={{ width: "45%" }} />
            <div className="skeleton" style={{ width: "60%", height: 36, marginTop: 8 }} />
          </div>
          <div className="card">
            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 8, marginBottom: 14 }} />
            <div className="skeleton skel-text" style={{ width: "45%" }} />
            <div className="skeleton" style={{ width: "60%", height: 36, marginTop: 8 }} />
          </div>
        </div>
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
                <span className="live-kpi-val"><AnimatedNumber value={live.counts.enrolled} /></span>
                <span className="live-kpi-label">Enrolled</span>
              </div>
              <div className="live-kpi green">
                <span className="live-kpi-val"><AnimatedNumber value={live.counts.present} /></span>
                <span className="live-kpi-label">Present</span>
              </div>
              <div className="live-kpi amber">
                <span className="live-kpi-val"><AnimatedNumber value={live.counts.late} /></span>
                <span className="live-kpi-label">Late</span>
              </div>
              <div className="live-kpi red">
                <span className="live-kpi-val"><AnimatedNumber value={live.counts.absent} /></span>
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
              Nothing scheduled for today or later.
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
                {isSuperadmin && selectedEvent && (
                  <button
                    type="button"
                    className="db-hero-action"
                    style={{ marginLeft: 8, borderColor: "#ef4444", color: "#ef4444" }}
                    onClick={archiveEvent}
                    disabled={archiveBusy}
                  >
                    {archiveBusy ? "Archiving…" : "Archive event"}
                  </button>
                )}
              </div>
              {archiveError && (
                <span className="err" role="alert" style={{ display: "block", marginTop: 8 }}>
                  {archiveError}
                </span>
              )}
              <div className="hero-progress-wrap">
                <div
                  className="hero-progress-bar"
                  style={{ width: `${Math.min(100, percentage)}%` }}
                />
              </div>
            </div>
            <div className="db-hero-badge">
              <b><AnimatedNumber value={percentage} />%</b>
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
            ].map(({ key, label, icon, className }) => {
              const pct = counts.enrolled
                ? Math.round((counts[key] / counts.enrolled) * 100)
                : 0;
              return (
                <div className={"card " + className} key={key}>
                  <div className="kpi-icon">
                    <Icon name={icon} />
                  </div>
                  <div className="kpi-label">{label}</div>
                  <b><AnimatedNumber value={counts[key]} /></b>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    <AnimatedNumber value={pct} />% of enrolled
                  </div>
                  <div className="stat-progress-track">
                    <div
                      className="stat-progress-bar"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {accessEnabled && selectedEvent && (
            <div className="card">
              <div className="row" style={{ marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontWeight: 700, fontSize: 15 }}>Gatekeeper access</h2>
                  <p style={{ margin: 0, color: "var(--mu)", fontSize: 13 }}>
                    Students who can scan for <strong>{selectedEvent.name}</strong> without
                    becoming organizers. Access ends one hour after the event.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setAccessOpen((open) => !open)}
                >
                  {accessOpen ? "Close" : "Add student"}
                </button>
              </div>

              {accessOpen && (
                <div style={{ marginBottom: 14 }}>
                  {officerGroups.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "flex-end",
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ flex: "1 1 240px" }}>
                        <Field id="access-group" label="Add a saved group">
                          <select
                            id="access-group"
                            value={groupChoice}
                            onChange={(event) => setGroupChoice(event.target.value)}
                          >
                            <option value="">Select a group</option>
                            {officerGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name} ({group.members?.length || 0})
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        onClick={grantGroupAccess}
                        disabled={groupBusy || !groupChoice}
                      >
                        {groupBusy ? "Adding…" : "Add group"}
                      </button>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "flex-end",
                    }}
                  >
                    <div style={{ flex: "1 1 240px" }}>
                      <Field id="access-search" label="Find a student">
                        <input
                          id="access-search"
                          value={accessQuery}
                          placeholder="Name or school ID"
                          onChange={(event) => setAccessQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              searchAccessCandidates();
                            }
                          }}
                        />
                      </Field>
                    </div>
                    <button
                      type="button"
                      className="btn"
                      onClick={searchAccessCandidates}
                      disabled={accessSearching || !accessQuery.trim()}
                    >
                      {accessSearching ? "Searching…" : "Search"}
                    </button>
                  </div>

                  {accessResults.length > 0 && (
                    <div className="orgs" style={{ marginTop: 10 }}>
                      {accessResults.map((student) => (
                        <button
                          type="button"
                          className="chip"
                          key={student.id}
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                          }}
                          onClick={() => grantAccess(student)}
                          disabled={accessBusyId === student.id}
                        >
                          <span>
                            {student.full_name}{" "}
                            <small>
                              {[student.school_id, student.program?.code]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {accessError && (
                <p style={{ margin: "0 0 12px", color: "#dc2626", fontSize: 13 }} role="alert">
                  {accessError}
                </p>
              )}

              {tempOrganizers.length === 0 ? (
                <p style={{ margin: 0, color: "var(--mu)" }}>
                  No temporary gatekeepers for this event.
                </p>
              ) : (
                <div className="tw">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Program</th>
                        <th>Access until</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {tempOrganizers.map((row) => {
                        const student = row.profile;
                        const busy = accessBusyId === student?.id;
                        return (
                          <tr key={student?.id || row.expires_at}>
                            <td>
                              <div className="who">
                                <Avatar
                                  name={student?.full_name}
                                  photoUrl={student?.photo_url}
                                />
                                <div>
                                  <div>{student?.full_name || "Unknown student"}</div>
                                  <small style={{ color: "var(--mu)" }}>
                                    {student?.school_id || "—"}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>{student?.program?.code || "—"}</td>
                            <td style={{ color: "var(--mu)", fontSize: 13 }}>
                              {expiryLabel(row.expires_at)}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: "6px 12px", fontSize: 12 }}
                                onClick={() => revokeAccess(row)}
                                disabled={busy}
                              >
                                {busy ? "Removing…" : "Remove"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

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
