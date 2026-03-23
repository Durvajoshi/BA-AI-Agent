const pool = require("../../../db/postgres");

const getVersionsController = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT v.id, v.version_number, v.change_summary, v.diff, v.ba_output,
              a.diagram_definition, a.gherkin_definition, a.schema_definition, a.prototype_definition,
              a.architecture_definition, a.competitor_analysis, a.risk_analysis, a.project_estimate,
              v.prd_markdown, v.brd_markdown
       FROM ba_versions v
       JOIN ba_documents d ON v.ba_document_id = d.id
       JOIN conversations c ON d.conversation_id = c.id
       LEFT JOIN activity_diagrams a ON a.ba_version_id = v.id
       WHERE c.id = $1 AND c.user_id = $2
       ORDER BY v.version_number DESC`,
      [req.params.id, userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch versions error:", err);
    res.status(500).json({ error: "Failed to fetch version history" });
  }
};

module.exports = { getVersionsController };
