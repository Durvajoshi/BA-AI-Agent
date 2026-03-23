const { verifyToken, getUserById } = require("../../../services/auth.service");

const verifyController = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        userId: decoded.userId,
        email: user.email,
        full_name: user.full_name,
        jira_base_url: user.jira_base_url,
        jira_email: user.jira_email,
        jira_lead_account_id: user.jira_lead_account_id,
        free_messages_used: user.free_messages_used || 0,
        has_openrouter_key: !!user.openrouter_api_key
      }
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

module.exports = { verifyController };
