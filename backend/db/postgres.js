const { Pool } = require("pg");

require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "ai_ba_agent",
  password: process.env.DB_PASSWORD || "seaneb2212",
  port: process.env.DB_PORT || 5432,
});

// If a pooled client errors while idle and there's no listener, Node will treat it as an unhandled 'error' event
// and can terminate the process. Always attach an error handler.
pool.on("error", (err) => {
  console.error("Postgres pool error (idle client):", err);
});

module.exports = pool;
