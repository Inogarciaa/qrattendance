import { useCallback, useEffect, useState } from "react";
import DataTable from "../../components/ui/DataTable";
import Field from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import Avatar from "../../components/ui/Avatar";
import {
  archiveEntity,
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

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
      setHistory((prev) => ({ ...prev, [student.id]: null }));
      toast?.(`${student.full_name} archived.`);
    } catch (err) {
      setError(err.message || "Could not archive this student.");
    } finally {
      setBusyId("");
    }
  };

  const columns = ["Student", "Department"];

  const openStudentModal = (student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  return (
    <>
      <PageHeader
        title="Search Students"
        description="Look up a student to see their attendance record. New sign-ups are reviewed on the Approvals page."
      />

      <div className="card">
        <div className="gf">
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
          <button
            type="button"
            className="btn"
            onClick={() => setIsModalOpen(true)}
            disabled={results === null || results.length === 0}
            style={{ marginLeft: 8 }}
          >
            Maximize
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
                const nameCell = (
                  <span
                    className="who"
                    key={student.id}
                    style={{
                      cursor: "pointer",
                      fontWeight: 600,
                      color: "var(--mu-dark, #1e293b)",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--primary, #4f46e5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--mu-dark, #1e293b)";
                    }}
                    onClick={() => openStudentModal(student)}
                  >
                    <Avatar name={student.full_name} photoUrl={student.photo_url} />
                    {student.full_name}
                  </span>
                );
                return [nameCell, student.program?.name || "—"];
              })}
              emptyMessage="No students match these filters."
            />
          </>
        )}
      </div>

      {isModalOpen && selectedStudent && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {selectedStudent.full_name}
              </h2>
              <div className="actions">
                <button
                  type="button"
                  className="btn"
                  onClick={closeModal}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="modal-content">
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="row" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <Avatar
                    name={selectedStudent.full_name}
                    photoUrl={selectedStudent.photo_url}
                    size="lg"
                  />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>
                      {selectedStudent.full_name}
                    </h3>
                    <p style={{ margin: "4px 0", color: "var(--mu)", fontSize: 13 }}>
                      ID: {selectedStudent.school_id}
                    </p>
                    <p style={{ margin: 0, color: "var(--mu)", fontSize: 13 }}>
                      Program: {selectedStudent.program?.code || "—"}
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <p style={{ margin: "0 0 8px", color: "var(--mu)", fontSize: 12 }}>
                    Email
                  </p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    {selectedStudent.email || "—"}
                  </p>
                </div>

                <div style={{ marginTop: 16 }}>
                  <p style={{ margin: "0 0 8px", color: "var(--mu)", fontSize: 12 }}>
                    Attendance
                  </p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    {attendanceSummary(history[selectedStudent.id])}
                  </p>
                </div>
              </div>

              {isSuperadmin && (
                <button
                  type="button"
                  className="btn"
                  style={{ padding: "8px 16px" }}
                  onClick={() => archiveStudent(selectedStudent)}
                  disabled={busyId === selectedStudent.id}
                >
                  {busyId === selectedStudent.id ? "Archiving…" : "Archive Student"}
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={closeModal}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}