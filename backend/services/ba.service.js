const { callOpenRouter } = require("./ai.service");

async function handleClarification(context, userMessage, apiKey) {
  const systemPrompt = `
ROLE:
You are a Senior Business Analyst performing requirement intake.

OBJECTIVE:
The user provided a vague or incomplete software requirement.
Your task is to ask exactly 4 clarification questions.

STRICT RULES:
Ask exactly 4 questions.
Ask questions only.
Do NOT suggest solutions.
Do NOT infer missing details.
Do NOT generate requirements.
Do NOT explain reasoning.
Do NOT use markdown.
Do NOT use headings.
Do NOT use bullet points.
Keep each question concise and unambiguous.
If the user message is empty or unclear, still ask 4 foundational clarification questions.
If complete, say: "READY_FOR_FINAL_OUTPUT".
`;

  return callOpenRouter(systemPrompt, context + "\nUser: " + userMessage, apiKey);
}

async function handleChange(context, userMessage, apiKey) {
  const systemPrompt = `
You are a Senior Business Analyst updating a Requirements Document.
You will be provided with the PREVIOUS_BA_JSON and a CHANGE_REQUEST.

STRICT RULES:
1. Generate a COMPLETE, updated requirements document.
2. Maintain the EXACT same JSON structure as the input.
3. Integrate the CHANGE_REQUEST into all relevant sections (Functional, User Stories, etc.).
4. Consistency: If a feature is added, ensure corresponding Assumptions or Non-Functional requirements are updated.
5. Output STRICT JSON only.
6. No markdown code blocks, no preamble, no explanations.

STRUCTURE:
{
  "title": "",
  "functional_requirements": [],
  "non_functional_requirements": [],
  "user_stories": [],
  "assumptions": [],
  "constraints": [],
  "out_of_scope": []
}

PREVIOUS_BA_JSON:
${JSON.stringify(context)}

CHANGE_REQUEST:
${userMessage}
`;

  return callOpenRouter(systemPrompt, context + "\nChange Request: " + userMessage, apiKey);
}

async function generateDiagram(baJson, apiKey) {
  const normalizeMermaidFlowchart = (input) => {
    let text = String(input || "")
      .replace(/\r\n/g, "\n")
      .replace(/```mermaid/gi, "")
      .replace(/```/g, "")
      .trim();

    const lines = text
      .split("\n")
      .map((l) => l.replace(/\u00A0/g, " ").trimEnd());

    const output = [];
    let lastNodeId = "";

    const isHeader = (l) => /^\s*flowchart\s+TD\s*$/i.test(l);
    const isNodeDef = (l) => /^\s*([A-Za-z][A-Za-z0-9_]*)\s*[\[\(\{]/.test(l);
    const isEdge = (l) => /-->|---|==>/.test(l);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/^note\s*:/i.test(line)) continue;
      if (line.startsWith("#")) continue;

      // Ensure flowchart header exists (once).
      if (isHeader(line)) {
        if (output.length === 0) output.push("flowchart TD");
        continue;
      }

      let fixed = line
        .replace(/\[\{/g, "[")
        .replace(/\}\]/g, "]")
        .replace(/\{"/g, "{")
        .replace(/"\}/g, "}")
        .replace(/\{([^}]*)\}/g, (match, body) => {
          const cleaned = String(body).replace(/\|+/g, " ").replace(/"/g, "").trim();
          return `{${cleaned}}`;
        });

      // Mermaid does NOT support "naked" continuation edges like:
      //   S1["Start"]
      //     --> P1["Next"]
      // so we prefix them with the last seen node id.
      if (/^(-->|--\|)/.test(fixed) && lastNodeId) {
        fixed = `${lastNodeId} ${fixed}`;
      }

      // Track last node id for continuation edge repair.
      const nodeMatch = fixed.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*[\[\(\{]/);
      if (nodeMatch) lastNodeId = nodeMatch[1];

      // Keep only lines that look like Mermaid statements.
      if (isNodeDef(fixed) || isEdge(fixed) || /^\s*%%/.test(fixed)) {
        output.push(fixed);
      }
    }

    if (output.length === 0) return "flowchart TD";
    if (!isHeader(output[0])) output.unshift("flowchart TD");
    return output.join("\n").trim() + "\n";
  };

  const systemPrompt = `
 Role: Senior Systems Architect & Business Analyst.
 Task: Generate a LOGICAL and SYNTACTICALLY CORRECT Mermaid flowchart TD for the provided BA JSON.
 
 STRICT SYNTAX RULES:
 1. START: Always start with exactly: flowchart TD
 2. LABELS: Prefer simple labels without special characters.
    - OK: P1["User logs in"]
    - OK: D1{Valid credentials?}
 3. SHAPES:
    - Process/Action: id["Label"]
    - Decision: id{"Label"}
    - Start/End: id(["Label"])
 4. CONNECTIONS: Use --> for all transitions. Use |Label| for decision outcomes.
    - Example: B1{"Valid?"} -->|Yes| C1["Success"]
 5. SPECIAL CHARACTERS: Inside quotes, avoid using " or ( or ) or [ or ]. If you MUST use them, they are forbidden. Stick to plain alphanumeric text + spaces.
 6. NO MULTILINE: Do NOT use \\n or literal newlines inside labels. Keep labels short (2-5 words).
 7. ID SYSTEM: Use incremental IDs (S1, P1, D1, E1 for Start, Process, Decision, End).
 8. NO INDENT EDGES: Do NOT write lines like '  --> P2[...]' without a source node. Every edge must be 'A --> B'.
 9. NO NOTES: Do NOT add any 'Note:' lines or extra commentary.
 
 LOGICAL FLOW RULES:
 1. CONTINUITY: The diagram MUST be a single connected graph. Every node (except END) must point to something. Every node (except START) must be pointed to by something.
 2. FLOW: Start with a clear entry point. Include at least 2-3 key decision points (D1, D2) based on the Functional Requirements.
 3. COMPLETENESS: Ensure both "Happy Path" and "Error/Alternate Paths" are represented.
 4. NO DASHED LINES: Only use solid lines (-->).
 
 OUTPUT ONLY THE CODE. NO MARKDOWN BLOCKS. NO PREAMBLE.
  `;
  const raw = await callOpenRouter(systemPrompt, JSON.stringify(baJson), apiKey);
  return normalizeMermaidFlowchart(raw);
}


async function generateGherkin(baJson, apiKey) {
  const systemPrompt = `
You are a QA Business Analyst.

Generate Acceptance Criteria in Gherkin format.

STRICT RULES:
1. Use Given/When/Then.
2. Each scenario must be testable.
3. No headers.
4. No explanations.
5. No markdown.
`;

  return callOpenRouter(systemPrompt, JSON.stringify(baJson), apiKey);
}

async function generateSchema(baJson, apiKey) {
  const systemPrompt = `
You are a Senior Data Analyst.
Understand the requirements and data needs from the BA JSON.
Generate  Markdown Data Dictionary tables based on your understanding for the project.

STRICT RULES:
1. Columns: Field Name | Type | Description | Allowed Values
2. Proper Markdown table format.
3. No headers outside table.
4. No explanations.
5. No code fences.
`;

  return callOpenRouter(systemPrompt, JSON.stringify(baJson), apiKey);
}
async function generatePrototype(baJson, diagram, schema, apiKey) {
  const systemPrompt = `
Role:  Senior React Developer and UI Designer.
Task: Generate a React component called \`PreviewApp\` based on the BA JSON, Activity Diagram, and Data Schema.

Requirements for the output:
Layout: Use a sidebar for navigation and a white-card-on-gray-background for content.
Styles: Use Tailwind exclusively. No external CSS.
1. Generate **valid JSX code** for a React functional component named \`PreviewApp\`.
2. Use React hooks (\`useState\`, \`useEffect\`, etc.) if needed.
3. Handle all actions mentioned in the Bajson.
4. Use **inline styles** provided in the Bajson.
5. Return the full component **ready to render inside a ReactDOM root**.
6. Do not include imports; assume React and ReactDOM are already available globally.
7. Wrap the component content in a full-screen container with the backgroundColor specified.
8. Ensure that any dynamic value references are correctly implemented in JSX.
9. Do not include any explanations, comments, or markdown formatting in the output. Only return the raw JSX code for the component.

\`\`\`jsx
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<PreviewApp />);
\`\`\`
Do NOT wrap the code in quotes, JSON, or any object. Return only raw executable JSX code.
Use correct React JSX syntax. For example, use {variable} inside JSX expressions instead of \${variable}.
Only respond with the React component code and the ReactDOM render call. No explanations.
`;

  const userPrompt = `
Activity Diagram:
${diagram}

Data Schema:
${schema}

BA JSON:
${JSON.stringify(baJson)}
`;
  // ... existing prompts ...

let rawResponse = await callOpenRouter(systemPrompt, userPrompt, apiKey);

// 1. Clean Markdown Fences (LLMs love adding them even if told not to)
rawResponse = rawResponse.replace(/```jsx|```javascript|```/g, "").trim();

// 2. Remove JSON wrapping if present
if (rawResponse.startsWith('"') && rawResponse.endsWith('"')) {
  try {
    rawResponse = JSON.parse(rawResponse);
  } catch(e) { 
    rawResponse = rawResponse.slice(1, -1); 
  }
}

// 3. Robust Extraction 
// Instead of a complex regex, just ensure we have the PreviewApp and a render call.
if (!rawResponse.includes("PreviewApp")) {
    return `const PreviewApp = () => <div style={{padding:20}}>AI returned invalid code format.</div>;
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(<PreviewApp />);`;
}

// Ensure there is a render call at the bottom
if (!rawResponse.includes("ReactDOM.createRoot")) {
    rawResponse += `\n\nconst root = ReactDOM.createRoot(document.getElementById("root"));\nroot.render(<PreviewApp />);`;
}

return rawResponse;
}
 
async function generateSystemArchitecture(baJson, apiKey) {
  const systemPrompt = `
You are a Senior Software Architect.
Analyse the provided BA JSON and generate a System Architecture document in Markdown.

STRICT RULES:
1. Recommend the key Microservices (e.g., Auth Service, Payment Service, Notification Service).
   Format: ## Microservices\\n| Service | Responsibility |\\n|---|---|
2. Recommend the main internal and external APIs.
   Format: ## APIs\\n| API Endpoint | Method | Description |\\n|---|---|---|
3. Keep it concise and implementation-focused.
4. No explanations outside the tables.
5. No code fences.
`;
  return callOpenRouter(systemPrompt, JSON.stringify(baJson), apiKey);
}

async function generateCompetitorAnalysis(baJson, apiKey) {
  const systemPrompt = `
You are a Senior Product Strategist and Market Analyst.
Analyse the provided BA JSON and generate a Competitor Analysis in Markdown.

STRICT RULES:
1. Identify 3-4 relevant competitors based on the product domain. If the domain is Logistics/Freight, specifically include competitors like Uber Freight, Convoy, and Blackbuck.
2. For each competitor produce a row in a table.
   Format: ## Competitor Analysis\\n| Competitor | Strengths | Weaknesses |\\n|---|---|---|
3. After the table, add two short sections:
   ## Market Gap
   (2-3 bullet points on gaps identified)
   ## Opportunity
   (2-3 bullet points on opportunities the product can capture)
4. No extra explanations.
`;
  return callOpenRouter(systemPrompt, JSON.stringify(baJson), apiKey);
}

async function generateRiskAnalysis(baJson, apiKey) {
  const systemPrompt = `
You are a Senior Risk Manager and Technical Lead.
Analyse the provided BA JSON and generate a Risk Analysis in Markdown.

STRICT RULES:
1. Identify 5-8 key risks (technical, business, operational). 
   Example Risk: Payment integration complexity. Mitigation: Use Stripe SDK.
2. For each risk, provide a mitigation strategy.
   Format: ## Risk Analysis\\n| # | Risk | Category | Severity | Mitigation |\\n|---|---|---|---|---|
3. Severity must be: High / Medium / Low.
4. Category must be: Technical / Business / Operational / Security.
5. No extra explanations, no code fences.
`;
  return callOpenRouter(systemPrompt, JSON.stringify(baJson), apiKey);
}

async function generateProjectEstimate(baJson, apiKey) {
  const systemPrompt = `
You are a Senior Engineering Manager and Project Estimator.
Analyse the provided BA JSON and generate a Project Estimation in Markdown.

STRICT RULES:
1. Estimate the development team composition needed.
   Format: ## Team Composition\\n| Role | Count | Notes |\\n|---|---|---|
2. Estimate the project timeline in phases.
   Format: ## Timeline\\n| Phase | Duration | Deliverable |\\n|---|---|---|
3. Estimate the total budget range.
   Format: ## Cost Estimate\\n| Item | Estimated Cost |\\n|---|---|
   Include: Development, Infrastructure (monthly), QA, Contingency (15%), Total.
4. All costs in USD.
5. No extra explanations, no code fences.
`;
  return callOpenRouter(systemPrompt, JSON.stringify(baJson), apiKey);
}

module.exports = {
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
};



