require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Live dashboards poll these endpoints; a cached (304) response would show
// stale attendance. Express' default ETag makes that happen, so disable it and
// tell browsers/proxies never to store API responses.
app.set("etag", false);
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, max-age=0");
  next();
});

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "lacoqr-backend", time: new Date().toISOString() });
});

app.get("/api/health", async (req, res) => {
  const { isLocalMode } = require("./lib/mode");
  const payload = {
    status: "ok",
    mode: isLocalMode ? "local" : "supabase",
    database: isLocalMode ? "local-db.json" : "unknown",
    time: new Date().toISOString(),
  };

  if (isLocalMode) return res.json(payload);

  payload.supabase_url = process.env.SUPABASE_URL;
  try {
    const { admin } = require("./lib/supabase");
    const { error } = await admin.from("programs").select("id").limit(1);
    if (error) {
      payload.status = "degraded";
      payload.database = "schema-missing-or-unreachable";
      payload.error = error.message;
      return res.status(503).json(payload);
    }
    payload.database = "ok";
    return res.json(payload);
  } catch (err) {
    payload.status = "degraded";
    payload.database = "unreachable";
    payload.error = err.message;
    return res.status(503).json(payload);
  }
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/tokens", require("./routes/tokens"));
app.use("/api/scan", require("./routes/scan"));
app.use("/api/events", require("./routes/events"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/programs", require("./routes/programs"));

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
