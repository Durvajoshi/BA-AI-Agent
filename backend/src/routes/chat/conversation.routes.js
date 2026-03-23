const express = require("express");
const router = express.Router();
const {
  createConversationController,
  getConversationsController,
  updateTitleController,
  pinConversationController,
  deleteConversationController
} = require("../../controllers/chat/conversation.controller");

router.post("/conversation", createConversationController);
router.get("/conversations", getConversationsController);
router.put("/conversation/:id/title", updateTitleController);
router.put("/conversation/:id/pin", pinConversationController);
router.delete("/conversation/:id", deleteConversationController);

module.exports = router;
