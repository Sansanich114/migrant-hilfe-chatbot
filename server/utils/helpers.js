// server/utils/helpers.js

// Remove markdown code fences and common formatting characters
export function stripFormatting(text) {
  // Remove markdown code fences like ```json or ```
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```/g, "").trim();
  });
  return text.replace(/\*\*|- |# /g, "").trim();
}

// Safe JSON parser with multiple fallbacks
export function parseAiResponse(raw) {
  if (!raw || typeof raw !== "string") return null;

  let jsonString = raw.trim();

  // Remove markdown-style wrappers and fix common issues
  jsonString = jsonString
    .replace(/```(json)?/gi, '')
    .replace(/```/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .trim();

  // Try full JSON parse
  try {
    return JSON.parse(jsonString);
  } catch (e1) {
    // Try extracting inner JSON block
    const match = jsonString.match(/{[\s\S]+}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        console.error("⚠️ Nested JSON parse failed:", e2.message);
      }
    }
    console.error("❌ Failed to parse AI response:", raw);
  }

  // Fallback to treating raw text as plain reply
  return {
    reply: stripFormatting(raw),
    suggestions: [],
  };
}