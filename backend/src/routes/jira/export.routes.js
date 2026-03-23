const express = require("express");
const router = express.Router();
const authMiddleware = require("../../../middleware/auth.middleware");
const { jiraExportController } = require("../../controllers/jira/export.controller");

router.post("/export/:conversationId", authMiddleware, jiraExportController);

module.exports = router;
