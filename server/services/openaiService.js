const OpenAI = require('openai');
const { parseAiResponse } = require('../utils/helpers');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// This is the default system prompt that shapes the bot's behavior.
// Modify as needed to match your old server.js
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
 * Helper that sends a chat prompt to OpenAI with systemPrompt + user content,
 * then calls parseAiResponse on the result.
 */
async function generateReply(userPrompt) {
  const result = await openai.chat.completions.create({
    model: 'deepseek/deepseek-chat:free',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.8,
    max_tokens: 500
  });
  return parseAiResponse(result.choices[0].message.content);
}

/**
 * NEW: Generate an intro greeting for the user in the specified language.
 * This replicates the "intro" logic from your old server.js
 */
async function generateIntroReply(language) {
  // We'll embed the language in the prompt
  const introPrompt = `
${systemPrompt}

The user's language is ${language}.
Give a short greeting as Sasha. Provide exactly 2 short suggestions for what the user might ask next about migration or Germany.
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
`.trim();

  // Use generateReply to call OpenAI
  const parsedResponse = await generateReply(introPrompt);

  // If no reply or suggestions, add fallback
  if (!parsedResponse.reply) {
    parsedResponse.reply = "Hi! I'm Sasha. How can I help you today?";
  }
  if (!Array.isArray(parsedResponse.suggestions)) {
    parsedResponse.suggestions = [];
  }

  return parsedResponse;
}

// Existing functions (if you have them) for "generateGermanyReply", "generatePolitenessReply", etc.
// Example:
async function generateGermanyReply(conversation, message, language, requiresWebsearch) {
  // ...
}

async function generatePolitenessReply(conversation, language) {
  // ...
}

async function generateOffTopicReply(conversation, language) {
  // ...
}

// Export everything
module.exports = {
  generateIntroReply,
  generateGermanyReply,
  generatePolitenessReply,
  generateOffTopicReply,
};
