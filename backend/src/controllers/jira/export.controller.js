const pool = require("../../../db/postgres");
const { exportToJira } = require("../../../services/jira.service");
const { getUserById } = require("../../../services/auth.service");

const jiraExportController = async (req, res) => {
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

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const jiraCredentials = {
      baseUrl: user.jira_base_url,
      email: user.jira_email,
      apiToken: user.jira_api_token,
      leadAccountId: user.jira_lead_account_id
    };

    const result = await pool.query(
      `SELECT c.jira_epic_key,
              v.ba_output,
              a.diagram_definition
       FROM conversations c
       JOIN ba_documents d ON c.id = d.conversation_id
       JOIN ba_versions v ON d.id = v.ba_document_id
       LEFT JOIN activity_diagrams a ON a.ba_version_id = v.id
       WHERE c.id = $1 AND c.user_id = $2
       ORDER BY v.version_number DESC LIMIT 1`,
      [conversationId, userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "No BA found" });

    const { jira_epic_key, ba_output, diagram_definition } = result.rows[0];

    const projectKey = await exportToJira(ba_output, diagram_definition, jiraCredentials, jira_epic_key);

    await pool.query(
      "UPDATE conversations SET jira_epic_key = $1, jira_exported = true WHERE id = $2",
      [projectKey, conversationId]
    );

    res.json({ projectKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { jiraExportController };
