// server/services/classificationService.js
import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

export async function classifyMessage(conversationMessages, currentUserMessage) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY in environment variables");
  }
  
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
You are a strict classifier that analyzes both the current user message and any available profile or conversation history to determine the user's stage in the real estate inquiry process.
1) Determine the language (e.g., "en", "de", "es").
2) Identify the category as follows:
   - "realestate_exploratory": if the user’s message is general or exploratory.
   - "realestate_qualified": if the user's message, combined with known preferences (e.g. specific location, price range, property type), indicates readiness for scheduling a meeting.
   - "politeness": if the user is simply greeting or being polite.
   - "other": if the message is off-topic.
Return ONLY raw JSON (no markdown) in the following format:
{
  "language": "...",
  "category": "..."
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
      };
    }

    const { language, category } = parsed;
    const validCategories = ["realestate_exploratory", "realestate_qualified", "politeness", "other"];

    if (!language || !validCategories.includes(category)) {
      return {
        language: "en",
        category: "other",
      };
    }
    return { language, category };
  } catch (err) {
    console.error("Classification error:", err);
    return {
      language: "en",
      category: "other",
    };
  }
}
