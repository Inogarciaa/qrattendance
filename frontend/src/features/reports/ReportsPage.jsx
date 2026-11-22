import { useCallback, useEffect, useState } from "react";
import DataTable from "../../components/ui/DataTable";
import Field from "../../components/ui/Field";
import Icon from "../../components/ui/Icon";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  downloadReportCsv,
  fetchEvents,
  fetchPrograms,
  fetchReports,
} from "../../lib/api";

const INITIAL_FILTERS = {
  event: "all",
  status: "all",
  program: "all",
  from: "",
  to: "",
};

const STATUSES = ["present", "late", "absent"];

function capitalize(value) {
  const text = String(value ?? "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

/** Maps the page filters onto the query keys the report endpoint expects. */
function toQuery(filters) {
  return {
    event_id: filters.event === "all" ? "" : filters.event,
    status: filters.status === "all" ? "" : filters.status,
    program_id: filters.program === "all" ? "" : filters.program,
    from: filters.from,
    to: filters.to,
  };
}

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ReportsPage({ toast }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [events, setEvents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const updateFilter = (key) => (event) =>
    setFilters({ ...filters, [key]: event.target.value });

  const load = useCallback(async (nextFilters) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchReports(toQuery(nextFilters));
      setRecords(data.records || []);
    } catch (err) {
      setRecords([]);
      setError(err.message || "Could not load the attendance report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(INITIAL_FILTERS);
  }, [load]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchEvents(), fetchPrograms()])
      .then(([eventData, programData]) => {
        if (!active) return;
        setEvents(eventData.events || []);
        setPrograms(programData.programs || []);
      })
      .catch(() => {
        // Filters still work with the defaults when the lookups fail.
      });
    return () => {
      active = false;
    };
  }, []);

  const generate = () => {
    setAppliedFilters(filters);
    load(filters);
  };

  const reset = () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    load(INITIAL_FILTERS);
  };

  const exportCsv = async () => {
    setExporting(true);
    setError("");
    try {
      const { filename, bytes } = await downloadReportCsv(toQuery(appliedFilters));
      toast?.(
        records.length
          ? `Exported ${records.length} record${records.length === 1 ? "" : "s"} to ${filename}.`
          : `Exported an empty report (${Math.max(1, Math.round(bytes / 1024))} KB) to ${filename}.`
      );
    } catch (err) {
      setError(err.message || "Could not export the report.");
    } finally {
      setExporting(false);
    }
  };

  const select = (key, options) => (
    <select id={key} value={filters[key]} onChange={updateFilter(key)}>
      <option value="all">All</option>
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );

  const rows = records.map((record) => [
    <strong key="event">{record.event?.name || "—"}</strong>,
    <span key="student">
      {record.student?.full_name || "—"}
      {record.student?.school_id ? (
        <>
          <br />
          <small style={{ color: "var(--text-muted)" }}>{record.student.school_id}</small>
        </>
      ) : null}
    </span>,
    record.student?.program?.code || record.student?.program?.name || "—",
    <StatusBadge key="status" status={capitalize(record.status)} />,
    <span key="time">
      {dateLabel(record.event?.event_date)}
      <br />
      <small style={{ color: "var(--text-muted)" }}>{timeLabel(record.scanned_at)}</small>
    </span>,
  ]);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Filter attendance records, then export them for official reporting."
        action={
          <button
            type="button"
            className="btn p"
            onClick={exportCsv}
            disabled={exporting || loading}
          >
            <Icon name="download" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        }
      />

      <div className="card">
        <div className="gf">
          <Field id="event" label="Event">
            {select(
              "event",
              events.map((event) => [event.id, event.name])
            )}
          </Field>
          <Field id="status" label="Status">
            {select("status", STATUSES.map((status) => [status, capitalize(status)]))}
          </Field>
          <Field id="program" label="Program">
            {select(
              "program",
              programs.map((program) => [program.id, program.code || program.name])
            )}
          </Field>
          <Field id="from" label="From date">
            <input
              id="from"
              type="date"
              value={filters.from}
              onChange={updateFilter("from")}
            />
          </Field>
          <Field id="to" label="To date">
            <input
              id="to"
              type="date"
              value={filters.to}
              onChange={updateFilter("to")}
            />
          </Field>
        </div>
        <div className="acts">
          <button type="button" className="btn" onClick={reset} disabled={loading}>
            Reset
          </button>
          <button type="button" className="btn p" onClick={generate} disabled={loading}>
            {loading ? "Generating…" : "Generate report"}
          </button>
        </div>
        {error && (
          <p style={{ margin: "12px 0 0", color: "#dc2626", fontSize: 13 }} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="card">
        <div className="row">
          <h2>
            {loading
              ? "Loading records…"
              : `${records.length} record${records.length === 1 ? "" : "s"}`}
          </h2>
        </div>
        <DataTable
          columns={["Event", "Student", "Program", "Status", "Date · Time"]}
          rows={rows}
          emptyMessage={
            loading
              ? "Loading attendance records…"
              : "No attendance records match these filters yet."
          }
        />
      </div>
    </>
  );
}
