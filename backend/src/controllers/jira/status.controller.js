const pool = require("../../../db/postgres");

const jiraStatusController = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    const convoCheck = await pool.query(
      "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
      [conversationId, userId]
    );

    if (convoCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await pool.query(
      `SELECT d.exported_to_jira, c.jira_epic_key 
       FROM ba_documents d
       JOIN conversations c ON d.conversation_id = c.id
       WHERE d.conversation_id = $1 AND c.user_id = $2
       ORDER BY d.created_at DESC LIMIT 1`,
      [conversationId, userId]
    );

    if (result.rows.length > 0) {
      return res.json({
        exists: true,
        isExported: !!result.rows[0].jira_epic_key,
        jiraKey: result.rows[0].jira_epic_key
      });
    }

    res.json({ exists: false, isExported: false });
  } catch (err) {
    console.error("Status Check Error:", err);
    res.status(500).json({ error: "Database error" });
  }
};

module.exports = { jiraStatusController };
