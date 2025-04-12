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

  // 🔍 Step 1: Block known AI test/bait questions
  const baitPatterns = [
    /what('?s| is) (2\s*\+\s*2|the capital of \w+)/i,
    /define [\w\s]+/i,
    /who (is|was) (the president|ceo|author|founder)/i,
    /translate [\w\s]+/i,
    /explain [\w\s]+/i,
    /tell me a (joke|fact)/i,
    /\b(2\s*\+\s*2|9\s*x\s*9|capital of)/i,
  ];
  if (baitPatterns.some(p => p.test(currentUserMessage))) {
    console.log("🚫 Detected AI bait question – forcing category 'other'");
    return { language: "en", category: "other" };
  }

  // 🧠 Step 2: Generate conversation summary
  const summary = await generateConversationSummary({ messages: conversationMessages }, "English");
  console.log("📝 Summary for classification:", summary);

  // 🧠 Step 3: Extract intent using smart extraction
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

  // 🧪 Step 5: Redundant classifier (optional fallback)
  if (finalCategory === "other") {
    const conversationText = conversationMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const classificationPrompt = `
You are a strict classifier analyzing user messages directed at Sasha, a real estate assistant working for Beispiel Immobilien GMBH.

Sasha helps clients with real estate needs: buying, renting, and selling property in Berlin.

Classify the intent of the user message:
- "salesman": if it is about real estate
- "politeness": if it's just greeting or thanking Sasha
- "other": if it's off-topic or irrelevant

Return ONLY JSON (no markdown), like:
{
  "language": "...",
  "category": "..."
}

Conversation so far:
${conversationText}

User message:
"${currentUserMessage}"
`.trim();

    try {
      const response = await openai.chat.completions.create({
        model: "deepseek/deepseek-chat:free",
        messages: [{ role: "system", content: classificationPrompt }],
        temperature: 0,
        max_tokens: 200,
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
      console.error("⚠️ Error during fallback classification:", err.message);
    }
  }

  return {
    language: "en",
    category: finalCategory,
  };
}
