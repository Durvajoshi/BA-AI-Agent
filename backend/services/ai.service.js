const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct";
const OPENROUTER_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS || 60000);
const OPENROUTER_MAX_RETRIES = Number(process.env.OPENROUTER_MAX_RETRIES || 2);
const OPENROUTER_SITE_URL =
  process.env.OPENROUTER_SITE_URL || "http://localhost:5173";
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || "AI BA Agent";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildOpenRouterUrl(pathname) {
  const base = String(OPENROUTER_BASE_URL || "").replace(/\/+$/, "");
  const path = String(pathname || "").replace(/^\/+/, "");
  return `${base}/${path}`;
}

function getErrorSummary(err) {
  if (!err) return "Unknown error";
  const message = err.message ? String(err.message) : String(err);
  const cause = err.cause;
  if (cause && typeof cause === "object") {
    const code = cause.code ? String(cause.code) : "";
    const host = cause.hostname ? String(cause.hostname) : "";
    if (code || host) return `${message} (cause: ${[code, host].filter(Boolean).join(" ")})`;
  }
  return message;
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

function isRetryableFetchError(err) {
  const summary = getErrorSummary(err);
  return (
    /AbortError|aborted|timed out/i.test(summary) ||
    /ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|UND_ERR_CONNECT_TIMEOUT/i.test(
      summary
    ) || /fetch failed/i.test(summary)
  );
}

async function callOpenRouter(systemPrompt, userPrompt, userApiKey) {
  const apiKey = userApiKey || OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenRouter misconfigured: OPENROUTER_API_KEY is missing in the backend environment."
    );
  }

  const url = buildOpenRouterUrl("/chat/completions");
  const payload = {
    model: OPENROUTER_MODEL,
    messages: [
      { role: "system", content: String(systemPrompt || "") },
      { role: "user", content: String(userPrompt || "") }
    ]
  };

  let lastError;
  for (let attempt = 0; attempt <= OPENROUTER_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": OPENROUTER_SITE_URL,
          "X-Title": OPENROUTER_APP_NAME,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const message = `OpenRouter API error: ${response.status} ${response.statusText}`;
        console.error(message, errorText);

        if (attempt < OPENROUTER_MAX_RETRIES && isRetryableStatus(response.status)) {
          await sleep(400 * Math.pow(2, attempt));
          continue;
        }

        throw new Error(message);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("OpenRouter API error: empty response content");
      }
      return content;
    } catch (err) {
      lastError = err;

      const aborted =
        err?.name === "AbortError" || /aborted/i.test(String(err?.message || ""));
      if (aborted) {
        const timeoutMessage = `OpenRouter request timed out after ${OPENROUTER_TIMEOUT_MS}ms`;
        console.error(timeoutMessage);
        lastError = new Error(timeoutMessage);
      }

      if (attempt < OPENROUTER_MAX_RETRIES && isRetryableFetchError(err)) {
        console.error("OpenRouter request failed (retrying):", getErrorSummary(err));
        await sleep(400 * Math.pow(2, attempt));
        continue;
      }

      console.error("OpenRouter request failed:", getErrorSummary(err));
      throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("OpenRouter request failed");
}

// Backward compatible name (older code calls it "Groq" even though we use OpenRouter).
const callGroq = callOpenRouter;

function cleanJson(str) {
  if (typeof str !== 'string') return str;
  let cleaned = str.trim();
  
  // 1. Remove markdown code fences if present
  if (cleaned.includes("```json")) {
    cleaned = cleaned.split("```json")[1].split("```")[0].trim();
  } else if (cleaned.includes("```")) {
    const parts = cleaned.split("```");
    if (parts.length >= 3) {
      cleaned = parts[1].trim();
    }
  }

  // 2. Find first { and last } to isolate JSON object
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. Handle literal newlines inside strings (the "Bad control character" error)
  // This regex finds content between double quotes and replaces literal newlines with \n
  cleaned = cleaned.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/gs, (match) => {
    return match.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  });

  // 4. Remove trailing commas (e.g. [1, 2, ] -> [1, 2])
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
  
  return cleaned;
}

module.exports = { callOpenRouter, callGroq, cleanJson };
