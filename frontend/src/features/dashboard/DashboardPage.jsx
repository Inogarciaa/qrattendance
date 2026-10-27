import { useEffect, useState } from "react";
import Icon from "../../components/ui/Icon";
import StatusBadge from "../../components/ui/StatusBadge";
import { ATTENDANCE, EVENTS, isLive } from "../../lib/demo-data";
import { initials } from "../../lib/format";

const NOW_STRING = new Date().toLocaleTimeString("en-PH", {
  hour: "2-digit",
  minute: "2-digit",
});

export default function DashboardPage() {
  const [selectedEventId, setSelectedEventId] = useState(EVENTS[0].id);
  const [liveLog, setLiveLog] = useState(() => {
    const liveEvent = EVENTS.find(isLive);
    if (!liveEvent) return [];
    return ATTENDANCE.filter(
      (entry) => entry.event.id === liveEvent.id && entry.status !== "Absent"
    ).slice(0, 3);
  });

  // Simulate new check-ins arriving every 8 seconds on a live event.
  // Replace this effect with realtime data from the API/Supabase later.
  useEffect(() => {
    const liveEvent = EVENTS.find(isLive);
    if (!liveEvent) return undefined;

    const pool = ATTENDANCE.filter(
      (entry) => entry.event.id === liveEvent.id && entry.status !== "Absent"
    );
    let index = 3;

    const timer = setInterval(() => {
      if (index < pool.length) {
        const nextEntry = pool[index];
        setLiveLog((previous) => [nextEntry, ...previous].slice(0, 8));
        index += 1;
      }
    }, 8000);

    return () => clearInterval(timer);
  }, []);

  const liveEvent = EVENTS.find(isLive);
  const liveRows = liveEvent
    ? ATTENDANCE.filter((entry) => entry.event.id === liveEvent.id)
    : [];
  const liveTotal = liveRows.length;
  const livePresent = liveRows.filter((entry) => entry.status === "Present").length;
  const liveLate = liveRows.filter((entry) => entry.status === "Late").length;
  const liveAbsent = liveRows.filter((entry) => entry.status === "Absent").length;
  const liveRate = liveTotal
    ? Math.round(((livePresent + liveLate) / liveTotal) * 100)
    : 0;

  const selectedEvent = EVENTS.find((event) => event.id === selectedEventId);
  const rows = ATTENDANCE.filter((entry) => entry.event.id === selectedEventId);
  const total = rows.length;
  const counts = {
    Present: rows.filter((entry) => entry.status === "Present").length,
    Late: rows.filter((entry) => entry.status === "Late").length,
    Absent: rows.filter((entry) => entry.status === "Absent").length,
  };
  const percentage = total
    ? Math.round(((counts.Present + counts.Late) / total) * 100)
    : 0;

  const kpiMeta = [
    { key: "Present", icon: "chk", className: "kpi-present" },
    { key: "Late", icon: "bel", className: "kpi-late" },
    { key: "Absent", icon: "out", className: "kpi-absent" },
  ];

  return (
    <>
      {liveEvent ? (
        <div className="live-wrap">
          <div className="live-header">
            <div className="live-tag">
              <span className="live-dot" />
              &nbsp;LIVE NOW
            </div>
            <div className="live-title">{liveEvent.name}</div>
            <div className="live-sub">
              {liveEvent.venue} &nbsp;·&nbsp; {liveEvent.start} – {liveEvent.end}{" "}
              &nbsp;·&nbsp; {liveEvent.mode}
            </div>
            <div className="live-kpis">
              <div className="live-kpi">
                <span className="live-kpi-val">{liveTotal}</span>
                <span className="live-kpi-label">Enrolled</span>
              </div>
              <div className="live-kpi green">
                <span className="live-kpi-val">{livePresent}</span>
                <span className="live-kpi-label">Present</span>
              </div>
              <div className="live-kpi amber">
                <span className="live-kpi-val">{liveLate}</span>
                <span className="live-kpi-label">Late</span>
              </div>
              <div className="live-kpi red">
                <span className="live-kpi-val">{liveAbsent}</span>
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
                Live &nbsp;·&nbsp; Updated {NOW_STRING} &nbsp;·&nbsp; {liveRate}%
                attendance rate
              </span>
            </div>
            <div className="scan-feed">
              {liveLog.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--mu)",
                    padding: "20px 0",
                    fontSize: 13,
                  }}
                >
                  Waiting for first scan…
                </div>
              )}
              {liveLog.map((entry, index) => (
                <div className="scan-item" key={index}>
                  <span className="av sm">{initials(entry.student.name)}</span>
                  <div style={{ flex: 1 }}>
                    <div className="scan-name">{entry.student.name}</div>
                    <div className="scan-prog">{entry.student.program}</div>
                  </div>
                  <StatusBadge status={entry.status} />
                  <span className="scan-time">{entry.time}</span>
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
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            No live event right now
          </div>
          <div style={{ color: "var(--mu)", fontSize: 13, marginTop: 4 }}>
            Events will appear here automatically when they start.
          </div>
        </div>
      )}

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
              ? new Date(selectedEvent.date + "T00:00").toLocaleDateString("en-PH", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Select an event below"}
          </p>
        </div>
        <div className="db-hero-badge">
          <b>{percentage}%</b>
          <span>Attendance rate</span>
        </div>
      </div>

      <div className="ev-tabs">
        {EVENTS.map((event) => (
          <button
            key={event.id}
            className={
              "ev-tab" +
              (selectedEventId === event.id ? " active" : "") +
              (isLive(event) ? " ev-tab-live" : "")
            }
            onClick={() => setSelectedEventId(event.id)}
          >
            {event.name}
          </button>
        ))}
      </div>

      <div className="st">
        {kpiMeta.map(({ key, icon, className }) => (
          <div className={"card " + className} key={key}>
            <div className="kpi-icon">
              <Icon name={icon} />
            </div>
            <div className="kpi-label">{key}</div>
            <b>{counts[key]}</b>
            <div style={{ fontSize: 12, color: "var(--mu)", marginTop: 2 }}>
              {total ? Math.round((counts[key] / total) * 100) : 0}% of total
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
            {rows.filter((entry) => entry.status !== "Absent").length} scanned
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
              {rows
                .filter((entry) => entry.status !== "Absent")
                .map((entry, index) => (
                  <tr key={index}>
                    <td>
                      <div className="who">
                        <span className="av sm">
                          {initials(entry.student.name)}
                        </span>
                        {entry.student.name}
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
                        {entry.student.program}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={entry.status} />
                    </td>
                    <td
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--mu)",
                        fontSize: 13,
                      }}
                    >
                      {entry.time}
                    </td>
                  </tr>
                ))}
              {rows.filter((entry) => entry.status !== "Absent").length === 0 && (
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
  );
}
