// server/utils/helpers.js

// Remove markdown code fences and common formatting characters
export function stripFormatting(text) {
  // Remove markdown code fences like ```json or ```
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    // Remove the starting and ending triple backticks and any language tags
    return match.replace(/```/g, "").trim();
  });
  // Remove other markdown formatting characters
  return text.replace(/\*\*|- |# /g, "").trim();
}

// Attempt to extract and parse JSON from the raw response text.
// It looks for the first "{" and the last "}" and extracts that substring.
export function parseAiResponse(raw) {
  let jsonString = raw.trim();

  // Remove code fences if present
  jsonString = jsonString.replace(/```(json)?/gi, "").replace(/```/g, "").trim();

  const firstBrace = jsonString.indexOf("{");
  const lastBrace = jsonString.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    // Fallback: return the raw text stripped of formatting as the reply.
    parsed = { reply: stripFormatting(raw), suggestions: [] };
  }
  if (!parsed.reply || !parsed.reply.trim()) {
    parsed.reply = "Sorry, I don't have an answer right now.";
  }
  if (!Array.isArray(parsed.suggestions)) {
    parsed.suggestions = [];
  }
  return parsed;
}
