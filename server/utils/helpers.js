// server/utils/helpers.js

// Clean non-JSON reply for fallback display
export function stripFormatting(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, "").trim())
    .replace(/\*\*|[-#>]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Safe JSON parser with multiple fallbacks
export function parseAiResponse(raw) {
  if (!raw || typeof raw !== "string") return null;

  let jsonString = raw.trim();

  // Clean markdown code blocks and trailing commas
  jsonString = jsonString
    .replace(/```(json)?/gi, "")
    .replace(/```/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .trim();

  // Try strict full JSON parse
  try {
    return JSON.parse(jsonString);
  } catch (e1) {
    // Try to extract and parse only the JSON block
    const match = jsonString.match(/{[\s\S]*?}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        console.error("⚠️ Nested JSON parse failed:", e2.message);
      }
    }
    console.error("❌ Failed to parse AI response:", raw);
  }

  // Fallback structure if not valid JSON
  return {
    reply: stripFormatting(raw),
    suggestions: [],
  };
}