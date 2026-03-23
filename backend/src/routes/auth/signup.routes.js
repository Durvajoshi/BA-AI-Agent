const express = require("express");
const router = express.Router();
const { signupController } = require("../../controllers/auth/signup.controller");

router.post("/signup", signupController);

module.exports = router;
