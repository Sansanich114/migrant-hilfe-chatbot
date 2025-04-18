// server/utils/helpers.js
import { repair } from 'jsonrepair';

// Clean non‑JSON reply for fallback display
export function stripFormatting(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, "").trim())
    .replace(/\*\*|[-#>]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Extract the first balanced JSON object from a string
export function extractFirstJson(text) {
  const start = text.indexOf("{");
  if (start === -1) return "";
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  // If braces never balanced, return from first brace to end
  return text.slice(start);
}

// Safe JSON parser with repair & retry support
export function parseAiResponse(raw) {
  if (!raw || typeof raw !== "string") return null;

  // 1. Grab only the first JSON-looking chunk
  const candidate = extractFirstJson(raw);
  if (!candidate) {
    console.error("No JSON object found in:", raw);
    return null;
  }

  // 2. Attempt automatic repair (fix trailing commas, single quotes, etc.)
  let toParse = candidate;
  try {
    toParse = repair(candidate);
  } catch (repairErr) {
    console.warn("JSON repair failed, using raw block:", repairErr.message);
  }

  // 3. Parse
  try {
    return JSON.parse(toParse);
  } catch (parseErr) {
    console.error("JSON.parse failed after repair:", parseErr.message, "\nContent:", toParse);
    return null;
  }
}
