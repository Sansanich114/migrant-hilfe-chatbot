// server/services/openaiService.js
const OpenAI = require('openai');
const { parseAiResponse } = require('../utils/helpers');
require('dotenv').config();

// Create an OpenAI client using your OPENROUTER_API_KEY
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// This is the same system prompt from your old server.js
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
 * Generate a short, friendly greeting when user is just being polite.
 * (Politeness logic from your old server.js)
 */
async function generatePolitenessReply(conversation, language) {
  // Rebuild conversation text
  const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");

  // Politeness prompt from old server.js
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

  // Call OpenAI (DeepSeek)
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
  // parseAiResponse is from ../utils/helpers
  const parsedResponse = parseAiResponse(rawOutput);

  return parsedResponse;
}

/**
 * Generate a Germany-related reply (placeholder).
 * Replace or expand with your existing logic from old server.js
 */
async function generateGermanyReply(conversation, message, language, requiresWebsearch) {
  // For example, you might do your google search here, build a final prompt, etc.
  // Return the final { reply, suggestions } object
  return {
    reply: "Here's some info about Germany (placeholder).",
    suggestions: ["Ask about visas", "Ask about housing"]
  };
}

/**
 * Generate an off-topic reply (placeholder).
 * Replace or expand with your existing logic from old server.js
 */
async function generateOffTopicReply(conversation, language) {
  return {
    reply: "It seems your question isn't about Germany. I can help with immigration or living in Germany.",
    suggestions: ["Visa requirements", "Housing in Germany"]
  };
}

/**
 * Intro function (placeholder).
 * If you have an existing generateIntroReply, you can keep or modify it.
 */
async function generateIntroReply(language) {
  return {
    reply: `Hello! I'm Sasha. How can I help you today? (Intro in ${language})`,
    suggestions: ["Ask about German visas", "Ask about housing"]
  };
}

module.exports = {
  generateIntroReply,
  generateGermanyReply,
  generatePolitenessReply,
  generateOffTopicReply,
};
