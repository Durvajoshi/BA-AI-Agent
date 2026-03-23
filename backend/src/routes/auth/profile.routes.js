const express = require("express");
const router = express.Router();
const authMiddleware = require("../../../middleware/auth.middleware");
const { updateProfileController, deleteProfileController } = require("../../controllers/auth/profile.controller");

router.put("/profile", authMiddleware, updateProfileController);
router.delete("/profile", authMiddleware, deleteProfileController);

module.exports = router;
