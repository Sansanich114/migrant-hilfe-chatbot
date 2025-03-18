// server/services/openaiService.js
import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();
import { parseAiResponse } from "../utils/helpers.js";

// Your system prompt text:
const systemPrompt =
  process.env.SYSTEM_PROMPT ||
  `
You are Sasha, a friendly migration assistant who explains things in simple language (easy enough for a 13-year-old, but still accurate).
Rules:
1. Your answers should be short and clear.
2. No direct links. Summarize any info you find.
3. If you have extra facts from web research, put them in your answer.
4. Provide exactly 2 short suggestions that are relevant next questions the user might ask.
5. Return valid JSON:
   {
     "reply": "...",
     "suggestions": ["...", "..."]
   }
`.trim();

// Create an OpenAI client pointing to OpenRouter
// This looks for process.env.OPENROUTER_API_KEY
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "X-OpenRouter-Api-Key": process.env.OPENROUTER_API_KEY,
  },
});

/** 
 * Main helper that calls the "deepseek/deepseek-chat:free" model 
 * for chat completions.
 */
async function callDeepSeekChat(messages, temperature = 0.8) {
  // Note the model name: "deepseek/deepseek-chat:free"
  const response = await openai.chat.completions.create({
    model: "deepseek/deepseek-chat:free",
    messages,
    temperature,
    max_tokens: 500,
  });
  return response.choices[0].message.content;
}

/** Politeness reply */
export async function generatePolitenessReply(conversation, language) {
  const promptMessages = conversation.messages
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");
  const politenessPrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

The user is just being polite. Respond in ${language} with a short, friendly greeting.
Provide exactly 2 short suggestions for what they might ask about Germany or migration next.
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

/** Germany-specific reply */
export async function generateGermanyReply(
  conversation,
  message,
  language,
  requiresWebsearch
) {
  const promptMessages = conversation.messages
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");
  const webInfoInstruction = requiresWebsearch
    ? "Incorporate up-to-date facts from recent data if available."
    : "";
  const germanyPrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

User's latest query: "${message}"
${webInfoInstruction}
Respond in ${language} with clear, concise information about migrating to or living in Germany.
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
  `.trim();

  const messages = [{ role: "system", content: germanyPrompt }];
  const rawOutput = await callDeepSeekChat(messages, 0.8);
  return parseAiResponse(rawOutput);
}

/** Off-topic reply */
export async function generateOffTopicReply(conversation, language) {
  const promptMessages = conversation.messages
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");
  const offTopicPrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

The user's latest message is off-topic. Remind the user to return to questions about Germany or migration in ${language}.
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

/** Intro greeting */
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

/** Conversation summary */
export async function generateConversationSummary(conversation, language) {
  const conversationText = conversation.messages
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");
  const summaryPrompt = `
Please provide a brief summary in ${language} of the conversation so far. Include key points such as the user's language, situation, and main topics discussed.
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
