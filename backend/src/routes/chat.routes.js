const express = require("express");
const router = express.Router();

const conversationRoutes = require("./chat/conversation.routes");
const messageRoutes = require("./chat/message.routes");
const diagramRoutes = require("./chat/diagram.routes");
const documentRoutes = require("./chat/document.routes");
const versionRoutes = require("./chat/version.routes");

router.use(conversationRoutes);
router.use(messageRoutes);
router.use(diagramRoutes);
router.use(documentRoutes);
router.use(versionRoutes);

module.exports = router;
