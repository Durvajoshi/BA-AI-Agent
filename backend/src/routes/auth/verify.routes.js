const express = require("express");
const router = express.Router();
const { verifyController } = require("../../controllers/auth/verify.controller");

router.post("/verify", verifyController);

module.exports = router;
