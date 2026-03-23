const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const chatRoutes = require("./routes/chat.routes");
const jiraRoutes = require("./routes/jira.routes");
const authMiddleware = require("../middleware/auth.middleware");
const pool = require("../db/postgres");


const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/jira", authMiddleware, jiraRoutes);
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

module.exports = app;
