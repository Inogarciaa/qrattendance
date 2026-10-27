import { useState } from "react";
import Field from "../../components/ui/Field";
import Icon from "../../components/ui/Icon";
import PageHeader from "../../components/ui/PageHeader";
import { SCAN_MODES, STUDENTS } from "../../lib/demo-data";
import { formatTime, toMinutes } from "../../lib/format";

const BLANK_EVENT = {
  name: "",
  description: "",
  venue: "",
  date: "",
  start: "",
  end: "",
  grace: "15",
  mode: SCAN_MODES[0][0],
  organizers: [],
};

export default function CreateEventPage() {
  const [form, setForm] = useState(BLANK_EVENT);
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);

  const update = (key) => (event) => {
    setForm({ ...form, [key]: event.target.value });
    setErrors({ ...errors, [key]: "" });
  };

  const selfService = form.mode === SCAN_MODES[1][0];
  const gatekeeper = !selfService;
  const needsDisplay = form.mode !== SCAN_MODES[0][0];
  const graceMinutes = parseInt(form.grace, 10);
  const lateAt =
    form.start && graceMinutes >= 0
      ? formatTime(toMinutes(form.start) + graceMinutes)
      : "";

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

  const toggleOrganizer = (name) => {
    setForm({
      ...form,
      organizers: form.organizers.includes(name)
        ? form.organizers.filter((item) => item !== name)
        : [...form.organizers, name],
    });
    setErrors({ ...errors, organizers: "" });
  };

  const submit = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Enter the event name.";
    if (!form.venue.trim()) nextErrors.venue = "Enter the venue.";
    if (!form.date) nextErrors.date = "Choose the event date.";
    if (!form.start) nextErrors.start = "Choose a start time.";
    if (!form.end) {
      nextErrors.end = "Choose an end time.";
    } else if (form.start && form.end <= form.start) {
      nextErrors.end = "End time must be after the start time.";
    }
    if (isNaN(graceMinutes) || graceMinutes < 0 || graceMinutes > 120) {
      nextErrors.grace = "Enter 0 to 120 minutes.";
    }
    if (gatekeeper && !form.organizers.length) {
      nextErrors.organizers = "Select at least one organizer.";
    }

    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) setDone(true);
  };

  if (done) {
    const formattedDate = new Date(form.date + "T00:00").toLocaleDateString(
      "en-PH",
      { weekday: "long", year: "numeric", month: "long", day: "numeric" }
    );
    const summaryRows = [
      ["Event", form.name.trim()],
      ["Venue", form.venue.trim()],
      ["Date", formattedDate],
      ["Time", `${formatTime(toMinutes(form.start))} – ${formatTime(toMinutes(form.end))}`],
      ["Late after", lateAt],
      ["Scanning method", form.mode],
    ];
    if (gatekeeper) summaryRows.push(["Organizers", form.organizers.join(", ")]);

    return (
      <div className="card done" aria-live="polite">
        <div className="ok">
          <Icon name="chk" />
        </div>
        <h2 style={{ fontSize: 18 }}>Event created</h2>
        <p style={{ margin: "4px 0 0" }}>
          {form.mode === SCAN_MODES[0][0]
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
        <button
          type="button"
          className="btn p"
          onClick={() => {
            setForm(BLANK_EVENT);
            setErrors({});
            setDone(false);
          }}
        >
          Create another event
        </button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Create Event"
        description="Set up an event, its late-arrival rule, and how students will check in."
      />

      <div className="card">
        <h2>Event details</h2>
        <p>What students will see for this event.</p>
        <div className="g">
          <Field id="name" label="Event name" required error={errors.name} full>
            {input("name", "text", "e.g. Cybersecurity Awareness Seminar")}
          </Field>
          <Field id="description" label="Description" full>
            <textarea
              id="description"
              placeholder="Short summary of the event"
              value={form.description}
              onChange={update("description")}
            />
          </Field>
          <Field id="venue" label="Venue" required error={errors.venue} full>
            {input("venue", "text", "e.g. LCC Auditorium")}
          </Field>
          <Field id="date" label="Date" required error={errors.date}>
            {input("date", "date")}
          </Field>
          <div />
          <Field id="start" label="Start time" required error={errors.start}>
            {input("start", "time")}
          </Field>
          <Field id="end" label="End time" required error={errors.end}>
            {input("end", "time")}
          </Field>
        </div>
      </div>

      <div className="card">
        <h2>Late arrival rule</h2>
        <p>Students who scan after the grace period are recorded as Late.</p>
        <div style={{ maxWidth: 260 }}>
          <Field
            id="grace"
            label="Grace period (minutes)"
            error={errors.grace}
          >
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
          {SCAN_MODES.map(([mode, icon, description]) => (
            <label className="mode" key={mode}>
              <input
                type="radio"
                name="mode"
                checked={form.mode === mode}
                onChange={() => setForm({ ...form, mode })}
              />
              <span className="box">
                <Icon name={icon} />
                <b>{mode}</b>
                <span>{description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {gatekeeper && (
        <div className="card">
          <h2>Assign organizers</h2>
          <p>
            Student officers who will act as gatekeepers. Pick at least one.
          </p>
          <div className="orgs">
            {STUDENTS.slice(0, 6).map((student) => (
              <label className="chip" key={student.id}>
                <input
                  type="checkbox"
                  checked={form.organizers.includes(student.name)}
                  onChange={() => toggleOrganizer(student.name)}
                />
                <span>
                  {student.name} <small>{student.program}</small>
                </span>
              </label>
            ))}
          </div>
          {errors.organizers && (
            <span className="err" role="alert">
              {errors.organizers}
            </span>
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

      <div className="acts">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setForm(BLANK_EVENT);
            setErrors({});
          }}
        >
          Cancel
        </button>
        <button type="button" className="btn p" onClick={submit}>
          Create event
        </button>
      </div>
    </>
  );
}
