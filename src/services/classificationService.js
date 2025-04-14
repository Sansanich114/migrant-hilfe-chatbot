// server/services/classificationService.js

import { OpenAI } from "openai";
import dotenv from "dotenv";
import { parseAiResponse } from "../../server/utils/helpers.js";
import { extractIntent, generateConversationSummary } from "./openaiService.js";

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

  // 🔍 Step 1: Block known AI test / bait patterns
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
    console.log("🚫 Detected AI bait or joke question – forcing category 'other'");
    return { language: "en", category: "other" };
  }

  // 🧠 Step 2: Generate conversation summary
  const summary = await generateConversationSummary({ messages: conversationMessages }, "English");
  console.log("📝 Summary for classification:", summary);

  // 🧠 Step 3: Extract intent using semantic analysis
  const intent = await extractIntent(currentUserMessage, summary);
  const extracted = intent?.extractedInfo || {};
  const missing = intent?.missingInfo || [];
  const mood = intent?.userMood || "";
  console.log("🧠 Intent:", intent);

  // 🧮 Step 4: Rule-based classification
  const hasRealEstateSignal =
    extracted.usage || extracted.location || extracted.propertyType || extracted.budget;

  const isEmpty = Object.values(extracted).every(val =>
    typeof val === "string" ? !val : Object.values(val).every(v => !v)
  );

  const isSoftPoliteness = mood === "positive" && isEmpty && missing.length === 0;

  let finalCategory = "other";
  if (hasRealEstateSignal) {
    finalCategory = "salesman";
  } else if (isSoftPoliteness) {
    finalCategory = "politeness";
  }

  // 🧪 Step 5: Optional fallback classifier
  if (finalCategory === "other") {
    const conversationText = conversationMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const classificationPrompt = `
You are a classifier for Sasha, a real estate assistant from Beispiel Immobilien GMBH (Berlin).

Classify the intent of the user message:
- "salesman" = real estate request
- "politeness" = greeting / gratitude
- "other" = unrelated / vague / test-like

Return plain JSON only:
{ "language": "...", "category": "..." }

Conversation:
${conversationText}

Message:
"${currentUserMessage}"
`.trim();

    try {
      const response = await openai.chat.completions.create({
        model: "deepseek/deepseek-chat:free",
        messages: [{ role: "system", content: classificationPrompt }],
        temperature: 0,
      });

      const rawOutput = response.choices?.[0]?.message?.content?.trim();
      console.log("🔍 Raw fallback classification output:", rawOutput);
      const parsed = parseAiResponse(rawOutput);
      const { language, category } = parsed || {};
      const validCategories = ["salesman", "politeness", "other"];

      if (language && validCategories.includes(category)) {
        return { language, category };
      }

      console.warn("⚠️ Invalid fallback classification, defaulting to 'other'");
    } catch (err) {
      console.error("⚠️ Fallback classifier error:", err.message);
    }
  }

  return {
    language: "en",
    category: finalCategory,
  };
}
