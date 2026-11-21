import { useEffect, useState } from "react";
import DataTable from "../../components/ui/DataTable";
import Field from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import { SCAN_MODES } from "../../lib/demo-data";
import {
  createOfficerGroup,
  createStaffAccount,
  deleteOfficerGroup,
  fetchOfficerGroups,
  fetchStaff,
  searchStudents,
  updateOfficerGroup,
} from "../../lib/api";

function addedLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SettingsPage({ user, setUser, toast }) {
  const isSuperadmin = user?.role === "superadmin";
  const [form, setForm] = useState({
    ...user,
    grace: "15",
    mode: SCAN_MODES[0][0],
  });
  const [errors, setErrors] = useState({});

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsEnabled, setGroupsEnabled] = useState(true);
  const [groupsError, setGroupsError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);

  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(isSuperadmin);
  const [staffError, setStaffError] = useState("");
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "" });
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffNotice, setStaffNotice] = useState(null);

  useEffect(() => {
    if (!isSuperadmin) return undefined;
    let active = true;
    fetchStaff()
      .then((data) => {
        if (active) setStaff(data.staff || []);
      })
      .catch((err) => {
        if (active) setStaffError(err.message || "Could not load staff accounts.");
      })
      .finally(() => {
        if (active) setStaffLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isSuperadmin]);

  const createStaff = async () => {
    if (staffBusy) return;

    const name = staffForm.name.trim();
    const email = staffForm.email.trim();
    const password = staffForm.password;

    if (name.split(/\s+/).length < 2) {
      setStaffError("Enter the admin's first and last name.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStaffError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setStaffError("The temporary password needs at least 8 characters.");
      return;
    }

    setStaffBusy(true);
    setStaffError("");
    setStaffNotice(null);
    try {
      const data = await createStaffAccount({ fullName: name, email, password });
      const created = data.staff;
      setStaff((current) => [created, ...current]);
      setStaffForm({ name: "", email: "", password: "" });
      setStaffNotice({
        name: created.full_name,
        email: created.email,
        password,
        role: created.role,
      });
      toast("Admin account created.");
    } catch (err) {
      setStaffError(err.message || "Could not create the admin account.");
    } finally {
      setStaffBusy(false);
    }
  };

  useEffect(() => {
    let active = true;

    fetchOfficerGroups()
      .then((data) => {
        if (active) setGroups(data.groups || []);
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 503) {
          setGroupsEnabled(false);
        } else {
          setGroupsError(err.message || "Could not load officer groups.");
        }
      })
      .finally(() => {
        if (active) setGroupsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const update = (key) => (event) => {
    setForm({ ...form, [key]: event.target.value });
    setErrors({ ...errors, [key]: "" });
  };

  const save = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    const graceMinutes = parseInt(form.grace, 10);
    if (isNaN(graceMinutes) || graceMinutes < 0 || graceMinutes > 120) {
      nextErrors.grace = "Enter 0 to 120 minutes.";
    }

    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) {
      setUser({ name: form.name.trim(), email: form.email.trim() });
      toast("Settings saved.");
    }
  };

  const resetGroupForm = () => {
    setEditingId(null);
    setGroupName("");
    setGroupMembers([]);
    setMemberQuery("");
    setMemberResults([]);
  };

  const searchMembers = async () => {
    const q = memberQuery.trim();
    if (!q) return;

    setMemberSearching(true);
    setGroupsError("");
    try {
      const data = await searchStudents({ q });
      const chosen = new Set(groupMembers.map((student) => student.id));
      setMemberResults(
        (data.students || [])
          .filter((student) => !chosen.has(student.id))
          .slice(0, 8)
      );
    } catch (err) {
      setGroupsError(err.message || "Could not search students.");
    } finally {
      setMemberSearching(false);
    }
  };

  const addMember = (student) => {
    setGroupMembers((current) =>
      current.some((row) => row.id === student.id) ? current : [...current, student]
    );
    setMemberResults([]);
    setMemberQuery("");
  };

  const removeMember = (id) => {
    setGroupMembers((current) => current.filter((row) => row.id !== id));
  };

  const startEdit = (group) => {
    setEditingId(group.id);
    setGroupName(group.name);
    setGroupMembers(group.members || []);
    setMemberQuery("");
    setMemberResults([]);
    setGroupsError("");
  };

  const saveGroup = async () => {
    const name = groupName.trim();
    if (!name) {
      setGroupsError("Give the group a name.");
      return;
    }

    const id = editingId;
    setGroupBusy(true);
    setGroupsError("");
    try {
      const payload = { name, profileIds: groupMembers.map((student) => student.id) };
      if (id) {
        await updateOfficerGroup(id, payload);
      } else {
        await createOfficerGroup(payload);
      }
      const data = await fetchOfficerGroups();
      setGroups(data.groups || []);
      resetGroupForm();
      toast(id ? "Group updated." : "Group saved.");
    } catch (err) {
      setGroupsError(err.message || "Could not save the group.");
    } finally {
      setGroupBusy(false);
    }
  };

  const removeGroup = async (group) => {
    const confirmed = window.confirm(
      `Archive the group “${group.name}”? It disappears from Settings, but a superadmin can restore it from the Archive page. Students already added to an event keep their access.`
    );
    if (!confirmed) return;

    setGroupBusy(true);
    setGroupsError("");
    try {
      await deleteOfficerGroup(group.id);
      setGroups((current) => current.filter((row) => row.id !== group.id));
      if (editingId === group.id) resetGroupForm();
      toast("Group archived.");
    } catch (err) {
      setGroupsError(err.message || "Could not archive the group.");
    } finally {
      setGroupBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Update your profile and the defaults used when you create events."
      />

      <div className="card">
        <h2>Profile</h2>
        <p>Shown in the top bar.</p>
        <div className="g">
          <Field id="name" label="Full name" error={errors.name}>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={update("name")}
              className={errors.name ? "bad" : ""}
            />
          </Field>
          <Field id="email" label="Email" error={errors.email}>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={update("email")}
              className={errors.email ? "bad" : ""}
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <h2>Event defaults</h2>
        <p>Applied to new events. You can still change them per event.</p>
        <div className="g">
          <Field
            id="grace"
            label="Default grace period (minutes)"
            error={errors.grace}
          >
            <input
              id="grace"
              type="number"
              value={form.grace}
              onChange={update("grace")}
              className={errors.grace ? "bad" : ""}
            />
          </Field>
          <Field id="mode" label="Default scanning method">
            <select id="mode" value={form.mode} onChange={update("mode")}>
              {SCAN_MODES.map(([mode]) => (
                <option key={mode}>{mode}</option>
              ))}
            </select>
          </Field>
          <Field id="qr" label="QR refresh interval">
            <input id="qr" type="text" value="30 seconds" disabled />
            <div className="hint">
              Fixed so shared screenshots expire quickly.
            </div>
          </Field>
        </div>
      </div>

      {isSuperadmin && (
        <div className="card">
          <h2>Staff accounts</h2>
          <p>
            Admins can create and edit events, students, and reports. They cannot
            archive anything; only superadmins can archive or restore. Share the
            temporary password over a secure channel.
          </p>

          <div className="g">
            <Field id="staff-name" label="Full name">
              <input
                id="staff-name"
                type="text"
                placeholder="e.g. Maria Cruz"
                value={staffForm.name}
                onChange={(event) =>
                  setStaffForm({ ...staffForm, name: event.target.value })
                }
              />
            </Field>
            <Field id="staff-email" label="Email">
              <input
                id="staff-email"
                type="email"
                placeholder="dean.cruz@laco.edu.ph"
                value={staffForm.email}
                onChange={(event) =>
                  setStaffForm({ ...staffForm, email: event.target.value })
                }
              />
            </Field>
            <Field id="staff-password" label="Temporary password">
              <input
                id="staff-password"
                type="password"
                placeholder="At least 8 characters"
                value={staffForm.password}
                onChange={(event) =>
                  setStaffForm({ ...staffForm, password: event.target.value })
                }
              />
              <div className="hint">
                There is no password-reset screen yet, so keep this somewhere safe
                until the admin signs in.
              </div>
            </Field>
          </div>

          <div className="acts" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn p"
              onClick={createStaff}
              disabled={staffBusy}
            >
              {staffBusy ? "Creating…" : "Create admin"}
            </button>
          </div>

          {staffNotice && (
            <div
              className="card"
              style={{ marginTop: 14, background: "var(--bg)", boxShadow: "none" }}
            >
              <strong>Account created.</strong> Share these credentials:
              <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8 }}>
                <div>
                  Name: <strong>{staffNotice.name}</strong>
                </div>
                <div>
                  Email: <code>{staffNotice.email}</code>
                </div>
                <div>
                  Temporary password: <code>{staffNotice.password}</code>
                </div>
              </div>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 10 }}
                onClick={() => setStaffNotice(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          {staffError && (
            <p style={{ margin: "12px 0 0", color: "#dc2626", fontSize: 13 }} role="alert">
              {staffError}
            </p>
          )}

          <div style={{ marginTop: 16 }}>
            {staffLoading ? (
              <p style={{ margin: 0, color: "var(--mu)" }}>Loading staff…</p>
            ) : (
              <DataTable
                columns={["Name", "Email", "Role", "Added"]}
                rows={staff.map((person) => [
                  person.full_name,
                  person.email || "—",
                  person.role,
                  addedLabel(person.created_at),
                ])}
                emptyMessage="No staff accounts yet."
              />
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Officer groups</h2>
        <p>
          Saved lists of student officers, for events that the same people run every
          time. Add a group to an event in one step from Create Event or the event's
          Gatekeeper access card. Members are copied at that moment, so editing a
          group later does not change events that already have access.
        </p>

        {!groupsEnabled ? (
          <p style={{ margin: 0, color: "var(--mu)" }}>
            Needs migration <code>0009_officer_groups.sql</code>.
          </p>
        ) : groupsLoading ? (
          <p style={{ margin: 0, color: "var(--mu)" }}>Loading groups…</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 240px" }}>
                <Field
                  id="group-name"
                  label={editingId ? "Group name (editing)" : "New group name"}
                >
                  <input
                    id="group-name"
                    value={groupName}
                    placeholder="e.g. SSG Officers 2026"
                    onChange={(event) => setGroupName(event.target.value)}
                  />
                </Field>
              </div>
              <div style={{ flex: "2 1 320px" }}>
                <Field id="group-search" label="Add students">
                  <input
                    id="group-search"
                    value={memberQuery}
                    placeholder="Name or school ID"
                    onChange={(event) => setMemberQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        searchMembers();
                      }
                    }}
                  />
                </Field>
              </div>
              <button
                type="button"
                className="btn"
                onClick={searchMembers}
                disabled={memberSearching || !memberQuery.trim()}
              >
                {memberSearching ? "Searching…" : "Search"}
              </button>
            </div>

            {memberResults.length > 0 && (
              <div className="orgs" style={{ marginTop: 10 }}>
                {memberResults.map((student) => (
                  <button
                    type="button"
                    className="chip"
                    key={student.id}
                    style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
                    onClick={() => addMember(student)}
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

            {groupMembers.length > 0 && (
              <div className="orgs" style={{ marginTop: 10 }}>
                {groupMembers.map((student) => (
                  <span className="chip" key={student.id}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      {student.full_name} <small>{student.school_id}</small>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: "2px 8px", fontSize: 11 }}
                        onClick={() => removeMember(student.id)}
                      >
                        Remove
                      </button>
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div className="acts" style={{ marginTop: 14 }}>
              {editingId && (
                <button type="button" className="btn" onClick={resetGroupForm}>
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="btn p"
                onClick={saveGroup}
                disabled={groupBusy}
              >
                {groupBusy ? "Saving…" : editingId ? "Save changes" : "Save group"}
              </button>
            </div>

            {groups.length === 0 ? (
              <p style={{ margin: "16px 0 0", color: "var(--mu)" }}>
                No groups saved yet.
              </p>
            ) : (
              groups.map((group) => (
                <div
                  key={group.id}
                  style={{
                    borderTop: "1px solid var(--br)",
                    marginTop: 16,
                    paddingTop: 14,
                  }}
                >
                  <div className="row" style={{ marginBottom: 8 }}>
                    <strong>{group.name}</strong>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="btn" onClick={() => startEdit(group)}>
                        Edit
                      </button>
                      {isSuperadmin && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => removeGroup(group)}
                          disabled={groupBusy}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                  {group.members?.length ? (
                    <div className="orgs">
                      {group.members.map((member) => (
                        <span className="chip" key={member.id}>
                          <span>
                            {member.full_name} <small>{member.school_id}</small>
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: "var(--mu)" }}>No members yet.</p>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {groupsError && (
          <span className="err" role="alert" style={{ display: "block", marginTop: 12 }}>
            {groupsError}
          </span>
        )}
      </div>

      <div className="acts">
        <button type="button" className="btn p" onClick={save}>
          Save changes
        </button>
      </div>
    </>
  );
}
