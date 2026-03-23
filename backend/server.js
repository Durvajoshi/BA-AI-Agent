require('dotenv').config();
const runMigrations = require("./db/migrate");
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

const app = require("./src/app");


// Run migrations before starting the server
runMigrations()
  .then(() => {
    const PORT = process.env.PORT || 5000;
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
