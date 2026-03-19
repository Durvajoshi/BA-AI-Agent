const pool = require("../db/postgres");
const { callOpenRouter } = require("./ai.service");
const { v4: uuidv4 } = require("uuid");

async function generateFinalBA(conversationContext, apiKey = null, conversationId = null) {
  // 🔒 KEEP ORIGINAL PROMPT (UNCHANGED)
  const systemPrompt = `
You are a senior Business Analyst.
Generate a COMPLETE and FINAL requirements document.

Rules:
- Output STRICT JSON only
- For each item in functional_requirements, non_functional_requirements, and user_stories, you MUST include:
  * "id": a unique identifier (e.g. "FR1", "NFR1", "US1").
  * "title": a short concise name for the task.
  * "description": the detailed requirement.
  * "related_to": an array of IDs representing other related requirements or user stories from this document.
  * "subtasks": an array of objects representing actionable subtasks (e.g., [{"title": "Send via email"}, {"title": "Send via SMS"}]).
- Follow this exact structure:
{
  "title": "",
  "functional_requirements": [{"id": "", "title": "", "description": "", "related_to": [], "subtasks": [{"title": ""}]}],
  "non_functional_requirements": [{"id": "", "title": "", "description": "", "related_to": [], "subtasks": [{"title": ""}]}],
  "user_stories": [{"id": "", "title": "", "description": "", "related_to": [], "subtasks": [{"title": ""}]}],
  "assumptions": [{"id": "", "title": "", "description": "", "related_to": []}],
  "constraints": [{"id": "", "title": "", "description": "", "related_to": []}],
  "out_of_scope": [{"id": "", "title": "", "description": "", "related_to": []}]
}
- No explanations
- No markdown
- No extra text
`;

  const { cleanJson } = require("./ai.service");
  
  // 🔹 Generate BA
  const baJsonString = await callOpenRouter(systemPrompt, conversationContext, apiKey);
  
  let baObject;
  try {
    baObject = JSON.parse(cleanJson(baJsonString));
  } catch (err) {
    console.error("Critical JSON Parse Error in generateFinalBA:", err.message);
    console.error("Raw AI String:", baJsonString);
    throw new Error("AI returned invalid JSON structure. Please try again.");
  }

  // 🔥 MINIMAL SAFETY GUARD
  // If conversationId is NOT provided → DO NOT touch DB
  // (used during CHANGE / DIFF flow)
  if (!conversationId) {
    return baJsonString;
  }

  // 🔹 Create BA document (ONLY first final output)
  const docId = uuidv4();

  await pool.query(
    `INSERT INTO ba_documents (id, conversation_id, title, exported_to_jira)
     VALUES ($1,$2,$3,false)`,
    [docId, conversationId, baObject.title]
  );

  // 🔹 Version 1
  await pool.query(
    `INSERT INTO ba_versions (id, ba_document_id, version_number, ba_output)
     VALUES ($1,$2,1,$3)`,
    [uuidv4(), docId, baObject]
  );

  // 🔹 DO NOT auto-export anymore (button controlled)
  // exported_to_jira stays false until user clicks button

  return baJsonString;
}

module.exports = { generateFinalBA };
