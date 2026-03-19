require('dotenv').config();
const pool = require("./db/postgres");
const runMigrations = require("./db/migrate");
const express = require("express");
const cors = require("cors");
const chatRoutes = require("./routes/chat.routes");
const jiraRoutes = require('./routes/jira.routes');
const authRoutes = require('./routes/auth.routes');
const authMiddleware = require('./middleware/auth.middleware');
const fs = require("fs");
const path = require("path");

function appendCrashLog(line) {
  try {
    const logsDir = path.join(__dirname, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(path.join(logsDir, "backend-crash.log"), line + "\n", "utf8");
  } catch (_) {
    // best-effort only
  }
}

function formatErr(err) {
  if (!err) return "Unknown error";
  if (err instanceof Error) return `${err.stack || err.message}`;
  try {
    return JSON.stringify(err);
  } catch (_) {
    return String(err);
  }
}

process.on("uncaughtException", (err) => {
  const msg = `[${new Date().toISOString()}] uncaughtException: ${formatErr(err)}`;
  console.error(msg);
  appendCrashLog(msg);
});

process.on("unhandledRejection", (reason) => {
  const msg = `[${new Date().toISOString()}] unhandledRejection: ${formatErr(reason)}`;
  console.error(msg);
  appendCrashLog(msg);
});

process.on("exit", (code) => {
  appendCrashLog(`[${new Date().toISOString()}] process exit: ${code}`);
});

["SIGINT", "SIGTERM", "SIGHUP"].forEach((sig) => {
  process.on(sig, () => {
    appendCrashLog(`[${new Date().toISOString()}] received signal: ${sig}`);
    process.exit(0);
  });
});

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/jira', authMiddleware, jiraRoutes);
app.use("/api/chat", authMiddleware, chatRoutes);

app.get("/db-test", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json(result.rows[0]);
});

app.get("/health", (req, res) => {
  res.json({ status: "Backend running" });
});

// 404 handler for debugging
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: "Not Found" });
});

// Run migrations before starting the server
runMigrations()
  .then(() => {
    const PORT = 5000;
    const server = app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
    server.on("error", (err) => {
      const msg = `[${new Date().toISOString()}] server error: ${formatErr(err)}`;
      console.error(msg);
      appendCrashLog(msg);
    });
  })
  .catch(err => {
    console.error("Failed to run migrations:", err);
    process.exit(1);
  });
