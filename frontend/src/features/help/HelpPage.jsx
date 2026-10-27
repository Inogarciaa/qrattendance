import { useState } from "react";
import Field from "../../components/ui/Field";
import Icon from "../../components/ui/Icon";
import PageHeader from "../../components/ui/PageHeader";

const TOPICS = [
  "Dynamic QR codes",
  "Gatekeeper scanning",
  "Reports and exports",
  "Account",
];

export default function HelpPage() {
  const [form, setForm] = useState({ topic: TOPICS[0], message: "" });
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const send = () => {
    if (!form.message.trim()) {
      setError("Describe what you need help with.");
      return;
    }
    setSent(true);
  };

  return (
    <>
      <PageHeader
        title="Help"
        description="Find a quick answer or send a request to support."
      />

      <div className="card">
        <h2>Common questions</h2>
        <details>
          <summary>Why does the student QR code keep changing?</summary>
          <p>
            It refreshes every 30 seconds, so a screenshot shared with a friend
            stops working almost immediately.
          </p>
        </details>
        <details>
          <summary>What does the organizer see after scanning?</summary>
          <p>
            The student's photo, full name, ID number and program. The organizer
            compares them with the person in front of them, then confirms or
            cancels.
          </p>
        </details>
        <details>
          <summary>When is a student marked Late?</summary>
          <p>
            Anyone who scans after the event's start time plus its grace period.
          </p>
        </details>
      </div>

      {sent ? (
        <div className="card done" aria-live="polite">
          <div className="ok">
            <Icon name="chk" />
          </div>
          <h2>Request sent</h2>
          <p style={{ margin: "4px 0 16px" }}>
            We'll reply to your email about "{form.topic}".
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSent(false);
              setForm({ ...form, message: "" });
            }}
          >
            Send another request
          </button>
        </div>
      ) : (
        <div className="card">
          <h2>Contact support</h2>
          <p>Tell us what's going wrong.</p>
          <div className="g">
            <Field id="topic" label="Topic" full>
              <select
                id="topic"
                value={form.topic}
                onChange={(event) =>
                  setForm({ ...form, topic: event.target.value })
                }
              >
                {TOPICS.map((topic) => (
                  <option key={topic}>{topic}</option>
                ))}
              </select>
            </Field>
            <Field id="message" label="Message" required error={error} full>
              <textarea
                id="message"
                className={error ? "bad" : ""}
                value={form.message}
                onChange={(event) => {
                  setForm({ ...form, message: event.target.value });
                  setError("");
                }}
              />
            </Field>
          </div>
          <div className="acts" style={{ marginTop: 16 }}>
            <button type="button" className="btn p" onClick={send}>
              Send request
            </button>
          </div>
        </div>
      )}
    </>
  );
}
