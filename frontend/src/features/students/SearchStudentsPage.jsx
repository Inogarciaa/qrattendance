import { useCallback, useEffect, useState } from "react";
import DataTable from "../../components/ui/DataTable";
import Field from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import Avatar from "../../components/ui/Avatar";
import {
  archiveEntity,
  fetchPrograms,
  fetchStudentAttendance,
  searchStudents,
} from "../../lib/api";

function attendanceSummary(tally) {
  if (!tally) return "—";
  const total = (tally.present || 0) + (tally.late || 0) + (tally.absent || 0);
  if (!total) return "No records yet";
  return [
    `${tally.present || 0} present`,
    `${tally.late || 0} late`,
    `${tally.absent || 0} absent`,
  ].join(" · ");
}

export default function SearchStudentsPage({ user, toast }) {
  const isSuperadmin = user?.role === "superadmin";
  const [filters, setFilters] = useState({ query: "", programId: "" });
  const [programs, setPrograms] = useState([]);
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState({});
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    fetchPrograms()
      .then((data) => setPrograms(data.programs || []))
      .catch(() => setPrograms([]));
  }, []);

  const runSearch = useCallback(async (nextFilters) => {
    setSearching(true);
    setError("");
    try {
      const data = await searchStudents({
        q: nextFilters.query,
        programId: nextFilters.programId,
      });
      const students = data.students || [];
      setResults(students);

      const tallies = await Promise.all(
        students.map((student) =>
          fetchStudentAttendance(student.id)
            .then((response) => [student.id, response.tally])
            .catch(() => [student.id, null])
        )
      );
      setHistory(Object.fromEntries(tallies));
    } catch (err) {
      setResults([]);
      setHistory({});
      setError(err.message || "Could not search students.");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch({ query: "", programId: "" }), 0);
    return () => clearTimeout(timer);
  }, [runSearch]);

  const submit = () => {
    runSearch(filters);
  };

  const archiveStudent = async (student) => {
    const confirmed = window.confirm(
      `Archive ${student.full_name}? They will disappear from search and cannot sign in until a superadmin restores them. Attendance history is kept.`
    );
    if (!confirmed) return;

    setBusyId(student.id);
    setError("");
    try {
      await archiveEntity("students", student.id);
      setResults((current) =>
        (current || []).filter((row) => row.id !== student.id)
      );
      toast?.(`${student.full_name} archived.`);
    } catch (err) {
      setError(err.message || "Could not archive this student.");
    } finally {
      setBusyId("");
    }
  };

  const columns = isSuperadmin
    ? ["Student", "ID number", "Email", "Program", "Attendance", ""]
    : ["Student", "ID number", "Email", "Program", "Attendance"];

  return (
    <>
      <PageHeader
        title="Search Students"
        description="Look up a student to see their attendance record. New sign-ups are reviewed on the Approvals page."
      />

      <div className="card">
        <div
          className="gf"
          onKeyDown={(event) =>
            event.key === "Enter" && event.target.tagName === "INPUT" && submit()
          }
        >
          <Field id="query" label="Name, ID number, or email">
            <input
              id="query"
              type="text"
              placeholder="e.g. Maria, 2023-0142, or maria@lccb.edu.ph"
              value={filters.query}
              onChange={(event) =>
                setFilters({ ...filters, query: event.target.value })
              }
            />
          </Field>
          <Field id="program" label="Program">
            <select
              id="program"
              value={filters.programId}
              onChange={(event) =>
                setFilters({ ...filters, programId: event.target.value })
              }
            >
              <option value="">All</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.code}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="acts">
          <button type="button" className="btn p" onClick={submit} disabled={searching}>
            {searching ? "Searching…" : "Search students"}
          </button>
        </div>
        {error && (
          <p style={{ margin: "12px 0 0", color: "#dc2626", fontSize: 13 }} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="card">
        {results === null ? (
          <p style={{ margin: 0, color: "var(--mu)" }}>
            Enter a name, ID number, or email and select Search students.
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 14px", color: "var(--mu)", fontSize: 13 }}>
              {results.length} student{results.length === 1 ? "" : "s"} found
            </p>
            <DataTable
              columns={columns}
              rows={results.map((student) => {
                const cells = [
                  <span className="who" key={student.id}>
                    <Avatar name={student.full_name} photoUrl={student.photo_url} />
                    {student.full_name}
                  </span>,
                  student.school_id,
                  student.email || "—",
                  student.program?.code || "—",
                  attendanceSummary(history[student.id]),
                ];
                if (isSuperadmin) {
                  cells.push(
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      onClick={() => archiveStudent(student)}
                      disabled={busyId === student.id}
                    >
                      {busyId === student.id ? "Archiving…" : "Archive"}
                    </button>
                  );
                }
                return cells;
              })}
              emptyMessage="No students match these filters."
            />
          </>
        )}
      </div>
    </>
  );
}
