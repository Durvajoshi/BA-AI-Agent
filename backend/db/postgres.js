const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "ai_ba_agent",
  password: "seaneb2212",
  port: 5432,
});

// If a pooled client errors while idle and there's no listener, Node will treat it as an unhandled 'error' event
// and can terminate the process. Always attach an error handler.
pool.on("error", (err) => {
  console.error("Postgres pool error (idle client):", err);
});

module.exports = pool;
