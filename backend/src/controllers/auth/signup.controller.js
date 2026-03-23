const { signup } = require("../../../services/auth.service");
const { sendOTP } = require("../../../services/otp.service");
const pool = require("../../../db/postgres");


const signupController = async (req, res) => {
  try {
    const {
      email,
      password,
      fullName,
      jiraBaseUrl,
      jiraEmail,
      jiraApiToken,
      jiraLeadAccountId,
      otpVerified
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // STEP 1: Check if user already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    // STEP 2: If OTP not verified → send OTP only
    if (!otpVerified) {
      await sendOTP(email);
      return res.json({
        otpRequired: true,
        message: "OTP sent to email"
      });
    }

    // STEP 3: If OTP verified → create user
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const jiraCredentials = {};
    if (jiraBaseUrl && jiraEmail && jiraApiToken && jiraLeadAccountId) {
      jiraCredentials.baseUrl = jiraBaseUrl;
      jiraCredentials.email = jiraEmail;
      jiraCredentials.apiToken = jiraApiToken;
      jiraCredentials.leadAccountId = jiraLeadAccountId;
    }

    const { user, token } = await signup(email, password, fullName, jiraCredentials);

    res.json({
      user,
      token,
      message: "User created successfully"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { signupController };
