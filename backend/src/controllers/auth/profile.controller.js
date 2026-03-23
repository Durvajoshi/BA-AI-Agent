const { updateProfile, deleteProfile, getUserById, comparePassword } = require("../../../services/auth.service");

const updateProfileController = async (req, res) => {
  try {
    console.log("PUT /profile endpoint hit");
    console.log("Request body:", req.body);
    console.log("User from middleware:", req.user);
    const { password, currentPassword, fullName, jiraBaseUrl, jiraEmail, jiraApiToken, jiraLeadAccountId, openrouterApiKey } = req.body;
    const userId = req.user.userId;

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required to change password" });
      }

      const user = await getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isPasswordValid = await comparePassword(currentPassword, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
    }

    const updatedUser = await updateProfile(userId, {
      password,
      fullName,
      jiraBaseUrl,
      jiraEmail,
      jiraApiToken,
      jiraLeadAccountId,
      openrouterApiKey
    });

    res.json({
      user: updatedUser,
      message: "Profile updated successfully"
    });
  } catch (err) {
    console.error("Error in updateProfile:", err.message);
    res.status(400).json({ error: err.message });
  }
};

const deleteProfileController = async (req, res) => {
  try {
    console.log("DELETE /profile endpoint hit");
    console.log("Request body:", req.body);
    console.log("User from middleware:", req.user);
    const { password } = req.body;
    const userId = req.user.userId;

    if (!password) {
      return res.status(400).json({ error: "Password is required to delete account" });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Password is incorrect" });
    }

    await deleteProfile(userId);

    res.json({
      success: true,
      message: "Account deleted successfully"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { updateProfileController, deleteProfileController };
