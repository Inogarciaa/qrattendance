import { useCallback, useEffect, useState } from "react";
import DataTable from "../../components/ui/DataTable";
import Field from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { fetchEvents, fetchReports } from "../../lib/api";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeRange(start, end) {
  if (!start) return "—";
  const fmt = (t) => {
    if (!t) return "";
    const [h, m] = String(t).split(":");
    const hour = Number(h);
    if (!Number.isFinite(hour)) return t;
    const suffix = hour >= 12 ? "PM" : "AM";
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${display}:${String(m || "00").padStart(2, "0")} ${suffix}`;
  };
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

export default function EventHistoryPage({ onNavigate }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventDetail, setEventDetail] = useState(null);
  const [records, setRecords] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchEvents();
      // Completed, closed, or cancelled events, or events whose date/time has passed
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const currentTime = now.toLocaleTimeString("en-GB", { hour12: false }).slice(0, 5);

      const finished = (data.events || []).filter((e) => {
        if (["closed", "completed", "cancelled"].includes(e.status)) return true;
        if (e.event_date < today) return true;
        if (e.event_date === today && e.end_time < currentTime) return true;
        return false;
      });
      setEvents(finished);
    } catch (err) {
      setError(err.message || "Could not load event history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const viewEventDetail = async (eventId) => {
    if (selectedEventId === eventId) {
      setSelectedEventId(null);
      setEventDetail(null);
      setRecords([]);
      return;
    }

    setSelectedEventId(eventId);
    setDetailLoading(true);
    try {
      const target = events.find((e) => e.id === eventId);
      setEventDetail(target);
      const reports = await fetchReports({ event_id: eventId });
      setRecords(reports.records || []);
    } catch (err) {
      setError(err.message || "Could not load event attendance records.");
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredEvents = events.filter((e) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      e.name.toLowerCase().includes(q) ||
      (e.venue || "").toLowerCase().includes(q) ||
      (e.event_date || "").includes(q)
    );
  });

  const columns = ["Event Name", "Date & Time", "Venue", "Enrolled", "Attendance Rate", "Status", ""];

  const rows = filteredEvents.map((event) => {
    const tally = event.tally || { present: 0, late: 0, absent: 0 };
    const enrolled = event.enrolled || 0;
    const totalPresent = (tally.present || 0) + (tally.late || 0);
    const rate = enrolled ? Math.round((totalPresent / enrolled) * 100) : 0;
    const isSelected = selectedEventId === event.id;

    return [
      <strong key="name">{event.name}</strong>,
      `${formatDate(event.event_date)} (${formatTimeRange(event.start_time, event.end_time)})`,
      event.venue || "—",
      enrolled,
      `${rate}% (${totalPresent}/${enrolled})`,
      <StatusBadge key="status" status={capitalize(event.status === "completed" ? "closed" : event.status)} />,
      <button
        key="action"
        type="button"
        className="btn"
        style={{ padding: "4px 12px", fontSize: 12 }}
        onClick={() => viewEventDetail(event.id)}
      >
        {isSelected ? "Hide Records" : "View Records"}
      </button>,
    ];
  });

  return (
    <>
      <PageHeader
        title="Event History"
        description="Review past and completed events, total attendance rates, and detailed check-in records."
      />

      <div className="card">
        <div className="gf">
          <Field id="history-query" label="Search past events">
            <input
              id="history-query"
              type="text"
              placeholder="Search by event name, venue, or date (YYYY-MM-DD)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <button type="button" className="btn" onClick={() => load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {error && (
          <p style={{ margin: "12px 0 0", color: "#dc2626", fontSize: 13 }} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="card">
        {loading ? (
          <p style={{ margin: 0, color: "var(--mu)" }}>Loading event history…</p>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            emptyMessage={
              query.trim()
                ? "No completed events match your search."
                : "No past or completed events yet."
            }
          />
        )}
      </div>

      {selectedEventId && eventDetail && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="row" style={{ marginBottom: 16 }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: 16 }}>
                Attendance Records: {eventDetail.name}
              </h2>
              <p style={{ margin: 0, color: "var(--mu)", fontSize: 13 }}>
                {formatDate(eventDetail.event_date)} · {eventDetail.venue || "No venue"}
              </p>
            </div>
            <button
              type="button"
              className="btn"
              style={{ fontSize: 12 }}
              onClick={() => {
                if (onNavigate) {
                  onNavigate("Reports");
                }
              }}
            >
              Open in Reports
            </button>
          </div>

          {detailLoading ? (
            <p style={{ color: "var(--mu)" }}>Loading student records…</p>
          ) : (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>School ID</th>
                    <th>Program</th>
                    <th>Status</th>
                    <th>Time Scanned</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.id}>
                      <td>{rec.student?.full_name || "—"}</td>
                      <td>{rec.student?.school_id || "—"}</td>
                      <td>{rec.student?.program?.code || "—"}</td>
                      <td>
                        <StatusBadge status={capitalize(rec.status)} />
                      </td>
                      <td style={{ fontSize: 13, color: "var(--mu)" }}>
                        {rec.scanned_at
                          ? new Date(rec.scanned_at).toLocaleTimeString("en-PH", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "24px 0", color: "var(--mu)" }}>
                        No attendance records logged for this event.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
