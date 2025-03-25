// classificationService.js
import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

export async function classifyMessage(conversationMessages, currentUserMessage) {
  const apiKey = process.env.OPENROUTER_API_KEY || "DUMMY_PLACEHOLDER";
  
  const openai = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "X-OpenRouter-Api-Key": apiKey,
    },
  });

  const conversationText = conversationMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const classificationPrompt = `
You are a strict classifier that identifies three things about the user's newest message:

1) Determine the language (like "en", "de", or "es").
2) Identify the category. It can be:
   - "realestate" if the message is about property inquiries, market trends, or real estate financing. If the message contains location or property-related keywords such as "Berlin", "apartment", "house", "property", "rent", or "buy", classify it as "realestate".
   - "politeness" if the user is just being polite (e.g., greetings).
   - "other" if it's off-topic.

Return ONLY raw JSON (no markdown) in the following format:
{
  "language": "...",
  "category": "...",
  "requiresWebsearch": false,
  "websearchExplanation": ""
}

Conversation so far:
${conversationText}

User's New Message:
"${currentUserMessage}"
  `.trim();

  try {
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
    const validCategories = ["realestate", "politeness", "other"];

    if (!language || !validCategories.includes(category)) {
      return {
        language: "en",
        category: "other",
        requiresWebsearch: false,
        websearchExplanation: "",
      };
    }

    // If not real estate, no web search needed
    if (category !== "realestate") {
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
