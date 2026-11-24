import { useState } from "react";
import Field from "../../components/ui/Field";
import Icon from "../../components/ui/Icon";
import { login, saveSession } from "../../lib/api";

const WEB_ROLES = ["superadmin", "admin"];

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => {
    setForm({ ...form, [key]: event.target.value });
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.email.trim() || !form.password) {
      setError("Enter your email and password.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const session = await login(form.email.trim(), form.password);
      if (!WEB_ROLES.includes(session.user?.role)) {
        throw new Error(
          "This dashboard is for superadmins and admins. Use the mobile app for student and organizer accounts."
        );
      }
      saveSession(session);
      onLogin(session);
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app login-page">
      <div className="login-shell">
        <section className="login-hero">
          <div className="login-brand">
            <span className="logo">
              <Icon name="grid" />
            </span>
            <div>
              <b>LacoQR</b>
              <small>Dynamic QR Attendance</small>
            </div>
          </div>

          <h1>
            Attendance,
            <br />
            in a single scan.
          </h1>
          <p>
            Secure, rotating QR codes for every event — built for the students
            and organizers of LCCB.
          </p>

          <div className="login-badges">
            <span>Anti-proxy</span>
            <span>30s rotation</span>
            <span>Real-time</span>
          </div>
        </section>

        <section className="login-panel">
          <div className="login-card">
            <h2>Sign in</h2>
            <p className="login-sub">
              Staff access for superadmins and admins.
            </p>

            <form onSubmit={submit} noValidate>
              <Field id="login-email" label="Email address">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={update("email")}
                />
              </Field>

              <Field id="login-password" label="Password">
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={update("password")}
                />
              </Field>

              {error && (
                <div className="login-error" role="alert">
                  <Icon name="inf" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn p login-submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="login-footer">LacoQR · College of Information Technology</p>
          </div>
        </section>
      </div>
    </div>
  );
}
