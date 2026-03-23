const express = require("express");
const router = express.Router();
const { getVersionsController } = require("../../controllers/chat/version.controller");

router.get("/conversation/:id/versions", getVersionsController);

module.exports = router;
