require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "attendx-backend", time: new Date().toISOString() });
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
