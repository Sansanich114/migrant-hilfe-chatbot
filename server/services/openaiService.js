// server/services/openaiService.js
const OpenAI = require('openai');
const { parseAiResponse } = require('../utils/helpers');
require('dotenv').config();

// Create an OpenAI client using your OPENROUTER_API_KEY
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// System prompt remains as your guiding instructions.
const systemPrompt = process.env.SYSTEM_PROMPT || `
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

/**
 * Generate a short, friendly greeting when the user is just being polite.
 */
async function generatePolitenessReply(conversation, language) {
  const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");

  const politenessPrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

The user is just being polite. Respond in ${language} with a short, friendly greeting.
Provide exactly 2 short suggestions for what the user might ask about Germany or migration next.
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
  `.trim();

  const result = await openai.chat.completions.create({
    model: 'deepseek/deepseek-chat:free',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: politenessPrompt }
    ],
    temperature: 0.8,
    max_tokens: 500
  });

  const rawOutput = result.choices[0].message.content;
  const parsedResponse = parseAiResponse(rawOutput);
  return parsedResponse;
}

/**
 * Generate a Germany-related reply.
 * This prompt uses the conversation context and, if needed, instructs the model
 * to incorporate up-to-date facts from external research.
 */
async function generateGermanyReply(conversation, message, language, requiresWebsearch) {
  const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");
  const webInfoInstruction = requiresWebsearch ? "Incorporate up-to-date facts from recent data if available." : "";
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

  const result = await openai.chat.completions.create({
    model: 'deepseek/deepseek-chat:free',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: germanyPrompt }
    ],
    temperature: 0.8,
    max_tokens: 500
  });

  const rawOutput = result.choices[0].message.content;
  const parsedResponse = parseAiResponse(rawOutput);
  return parsedResponse;
}

/**
 * Generate an off-topic reply.
 * Remind the user to return to questions about Germany or migration.
 */
async function generateOffTopicReply(conversation, language) {
  const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");
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

  const result = await openai.chat.completions.create({
    model: 'deepseek/deepseek-chat:free',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: offTopicPrompt }
    ],
    temperature: 0.8,
    max_tokens: 500
  });

  const rawOutput = result.choices[0].message.content;
  const parsedResponse = parseAiResponse(rawOutput);
  return parsedResponse;
}

/**
 * Generate an introductory reply.
 */
async function generateIntroReply(language) {
  const introPrompt = `
${systemPrompt}

Respond in ${language} with a friendly introduction greeting the user.
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
  `.trim();

  const result = await openai.chat.completions.create({
    model: 'deepseek/deepseek-chat:free',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: introPrompt }
    ],
    temperature: 0.8,
    max_tokens: 500
  });

  const rawOutput = result.choices[0].message.content;
  const parsedResponse = parseAiResponse(rawOutput);
  return parsedResponse;
}

module.exports = {
  generateIntroReply,
  generateGermanyReply,
  generatePolitenessReply,
  generateOffTopicReply,
};
