const express = require("express");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db/postgres");

const {
  handleClarification,
  handleChange,
  generateDiagram,
  generateGherkin,
  generateSchema,
  generatePrototype,
  generateSystemArchitecture,
  generateCompetitorAnalysis,
  generateRiskAnalysis,
  generateProjectEstimate
} = require("../services/ba.service");

const { cleanJson } = require("../services/ai.service");

const { generatePRD, generateBRD } = require("../services/documentGenerator.service");

const { generateFinalBA } = require("../services/finalBaGenerator");
const { diffBA } = require("../services/diff.service");
const { generateChangeSummary } = require("../services/changeSummary.service");
const serialize = require("../utils/serialize");

const router = express.Router();

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
    {
      title: "Activity Diagram",
      body: diagram ? ["```mermaid", diagram, "```"].join("\n") : "N/A"
    },
    {
      title: "Gherkin (QA)",
      body: gherkin ? ["```gherkin", gherkin, "```"].join("\n") : "N/A"
    },
    {
      title: "Data Schema",
      body: schema || "N/A"
    },
    {
      title: "Architecture",
      body: architecture || "N/A"
    },
    {
      title: "Competitors",
      body: competitors || "N/A"
    },
    {
      title: "Risk Analysis",
      body: risk || "N/A"
    },
    {
      title: "Estimation",
      body: estimation || "N/A"
    }
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

/* ===============================
   CREATE CONVERSATION
================================ */
router.post("/conversation", async (req, res) => {
  // Just return a UUID - don't save to DB until first message is sent
  // This prevents empty conversations from being created
  const conversationId = uuidv4();
  res.json({ conversationId });
});

/* ===============================
   GET ALL CONVERSATIONS FOR USER
================================ */
router.get("/conversations", async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    `SELECT id, title, preview, is_pinned, pin_order, created_at, updated_at
     FROM conversations
     WHERE user_id = $1
     ORDER BY is_pinned DESC, pin_order DESC, updated_at DESC`,
    [userId]
  );

  res.json(result.rows);
});

/* ===============================
   UPDATE CONVERSATION TITLE
================================ */
router.put("/conversation/:id/title", async (req, res) => {
  const { title } = req.body;
  const userId = req.user.userId;

  // Verify user owns this conversation
  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  await pool.query(
    "UPDATE conversations SET title=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2",
    [title, req.params.id]
  );

  res.json({ success: true });
});

/* ===============================
   PIN/UNPIN CONVERSATION
================================ */
router.put("/conversation/:id/pin", async (req, res) => {
  const { isPinned } = req.body;
  const userId = req.user.userId;

  // Verify user owns this conversation
  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  const timestamp = isPinned ? Date.now() : 0;
  await pool.query(
    "UPDATE conversations SET is_pinned=$1, pin_order=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3",
    [isPinned, timestamp, req.params.id]
  );

  res.json({ success: true });
});

/* ===============================
   DELETE CONVERSATION
================================ */
router.delete("/conversation/:id", async (req, res) => {
  const userId = req.user.userId;

  // Verify user owns this conversation
  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  // Delete related records
  await pool.query(
    `DELETE FROM jira_issues 
     WHERE ba_version_id IN (
       SELECT v.id FROM ba_versions v
       JOIN ba_documents d ON v.ba_document_id = d.id
       WHERE d.conversation_id = $1
     )`,
    [req.params.id]
  );

  await pool.query(
    `DELETE FROM activity_diagrams 
     WHERE ba_version_id IN (
       SELECT v.id FROM ba_versions v
       JOIN ba_documents d ON v.ba_document_id = d.id
       WHERE d.conversation_id = $1
     )`,
    [req.params.id]
  );

  await pool.query(
    `DELETE FROM ba_versions 
     WHERE ba_document_id IN (
       SELECT id FROM ba_documents WHERE conversation_id = $1
     )`,
    [req.params.id]
  );

  await pool.query(
    "DELETE FROM ba_documents WHERE conversation_id = $1",
    [req.params.id]
  );

  await pool.query(
    "DELETE FROM messages WHERE conversation_id = $1",
    [req.params.id]
  );

  await pool.query(
    "DELETE FROM conversations WHERE id = $1",
    [req.params.id]
  );

  res.json({ success: true });
});

/* ===============================
   LOAD MESSAGES
================================ */
router.get("/conversation/:id/messages", async (req, res) => {
  const userId = req.user.userId;
  
  // Verify user owns this conversation
  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  const result = await pool.query(
    `SELECT sender, content
     FROM messages
     WHERE conversation_id=$1
     ORDER BY created_at`,
    [req.params.id]
  );

  res.json(result.rows);
});

/* ===============================
   SEND MESSAGE
================================ */
router.post("/message", async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const userId = req.user.userId;

    // Check if conversation exists
    let convoOwner = await pool.query(
      "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
      [conversationId, userId]
    );

    // Check if this is the first message to auto-generate title
    const messageCount = await pool.query(
      "SELECT COUNT(*) FROM messages WHERE conversation_id = $1",
      [conversationId]
    );

    const isFirstMessage = messageCount.rows[0].count === 0;

    // ... rest of the logic ...
    // If conversation doesn't exist, create it now (on first message)
    if (convoOwner.rows.length === 0) {
      // Generate title and preview from first message
      const title = content.substring(0, 50).trim() || "New Chat";
      const preview = content.substring(0, 100).trim();
      
      try {
        await pool.query(
          "INSERT INTO conversations (id, user_id, title, preview, clarification_done, created_at, updated_at) VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          [conversationId, userId, title, preview]
        );
        console.log(`Created new conversation ${conversationId} with title: ${title}`);
      } catch (err) {
        // If insert fails (e.g., duplicate), verify it belongs to user
        convoOwner = await pool.query(
          "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
          [conversationId, userId]
        );
        
        if (convoOwner.rows.length === 0) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
    }

    /* ===============================
       FREE TIER CHECK
    ================================ */
    const FREE_TIER_LIMIT = 3;
    const userRecord = await pool.query(
      "SELECT free_messages_used, openrouter_api_key FROM users WHERE id=$1",
      [userId]
    );
    const freeMessagesUsed = userRecord.rows[0]?.free_messages_used || 0;
    const userApiKey = userRecord.rows[0]?.openrouter_api_key || null;

    // If free tier exhausted and no personal key, block the request
    if (freeMessagesUsed >= FREE_TIER_LIMIT && !userApiKey) {
      return res.status(402).json({
        error: "FREE_TIER_EXHAUSTED",
        message: "Your 3 free messages have been used. Please add your OpenRouter API key in Profile Settings to continue.",
        free_messages_used: freeMessagesUsed,
        free_tier_limit: FREE_TIER_LIMIT
      });
    }

    // Use user's own API key if available, otherwise use env key (undefined falls back to env in ai.service)
    const apiKeyToUse = userApiKey || undefined;

    // Save user message
    await pool.query(
      `INSERT INTO messages (id, conversation_id, sender, content)
       VALUES ($1,$2,'user',$3)`,
      [uuidv4(), conversationId, String(content)]
    );

    // Only update preview on subsequent messages, never change the title
    if (!isFirstMessage) {
      const preview = content.substring(0, 100).trim();
      await pool.query(
        "UPDATE conversations SET preview=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2",
        [preview, conversationId]
      );
    }

    // Conversation state
    const convo = await pool.query(
      "SELECT clarification_done FROM conversations WHERE id=$1",
      [conversationId]
    );

    const clarificationDone = convo.rows[0]?.clarification_done ?? false;

    // Latest BA version
    const versionCheck = await pool.query(
      `SELECT v.id,
              v.version_number,
              v.ba_output,
              d.id AS doc_id
       FROM ba_versions v
       JOIN ba_documents d ON v.ba_document_id = d.id
       JOIN conversations c ON d.conversation_id = c.id
       WHERE d.conversation_id=$1 AND c.user_id=$2
       ORDER BY v.version_number DESC
       LIMIT 1`,
      [conversationId, userId]
    );

    const hasBaseline = versionCheck.rowCount > 0;

    /* ===============================
       CHANGE MODE
  ================================ */
    if (hasBaseline) {
      const previous = versionCheck.rows[0];

      const impactText = await handleChange(JSON.stringify(previous.ba_output), content, apiKeyToUse);

      const rawNewBA = await generateFinalBA(`Original BA: ${JSON.stringify(previous.ba_output)}\nChange Request: ${content}`, apiKeyToUse);

      const newBA = typeof rawNewBA === "string" ? JSON.parse(cleanJson(rawNewBA)) : rawNewBA;

      const diff = diffBA(previous.ba_output, newBA);
      const summary = generateChangeSummary(diff);

      const newVersionId = uuidv4();

      await pool.query(
        `INSERT INTO ba_versions
         (id, ba_document_id, version_number, ba_output, change_summary, diff)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          newVersionId,
          previous.doc_id,
          previous.version_number + 1,
          newBA,
          summary,
          diff
        ]
      );

      let diagram = "Rate limit hit. Could not generate diagram.";
      let gherkin = "Rate limit hit. Could not generate Gherkin.";
      let schema = "Rate limit hit. Could not generate Data Schema.";
      let prototype = "Rate limit hit. Could not generate UI Prototype.";
      let architecture = "Rate limit hit. Could not generate System Architecture.";
      let competitorAnalysis = "Rate limit hit. Could not generate Competitor Analysis.";
      let riskAnalysis = "Rate limit hit. Could not generate Risk Analysis.";
      let projectEstimate = "Rate limit hit. Could not generate Project Estimate.";

      try {
        diagram = await generateDiagram(newBA, apiKeyToUse);
        gherkin = await generateGherkin(newBA, apiKeyToUse);
        schema = await generateSchema(newBA, apiKeyToUse);
        prototype = await generatePrototype(newBA, diagram, schema, apiKeyToUse);
      } catch (err) {
        console.warn("Rate limit or AI error during core spec generation:", err.message);
      }

      try {
        architecture = await generateSystemArchitecture(newBA, apiKeyToUse);
        competitorAnalysis = await generateCompetitorAnalysis(newBA, apiKeyToUse);
        riskAnalysis = await generateRiskAnalysis(newBA, apiKeyToUse);
        projectEstimate = await generateProjectEstimate(newBA, apiKeyToUse);
      } catch (err) {
        console.warn("Rate limit or AI error during analysis spec generation:", err.message);
      }

      await pool.query(
        `INSERT INTO activity_diagrams 
         (id, ba_version_id, diagram_definition, gherkin_definition, schema_definition, prototype_definition,
          architecture_definition, competitor_analysis, risk_analysis, project_estimate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [uuidv4(), newVersionId, diagram, gherkin, schema, prototype, architecture, competitorAnalysis, riskAnalysis, projectEstimate]
      );

      const aiText = `${impactText}\n\n✅ Updates Applied:\n${summary}`;

      await pool.query(
        `INSERT INTO messages (id, conversation_id, sender, content)
         VALUES ($1,$2,'ai',$3)`,
        [uuidv4(), conversationId, aiText]
      );

      // Increment free messages counter if using env key (free tier)
      if (!userApiKey) {
        await pool.query(
          "UPDATE users SET free_messages_used = free_messages_used + 1 WHERE id=$1",
          [userId]
        );
      }

      return res.json({ reply: aiText, free_messages_used: !userApiKey ? freeMessagesUsed + 1 : freeMessagesUsed });
    }

    /* ===============================
       FINAL BA GENERATION
  ================================ */
    if (clarificationDone) {
      const context = await pool.query(
        `SELECT sender, content
         FROM messages
         WHERE conversation_id=$1
         ORDER BY created_at`,
        [conversationId]
      );

      const conversationText = context.rows
        .map(m => `${m.sender}: ${serialize(m.content)}`)
        .join("\n");

      const finalBA = JSON.parse(
        await generateFinalBA(conversationText, apiKeyToUse)
      );

      const baDocumentId = uuidv4();
      const baVersionId = uuidv4();

      await pool.query(
        `INSERT INTO ba_documents (id, conversation_id, title)
         VALUES ($1,$2,$3)`,
        [baDocumentId, conversationId, finalBA.title]
      );

      await pool.query(
        `INSERT INTO ba_versions
         (id, ba_document_id, version_number, ba_output)
         VALUES ($1,$2,1,$3)`,
        [baVersionId, baDocumentId, finalBA]
      );

      let diagram = "Rate limit hit. Could not generate diagram.";
      let gherkin = "Rate limit hit. Could not generate Gherkin.";
      let schema = "Rate limit hit. Could not generate Data Schema.";
      let prototype = "Rate limit hit. Could not generate UI Prototype.";
      let architecture = "Rate limit hit. Could not generate System Architecture.";
      let competitorAnalysis = "Rate limit hit. Could not generate Competitor Analysis.";
      let riskAnalysis = "Rate limit hit. Could not generate Risk Analysis.";
      let projectEstimate = "Rate limit hit. Could not generate Project Estimate.";

      try {
        diagram = await generateDiagram(finalBA, apiKeyToUse);
        gherkin = await generateGherkin(finalBA, apiKeyToUse);
        schema = await generateSchema(finalBA, apiKeyToUse);
        prototype = await generatePrototype(finalBA, diagram, schema, apiKeyToUse);
      } catch (err) {
        console.warn("Rate limit or AI error during core spec generation:", err.message);
      }

      try {
        architecture = await generateSystemArchitecture(finalBA, apiKeyToUse);
        competitorAnalysis = await generateCompetitorAnalysis(finalBA, apiKeyToUse);
        riskAnalysis = await generateRiskAnalysis(finalBA, apiKeyToUse);
        projectEstimate = await generateProjectEstimate(finalBA, apiKeyToUse);
      } catch (err) {
        console.warn("Rate limit or AI error during analysis spec generation:", err.message);
      }

      await pool.query(
        `INSERT INTO activity_diagrams 
         (id, ba_version_id, diagram_definition, gherkin_definition, schema_definition, prototype_definition,
          architecture_definition, competitor_analysis, risk_analysis, project_estimate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [uuidv4(), baVersionId, diagram, gherkin, schema, prototype, architecture, competitorAnalysis, riskAnalysis, projectEstimate]
      );

      const aiText = JSON.stringify(finalBA, null, 2);

      await pool.query(
        `INSERT INTO messages (id, conversation_id, sender, content)
         VALUES ($1,$2,'ai',$3)`,
        [uuidv4(), conversationId, aiText]
      );

      // Increment free messages counter if using env key (free tier)
      if (!userApiKey) {
        await pool.query(
          "UPDATE users SET free_messages_used = free_messages_used + 1 WHERE id=$1",
          [userId]
        );
      }

      return res.json({ reply: aiText, free_messages_used: !userApiKey ? freeMessagesUsed + 1 : freeMessagesUsed });
    }

    /* ===============================
       CLARIFICATION
  ================================ */
    const clarificationReply = await handleClarification("", content, apiKeyToUse);
    await pool.query(
      "UPDATE conversations SET clarification_done=true WHERE id=$1",
      [conversationId]
    );

    await pool.query(
      `INSERT INTO messages (id, conversation_id, sender, content)
       VALUES ($1,$2,'ai',$3)`,
      [uuidv4(), conversationId, clarificationReply]
    );

    // Increment free messages counter if using env key (free tier)
    if (!userApiKey) {
      await pool.query(
        "UPDATE users SET free_messages_used = free_messages_used + 1 WHERE id=$1",
        [userId]
      );
    }

    res.json({ reply: clarificationReply, free_messages_used: !userApiKey ? freeMessagesUsed + 1 : freeMessagesUsed });
  } catch (err) {
    console.error("Error processing message:", err);
    res.status(500).json({ error: "Failed to process message." });
  }
});

/* ===============================
   FREE TIER STATUS
================================ */
router.get("/free-tier-status", async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      "SELECT free_messages_used, openrouter_api_key FROM users WHERE id=$1",
      [userId]
    );
    const row = result.rows[0];
    res.json({
      free_messages_used: row?.free_messages_used || 0,
      free_tier_limit: 3,
      has_openrouter_key: !!row?.openrouter_api_key,
      free_tier_exhausted: (row?.free_messages_used || 0) >= 3 && !row?.openrouter_api_key
    });
  } catch (err) {
    console.error("Free tier status error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   FETCH LATEST ACTIVITY DIAGRAM
================================ */
router.get("/conversation/:id/activity-diagram", async (req, res) => {
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
});


router.post("/conversation/:id/generate-prototype", async (req, res) => {
  // Fetch the latest BA, diagram, and schema for this conversation
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
    console.log('Generated prototype:', prototypeObj.prototype);
    const finalPrototype =
      prototypeObj && prototypeObj.prototype && prototypeObj.prototype.trim().startsWith("const PreviewApp = () =>")
        ? prototypeObj.prototype
        : `const PreviewApp = () => {\n  return (\n    <div className="p-4">\n      <h1>Minimal Preview</h1>\n      <p>No valid prototype could be generated.</p>\n    </div>\n  );\n};\n\n<PreviewApp />`;
// Save prototype to DB
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
});
/* ===============================
   CLEANUP EMPTY CONVERSATIONS
================================ */
router.post("/cleanup-empty-conversations", async (req, res) => {
  const userId = req.user.userId;

  try {
    // Find conversations with no messages
    const emptyConvos = await pool.query(
      `SELECT c.id FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE c.user_id = $1
       GROUP BY c.id
       HAVING COUNT(m.id) = 0`,
      [userId]
    );

    // Delete empty conversations
    for (const convo of emptyConvos.rows) {
      await pool.query(
        "DELETE FROM conversations WHERE id = $1",
        [convo.id]
      );
    }

    res.json({ success: true, deletedCount: emptyConvos.rows.length });
  } catch (err) {
    console.error("Cleanup error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   GENERATE PRD
================================ */
router.post("/conversation/:id/generate-prd", async (req, res) => {
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

    // If already generated, return cached markdown
    if (version.prd_markdown) {
      return res.json({ prd: version.prd_markdown });
    }

    // Generate new PRD
    const prdMarkdown = await generatePRD(version.ba_output);

    // Save to DB
    await pool.query(
      `UPDATE ba_versions SET prd_markdown = $1 WHERE id = $2`,
      [prdMarkdown, version.id]
    );

    res.json({ prd: prdMarkdown });
  } catch (err) {
    console.error("PRD generation error:", err);
    res
      .status(502)
      .json({ error: err?.message ? String(err.message) : "Failed to generate PRD" });
  }
});

/* ===============================
   GENERATE BRD
================================ */
router.post("/conversation/:id/generate-brd", async (req, res) => {
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

    // If already generated, return cached markdown
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

    // Generate new BRD
    const brdMarkdown = await generateBRD(version.ba_output);
    const augmented = withBrdAppendix(brdMarkdown, extras);

    // Save to DB
    await pool.query(
      `UPDATE ba_versions SET brd_markdown = $1 WHERE id = $2`,
      [augmented, version.id]
    );

    res.json({ brd: augmented });
  } catch (err) {
    console.error("BRD generation error:", err);
    res
      .status(502)
      .json({ error: err?.message ? String(err.message) : "Failed to generate BRD" });
  }
});

/* ===============================
   VERSION HISTORY
================================ */
router.get("/conversation/:id/versions", async (req, res) => {
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
});

module.exports = router;
