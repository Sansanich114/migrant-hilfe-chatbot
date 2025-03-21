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

/**
 * System prompt: short, direct, no polite filler.
 * Always ask clarifying questions about the user's real estate needs.
 * Provide short suggestions that are context-related.
 */
const systemPrompt = `
You are a concise and pragmatic real estate assistant.
You do NOT use polite filler or say "thank you." 
Always respond in short, direct sentences with relevant real estate info.
Ask at least one clarifying question if needed. 
Provide 1 or 2 context-specific suggestions (e.g., "3-bedroom", "Garden", "Near city center"), 
and return them in JSON with the structure:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
`.trim();

async function callDeepSeekChat(messages, temperature = 0.8) {
  const response = await openai.chat.completions.create({
    model: "deepseek/deepseek-chat:free",
    messages,
    temperature,
    max_tokens: 500,
  });
  return response.choices[0].message.content;
}

export async function generateRealEstateReply(conversation, message, language) {
  const promptMessages = conversation.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const realEstatePrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

User's latest query: "${message}"

Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
  `.trim();

  const messages = [{ role: "system", content: realEstatePrompt }];
  const rawOutput = await callDeepSeekChat(messages, 0.8);
  return parseAiResponse(rawOutput);
}

export async function generatePolitenessReply(conversation, language) {
  const promptMessages = conversation.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const politenessPrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

The user is just being polite or greeting. Provide a short greeting back, 
then offer 1 or 2 quick suggestions about real estate topics.

Return valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
  `.trim();

  const messages = [{ role: "system", content: politenessPrompt }];
  const rawOutput = await callDeepSeekChat(messages, 0.7);
  return parseAiResponse(rawOutput);
}

export async function generateOffTopicReply(conversation, language) {
  const promptMessages = conversation.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const offTopicPrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

User's message is off-topic. Politely redirect them to real estate questions. 
Return valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
  `.trim();

  const messages = [{ role: "system", content: offTopicPrompt }];
  const rawOutput = await callDeepSeekChat(messages, 0.7);
  return parseAiResponse(rawOutput);
}

export async function generateIntroReply(language) {
  const introPrompt = `
${systemPrompt}

Respond in ${language} with a short introduction about real estate assistance. 
Offer 1 or 2 suggestions for what they can ask next.

Return valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
  `.trim();

  const messages = [{ role: "system", content: introPrompt }];
  const rawOutput = await callDeepSeekChat(messages, 0.7);
  return parseAiResponse(rawOutput);
}

export async function generateConversationSummary(conversation, language) {
  const conversationText = conversation.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const summaryPrompt = `
Please provide a very short summary in ${language} of the conversation so far. 
Focus on property interests, location, budget, etc.

Conversation:
${conversationText}
  `.trim();

  const messages = [{ role: "system", content: summaryPrompt }];
  try {
    const rawOutput = await callDeepSeekChat(messages, 0.5);
    return rawOutput.trim();
  } catch (err) {
    console.error("Error generating conversation summary:", err);
    return "";
  }
}
