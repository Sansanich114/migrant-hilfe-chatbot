import dotenv from "dotenv";
import { OpenAI } from "openai";
import { parseAiResponse } from "../../server/utils/helpers.js";

dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY;
const openai = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: { "X-OpenRouter-Api-Key": apiKey },
});

export async function classifyMessage(conversationMessages, currentUserMessage) {
  // Step 1: Quick bait test
  const baitPatterns = [
    /what('?s| is) (2\s*\+\s*2|the capital of \w+)/i,
    /define [\w\s]+/i,
    /who (is|was) (the president|ceo|author|founder)/i,
    /translate [\w\s]+/i,
    /explain [\w\s]+/i,
    /tell me a (joke|fact)/i,
    /\b(2\s*\+\s*2|9\s*x\s*9|capital of)\b/i,
  ];
  if (baitPatterns.some(p => p.test(currentUserMessage))) {
    return { language: "en", category: "other" };
  }

  // Step 2: Ask DeepSeek to classify
  const prompt = `
You are a classifier for Sasha, a real estate assistant from Beispiel Immobilien GMBH.

Classify this message based on intent:

- "salesman" → real estate inquiry (needs context, recommendations, or extraction)
- "politeness" → greetings or thank you
- "other" → off-topic, test, or irrelevant

Return JSON only:
{ "category": "...", "language": "..." }

Message: "${currentUserMessage}"
Conversation:
${conversationMessages.map(m => `${m.role}: ${m.content}`).join("\n")}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "mistralai/mistral-nemo:free", // This is the DeepSeek v3-compatible free model
      messages: [{ role: "system", content: prompt }],
      temperature: 0,
    });

    const raw = response.choices?.[0]?.message?.content?.trim();
    const parsed = parseAiResponse(raw);
    const category = parsed?.category || "other";
    const language = parsed?.language || "en";

    return { category, language };
  } catch (err) {
    console.error("⚠️ Classification failed:", err.message);
    return { category: "other", language: "en" };
  }
}
