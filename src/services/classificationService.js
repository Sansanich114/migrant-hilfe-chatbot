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
You are a strict classifier that analyzes the current user message along with conversation history and profile info to determine the user's intent. Identify the language and categorize the intent into one of the following:
  - "salesman": if the user is inquiring about properties and you need to guide the conversation to gather more details.
  - "politeness": if the user is greeting or engaging in simple politeness.
  - "other": if the message is off-topic or unrelated to real estate.
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
    const validCategories = ["salesman", "politeness", "other"];

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
