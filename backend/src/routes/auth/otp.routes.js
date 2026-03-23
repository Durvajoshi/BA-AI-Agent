const express = require("express");
const router = express.Router();
const authMiddleware = require("../../../middleware/auth.middleware");
const {
  requestOTPController,
  verifyOTPController,
  markEmailVerifiedController
} = require("../../controllers/auth/otp.controller");

router.post("/request-otp", requestOTPController);
router.post("/verify-otp", verifyOTPController);
router.post("/mark-email-verified", authMiddleware, markEmailVerifiedController);

module.exports = router;
