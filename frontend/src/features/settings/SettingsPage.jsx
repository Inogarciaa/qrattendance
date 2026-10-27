import { useState } from "react";
import Field from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import { SCAN_MODES } from "../../lib/demo-data";

export default function SettingsPage({ user, setUser, toast }) {
  const [form, setForm] = useState({
    ...user,
    grace: "15",
    mode: SCAN_MODES[0][0],
  });
  const [errors, setErrors] = useState({});

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

      <div className="acts">
        <button type="button" className="btn p" onClick={save}>
          Save changes
        </button>
      </div>
    </>
  );
}
