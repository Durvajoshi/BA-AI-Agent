const { login } = require("../../../services/auth.service");

const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { user, token } = await login(email, password);

    res.json({
      user,
      token,
      message: "Login successful"
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

module.exports = { loginController };
