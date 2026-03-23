const { v4: uuidv4 } = require("uuid");
const pool = require("../../../db/postgres");
const { generatePrototype } = require("../../../services/ba.service");

const activityDiagramController = async (req, res) => {
  const userId = req.user.userId;
  const result = await pool.query(
    `SELECT a.diagram_definition, a.gherkin_definition, a.schema_definition, a.prototype_definition,
            a.architecture_definition, a.competitor_analysis, a.risk_analysis, a.project_estimate
     FROM activity_diagrams a
     JOIN ba_versions v ON a.ba_version_id = v.id
     JOIN ba_documents d ON v.ba_document_id = d.id
     JOIN conversations c ON d.conversation_id = c.id
     WHERE d.conversation_id = $1 AND c.user_id = $2
     ORDER BY v.version_number DESC
     LIMIT 1`,
    [req.params.id, userId]
  );

  if (result.rows.length === 0) {
    return res.json({ diagram: null, gherkin: null, schema: null });
  }

  res.json({
    diagram: result.rows[0].diagram_definition,
    gherkin: result.rows[0].gherkin_definition,
    schema: result.rows[0].schema_definition,
    prototype: result.rows[0].prototype_definition,
    architecture: result.rows[0].architecture_definition,
    competitors: result.rows[0].competitor_analysis,
    risk: result.rows[0].risk_analysis,
    estimate: result.rows[0].project_estimate
  });
};

const generatePrototypeController = async (req, res) => {
  const userId = req.user.userId;
  const result = await pool.query(
    `SELECT v.ba_output, a.diagram_definition, a.schema_definition
     FROM ba_versions v
     JOIN ba_documents d ON v.ba_document_id = d.id
     JOIN conversations c ON d.conversation_id = c.id
     JOIN activity_diagrams a ON a.ba_version_id = v.id
     WHERE c.id = $1 AND c.user_id = $2
     ORDER BY v.version_number DESC
     LIMIT 1`,
    [req.params.id, userId]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "No BA found" });
  }

  try {
    const { ba_output, diagram_definition, schema_definition } = result.rows[0];
    const prototypeObj = await generatePrototype(ba_output, diagram_definition, schema_definition);
    console.log("Generated prototype:", prototypeObj.prototype);
    const finalPrototype =
      prototypeObj && prototypeObj.prototype && prototypeObj.prototype.trim().startsWith("const PreviewApp = () =>")
        ? prototypeObj.prototype
        : `const PreviewApp = () => {\n  return (\n    <div className="p-4">\n      <h1>Minimal Preview</h1>\n      <p>No valid prototype could be generated.</p>\n    </div>\n  );\n};\n\n<PreviewApp />`;

    await pool.query(
      `UPDATE activity_diagrams
       SET prototype_definition = $1
       WHERE ba_version_id = (
         SELECT v.id
         FROM ba_versions v
         JOIN ba_documents d ON v.ba_document_id = d.id
         JOIN conversations c ON d.conversation_id = c.id
         WHERE c.id = $2 AND c.user_id = $3
         ORDER BY v.version_number DESC
         LIMIT 1
       )`,
      [finalPrototype, req.params.id, userId]
    );

    res.json({ prototype: finalPrototype });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Prototype generation failed" });
  }
};

module.exports = { activityDiagramController, generatePrototypeController };
