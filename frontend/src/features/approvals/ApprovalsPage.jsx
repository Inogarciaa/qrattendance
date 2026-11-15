import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import { fetchApprovals, fetchPrograms, setAccountApproval } from "../../lib/api";
import { initials } from "../../lib/format";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "organizer", label: "Organizer" },
];

function signedUpLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ApprovalsPage() {
  const [rows, setRows] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Unsaved role/department corrections, per account id.
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    try {
      const data = await fetchApprovals();
      setRows(data.approvals || []);
      setEnabled(data.approvals_enabled !== false);
      setDrafts({});
      setError("");
    } catch (err) {
      setRows([]);
      setError(err.message || "Could not load the approval queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = () => {
    setLoading(true);
    load();
  };

  useEffect(() => {
    const timer = setTimeout(load, 0);
    fetchPrograms()
      .then((data) => setPrograms(data.programs || []))
      .catch(() => setPrograms([]));
    return () => clearTimeout(timer);
  }, [load]);

  const draftFor = (row) =>
    drafts[row.id] ?? {
      role: row.role,
      programId: row.program?.id ? String(row.program.id) : "",
    };

  const setDraft = (row, patch) => {
    setDrafts({ ...drafts, [row.id]: { ...draftFor(row), ...patch } });
  };

  const decide = async (row, approved) => {
    if (busyId) return;

    const draft = draftFor(row);

    if (!approved) {
      const confirmed = window.confirm(
        `Reject ${row.full_name}? The account is deleted and they can sign up again with the same school ID.`
      );
      if (!confirmed) return;
    }

    if (approved && !draft.programId) {
      setError(`Pick a department for ${row.full_name} before approving.`);
      return;
    }

    setBusyId(row.id);
    setError("");
    setNotice("");

    try {
      await setAccountApproval(row.id, {
        approved,
        role: approved ? draft.role : undefined,
        program_id: approved ? Number(draft.programId) : undefined,
      });
      setNotice(
        approved
          ? `${row.full_name} can now sign in to the app.`
          : `${row.full_name} was rejected and removed.`
      );
      await load();
    } catch (err) {
      setError(err.message || "Could not update this account.");
    } finally {
      setBusyId("");
    }
  };

  const pendingStudents = rows.filter((row) => row.role === "student").length;
  const pendingOrganizers = rows.filter((row) => row.role === "organizer").length;

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Review the students and organizers who signed up with Google. Nobody can sign in until an account is approved."
      />

      {!enabled && !loading && (
        <div
          className="card"
          style={{ borderLeft: "3px solid #f59e0b", background: "#fffbeb" }}
          role="status"
        >
          <p style={{ margin: 0, fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
            Approvals are switched off because the database is missing{" "}
            <code>profiles.approved_at</code>. Apply{" "}
            <code>supabase/migrations/0005_signup_approval.sql</code> in the Supabase SQL
            editor, then reload this page.
          </p>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 0 }}>
          <div>
            <div className="kpi-label">Waiting for approval</div>
            <b style={{ display: "block", fontSize: 32, fontWeight: 800, letterSpacing: "-.5px" }}>
              {rows.length}
            </b>
          </div>
          <div style={{ fontSize: 13, color: "var(--mu)" }}>
            {pendingStudents} student{pendingStudents === 1 ? "" : "s"} ·{" "}
            {pendingOrganizers} organizer{pendingOrganizers === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {error && (
        <div className="card">
          <p style={{ margin: 0, color: "#dc2626", fontSize: 13 }} role="alert">
            {error}
          </p>
        </div>
      )}

      {notice && (
        <div className="card">
          <p style={{ margin: 0, color: "#15803d", fontSize: 13 }} role="status">
            {notice}
          </p>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 15 }}>Pending accounts</h2>
            <p style={{ margin: 0, color: "var(--mu)", fontSize: 13 }}>
              Correct the role or department if someone picked the wrong one, then approve.
            </p>
          </div>
          <button type="button" className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p style={{ margin: 0, color: "var(--mu)" }}>Loading the queue…</p>
        ) : rows.length === 0 ? (
          <p style={{ margin: 0, color: "var(--mu)" }}>
            Nothing is waiting for approval right now.
          </p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>School ID</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Signed up</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const draft = draftFor(row);
                  const busy = busyId === row.id;
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="who">
                          <span className="av sm">{initials(row.full_name)}</span>
                          <div>
                            <div>{row.full_name}</div>
                            <small style={{ color: "var(--mu)" }}>{row.email || "—"}</small>
                          </div>
                        </div>
                      </td>
                      <td>{row.school_id}</td>
                      <td>
                        <select
                          aria-label={`Role for ${row.full_name}`}
                          value={draft.role}
                          onChange={(event) =>
                            setDraft(row, { role: event.target.value })
                          }
                        >
                          {ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`Department for ${row.full_name}`}
                          value={draft.programId}
                          onChange={(event) =>
                            setDraft(row, { programId: event.target.value })
                          }
                        >
                          <option value="">Choose…</option>
                          {programs.map((program) => (
                            <option key={program.id} value={program.id}>
                              {program.code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ color: "var(--mu)", fontSize: 13 }}>
                        {signedUpLabel(row.created_at)}
                      </td>
                      <td>
                        <span style={{ display: "inline-flex", gap: 8 }}>
                          <button
                            type="button"
                            className="btn p"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => decide(row, true)}
                            disabled={busy}
                          >
                            {busy ? "Working…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => decide(row, false)}
                            disabled={busy}
                          >
                            Reject
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>What happens next</h2>
        <p style={{ marginBottom: 0 }}>
          Approving turns the account on straight away. Rejecting deletes it, so the
          person can sign up again with the same school ID. Approved accounts are managed
          from <strong>Students</strong>.
        </p>
      </div>
    </>
  );
}
