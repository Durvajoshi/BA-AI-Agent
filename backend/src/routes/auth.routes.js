const express = require("express");
const router = express.Router();

const signupRoutes = require("./auth/signup.routes");
const loginRoutes = require("./auth/login.routes");
const verifyRoutes = require("./auth/verify.routes");
const profileRoutes = require("./auth/profile.routes");
const otpRoutes = require("./auth/otp.routes");
const forgotPasswordRoutes = require("./auth/forgotPassword.routes");

router.use(signupRoutes);
router.use(loginRoutes);
router.use(verifyRoutes);
router.use(profileRoutes);
router.use(otpRoutes);
router.use(forgotPasswordRoutes);

module.exports = router;
