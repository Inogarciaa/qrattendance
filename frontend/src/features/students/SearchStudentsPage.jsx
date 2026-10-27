import { useState } from "react";
import DataTable from "../../components/ui/DataTable";
import Field from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import {
  ATTENDANCE,
  PROGRAMS,
  STATUSES,
  STUDENTS,
} from "../../lib/demo-data";
import { initials } from "../../lib/format";

export default function SearchStudentsPage() {
  const [filters, setFilters] = useState({ query: "", program: "all" });
  const [results, setResults] = useState(null);

  const search = () => {
    const query = filters.query.trim().toLowerCase();
    setResults(
      STUDENTS.filter(
        (student) =>
          (!query ||
            student.name.toLowerCase().includes(query) ||
            student.id.includes(query)) &&
          (filters.program === "all" || student.program === filters.program)
      )
    );
  };

  const history = (student) => {
    const records = ATTENDANCE.filter(
      (entry) => entry.student.id === student.id
    );
    return STATUSES.map(
      (status) =>
        `${records.filter((entry) => entry.status === status).length} ${status.toLowerCase()}`
    ).join(" · ");
  };

  return (
    <>
      <PageHeader
        title="Search Students"
        description="Look up a student by name or ID number to see their attendance history."
      />

      <div className="card">
        <div
          className="gf"
          onKeyDown={(event) =>
            event.key === "Enter" &&
            event.target.tagName === "INPUT" &&
            search()
          }
        >
          <Field id="query" label="Name or ID number">
            <input
              id="query"
              type="text"
              placeholder="e.g. Maria or 2023-0142"
              value={filters.query}
              onChange={(event) =>
                setFilters({ ...filters, query: event.target.value })
              }
            />
          </Field>
          <Field id="program" label="Program">
            <select
              id="program"
              value={filters.program}
              onChange={(event) =>
                setFilters({ ...filters, program: event.target.value })
              }
            >
              <option value="all">All</option>
              {PROGRAMS.map((program) => (
                <option key={program}>{program}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="acts">
          <button type="button" className="btn p" onClick={search}>
            Search students
          </button>
        </div>
      </div>

      <div className="card">
        {results === null ? (
          <p style={{ margin: 0, color: "var(--mu)" }}>
            Enter a name or ID and select Search students.
          </p>
        ) : (
          <DataTable
            columns={["Student", "ID number", "Program", "Attendance"]}
            rows={results.map((student) => [
              <span className="who" key={student.id}>
                <span className="av sm">{initials(student.name)}</span>
                {student.name}
              </span>,
              student.id,
              student.program,
              history(student),
            ])}
          />
        )}
      </div>
    </>
  );
}
