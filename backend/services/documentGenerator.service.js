const pool = require("../db/postgres");
const { callOpenRouter } = require("./ai.service");

async function generatePRD(baJson) {
  const systemPrompt = `
You are an expert Product Manager.
Your task is to generate a comprehensive Product Requirement Document (PRD) based on the provided Business Analysis (BA) JSON.

STRICT RULES:
1. Output ONLY valid Markdown format.
2. The document MUST include EXACTLY these sections with these specific headers:
   - Overview
   - Problem Statement
   - Goals
   - KPIs
   - User Personas
   - User Flow
   - Features
   - Timeline
3. Do not include introductory conversational text (e.g., "Here is your PRD"). Start directly with the Markdown heading (e.g., "# Product Requirement Document" or "## Overview").
4. Expand logically on the provided requirements to flesh out the PRD naturally.
5. Do not wrap the output in a JSON object or stringify it. Output raw markdown.
`;

  return callOpenRouter(systemPrompt, JSON.stringify(baJson));
}

async function generateBRD(baJson) {
  const systemPrompt = `
You are an expert Business Analyst.
Your task is to generate a comprehensive Business Requirement Document (BRD) based on the provided Business Analysis (BA) JSON.

STRICT RULES:
1. Output ONLY valid Markdown format.
2. The document MUST include standard BRD sections such as:
   - Executive Summary
   - Project Objectives
   - Scope (In-Scope & Out-of-Scope)
   - Functional Requirements
   - Non-Functional Requirements
   - Assumptions & Constraints
3. Do not include introductory conversational text (e.g., "Here is your BRD"). Start directly with the Markdown heading.
4. Expand logically on the provided requirements to flesh out the BRD naturally.
5. Do not wrap the output in a JSON object or stringify it. Output raw markdown.
`;

  return callOpenRouter(systemPrompt, JSON.stringify(baJson));
}

module.exports = {
  generatePRD,
  generateBRD
};
