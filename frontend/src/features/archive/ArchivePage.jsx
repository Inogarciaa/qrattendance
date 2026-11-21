import { useCallback, useEffect, useState } from "react";
import Avatar from "../../components/ui/Avatar";
import DataTable from "../../components/ui/DataTable";
import Field from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import { fetchArchive, restoreEntity } from "../../lib/api";

const TABS = [
  { id: "events", label: "Events", entity: "events" },
  { id: "students", label: "Students", entity: "students" },
  { id: "groups", label: "Officer groups", entity: "groups" },
];

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
  const [hours, minutes] = String(value).split(":");
  const hour = Number(hours);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minutes || "00").padStart(2, "0")} ${suffix}`;
}

function archivedLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventDetail(item) {
  const when = [dateLabel(item.event_date), timeLabel(item.start_time)].join(" · ");
  return item.venue ? `${when} · ${item.venue}` : when;
}

function studentDetail(item) {
  return [item.school_id, item.email].filter(Boolean).join(" · ") || "—";
}

function groupDetail(item) {
  return item.note || "Saved officer group";
}

export default function ArchivePage({ toast }) {
  const [tab, setTab] = useState(TABS[0]);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async (entity, search = "") => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchArchive(entity, search);
      setItems(data.items || []);
    } catch (err) {
      setItems([]);
      setError(err.message || "Could not load archived items.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab.entity, "");
  }, [tab.entity, load]);

  const changeTab = (next) => {
    if (next.id === tab.id) return;
    setTab(next);
    setQuery("");
  };

  const restore = async (item) => {
    const name = item.name || item.full_name || "this item";
    const confirmed = window.confirm(
      `Restore “${name}”? It will be available again everywhere it was hidden.`
    );
    if (!confirmed) return;

    setBusyId(item.id);
    setError("");
    try {
      await restoreEntity(tab.entity, item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      toast?.(`${name} restored.`);
    } catch (err) {
      setError(err.message || "Could not restore this item.");
    } finally {
      setBusyId("");
    }
  };

  const restoreButton = (item) => (
    <button
      type="button"
      className="btn p"
      style={{ padding: "6px 12px", fontSize: 12 }}
      onClick={() => restore(item)}
      disabled={busyId === item.id}
    >
      {busyId === item.id ? "Restoring…" : "Restore"}
    </button>
  );

  const columns =
    tab.entity === "events"
      ? ["Event", "When", "Archived", "By", ""]
      : tab.entity === "students"
        ? ["Student", "ID · Email", "Archived", "By", ""]
        : ["Group", "Note", "Archived", "By", ""];

  const rows = items.map((item) => {
    if (tab.entity === "events") {
      return [
        <strong key="name">{item.name}</strong>,
        eventDetail(item),
        archivedLabel(item.deleted_at),
        item.deleted_by_name || "—",
        restoreButton(item),
      ];
    }

    if (tab.entity === "students") {
      return [
        <span className="who" key="name">
          <Avatar name={item.full_name} />
          {item.full_name}
        </span>,
        studentDetail(item),
        archivedLabel(item.deleted_at),
        item.deleted_by_name || "—",
        restoreButton(item),
      ];
    }

    return [
      <strong key="name">{item.name}</strong>,
      groupDetail(item),
      archivedLabel(item.deleted_at),
      item.deleted_by_name || "—",
      restoreButton(item),
    ];
  });

  return (
    <>
      <PageHeader
        title="Archive"
        description="Archived items are hidden everywhere but never deleted. Restore anything here to make it available again."
      />

      <div className="ev-tabs">
        {TABS.map((next) => (
          <button
            key={next.id}
            type="button"
            className={"ev-tab" + (tab.id === next.id ? " active" : "")}
            onClick={() => changeTab(next)}
          >
            {next.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div
          className="gf"
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target.tagName === "INPUT") {
              load(tab.entity, query);
            }
          }}
        >
          <Field
            id="archive-query"
            label={
              tab.entity === "events"
                ? "Search events"
                : tab.entity === "students"
                  ? "Search students"
                  : "Search groups"
            }
          >
            <input
              id="archive-query"
              type="text"
              placeholder={
                tab.entity === "events"
                  ? "Event name"
                  : tab.entity === "students"
                    ? "Name, school ID, or email"
                    : "Group name"
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
          <button
            type="button"
            className="btn"
            onClick={() => load(tab.entity, query)}
            disabled={loading}
          >
            {loading ? "Searching…" : "Search"}
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
          <p style={{ margin: 0, color: "var(--mu)" }}>Loading archived items…</p>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            emptyMessage={
              query.trim()
                ? "Nothing archived matches that search."
                : `No archived ${tab.label.toLowerCase()}. Items only appear here after a superadmin archives them.`
            }
          />
        )}
      </div>
    </>
  );
}
