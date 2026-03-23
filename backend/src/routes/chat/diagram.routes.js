const express = require("express");
const router = express.Router();
const {
  activityDiagramController,
  generatePrototypeController
} = require("../../controllers/chat/diagram.controller");

router.get("/conversation/:id/activity-diagram", activityDiagramController);
router.post("/conversation/:id/generate-prototype", generatePrototypeController);

module.exports = router;
