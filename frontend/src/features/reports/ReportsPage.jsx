import { useState } from "react";
import DataTable from "../../components/ui/DataTable";
import Field from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  ATTENDANCE,
  EVENTS,
  PROGRAMS,
  STATUSES,
} from "../../lib/demo-data";

const INITIAL_FILTERS = {
  event: "all",
  status: "all",
  program: "all",
  from: "",
  to: "",
};

export default function ReportsPage({ toast }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);

  const updateFilter = (key) => (event) =>
    setFilters({ ...filters, [key]: event.target.value });

  const rows = ATTENDANCE.filter(
    (entry) =>
      (appliedFilters.event === "all" ||
        entry.event.id === Number(appliedFilters.event)) &&
      (appliedFilters.status === "all" ||
        entry.status === appliedFilters.status) &&
      (appliedFilters.program === "all" ||
        entry.student.program === appliedFilters.program) &&
      (!appliedFilters.from || entry.event.date >= appliedFilters.from) &&
      (!appliedFilters.to || entry.event.date <= appliedFilters.to)
  );

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

  return (
    <>
      <PageHeader
        title="Reports"
        description="Filter attendance records, then export them for official reporting."
      />

      <div className="card">
        <div className="gf">
          <Field id="event" label="Event">
            {select("event", EVENTS.map((event) => [event.id, event.name]))}
          </Field>
          <Field id="status" label="Status">
            {select("status", STATUSES.map((status) => [status, status]))}
          </Field>
          <Field id="program" label="Program">
            {select("program", PROGRAMS.map((program) => [program, program]))}
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
          <button
            type="button"
            className="btn"
            onClick={() => {
              setFilters(INITIAL_FILTERS);
              setAppliedFilters(INITIAL_FILTERS);
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className="btn p"
            onClick={() => setAppliedFilters(filters)}
          >
            Generate report
          </button>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <h2>{rows.length} records</h2>
          <div className="acts">
            <button
              type="button"
              className="btn"
              onClick={() =>
                toast("Document export is simulated in this prototype.")
              }
            >
              Export document
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                toast("Spreadsheet export is simulated in this prototype.")
              }
            >
              Export spreadsheet
            </button>
          </div>
        </div>
        <DataTable
          columns={["Event", "Student", "Program", "Status", "Time"]}
          rows={rows.map((entry) => [
            entry.event.name,
            entry.student.name,
            entry.student.program,
            <StatusBadge key={entry.student.id + entry.event.id} status={entry.status} />,
            entry.time,
          ])}
        />
      </div>
    </>
  );
}
