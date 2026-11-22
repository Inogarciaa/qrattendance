import { useCallback, useEffect, useMemo, useState } from "react";
import Avatar from "../../components/ui/Avatar";
import DataTable from "../../components/ui/DataTable";
import Field from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import { fetchActivityLog } from "../../lib/api";

const ACTIONS = [
  { id: "all", label: "All", match: () => true },
  { id: "archive", label: "Archived", match: (item) => item.action === "archive" },
  { id: "restore", label: "Restored", match: (item) => item.action === "restore" },
  {
    id: "gatekeepers",
    label: "Gatekeepers",
    match: (item) => item.action === "grant" || item.action === "revoke",
  },
  { id: "staff", label: "Staff", match: (item) => item.action === "staff_create" },
];

const ACTION_LABELS = {
  archive: "Archived",
  restore: "Restored",
  grant: "Gatekeeper added",
  revoke: "Gatekeeper removed",
  staff_create: "Staff created",
};

const ACTION_CLASSES = {
  archive: "act-archive",
  restore: "act-restore",
  grant: "act-grant",
  revoke: "act-revoke",
  staff_create: "act-staff",
};

const ENTITY_LABELS = {
  event: "event",
  student: "student",
  profile: "account",
  group: "group",
  officer_group: "officer group",
};

function whenLabel(value) {
  if (!value) return { date: "—", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: "" };
  return {
    date: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function describe(item) {
  const what = ENTITY_LABELS[item.entity] || item.entity;
  const name = item.item_label;
  if (item.action === "staff_create") {
    const who = item.meta?.name || item.item_label;
    return item.meta?.email ? `${who} · ${item.meta.email}` : who || what;
  }
  if (item.action === "grant" || item.action === "revoke") {
    const person = item.subject_name
      ? `${item.subject_name}${item.subject_school_id ? ` (${item.subject_school_id})` : ""}`
      : "gatekeeper";
    return name ? `${person} · ${what} “${name}”` : `${person} · ${what}`;
  }
  return name ? `${what.charAt(0).toUpperCase()}${what.slice(1)} “${name}”` : what;
}

export default function ActivityPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchActivityLog({ limit: 200 });
      setItems(data.items || []);
    } catch (err) {
      setItems([]);
      setError(err.message || "Could not load the activity log.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const active = ACTIONS.find((entry) => entry.id === filter) || ACTIONS[0];
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!active.match(item)) return false;
      if (!term) return true;
      const haystack = [
        ACTION_LABELS[item.action] || item.action,
        item.actor_name,
        item.item_label,
        item.subject_name,
        item.subject_school_id,
        item.meta?.email,
        item.meta?.name,
        item.entity,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [items, filter, query]);

  const rows = visible.map((item) => {
    const when = whenLabel(item.created_at);
    return [
      <span className="act-when" key="when">
        {when.date}
        <small>{when.time}</small>
      </span>,
      <span
        className={`act-tag ${ACTION_CLASSES[item.action] || "act-other"}`}
        key="action"
      >
        <span className="bg-dot" aria-hidden="true" />
        {ACTION_LABELS[item.action] || item.action}
      </span>,
      describe(item),
      item.actor_name ? (
        <span className="who" key="actor">
          <Avatar name={item.actor_name} />
          {item.actor_name}
        </span>
      ) : (
        "—"
      ),
    ];
  });

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Every archive, restore, staff account and gatekeeper change is recorded here. Only superadmins can see this page."
      />

      <div className="ev-tabs">
        {ACTIONS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={"ev-tab" + (filter === entry.id ? " active" : "")}
            onClick={() => setFilter(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="gf">
          <Field id="activity-query" label="Search activity">
            <input
              id="activity-query"
              type="text"
              placeholder="Person, event, action, or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
          <button type="button" className="btn" onClick={load} disabled={loading}>
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
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Loading activity…</p>
        ) : (
          <DataTable
            columns={["When", "Action", "Details", "By"]}
            rows={rows}
            emptyMessage={
              query.trim() || filter !== "all"
                ? "No activity matches those filters."
                : "Nothing has been archived, restored, or granted yet."
            }
          />
        )}
      </div>
    </>
  );
}
