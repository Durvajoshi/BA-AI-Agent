const express = require("express");
const router = express.Router();
const {
  sendMessageController,
  freeTierStatusController
} = require("../../controllers/chat/message.controller");
const { getMessagesController } = require("../../controllers/chat/conversation.controller");

router.get("/conversation/:id/messages", getMessagesController);
router.post("/message", sendMessageController);
router.get("/free-tier-status", freeTierStatusController);

module.exports = router;
