const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");

function createAuthHeader(jiraEmail, jiraApiToken) {
  const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString("base64");
  return {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json"
  };
}

// DateTracker: assigns consecutive start/end dates to all Jira issues
class DateTracker {
  constructor(startDate = new Date()) {
    this.current = new Date(startDate);
    this.current.setHours(0, 0, 0, 0);
  }

  // Allocate `days` working days and return { startDate, endDate } strings (YYYY-MM-DD)
  allocate(days = 2) {
    const start = this._format(this.current);
    this.current.setDate(this.current.getDate() + days);
    const end = this._format(this.current);
    return { startDate: start, dueDate: end };
  }

  _format(d) {
    return d.toISOString().split('T')[0];
  }
}


// Helper function to generate project key
function generateProjectKey(title) {
  return title
    .replace(/[^A-Za-z]/g, "")
    .substring(0, 6)
    .toUpperCase();
}

function parseList(list) {
  if (!Array.isArray(list) || list.length === 0) return "N/A";

  return list
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        return (
          item.text ||
          item.description ||
          item.title ||
          JSON.stringify(item)
        );
      }
      return String(item);
    })
    .join("\n- ");
}

function buildJiraProjectSummary(ba, activityDiagram) {
  return `h2. ${ba.title || "BA Requirements"}

h3. User Stories
${parseList(ba.user_stories)}

h3. Assumptions
${parseList(ba.assumptions)}

h3. Constraints
${parseList(ba.constraints)}

h3. Out of Scope
${parseList(ba.out_of_scope)}

h3. Activity Diagram (Mermaid)
${activityDiagram || "N/A"}
`.trim();
}

// Helper to extract keys safely regardless of case or stringified JSON
function extractTitleAndDesc(item, fallbackPrefix) {
  if (typeof item === "string") {
    try {
      item = JSON.parse(item);
    } catch (e) {
      return {
        title: item.length > 50 ? item.substring(0, 50) + "..." : item,
        desc: item,
        id: null,
        rawItem: { description: item }
      };
    }
  }

  const lowerObj = {};
  for (const k of Object.keys(item)) {
    lowerObj[k.toLowerCase()] = item[k];
  }

  if (typeof lowerObj.description === 'string' && lowerObj.description.startsWith('{')) {
    try {
      const parsedDesc = JSON.parse(lowerObj.description);
      for (const k of Object.keys(parsedDesc)) {
        lowerObj[k.toLowerCase()] = parsedDesc[k];
      }
    } catch (e) { }
  }

  let title = lowerObj.name || lowerObj.title || lowerObj.summary || lowerObj.user_story || null;
  let id = lowerObj.id || null;
  let desc = lowerObj.description || lowerObj.user_story || JSON.stringify(item, null, 2);

  if (!title) {
    if (typeof lowerObj.description === 'string') {
      title = lowerObj.description.length > 50 ? lowerObj.description.substring(0, 50) + '...' : lowerObj.description;
    } else {
      title = fallbackPrefix;
    }
  }

  return { title, desc, id, rawItem: lowerObj };
}

// Search issues
async function searchJiraIssues(jql, jiraBase, headers) {
  try {
    const res = await axios.get(`${jiraBase}/rest/api/3/search/jql`, {
      headers,
      params: {
        jql,
        maxResults: 100,
        fields: "summary,issuetype"
      }
    });
    return res.data.issues || [];
  } catch (err) {
    console.error("Error searching Jira issues:", err.response?.data || err.message);
    return [];
  }
}

// Helper function to sanitize project name
function sanitizeProjectName(title) {
  return title
    .replace(/requirement\s*documents?/gi, "")
    .replace(/requirements?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Create Jira Project
async function createJiraProject(title, projectSummary, jiraBase, headers, leadAccountId) {
  const cleanTitle = sanitizeProjectName(title);
  let key = generateProjectKey(cleanTitle);

  let payload = {
    key,
    name: cleanTitle,
    description: projectSummary,
    projectTypeKey: "software",
    projectTemplateKey: "com.pyxis.greenhopper.jira:gh-simplified-agility-kanban",
    leadAccountId: leadAccountId,
    assigneeType: "PROJECT_LEAD"
  };

  try {
    await axios.post(`${jiraBase}/rest/api/3/project`, payload, { headers });
    return key;
  } catch (err) {
    if (err.response && err.response.data && err.response.data.errors && err.response.data.errors.projectKey) {
      console.log(`Project key ${key} is already taken, generating a unique one...`);
      // Try again with a unique key
      key = `${key.substring(0, 3)}${Math.floor(Math.random() * 900) + 100}`;
      payload.key = key;
      // Also make sure name is unique
      payload.name = `${cleanTitle} ${key}`;

      try {
        await axios.post(`${jiraBase}/rest/api/3/project`, payload, { headers });
        return key;
      } catch (retryErr) {
        console.error("Error creating Jira project on retry:", retryErr.response ? retryErr.response.data : retryErr.message);
        throw retryErr;
      }
    } else {
      console.error("Error creating Jira project:", err.response ? err.response.data : err.message);
      throw err;
    }
  }
}

// Create Epic (Functional Requirements / Non-Functional Requirements)
async function createEpic(projectKey, name, jiraBase, headers, startDate, dueDate) {
  const payload = {
    fields: {
      project: { key: projectKey },
      summary: name,
      issuetype: { name: "Epic" },
      description: {
        version: 1,
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: `Epic for ${name}` }]
          }
        ]
      },
      duedate: dueDate,
      customfield_10015: startDate
    }
  };

  try {
    const res = await axios.post(`${jiraBase}/rest/api/3/issue`, payload, { headers });
    console.log("Epic created:", res.data.key);
    return res.data.key;
  } catch (err) {
    console.error("Error creating Epic:", JSON.stringify(err.response?.data, null, 2));
    throw err;
  }
}

// Link Issues
async function linkIssues(inwardKey, outwardKey, jiraBase, headers, linkType = "Relates") {
  const payload = {
    type: { name: linkType },
    inwardIssue: { key: inwardKey },
    outwardIssue: { key: outwardKey }
  };
  try {
    await axios.post(`${jiraBase}/rest/api/3/issueLink`, payload, { headers });
    console.log(`Linked ${inwardKey} -> ${outwardKey}`);
  } catch (err) {
    // Suppress if already linked or other minor issue, but log it
    console.error(`Error linking ${inwardKey} to ${outwardKey}:`, err.response?.data || err.message);
  }
}

// Create Task linked to Epic (Using Parent Field)
async function createIssueUnderEpic(projectKey, epicKey, summary, description, issueType, jiraBase, headers, startDate, dueDate) {
  const payload = {
    fields: {
      project: { key: projectKey },
      summary: summary,
      issuetype: { name: issueType },
      parent: { key: epicKey },
      description: {
        version: 1,
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description || "No description provided." }]
          }
        ]
      },
      duedate: dueDate,
      customfield_10015: startDate
    }
  };

  try {
    const res = await axios.post(`${jiraBase}/rest/api/3/issue`, payload, { headers });
    console.log(`${issueType} ${res.data.key} linked to Epic ${epicKey}`);
    return res.data.key;
  } catch (err) {
    console.error(`Error creating ${issueType}:`, JSON.stringify(err.response?.data, null, 2));
    throw err;
  }
}

function buildDescription(item) {
  let desc = item.description || "";

  if (Array.isArray(item.acceptance_criteria)) {
    desc += "\n\nAcceptance Criteria:\n";
    desc += item.acceptance_criteria.map(ac => `- ${ac}`).join("\n");
  }

  return desc || "No description provided.";
}


// Format BA (Business Analysis) document for Jira (convert lists to string)
function formatBAForJira(ba) {
  const parseList = (list) => {
    if (!Array.isArray(list) || list.length === 0) return "N/A";

    return list
      .map(item => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          return (
            item.text ||
            item.description ||
            item.title ||
            JSON.stringify(item)
          );
        }
        return String(item);
      })
      .join("\n- ");
  };

  return `h2. ${ba.title || "BA Requirements"}

h3. Functional Requirements
${parseList(ba.functional_requirements)}

h3. Non-Functional Requirements
${parseList(ba.non_functional_requirements)}

h3. User Stories
${parseList(ba.user_stories)}
  `.trim();
}

// Convert Mermaid diagram to PNG using npx
async function convertMermaidToPng(diagramText) {
  const execAsync = promisify(exec);
  const tempDir = path.join(__dirname, "../temp");

  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const diagramFile = path.join(tempDir, `diagram-${timestamp}.mmd`);
  const outputFile = path.join(tempDir, `diagram-${timestamp}.png`);

  try {
    // Clean diagram: remove markdown code fence markers and excessive whitespace
    let cleanDiagram = diagramText
      .replace(/```mermaid\n?/g, "")
      .replace(/```\n?/g, "")
      .split('\n')
      .map(line => line.trim())  // Remove leading/trailing spaces from each line
      .filter(line => line.length > 0)  // Remove empty lines
      .join('\n')
      .trim();

    // Write cleaned diagram to file
    fs.writeFileSync(diagramFile, cleanDiagram);

    // Use npx to run mermaid-cli
    await execAsync(`npx @mermaid-js/mermaid-cli -i "${diagramFile}" -o "${outputFile}"`);

    // Read the PNG file
    const pngBuffer = fs.readFileSync(outputFile);

    // Clean up temp files
    fs.unlinkSync(diagramFile);
    fs.unlinkSync(outputFile);

    return pngBuffer;
  } catch (err) {
    console.error("Error converting diagram to PNG:", err.message);
    // Clean up on error
    if (fs.existsSync(diagramFile)) fs.unlinkSync(diagramFile);
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
    throw err;
  }
}

// Upload attachment to Jira issue
async function uploadAttachmentToJira(issueKey, fileName, fileBuffer, jiraBase, headers) {
  const url = `${jiraBase}/rest/api/3/issue/${issueKey}/attachments`;

  try {
    // Create form data for multipart upload
    const FormData = require("form-data");
    const form = new FormData();
    form.append("file", fileBuffer, fileName);

    await axios.post(url, form, {
      headers: {
        ...headers,
        "X-Atlassian-Token": "no-check",
        ...form.getHeaders()
      }
    });
    console.log(`Attachment ${fileName} uploaded to ${issueKey}`);
  } catch (err) {
    console.error(`Error uploading attachment to ${issueKey}:`, err.response?.data || err.message);
    throw err;
  }
}

// Create Issue (Story, Task, or Bug) without parent Epic
async function createIssue(projectKey, issueType, summary, description, jiraBase, headers, startDate, dueDate) {
  const payload = {
    fields: {
      project: { key: projectKey },
      summary: summary,
      issuetype: { name: issueType },
      description: {
        version: 1,
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description || "No description provided." }]
          }
        ]
      },
      duedate: dueDate,
      customfield_10015: startDate
    }
  };

  try {
    const res = await axios.post(`${jiraBase}/rest/api/3/issue`, payload, { headers });
    console.log(`${issueType} ${res.data.key} created: ${summary}`);
    return res.data.key;
  } catch (err) {
    console.error(`Error creating ${issueType}:`, JSON.stringify(err.response?.data, null, 2));
    throw err;
  }
}

async function updateIssueDescription(issueKey, description, jiraBase, headers) {
  if (!issueKey) return;
  const payload = {
    fields: {
      description: {
        version: 1,
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description || "No description provided." }]
          }
        ]
      }
    }
  };

  try {
    await axios.put(`${jiraBase}/rest/api/3/issue/${issueKey}`, payload, { headers });
    console.log(`Updated ${issueKey} description`);
  } catch (err) {
    console.error(`Error updating description for ${issueKey}:`, err.response?.data || err.message);
  }
}

async function getIssueAttachments(issueKey, jiraBase, headers) {
  try {
    const res = await axios.get(`${jiraBase}/rest/api/3/issue/${issueKey}`, {
      headers,
      params: { fields: "attachment" }
    });
    return res.data?.fields?.attachment || [];
  } catch (err) {
    console.error(`Error fetching attachments for ${issueKey}:`, err.response?.data || err.message);
    return [];
  }
}

async function deleteAttachmentFromJira(attachmentId, jiraBase, headers) {
  if (!attachmentId) return;
  try {
    await axios.delete(`${jiraBase}/rest/api/3/attachment/${attachmentId}`, { headers });
  } catch (err) {
    // Often permissioned; best-effort cleanup.
    console.error(`Error deleting attachment ${attachmentId}:`, err.response?.data || err.message);
  }
}

async function updateIssueDueDate(issueKey, jiraBase, headers, dueDate) {
  if (!issueKey || !dueDate) return;
  const payload = { fields: { duedate: dueDate } };
  try {
    await axios.put(`${jiraBase}/rest/api/3/issue/${issueKey}`, payload, { headers });
    console.log(`Updated ${issueKey} due date -> ${dueDate}`);
  } catch (err) {
    console.error(`Error updating due date for ${issueKey}:`, err.response?.data || err.message);
  }
}

function maxDateString(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
}

// Main function to export BA to Jira (create issues for outputs excluding FR and NFR)
async function exportToJira(ba, activityDiagram = null, jiraCredentials = {}, existingProjectKey = null) {
  // Use provided credentials or fallback to environment variables
  const jiraBase = jiraCredentials.baseUrl || process.env.JIRA_BASE_URL;
  const jiraEmail = jiraCredentials.email || process.env.JIRA_EMAIL;
  const jiraApiToken = jiraCredentials.apiToken || process.env.JIRA_API_TOKEN;
  const jiraLeadAccountId = jiraCredentials.leadAccountId || process.env.JIRA_LEAD_ACCOUNT_ID;

  const headers = createAuthHeader(jiraEmail, jiraApiToken);

  // Initialize sequential date tracker starting from today
  const tracker = new DateTracker();

  let projectKey = existingProjectKey;
  let projectExists = false;

  if (projectKey) {
    // Verify project still exists in Jira
    try {
      await axios.get(`${jiraBase}/rest/api/3/project/${projectKey}`, { headers });
      projectExists = true;
    } catch (err) {
      console.log(`Project ${projectKey} not found in Jira, recreating...`);
      projectKey = null; // Will recreate
    }
  }

  if (!projectKey) {
    const projectSummary = buildJiraProjectSummary(ba, activityDiagram);
    // Create or ensure project exists
    projectKey = await createJiraProject(ba.title, projectSummary, jiraBase, headers, jiraLeadAccountId);
  }

  // Fetch existing issues to avoid duplicates
  let existingIssues = [];
  if (projectExists) {
    existingIssues = await searchJiraIssues(`project = "${projectKey}"`, jiraBase, headers);
  }
  const findIssue = (summary, type) => {
    return existingIssues.find(i => i.fields.issuetype.name === type && i.fields.summary === summary);
  };

  const issueMap = {}; // Holds Jira Keys mapped by title and ID
  const allItemsToLink = []; // For 2nd pass linking

  async function processSubtasks(subtasks, parentTaskKey) {
    if (!subtasks || !Array.isArray(subtasks)) return;
    for (const sub of subtasks) {
      let subTitle = typeof sub === 'object' ? (sub.title || sub.name || JSON.stringify(sub)) : String(sub);
      let subDesc = typeof sub === 'object' ? (sub.description || subTitle) : String(sub);
      if (typeof subTitle === 'string' && subTitle.length > 250) subTitle = subTitle.substring(0, 250) + "...";

      let existingSub = existingIssues.find(i => (i.fields.issuetype.name === "Sub-task" || i.fields.issuetype.name === "Subtask") && i.fields.summary === subTitle);
      if (!existingSub) {
        console.log("Creating Sub-task:", subTitle);
        try {
          await createIssueUnderEpic(projectKey, parentTaskKey, subTitle, subDesc, "Sub-task", jiraBase, headers);
        } catch (err) {
          if (err.response?.data?.errors?.issuetype) {
            try {
              await createIssueUnderEpic(projectKey, parentTaskKey, subTitle, subDesc, "Subtask", jiraBase, headers);
            } catch (err2) {
              console.error("Failed to create subtask", err2.response?.data);
            }
          } else {
            console.error("Failed to create subtask", err.response?.data);
          }
        }
      } else {
        console.log("Skipping existing Sub-task:", subTitle);
      }
    }
  }

  // Subtask helper that uses tracker for dates
  const originalProcessSubtasks = processSubtasks;
  // Override processSubtasks to inject dates
  async function processSubtasksWithDates(subtasks, parentTaskKey) {
    let latestDue = null;
    if (!subtasks || !Array.isArray(subtasks)) return null;
    for (const sub of subtasks) {
      let subTitle = typeof sub === 'object' ? (sub.title || sub.name || JSON.stringify(sub)) : String(sub);
      let subDesc = typeof sub === 'object' ? (sub.description || subTitle) : String(sub);
      if (typeof subTitle === 'string' && subTitle.length > 250) subTitle = subTitle.substring(0, 250) + "...";

      let existingSub = existingIssues.find(i => (i.fields.issuetype.name === "Sub-task" || i.fields.issuetype.name === "Subtask") && i.fields.summary === subTitle);
      if (!existingSub) {
        const { startDate, dueDate } = tracker.allocate(1); // 1 day per subtask
        latestDue = maxDateString(latestDue, dueDate);
        console.log("Creating Sub-task:", subTitle);
        try {
          await createIssueUnderEpic(projectKey, parentTaskKey, subTitle, subDesc, "Sub-task", jiraBase, headers, startDate, dueDate);
        } catch (err) {
          if (err.response?.data?.errors?.issuetype) {
            try {
              await createIssueUnderEpic(projectKey, parentTaskKey, subTitle, subDesc, "Subtask", jiraBase, headers, startDate, dueDate);
            } catch (err2) {
              console.error("Failed to create subtask", err2.response?.data);
            }
          } else {
            console.error("Failed to create subtask", err.response?.data);
          }
        }
      } else {
        console.log("Skipping existing Sub-task:", subTitle);
      }
    }
    return latestDue;
  }

  // Create Functional Requirements Epic
  let frEpicKey;
  const existingFrEpic = findIssue("Functional Requirements", "Epic");
  if (existingFrEpic) {
    frEpicKey = existingFrEpic.key;
  } else {
    const epicDates = tracker.allocate((ba.functional_requirements || []).length * 2);
    frEpicKey = await createEpic(projectKey, "Functional Requirements", jiraBase, headers, epicDates.startDate, epicDates.dueDate);
    // Reset tracker back to epic start since tasks fill this range
    tracker.current = new Date(epicDates.startDate);
  }

  let frEpicMaxDue = null;
  for (const fr of ba.functional_requirements || []) {
    const { title, desc, id, rawItem } = extractTitleAndDesc(fr, "FR Task");

    const existingTask = findIssue(title, "Task");
    let taskKey;
    let taskDue;
    if (!existingTask) {
      const { startDate, dueDate } = tracker.allocate(2); // 2 days per FR
      console.log("Creating Functional Requirement task:", title);
      taskKey = await createIssueUnderEpic(projectKey, frEpicKey, title, desc, "Task", jiraBase, headers, startDate, dueDate);
      taskDue = dueDate;
    } else {
      console.log("Skipping existing Functional Requirement task:", title);
      taskKey = existingTask.key;
    }

    issueMap[title.toLowerCase()] = taskKey;
    if (id) issueMap[String(id).toLowerCase()] = taskKey;
    allItemsToLink.push({ rawItem, taskKey });

    const subMaxDue = await processSubtasksWithDates(rawItem.subtasks, taskKey);
    const finalTaskDue = maxDateString(taskDue, subMaxDue);
    if (finalTaskDue && (!taskDue || finalTaskDue !== taskDue)) {
      await updateIssueDueDate(taskKey, jiraBase, headers, finalTaskDue);
    }
    frEpicMaxDue = maxDateString(frEpicMaxDue, finalTaskDue || taskDue);
  }
  if (frEpicKey && frEpicMaxDue) {
    await updateIssueDueDate(frEpicKey, jiraBase, headers, frEpicMaxDue);
  }

  // Create Non-Functional Requirements Epic
  let nfrEpicKey;
  const existingNfrEpic = findIssue("Non-Functional Requirements", "Epic");
  if (existingNfrEpic) {
    nfrEpicKey = existingNfrEpic.key;
  } else {
    const epicDates = tracker.allocate((ba.non_functional_requirements || []).length * 2);
    nfrEpicKey = await createEpic(projectKey, "Non-Functional Requirements", jiraBase, headers, epicDates.startDate, epicDates.dueDate);
    tracker.current = new Date(epicDates.startDate);
  }

  let nfrEpicMaxDue = null;
  for (const nfr of ba.non_functional_requirements || []) {
    const { title, desc, id, rawItem } = extractTitleAndDesc(nfr, "NFR Task");

    const existingTask = findIssue(title, "Task");
    let taskKey;
    let taskDue;
    if (!existingTask) {
      const { startDate, dueDate } = tracker.allocate(2); // 2 days per NFR
      console.log("Creating Non-Functional Requirement task:", title);
      taskKey = await createIssueUnderEpic(projectKey, nfrEpicKey, title, desc, "Task", jiraBase, headers, startDate, dueDate);
      taskDue = dueDate;
    } else {
      console.log("Skipping existing Non-Functional Requirement task:", title);
      taskKey = existingTask.key;
    }

    issueMap[title.toLowerCase()] = taskKey;
    if (id) issueMap[String(id).toLowerCase()] = taskKey;
    allItemsToLink.push({ rawItem, taskKey });

    const subMaxDue = await processSubtasksWithDates(rawItem.subtasks, taskKey);
    const finalTaskDue = maxDateString(taskDue, subMaxDue);
    if (finalTaskDue && (!taskDue || finalTaskDue !== taskDue)) {
      await updateIssueDueDate(taskKey, jiraBase, headers, finalTaskDue);
    }
    nfrEpicMaxDue = maxDateString(nfrEpicMaxDue, finalTaskDue || taskDue);
  }
  if (nfrEpicKey && nfrEpicMaxDue) {
    await updateIssueDueDate(nfrEpicKey, jiraBase, headers, nfrEpicMaxDue);
  }

  // Create User Stories
  let usEpicKey;
  const existingUsEpic = findIssue("User Stories", "Epic");
  if (existingUsEpic) {
    usEpicKey = existingUsEpic.key;
  } else if (ba.user_stories && ba.user_stories.length > 0) {
    const epicDates = tracker.allocate((ba.user_stories || []).length * 2);
    usEpicKey = await createEpic(projectKey, "User Stories", jiraBase, headers, epicDates.startDate, epicDates.dueDate);
    tracker.current = new Date(epicDates.startDate);
  }

  let usEpicMaxDue = null;
  if (usEpicKey && ba.user_stories) {
    for (const us of ba.user_stories) {
      const { title, desc, id, rawItem } = extractTitleAndDesc(us, "User Story");

      const existingUs = findIssue(title, "Task");
      let storyKey;
      let taskDue;
      if (!existingUs) {
        const { startDate, dueDate } = tracker.allocate(2); // 2 days per User Story
        console.log("Creating User Story:", title);
        storyKey = await createIssueUnderEpic(projectKey, usEpicKey, title, desc, "Task", jiraBase, headers, startDate, dueDate);
        taskDue = dueDate;
      } else {
        console.log("Skipping existing User Story:", title);
        storyKey = existingUs.key;
      }

      issueMap[title.toLowerCase()] = storyKey;
      if (id) issueMap[String(id).toLowerCase()] = storyKey;
      allItemsToLink.push({ rawItem, taskKey: storyKey });

      const subMaxDue = await processSubtasksWithDates(rawItem.subtasks, storyKey);
      const finalTaskDue = maxDateString(taskDue, subMaxDue);
      if (finalTaskDue && (!taskDue || finalTaskDue !== taskDue)) {
        await updateIssueDueDate(storyKey, jiraBase, headers, finalTaskDue);
      }
      usEpicMaxDue = maxDateString(usEpicMaxDue, finalTaskDue || taskDue);
    }
    if (usEpicMaxDue) {
      await updateIssueDueDate(usEpicKey, jiraBase, headers, usEpicMaxDue);
    }
  }

  // 2nd Pass: Link all items that have 'related_to'
  for (const itemObj of allItemsToLink) {
    const { rawItem, taskKey } = itemObj;
    const relatedList = rawItem.related_to || rawItem.relatedto || rawItem.related || [];

    if (taskKey && Array.isArray(relatedList)) {
      for (const related of relatedList) {
        let rTitle = related;
        if (typeof related === 'object') {
          rTitle = extractTitleAndDesc(related, "").title;
        }
        rTitle = String(rTitle).toLowerCase();

        let relatedKey = issueMap[rTitle];
        if (!relatedKey && typeof related === 'object' && related.id) {
          relatedKey = issueMap[String(related.id).toLowerCase()];
        }

        if (relatedKey) {
          await linkIssues(taskKey, relatedKey, jiraBase, headers);
        }
      }
    }
  }

  // Export Activity Diagram with PNG attachment
  if (activityDiagram) {
    const diagramDescription = `Latest activity diagram is attached as a PNG.\n\nMermaid definition:\n${activityDiagram}`;

    // Ensure there is only one "Activity Diagram" issue: update if it exists, otherwise create it.
    let activityDiagramIssueKey = findIssue("Activity Diagram", "Task")?.key;
    if (!activityDiagramIssueKey && projectKey) {
      const hits = await searchJiraIssues(`project = "${projectKey}" AND summary ~ "\"Activity Diagram\""`, jiraBase, headers);
      activityDiagramIssueKey = hits.find(i => i?.fields?.summary === "Activity Diagram")?.key || hits[0]?.key;
    }

    if (!activityDiagramIssueKey) {
      console.log("Creating Activity Diagram issue");
      const { startDate: diagStart, dueDate: diagDue } = tracker.allocate(1);
      activityDiagramIssueKey = await createIssue(
        projectKey,
        "Task",
        "Activity Diagram",
        diagramDescription,
        jiraBase,
        headers,
        diagStart,
        diagDue
      );
    } else {
      console.log("Updating existing Activity Diagram issue:", activityDiagramIssueKey);
      await updateIssueDescription(activityDiagramIssueKey, diagramDescription, jiraBase, headers);
    }

    // Replace attachment so only one latest diagram stays.
    try {
      const attachments = await getIssueAttachments(activityDiagramIssueKey, jiraBase, headers);
      for (const att of attachments) {
        await deleteAttachmentFromJira(att.id, jiraBase, headers);
      }

      const pngBuffer = await convertMermaidToPng(activityDiagram);
      await uploadAttachmentToJira(activityDiagramIssueKey, "activity-diagram.png", pngBuffer, jiraBase, headers);
    } catch (err) {
      console.error("Failed to replace diagram image:", err.message);
      console.log("Diagram conversion/attachment failed. Keeping text definition only.");
    }
  }

  // Export Assumptions, Constraints, and Out of Scope in a single task
  let combinedDetails = "";

  if (ba.assumptions && ba.assumptions.length > 0) {
    const assumptionsText = ba.assumptions
      .map(a => typeof a === "string" ? `• ${a}` : `• ${a.description || JSON.stringify(a)}`)
      .join("\n");
    combinedDetails += `Assumptions:\n${assumptionsText}\n\n`;
  }

  if (ba.constraints && ba.constraints.length > 0) {
    const constraintsText = ba.constraints
      .map(c => typeof c === "string" ? `• ${c}` : `• ${c.description || JSON.stringify(c)}`)
      .join("\n");
    combinedDetails += `Constraints:\n${constraintsText}\n\n`;
  }

  if (ba.out_of_scope && ba.out_of_scope.length > 0) {
    const outOfScopeText = ba.out_of_scope
      .map(o => typeof o === "string" ? `• ${o}` : `• ${o.description || JSON.stringify(o)}`)
      .join("\n");
    combinedDetails += `Out of Scope:\n${outOfScopeText}`;
  }

  if (combinedDetails.trim() && !findIssue("Requirements & Details", "Task")) {
    console.log("Creating Requirements and Details task");
    const { startDate: reqStart, dueDate: reqDue } = tracker.allocate(1);
    await createIssue(
      projectKey,
      "Task",
      "Requirements & Details",
      combinedDetails.trim(),
      jiraBase,
      headers,
      reqStart,
      reqDue
    );
  } else if (combinedDetails.trim()) {
    console.log("Skipping existing Requirements and Details task");
  }

  return projectKey;
}

// Export the function
module.exports = { exportToJira };
