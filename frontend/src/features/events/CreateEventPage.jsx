import { useEffect, useState } from "react";
import Field from "../../components/ui/Field";
import Icon from "../../components/ui/Icon";
import PageHeader from "../../components/ui/PageHeader";
import { createEvent, fetchOfficerGroups, fetchOrganizers, fetchPrograms, searchStudents } from "../../lib/api";
import { formatTime, toMinutes } from "../../lib/format";
import LocationPicker from "./LocationPicker";

const MODES = [
  {
    key: "gatekeeper",
    label: "Gatekeeper Scan Mode",
    icon: "uc",
    description:
      "Organizers scan each student's QR and verify their photo before saving.",
  },
  {
    key: "self_service",
    label: "Self-Service Scan Mode",
    icon: "mon",
    description:
      "Students scan the event QR shown on a projector or TV. Best for large venues.",
  },
  {
    key: "dual",
    label: "Dual Mode",
    icon: "lay",
    description: "Use both methods at the same time.",
  },
];

const VENUES = ["Quadrangle", "Auditorium", "Little Theater", "AVC", "Other"];

const BLANK_EVENT = {
  name: "",
  description: "",
  venue: "",
  venueOther: "",
  date: "",
  startHour: "8",
  startMinute: "00",
  startPeriod: "AM",
  endHour: "10",
  endMinute: "00",
  endPeriod: "AM",
  grace: "15",
  mode: "gatekeeper",
  programs: [],
  organizers: [],
  latitude: "",
  longitude: "",
  radius: "100",
};

/** Converts the hour/minute/period dropdown values to "HH:mm" 24h format. */
function to24h(hour, minute, period) {
  let h = parseInt(hour, 10);
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

export default function CreateEventPage({ toast }) {
  const [form, setForm] = useState(BLANK_EVENT);
  const [errors, setErrors] = useState({});
  const [created, setCreated] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState("");
  const [tempQuery, setTempQuery] = useState("");
  const [tempResults, setTempResults] = useState([]);
  const [tempSearching, setTempSearching] = useState(false);
  const [tempSelected, setTempSelected] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupChoice, setGroupChoice] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([fetchPrograms(), fetchOrganizers()])
      .then(([programData, organizerData]) => {
        if (!active) return;
        setPrograms(programData.programs || []);
        setOrganizers(organizerData.organizers || []);
      })
      .catch((err) => {
        if (active) setLoadError(err.message || "Unable to load form options.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Saved officer groups are optional, and missing until migration 0009 is
  // applied, so a failure here must not block the form.
  useEffect(() => {
    let active = true;

    fetchOfficerGroups()
      .then((data) => {
        if (active) setGroups(data.groups || []);
      })
      .catch(() => {
        if (active) setGroups([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const update = (key) => (event) => {
    setForm({ ...form, [key]: event.target.value });
    setErrors({ ...errors, [key]: "" });
  };

  const select = (key, options, placeholder) => (
    <select id={key} value={form[key]} onChange={update(key)} className={errors[key] ? "bad" : ""}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );

  const timeDropdowns = (prefix) => (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "8px" }}>
      <select value={form[`${prefix}Hour`]} onChange={update(`${prefix}Hour`)}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <select value={form[`${prefix}Minute`]} onChange={update(`${prefix}Minute`)}>
        <option value="00">00</option>
        <option value="30">30</option>
      </select>
      <select value={form[`${prefix}Period`]} onChange={update(`${prefix}Period`)}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );


  const toggle = (listKey, id) => {
    const values = form[listKey];
    setForm({
      ...form,
      [listKey]: values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    });
    setErrors({ ...errors, [listKey]: "" });
  };

  const searchTempCandidates = async () => {
    const q = tempQuery.trim();
    if (!q) return;

    setTempSearching(true);
    setSubmitError("");
    try {
      const data = await searchStudents({ q });
      const picked = new Set(tempSelected.map((student) => student.id));
      setTempResults(
        (data.students || [])
          .filter((student) => !picked.has(student.id))
          .slice(0, 8)
      );
    } catch (err) {
      setSubmitError(err.message || "Could not search students.");
    } finally {
      setTempSearching(false);
    }
  };

  const addTempOrganizer = (student) => {
    setTempSelected((current) =>
      current.some((row) => row.id === student.id) ? current : [...current, student]
    );
    setTempResults([]);
    setTempQuery("");
  };

  const removeTempOrganizer = (id) => {
    setTempSelected((current) => current.filter((row) => row.id !== id));
  };

  const addGroupMembers = () => {
    const group = groups.find((row) => row.id === groupChoice);
    if (!group) return;

    setTempSelected((current) => {
      const seen = new Set(current.map((row) => row.id));
      const additions = (group.members || []).filter((member) => !seen.has(member.id));
      return additions.length ? [...current, ...additions] : current;
    });
    setGroupChoice("");
  };

  const selfService = form.mode === "self_service";
  const needsOrganizers = !selfService;
  const needsDisplay = form.mode !== "gatekeeper";
  const graceMinutes = parseInt(form.grace, 10);

  const startTime24 = to24h(form.startHour, form.startMinute, form.startPeriod);
  const endTime24 = to24h(form.endHour, form.endMinute, form.endPeriod);

  const lateAt =
    startTime24 && graceMinutes >= 0
      ? formatTime(toMinutes(startTime24) + graceMinutes)
      : "";

  const pinLat = Number(form.latitude);
  const pinLon = Number(form.longitude);
  const pinValid =
    form.latitude.trim() !== "" &&
    form.longitude.trim() !== "" &&
    Number.isFinite(pinLat) &&
    Number.isFinite(pinLon) &&
    Math.abs(pinLat) <= 90 &&
    Math.abs(pinLon) <= 180;

  const input = (key, type = "text", placeholder) => (
    <input
      id={key}
      type={type}
      placeholder={placeholder}
      value={form[key]}
      onChange={update(key)}
      className={errors[key] ? "bad" : ""}
    />
  );

  /**
   * Fills the coordinates from the admin's own browser. This is the simplest
   * way to drop a pin: stand at the venue (or its door) and press the button.
   */
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setSubmitError("This browser cannot read your location. Enter the coordinates manually.");
      return;
    }

    setLocating(true);
    setSubmitError("");
    setLocationNote("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setForm((prev) => ({
          ...prev,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        }));
        setErrors((prev) => ({ ...prev, latitude: "", longitude: "" }));
        setLocationNote(
          Number.isFinite(accuracy)
            ? `Captured ±${Math.round(accuracy)} m. Check the pin before creating the event.`
            : "Location captured. Check the pin before creating the event."
        );
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setSubmitError(
          error?.code === error?.PERMISSION_DENIED
            ? "Location permission was denied. Enter the coordinates manually."
            : "Could not read your location. Enter the coordinates manually."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  /** Removes the fence entirely so this event has no location check. */
  const clearPin = () => {
    setForm((prev) => ({ ...prev, latitude: "", longitude: "" }));
    setErrors((prev) => ({ ...prev, latitude: "", longitude: "" }));
    setLocationNote("");
  };

  const submit = async () => {    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Enter the event name.";
    if (!form.venue.trim()) nextErrors.venue = "Select the venue.";
    if (form.venue === "Other" && !form.venueOther.trim()) nextErrors.venueOther = "Enter the custom venue name.";
    if (!form.date) nextErrors.date = "Choose the event date.";
    
    if (endTime24 <= startTime24) {
      nextErrors.end = "End time must be after the start time.";
    }
    if (isNaN(graceMinutes) || graceMinutes < 0 || graceMinutes > 120) {
      nextErrors.grace = "Enter 0 to 120 minutes.";
    }

    const hasLat = form.latitude.trim() !== "";
    const hasLon = form.longitude.trim() !== "";
    if (hasLat !== hasLon) {
      nextErrors.latitude = "Enter both coordinates, or leave both empty.";
      nextErrors.longitude = "Enter both coordinates, or leave both empty.";
    } else if (hasLat) {
      const latitude = Number(form.latitude);
      const longitude = Number(form.longitude);
      const radius = Number(form.radius);
      if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) {
        nextErrors.latitude = "Latitude must be between -90 and 90.";
      }
      if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) {
        nextErrors.longitude = "Longitude must be between -180 and 180.";
      }
      if (form.radius.trim() === "" || !Number.isFinite(radius) || radius < 25 || radius > 1000) {
        nextErrors.radius = "Enter 25 to 1000 metres.";
      }
    }

    if (!form.programs.length) {
      nextErrors.programs = "Select at least one program that will attend.";
    }
    if (needsOrganizers && !form.organizers.length && !tempSelected.length) {
      nextErrors.organizers = "Add at least one organizer or temporary organizer.";
    }

    setErrors(nextErrors);
    setSubmitError("");
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      const { event } = await createEvent({
        name: form.name.trim(),
        description: form.description.trim(),
        venue: form.venue === "Other" ? form.venueOther.trim() : form.venue.trim(),
        event_date: form.date,
        start_time: startTime24,
        end_time: endTime24,
        grace_minutes: graceMinutes,
        scan_mode: form.mode,
        program_ids: form.programs,
        organizer_ids: needsOrganizers ? form.organizers : [],
        temp_organizer_ids: needsOrganizers
          ? tempSelected.map((student) => student.id)
          : [],
        ...(hasLat
          ? {
              latitude: Number(form.latitude),
              longitude: Number(form.longitude),
              geofence_radius_m: Math.round(Number(form.radius)),
            }
          : {}),
      });
      setCreated(event);
      toast?.("Event created.");
    } catch (err) {
      setSubmitError(err.message || "Unable to create the event.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setForm(BLANK_EVENT);
    setErrors({});
    setSubmitError("");
    setLocationNote("");
    setCreated(null);
    setTempQuery("");
    setTempResults([]);
    setTempSelected([]);
  };

  if (created) {
    const formattedDate = new Date(form.date + "T00:00").toLocaleDateString(
      "en-PH",
      { weekday: "long", year: "numeric", month: "long", day: "numeric" }
    );
    const selectedPrograms = programs
      .filter((program) => form.programs.includes(program.id))
      .map((program) => program.code)
      .join(", ");
    const selectedOrganizers = organizers
      .filter((organizer) => form.organizers.includes(organizer.id))
      .map((organizer) => organizer.full_name)
      .join(", ");
    const modeLabel = MODES.find((mode) => mode.key === form.mode)?.label;

    const summaryRows = [
      ["Event", form.name.trim()],
      ["Venue", form.venue.trim()],
      ["Date", formattedDate],
      ["Time", `${formatTime(toMinutes(form.start))} – ${formatTime(toMinutes(form.end))}`],
      ["Late after", lateAt],
      ["Scanning method", modeLabel],
      ["Students", selectedPrograms],
    ];
    if (needsOrganizers) {
      summaryRows.push([
        "Organizers",
        selectedOrganizers || "None — temporary organizers only",
      ]);
    }
    if (tempSelected.length) {
      summaryRows.push([
        "Temporary organizers",
        tempSelected.map((student) => student.full_name).join(", "),
      ]);
    }
    if (form.latitude.trim() && form.longitude.trim()) {
      summaryRows.push(["Venue fence", `${form.radius} m radius`]);
    }

    return (
      <div className="card done" aria-live="polite">
        <div className="ok">
          <Icon name="chk" />
        </div>
        <h2 style={{ fontSize: 18 }}>Event created</h2>
        <p style={{ margin: "4px 0 0" }}>
          {form.mode === "gatekeeper"
            ? "Your organizers can start scanning when the event opens."
            : "Open the display terminal on the venue screen when the event starts."}
        </p>
        <dl className="sum">
          {summaryRows.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="btn p" onClick={reset}>
          Create another event
        </button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Create Event"
        description="Set up an event, choose which students attend, and how they will check in."
      />

      {loadError && (
        <div className="card">
          <div className="login-error" role="alert">
            <Icon name="inf" />
            <span>{loadError}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div className="kpi-icon" style={{ width: 36, height: 36, background: "var(--brand-light)", color: "var(--brand)", borderRadius: 10 }}>
            <Icon name="cal" size={18} />
          </div>
          <div>
            <h2>Event details</h2>
            <p style={{ margin: 0 }}>What students will see for this event.</p>
          </div>
        </div>
        <div className="g" style={{ marginTop: 20 }}>
          <Field id="name" label="Event name" required error={errors.name} full>
            {input("name", "text", "e.g. Cybersecurity Awareness Seminar")}
          </Field>
          <Field id="description" label="Description" full>
            <textarea
              id="description"
              placeholder="Short summary of the event"
              value={form.description}
              onChange={update("description")}
              rows={3}
            />
          </Field>
          <Field id="venue" label="Venue" required error={errors.venue} full>
            {select("venue", VENUES, "Select a venue")}
          </Field>
          {form.venue === "Other" && (
            <Field id="venueOther" label="Other venue name" required error={errors.venueOther} full>
              {input("venueOther", "text", "Enter venue name")}
            </Field>
          )}
          <Field id="date" label="Date" required error={errors.date}>
            {input("date", "date")}
          </Field>
          <div />
          <Field id="start" label="Start time" required error={errors.start}>
            {timeDropdowns("start")}
          </Field>
          <Field id="end" label="End time" required error={errors.end}>
            {timeDropdowns("end")}
          </Field>
        </div>
      </div>

      <div className="card">
        <h2>Venue location</h2>
        <p>
          Optional. When set, a student who checks in by scanning the event QR must
          be within this radius of the venue. Organizers scanning student codes are
          never blocked by location.
        </p>

        <LocationPicker
          latitude={pinValid ? pinLat : null}
          longitude={pinValid ? pinLon : null}
          radius={Number(form.radius) || 100}
          onChange={({ latitude, longitude }) => {
            setForm((prev) => ({
              ...prev,
              latitude: latitude.toFixed(6),
              longitude: longitude.toFixed(6),
            }));
            setErrors((prev) => ({ ...prev, latitude: "", longitude: "" }));
            setLocationNote("");
          }}
        />

        <div className="location-actions">
          <button type="button" className="btn" onClick={useMyLocation} disabled={locating}>
            <Icon name="pin" />
            {locating ? "Getting your location…" : "Use my current location"}
          </button>
          {pinValid && (
            <button type="button" className="btn" onClick={clearPin}>
              Clear pin
            </button>
          )}
        </div>

        <div className="g" style={{ marginTop: 16 }}>
          <Field id="latitude" label="Latitude" error={errors.latitude}>
            {input("latitude", "number", "e.g. 8.485700")}
          </Field>
          <Field id="longitude" label="Longitude" error={errors.longitude}>
            {input("longitude", "number", "e.g. 124.639300")}
          </Field>
          <Field id="radius" label="Radius (metres)" error={errors.radius}>
            {input("radius", "number", "100")}
          </Field>
        </div>

        {pinValid && (
          <div className="hint">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${pinLat},${pinLon}`}
              target="_blank"
              rel="noreferrer"
            >
              Check the pin in Google Maps
            </a>
            {locationNote ? ` — ${locationNote}` : ""}
          </div>
        )}
        {!pinValid && locationNote ? <div className="hint">{locationNote}</div> : null}
        <div className="hint">
          Drag the pin for fine tuning, or type the coordinates. Map tiles come from
          OpenStreetMap, so the map needs an internet connection. Leave both
          coordinates empty to skip the location check. Accuracy indoors is often
          30–50 m, so keep the radius comfortable — 100 m suits most campus venues.
        </div>
      </div>

      <div className="card">
        <h2>Who attends</h2>
        <p>Pick the programs whose students are expected at this event.</p>
        {loading ? (
          <p style={{ margin: 0, color: "var(--mu)" }}>Loading programs…</p>
        ) : programs.length === 0 ? (
          <p style={{ margin: 0, color: "var(--mu)" }}>
            No programs found. Add programs in Supabase first.
          </p>
        ) : (
          <div className="orgs">
            {programs.map((program) => (
              <label className="chip" key={program.id}>
                <input
                  type="checkbox"
                  checked={form.programs.includes(program.id)}
                  onChange={() => toggle("programs", program.id)}
                />
                <span>
                  {program.code} <small>{program.name}</small>
                </span>
              </label>
            ))}
          </div>
        )}
        {errors.programs && (
          <span className="err" role="alert">
            {errors.programs}
          </span>
        )}
      </div>

      <div className="card">
        <h2>Late arrival rule</h2>
        <p>Students who scan after the grace period are recorded as Late.</p>
        <div style={{ maxWidth: 260 }}>
          <Field id="grace" label="Grace period (minutes)" error={errors.grace}>
            {input("grace", "number")}
          </Field>
        </div>
        <div className="hint">
          {lateAt
            ? `Scans after ${lateAt} will be marked Late.`
            : "Set a start time to see when Late begins."}
        </div>
      </div>

      <div className="card">
        <h2>Scanning method</h2>
        <p>Choose how attendance is captured at this venue.</p>
        <div className="modes" role="radiogroup" aria-label="Scanning method">
          {MODES.map(({ key, label, icon, description }) => (
            <label className="mode" key={key}>
              <input
                type="radio"
                name="mode"
                checked={form.mode === key}
                onChange={() => setForm({ ...form, mode: key })}
              />
              <span className="box">
                <Icon name={icon} />
                <b>{label}</b>
                <span>{description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {needsOrganizers && (
        <div className="card">
          <h2>Assign organizers</h2>
          <p>
            Optional. Student officers who have a permanent organizer account and will
            act as gatekeepers, for every event they are assigned to. Skip this if a
            temporary organizer below will run the scanner — you need at least one of
            the two.
          </p>
          {loading ? (
            <p style={{ margin: 0, color: "var(--mu)" }}>Loading organizers…</p>
          ) : organizers.length === 0 ? (
            <p style={{ margin: 0, color: "var(--mu)" }}>
              No organizer accounts exist. Use a temporary organizer below.
            </p>
          ) : (
            <div className="orgs">
              {organizers.map((organizer) => (
                <label className="chip" key={organizer.id}>
                  <input
                    type="checkbox"
                    checked={form.organizers.includes(organizer.id)}
                    onChange={() => toggle("organizers", organizer.id)}
                  />
                  <span>
                    {organizer.full_name}{" "}
                    <small>{organizer.program?.code || "Organizer"}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
          {errors.organizers && (
            <span className="err" role="alert">
              {errors.organizers}
            </span>
          )}
        </div>
      )}

      {needsOrganizers && (
        <div className="card">
          <h2>Temporary organizers</h2>
          <p>
            A student who runs the scanner for this event only. They keep their student
            account, personal QR and history, so this suits council officers handling a
            single event. Access ends one hour after the event and can be revoked at any
            time.
          </p>

          {groups.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "flex-end",
                marginBottom: 12,
              }}
            >
              <div style={{ flex: "1 1 260px" }}>
                <Field id="temp-group" label="Add a saved group">
                  <select
                    id="temp-group"
                    value={groupChoice}
                    onChange={(event) => setGroupChoice(event.target.value)}
                  >
                    <option value="">Select a group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.members?.length || 0})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <button
                type="button"
                className="btn"
                onClick={addGroupMembers}
                disabled={!groupChoice}
              >
                Add group
              </button>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div style={{ flex: "1 1 260px" }}>
              <Field id="temp-search" label="Find a student">
                <input
                  id="temp-search"
                  value={tempQuery}
                  placeholder="Name or school ID"
                  onChange={(event) => setTempQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      searchTempCandidates();
                    }
                  }}
                />
              </Field>
            </div>
            <button
              type="button"
              className="btn"
              onClick={searchTempCandidates}
              disabled={tempSearching || !tempQuery.trim()}
            >
              {tempSearching ? "Searching…" : "Search"}
            </button>
          </div>

          {tempResults.length > 0 && (
            <div className="orgs" style={{ marginTop: 10 }}>
              {tempResults.map((student) => (
                <button
                  type="button"
                  className="chip"
                  key={student.id}
                  style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
                  onClick={() => addTempOrganizer(student)}
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

          {tempSelected.length > 0 && (
            <div className="orgs" style={{ marginTop: 10 }}>
              {tempSelected.map((student) => (
                <span className="chip" key={student.id}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {student.full_name} <small>{student.school_id}</small>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "2px 8px", fontSize: 11 }}
                      onClick={() => removeTempOrganizer(student.id)}
                    >
                      Remove
                    </button>
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {needsDisplay && (
        <div className="card">
          <div className="note">
            <Icon name="inf" />
            <div>
              The live display terminal unlocks after you create the event. Open
              it on a projector or TV and the QR code will refresh every 30
              seconds.
            </div>
          </div>
        </div>
      )}

      {submitError && (
        <div className="card">
          <div className="login-error" role="alert">
            <Icon name="inf" />
            <span>{submitError}</span>
          </div>
        </div>
      )}

      <div className="acts">
        <button type="button" className="btn" onClick={reset}>
          Cancel
        </button>
        <button
          type="button"
          className="btn p"
          onClick={submit}
          disabled={busy || loading}
        >
          {busy ? "Creating…" : "Create event"}
        </button>
      </div>
    </>
  );
}
