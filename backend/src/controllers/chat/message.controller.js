const { v4: uuidv4 } = require("uuid");
const pool = require("../../../db/postgres");
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
} = require("../../../services/ba.service");
const { cleanJson } = require("../../../services/ai.service");
const { generateFinalBA } = require("../../../services/finalBaGenerator");
const { diffBA } = require("../../../services/diff.service");
const { generateChangeSummary } = require("../../../services/changeSummary.service");
const serialize = require("../../../utils/serialize");

const sendMessageController = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const userId = req.user.userId;

    let convoOwner = await pool.query(
      "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
      [conversationId, userId]
    );

    const messageCount = await pool.query(
      "SELECT COUNT(*) FROM messages WHERE conversation_id = $1",
      [conversationId]
    );

    const isFirstMessage = messageCount.rows[0].count === 0;

    if (convoOwner.rows.length === 0) {
      const title = content.substring(0, 50).trim() || "New Chat";
      const preview = content.substring(0, 100).trim();

      try {
        await pool.query(
          "INSERT INTO conversations (id, user_id, title, preview, clarification_done, created_at, updated_at) VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          [conversationId, userId, title, preview]
        );
        console.log(`Created new conversation ${conversationId} with title: ${title}`);
      } catch (err) {
        convoOwner = await pool.query(
          "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
          [conversationId, userId]
        );
        if (convoOwner.rows.length === 0) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
    }

    const FREE_TIER_LIMIT = 3;
    const userRecord = await pool.query(
      "SELECT free_messages_used, openrouter_api_key FROM users WHERE id=$1",
      [userId]
    );
    const freeMessagesUsed = userRecord.rows[0]?.free_messages_used || 0;
    const userApiKey = userRecord.rows[0]?.openrouter_api_key || null;

    if (freeMessagesUsed >= FREE_TIER_LIMIT && !userApiKey) {
      return res.status(402).json({
        error: "FREE_TIER_EXHAUSTED",
        message: "Your 3 free messages have been used. Please add your OpenRouter API key in Profile Settings to continue.",
        free_messages_used: freeMessagesUsed,
        free_tier_limit: FREE_TIER_LIMIT
      });
    }

    const apiKeyToUse = userApiKey || undefined;

    await pool.query(
      `INSERT INTO messages (id, conversation_id, sender, content)
       VALUES ($1,$2,'user',$3)`,
      [uuidv4(), conversationId, String(content)]
    );

    if (!isFirstMessage) {
      const preview = content.substring(0, 100).trim();
      await pool.query(
        "UPDATE conversations SET preview=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2",
        [preview, conversationId]
      );
    }

    const convo = await pool.query(
      "SELECT clarification_done FROM conversations WHERE id=$1",
      [conversationId]
    );

    const clarificationDone = convo.rows[0]?.clarification_done ?? false;

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

    /* CHANGE MODE */
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
        [newVersionId, previous.doc_id, previous.version_number + 1, newBA, summary, diff]
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

      const aiText = `${impactText}\n\nâœ… Updates Applied:\n${summary}`;

      await pool.query(
        `INSERT INTO messages (id, conversation_id, sender, content)
         VALUES ($1,$2,'ai',$3)`,
        [uuidv4(), conversationId, aiText]
      );

      if (!userApiKey) {
        await pool.query(
          "UPDATE users SET free_messages_used = free_messages_used + 1 WHERE id=$1",
          [userId]
        );
      }

      return res.json({ reply: aiText, free_messages_used: !userApiKey ? freeMessagesUsed + 1 : freeMessagesUsed });
    }

    /* FINAL BA GENERATION */
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

      const finalBA = JSON.parse(await generateFinalBA(conversationText, apiKeyToUse));

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

      if (!userApiKey) {
        await pool.query(
          "UPDATE users SET free_messages_used = free_messages_used + 1 WHERE id=$1",
          [userId]
        );
      }

      return res.json({ reply: aiText, free_messages_used: !userApiKey ? freeMessagesUsed + 1 : freeMessagesUsed });
    }

    /* CLARIFICATION */
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
};

const freeTierStatusController = async (req, res) => {
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
};

module.exports = { sendMessageController, freeTierStatusController };
