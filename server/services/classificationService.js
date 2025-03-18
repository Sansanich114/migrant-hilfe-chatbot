// server/services/classificationService.js
import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

/**
 * Classifies the user's newest message by:
 *  - Detecting the language
 *  - Categorizing the topic
 *  - Checking if web search is required
 */
export async function classifyMessage(conversationMessages, currentUserMessage) {
  // Use whichever environment variable is available
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("API key missing: set OPENAI_API_KEY or OPENROUTER_API_KEY in your environment.");
  }

  const openai = new OpenAI({
    apiKey,
    // If you want to use openrouter.ai, you can uncomment:
    // baseURL: "https://openrouter.ai/api/v1",
  });

  // Build text representation of the conversation so far
  const conversationText = conversationMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const classificationPrompt = `
You are a strict classifier that identifies three things about the user's newest message:

1) Determine the language (like "en", "de", or "tr").
2) Identify the category. It can be:
   - "germany" if the message is about immigrating or living in Germany
   - "politeness" if the user is just being polite (greeting, etc.)
   - "other" if it's off-topic with no mention of Germany or immigration.
3) If the category is "germany", decide if a websearch is needed.

Return ONLY raw JSON (no markdown), of the form:
{
  "language": "...",
  "category": "...",
  "requiresWebsearch": true/false,
  "websearchExplanation": "..."
}

Conversation so far:
${conversationText}

User's New Message:
"${currentUserMessage}"
`.trim();

  try {
    // UPDATED: use "deepseek/deepseek-chat:free"
    const response = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat:free",
      messages: [{ role: "system", content: classificationPrompt }],
      temperature: 0,
      max_tokens: 150,
    });

    const rawOutput = response.choices[0].message.content.trim();
    console.log("Raw classification output:", rawOutput);

    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch (err) {
      console.error("Failed to parse classification JSON:", err);
      return {
        language: "en",
        category: "other",
        requiresWebsearch: false,
        websearchExplanation: "",
      };
    }

    let { language, category, requiresWebsearch, websearchExplanation } = parsed;
    const validCategories = ["germany", "politeness", "other"];

    if (!language || !validCategories.includes(category)) {
      return {
        language: "en",
        category: "other",
        requiresWebsearch: false,
        websearchExplanation: "",
      };
    }

    // If not "germany," force no websearch
    if (category !== "germany") {
      requiresWebsearch = false;
      websearchExplanation = "";
    } else if (typeof requiresWebsearch !== "boolean") {
      requiresWebsearch = false;
      websearchExplanation = "";
    }

    return { language, category, requiresWebsearch, websearchExplanation };
  } catch (err) {
    console.error("Classification error:", err);
    return {
      language: "en",
      category: "other",
      requiresWebsearch: false,
      websearchExplanation: "",
    };
  }
}
