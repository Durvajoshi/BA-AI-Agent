const { sendOTP, verifyOTP } = require("../../../services/otp.service");
const { updateProfile } = require("../../../services/auth.service");
const pool = require("../../../db/postgres");

const forgotPasswordRequestController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "No account found with this email" });
    }

    await sendOTP(email);
    res.json({ success: true, message: "Reset OTP sent to email" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const forgotPasswordResetController = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Email, code, and new password are required" });
    }

    await verifyOTP(email, code);

    const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    const userId = userResult.rows[0].id;

    await updateProfile(userId, { password: newPassword });

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { forgotPasswordRequestController, forgotPasswordResetController };
