const express = require("express");
const router = express.Router();
const authMiddleware = require("../../../middleware/auth.middleware");
const { jiraStatusController } = require("../../controllers/jira/status.controller");

router.get("/status/:conversationId", authMiddleware, jiraStatusController);

module.exports = router;
