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
    /tell me a (joke|fact)/i
  ];
  if (baitPatterns.some(p => p.test(currentUserMessage))) {
    console.log("🚫 Detected AI bait question – forcing category 'other'");
    return { language: "en", category: "other" };
  }

  // 🧠 Step 2: Get summary
  const summary = await generateConversationSummary({ messages: conversationMessages }, "English");
  console.log("📝 Summary for classification:", summary);

  // 🧠 Step 3: Extract intent
  const intent = await extractIntent(currentUserMessage, summary);
  const extracted = intent?.extractedInfo || {};
  const missing = intent?.missingInfo || [];
  const mood = intent?.userMood || "";

  console.log("🧠 Intent:", intent);

  // 🧮 Step 4: Rule-based classification
  const hasRealEstateSignal =
    extracted.usage || extracted.location || extracted.propertyType || extracted.budget;

  const isSoftPoliteness =
    mood === "positive" &&
    Object.values(extracted).every(val =>
      typeof val === "string" ? !val : Object.values(val).every(v => !v)
    ) &&
    missing.length === 0;

  let finalCategory = "other";
  if (hasRealEstateSignal) {
    finalCategory = "salesman";
  } else if (isSoftPoliteness) {
    finalCategory = "politeness";
  }

  return {
    language: "en",
    category: finalCategory
  };
}
