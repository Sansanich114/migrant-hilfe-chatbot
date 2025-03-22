import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();
import { parseAiResponse } from "../utils/helpers.js";

const apiKey = process.env.OPENROUTER_API_KEY || "DUMMY_PLACEHOLDER";
if (!process.env.OPENROUTER_API_KEY) {
  console.warn("Warning: OPENROUTER_API_KEY environment variable is not set. Using a dummy placeholder.");
}

const openai = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "X-OpenRouter-Api-Key": apiKey,
  },
});

// Minimal fallback if no system message is present
const fallbackSystemPrompt = "You are a helpful real estate assistant.";

/**
 * A generic function to call the chat model.
 * Ensures we have at least one system message in the chain.
 */
async function callDeepSeekChat(messages, temperature = 0.8) {
  // If no system message is present, insert a fallback
  const hasSystem = messages.some((m) => m.role === "system");
  if (!hasSystem) {
    messages.unshift({
      role: "system",
      content: fallbackSystemPrompt,
    });
  }

  const response = await openai.chat.completions.create({
    model: "deepseek/deepseek-chat:free",
    messages,
    temperature,
    max_tokens: 500,
  });
  return response.choices[0].message.content;
}

/**
 * Generate a real estate related reply using the conversation so far.
 * Adds a system-level note to return JSON.
 */
export async function generateRealEstateReply(conversation, message, language) {
  // Convert stored conversation messages into the format required by OpenAI
  const messages = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Add a short system instruction to ensure JSON output
  messages.push({
    role: "system",
    content: `
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
    `.trim(),
  });

  const rawOutput = await callDeepSeekChat(messages, 0.8);
  return parseAiResponse(rawOutput);
}

/**
 * Generate a reply for polite/greeting messages.
 */
export async function generatePolitenessReply(conversation, language) {
  const messages = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messages.push({
    role: "system",
    content: `
The user is greeting or being polite. Respond briefly and politely, then offer 1 or 2 short suggestions about real estate, in valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
    `.trim(),
  });

  const rawOutput = await callDeepSeekChat(messages, 0.7);
  return parseAiResponse(rawOutput);
}

/**
 * Generate a reply for off-topic queries.
 */
export async function generateOffTopicReply(conversation, language) {
  const messages = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messages.push({
    role: "system",
    content: `
User's message is off-topic. Politely guide them back to real estate topics. Return valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
    `.trim(),
  });

  const rawOutput = await callDeepSeekChat(messages, 0.7);
  return parseAiResponse(rawOutput);
}

/**
 * Optional function if you still want an AI-based introduction for other use-cases.
 */
export async function generateIntroReply(language) {
  const messages = [
    {
      role: "system",
      content: fallbackSystemPrompt,
    },
    {
      role: "system",
      content: `
Respond in ${language} with a short introduction about real estate assistance.
Offer 1 or 2 suggestions for what they can ask next, in valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
      `.trim(),
    },
  ];

  const rawOutput = await callDeepSeekChat(messages, 0.7);
  return parseAiResponse(rawOutput);
}

/**
 * Generate a short summary of the conversation so far.
 */
export async function generateConversationSummary(conversation, language) {
  const messages = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messages.push({
    role: "system",
    content: `
Please provide a short summary in ${language} of the conversation so far,
focusing on property interests, location, and budget.
    `.trim(),
  });

  try {
    const rawOutput = await callDeepSeekChat(messages, 0.5);
    return rawOutput.trim();
  } catch (err) {
    console.error("Error generating conversation summary:", err);
    return "";
  }
}
