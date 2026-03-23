const express = require("express");
const router = express.Router();
const {
  generatePRDController,
  generateBRDController,
  cleanupConversationsController
} = require("../../controllers/chat/document.controller");

router.post("/cleanup-empty-conversations", cleanupConversationsController);
router.post("/conversation/:id/generate-prd", generatePRDController);
router.post("/conversation/:id/generate-brd", generateBRDController);

module.exports = router;
