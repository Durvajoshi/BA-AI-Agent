const { sendOTP, verifyOTP, markEmailVerified } = require("../../../services/otp.service");

const requestOTPController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const result = await sendOTP(email);

    res.json({
      success: true,
      message: "OTP sent to email",
      expiresAt: result.expiresAt
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const verifyOTPController = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and OTP code are required" });
    }

    await verifyOTP(email, code);

    res.json({
      success: true,
      message: "OTP verified successfully"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const markEmailVerifiedController = async (req, res) => {
  try {
    const userId = req.user.userId;

    await markEmailVerified(userId);

    res.json({
      success: true,
      message: "Email marked as verified"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { requestOTPController, verifyOTPController, markEmailVerifiedController };
