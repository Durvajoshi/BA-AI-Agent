const express = require("express");
const router = express.Router();

const statusRoutes = require("./jira/status.routes");
const exportRoutes = require("./jira/export.routes");

router.use(statusRoutes);
router.use(exportRoutes);

module.exports = router;
