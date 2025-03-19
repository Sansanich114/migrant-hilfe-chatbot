import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();
import { parseAiResponse } from "../utils/helpers.js";

// Updated system prompt for real estate context
const systemPrompt =
  process.env.SYSTEM_PROMPT ||
  `
You are a professional real estate assistant chatbot, designed to help potential buyers, renters, and investors navigate the real estate market.

Rules:
1. Your responses should be clear, concise, and professional.
2. Provide relevant property information, financing options, and market insights.
3. When necessary, guide users to appropriate website pages for more details.
4. Offer exactly 2 follow-up questions to keep the conversation moving.
5. Return responses in JSON format:
   {
     "reply": "...",
     "suggestions": ["...", "..."]
   }
`.trim();

// Use OPENROUTER_API_KEY environment variable instead of X-OpenRouter-Api-Key
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
 * Helper to call the "deepseek/deepseek-chat:free" model 
 * for chat completions via OpenRouter.
 */
async function callDeepSeekChat(messages, temperature = 0.8) {
  const response = await openai.chat.completions.create({
    model: "deepseek/deepseek-chat:free",
    messages,
    temperature,
    max_tokens: 500,
  });
  return response.choices[0].message.content;
}

// Generate real estate-related replies
export async function generateRealEstateReply(conversation, message, language) {
  const promptMessages = conversation.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const realEstatePrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

User's latest query: "${message}"
Provide a professional and concise response with relevant property information, financing advice, or market insights.
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

The user is just being polite. Respond in ${language} with a short, friendly greeting.
Provide exactly 2 short suggestions for what they might ask about real estate next.
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
  `.trim();

  const messages = [{ role: "system", content: politenessPrompt }];
  const rawOutput = await callDeepSeekChat(messages, 0.8);
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

The user's latest message is off-topic. Kindly remind the user to ask questions related to real estate.
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
  `.trim();

  const messages = [{ role: "system", content: offTopicPrompt }];
  const rawOutput = await callDeepSeekChat(messages, 0.8);
  return parseAiResponse(rawOutput);
}

export async function generateIntroReply(language) {
  const introPrompt = `
${systemPrompt}

Respond in ${language} with a friendly introduction greeting the user.
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
  `.trim();

  const messages = [{ role: "system", content: introPrompt }];
  const rawOutput = await callDeepSeekChat(messages, 0.8);
  return parseAiResponse(rawOutput);
}

export async function generateConversationSummary(conversation, language) {
  const conversationText = conversation.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const summaryPrompt = `
Please provide a brief summary in ${language} of the conversation so far. Include key points such as property interests, market queries, and user preferences.
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
