const express = require("express");
const router = express.Router();
const {
  forgotPasswordRequestController,
  forgotPasswordResetController
} = require("../../controllers/auth/forgotPassword.controller");

router.post("/forgot-password-request", forgotPasswordRequestController);
router.post("/forgot-password-reset", forgotPasswordResetController);

module.exports = router;
