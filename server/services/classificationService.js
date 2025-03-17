// ------------------------
// server/services/classificationService.js
// ------------------------
import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

// 1) Create an OpenAI client instance
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Classifies the user's newest message by:
 *  - Detecting the language
 *  - Categorizing the topic
 *  - Checking if web search is required (for time-sensitive info)
 */
export async function classifyMessage(conversationMessages, currentUserMessage) {
  // Build text representation of the conversation so far
  const conversationText = conversationMessages
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");

  // We’ll pass this entire prompt in as a single system message
  const classificationPrompt = `
You are a strict classifier that identifies three things about the user's newest message:

1) Determine the language (like "en", "de", or "tr").
2) Identify the category. It can be:
   - "germany" if the message is about immigrating or living in Germany
   - "politeness" if the user is just being polite (greeting, etc.)
   - "other" if it's off-topic with no mention of Germany or immigration.
3) If the category is "germany", decide if a websearch is needed for time-sensitive info 
   (for example, if the user asks about recent laws or COVID rules). If needed, set "requiresWebsearch" to true
   and provide a short reason in "websearchExplanation". Otherwise, set it to false.

Conversation so far:
${conversationText}

User's New Message:
"${currentUserMessage}"

Return ONLY raw JSON (no markdown), of the form:
{
  "language": "...",
  "category": "...",
  "requiresWebsearch": true/false,
  "websearchExplanation": "..."
}
  `.trim();

  try {
    // 2) Make a Chat Completion request to GPT-3.5
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: classificationPrompt
        }
      ],
      temperature: 0,
      max_tokens: 150
    });

    // 3) Extract the raw text from the assistant’s reply
    const rawOutput = response.choices[0].message.content.trim();
    console.log("Raw classification output:", rawOutput);

    // 4) Attempt to parse the JSON
    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch (err) {
      console.error("Failed to parse classification JSON:", err);
      // Return a fallback if JSON parsing fails
      return { 
        language: "en", 
        category: "other", 
        requiresWebsearch: false, 
        websearchExplanation: "" 
      };
    }

    // 5) Validate the fields
    let { language, category, requiresWebsearch, websearchExplanation } = parsed;
    const validCategories = ["germany", "politeness", "other"];

    if (!language || !validCategories.includes(category)) {
      return {
        language: "en",
        category: "other",
        requiresWebsearch: false,
        websearchExplanation: ""
      };
    }

    if (category !== "germany") {
      // If not Germany, ensure we don’t do websearch
      requiresWebsearch = false;
      websearchExplanation = "";
    } else if (typeof requiresWebsearch !== "boolean") {
      // Must be boolean
      requiresWebsearch = false;
      websearchExplanation = "";
    }

    // 6) Return the classification info
    return { language, category, requiresWebsearch, websearchExplanation };

  } catch (err) {
    // 7) If the API call fails, log the error and return a fallback
    console.error("Classification error:", err);
    return {
      language: "en",
      category: "other",
      requiresWebsearch: false,
      websearchExplanation: ""
    };
  }
}
