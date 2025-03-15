const OpenAI = require('openai');
const { parseAiResponse } = require('../utils/helpers');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// This is the default system prompt that shapes the bot's behavior.
// It references some instructions about how to respond, e.g. no direct links.
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

async function generateReply(prompt) {
  const result = await openai.chat.completions.create({
    model: 'deepseek/deepseek-chat:free',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 500
  });

  // parseAiResponse is presumably a helper that ensures valid JSON is returned
  return parseAiResponse(result.choices[0].message.content);
}

async function generateGermanyReply(conversation, message, language, requiresWebsearch) {
  let googleSummary = "";

  // If classification indicated we need a web search, run it
  if (requiresWebsearch) {
    const googleSearchService = require('./googleSearchService');
    googleSummary = await googleSearchService.getGoogleSummary(message);
  }

  // Build a prompt that includes the conversation, any web results, etc.
  const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");

  // We specifically instruct the model to use the googleSummary in the final answer
  const germanyPrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

Additional info from web search (if any):
${googleSummary}

Now, please provide a concise, up-to-date answer in ${language}, summarizing key points
like current rules, addresses, phone numbers, or anything relevant found above.
Then provide exactly 2 short suggestions for next questions the user might ask.
`.trim();

  return await generateReply(germanyPrompt);
}

async function generatePolitenessReply(conversation, language) {
  const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");
  const politenessPrompt = `
${systemPrompt}
Conversation:
${promptMessages}
Respond politely in ${language}.
`.trim();
  return await generateReply(politenessPrompt);
}

async function generateOffTopicReply(conversation, language) {
  const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");
  const offTopicPrompt = `
${systemPrompt}
Conversation:
${promptMessages}
Inform politely in ${language} that you're only able to help about Germany or migration.
`.trim();
  return await generateReply(offTopicPrompt);
}

module.exports = {
  generateGermanyReply,
  generatePolitenessReply,
  generateOffTopicReply,
};
