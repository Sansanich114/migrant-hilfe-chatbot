function stripFormatting(text) {
    return text.replace(/\*\*|- |# /g, "").trim();
  }
  
  function parseAiResponse(raw) {
    let jsonString = raw.trim();
    const firstBrace = jsonString.indexOf("{");
    const lastBrace = jsonString.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
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
  
  module.exports = { stripFormatting, parseAiResponse };
  