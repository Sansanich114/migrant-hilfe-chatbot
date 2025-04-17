import dotenv from "dotenv";
import { classifyAndRespond } from "./openaiService.js";

dotenv.config();

export async function classifyMessage(conversationMessages, currentUserMessage) {
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

  // ✅ Step 2: Use the unified LLM call to classify, extract, summarize
  try {
    const result = await classifyAndRespond({ messages: conversationMessages }, currentUserMessage);
    const category = result?.category || "other";
    const language = result?.language || "en";
    console.log("🧠 LLM classification result:", { category, language });
    return { category, language };
  } catch (err) {
    console.error("⚠️ Unified classifier error:", err.message);
    return { category: "other", language: "en" };
  }
}