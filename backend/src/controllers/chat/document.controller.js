const pool = require("../../../db/postgres");
const { generatePRD, generateBRD } = require("../../../services/documentGenerator.service");

function buildBrdAppendix(extras = {}) {
  const marker = "<!-- BRD_APPENDIX_V1 -->";

  const normalize = (v) => (typeof v === "string" ? v.trim() : "");
  const diagram = normalize(extras.diagram);
  const gherkin = normalize(extras.gherkin);
  const schema = normalize(extras.schema);
  const architecture = normalize(extras.architecture);
  const competitors = normalize(extras.competitors);
  const risk = normalize(extras.risk);
  const estimation = normalize(extras.estimation);

  const sections = [
    { title: "Activity Diagram", body: diagram ? ["```mermaid", diagram, "```"].join("\n") : "N/A" },
    { title: "Gherkin (QA)", body: gherkin ? ["```gherkin", gherkin, "```"].join("\n") : "N/A" },
    { title: "Data Schema", body: schema || "N/A" },
    { title: "Architecture", body: architecture || "N/A" },
    { title: "Competitors", body: competitors || "N/A" },
    { title: "Risk Analysis", body: risk || "N/A" },
    { title: "Estimation", body: estimation || "N/A" }
  ];

  return (
    marker +
    "\n\n" +
    sections
      .map((s) => `## ${s.title}\n\n${s.body}`)
      .join("\n\n")
      .trim() +
    "\n"
  );
}

function withBrdAppendix(brdMarkdown, extras) {
  const marker = "<!-- BRD_APPENDIX_V1 -->";
  const base = String(brdMarkdown || "").split(marker)[0].trimEnd();
  const appendix = buildBrdAppendix(extras);
  return `${base}\n\n${appendix}`.trimEnd() + "\n";
}

const generatePRDController = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT v.id, v.ba_output, v.prd_markdown, c.id as cid
       FROM ba_versions v
       JOIN ba_documents d ON v.ba_document_id = d.id
       JOIN conversations c ON d.conversation_id = c.id
       WHERE c.id = $1 AND c.user_id = $2
       ORDER BY v.version_number DESC
       LIMIT 1`,
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No BA found" });
    }

    const version = result.rows[0];

    if (version.prd_markdown) {
      return res.json({ prd: version.prd_markdown });
    }

    const prdMarkdown = await generatePRD(version.ba_output);

    await pool.query(
      `UPDATE ba_versions SET prd_markdown = $1 WHERE id = $2`,
      [prdMarkdown, version.id]
    );

    res.json({ prd: prdMarkdown });
  } catch (err) {
    console.error("PRD generation error:", err);
    res.status(502).json({ error: err?.message ? String(err.message) : "Failed to generate PRD" });
  }
};

const generateBRDController = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT v.id, v.ba_output, v.brd_markdown, c.id as cid,
              a.diagram_definition, a.gherkin_definition, a.schema_definition, a.architecture_definition,
              a.competitor_analysis, a.risk_analysis, a.project_estimate
       FROM ba_versions v
        JOIN ba_documents d ON v.ba_document_id = d.id
        JOIN conversations c ON d.conversation_id = c.id
        LEFT JOIN activity_diagrams a ON a.ba_version_id = v.id
        WHERE c.id = $1 AND c.user_id = $2
        ORDER BY v.version_number DESC
        LIMIT 1`,
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No BA found" });
    }

    const version = result.rows[0];
    const extras = {
      diagram: version.diagram_definition,
      gherkin: version.gherkin_definition,
      schema: version.schema_definition,
      architecture: version.architecture_definition,
      competitors: version.competitor_analysis,
      risk: version.risk_analysis,
      estimation: version.project_estimate
    };

    if (version.brd_markdown) {
      const augmented = withBrdAppendix(version.brd_markdown, extras);
      if (augmented !== version.brd_markdown) {
        await pool.query(
          `UPDATE ba_versions SET brd_markdown = $1 WHERE id = $2`,
          [augmented, version.id]
        );
      }
      return res.json({ brd: augmented });
    }

    const brdMarkdown = await generateBRD(version.ba_output);
    const augmented = withBrdAppendix(brdMarkdown, extras);

    await pool.query(
      `UPDATE ba_versions SET brd_markdown = $1 WHERE id = $2`,
      [augmented, version.id]
    );

    res.json({ brd: augmented });
  } catch (err) {
    console.error("BRD generation error:", err);
    res.status(502).json({ error: err?.message ? String(err.message) : "Failed to generate BRD" });
  }
};

const cleanupConversationsController = async (req, res) => {
  const userId = req.user.userId;

  try {
    const emptyConvos = await pool.query(
      `SELECT c.id FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE c.user_id = $1
       GROUP BY c.id
       HAVING COUNT(m.id) = 0`,
      [userId]
    );

    for (const convo of emptyConvos.rows) {
      await pool.query("DELETE FROM conversations WHERE id = $1", [convo.id]);
    }

    res.json({ success: true, deletedCount: emptyConvos.rows.length });
  } catch (err) {
    console.error("Cleanup error:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { generatePRDController, generateBRDController, cleanupConversationsController };
