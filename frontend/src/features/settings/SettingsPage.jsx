import { useEffect, useState } from "react";
import Field from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import { SCAN_MODES } from "../../lib/demo-data";
import {
  createOfficerGroup,
  deleteOfficerGroup,
  fetchOfficerGroups,
  searchStudents,
  updateOfficerGroup,
} from "../../lib/api";

export default function SettingsPage({ user, setUser, toast }) {
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
      `Delete the group “${group.name}”? Students already added to an event keep their access.`
    );
    if (!confirmed) return;

    setGroupBusy(true);
    setGroupsError("");
    try {
      await deleteOfficerGroup(group.id);
      setGroups((current) => current.filter((row) => row.id !== group.id));
      if (editingId === group.id) resetGroupForm();
      toast("Group deleted.");
    } catch (err) {
      setGroupsError(err.message || "Could not delete the group.");
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
                      <button
                        type="button"
                        className="btn"
                        onClick={() => removeGroup(group)}
                        disabled={groupBusy}
                      >
                        Delete
                      </button>
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
