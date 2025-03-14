const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

async function classifyMessage(conversationMessages, currentUserMessage) {
  const conversationText = conversationMessages.map(m => `${m.role}: ${m.content}`).join('\n');

  // We add extra guidance in the prompt so that if the user mentions time-sensitive topics
  // (like COVID restrictions, new laws, or official guidelines),
  // "requiresWebsearch" should be set to true.
  const classificationPrompt = `
You are a strict classifier that identifies three things about the user's newest message:

1) The language of the user's newest message (e.g., "en", "de", "tr", etc.).
2) The category of the user's newest message, which can be:
   - "germany" if the message is about immigrating to or living in Germany, or advances the immigration consultation.
   - "politeness" if the message is a greeting, introduction, thank you, goodbye, or an uncertain statement like "I don't know" that does not advance the consultation.
   - "other" if it is purely off-topic with no mention of Germany or immigration.
3) If the category is "germany", determine whether external research (websearch) is required to provide an accurate and up-to-date response.
   For example, if the user mentions time-sensitive or current-event topics like "COVID-19", "Corona", "entry rules", "visa requirements", or "recent changes in the law", set "requiresWebsearch" to true. Otherwise, set it to false.
   Provide a brief explanation in "websearchExplanation" if requiresWebsearch is true.

Below is the entire conversation so far, followed by the user's newest message:

Conversation So Far:
${conversationText}

User's New Message:
"${currentUserMessage}"

Return ONLY valid JSON of the form:
{
  "language": "...",
  "category": "...",
  "requiresWebsearch": true/false,
  "websearchExplanation": "..."
}
  `.trim();

  try {
    const classificationRes = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat:free',
      messages: [{ role: 'system', content: classificationPrompt }],
      temperature: 0,
      max_tokens: 150,
      tools: []
    });

    const rawOutput = classificationRes.choices[0].message.content.trim();
    console.log('Raw classification output:', rawOutput);

    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch (err) {
      console.error('Failed to parse classification JSON:', err);
      return { language: 'en', category: 'other', requiresWebsearch: false, websearchExplanation: "" };
    }

    let { language, category, requiresWebsearch, websearchExplanation } = parsed;
    const validCategories = ['germany', 'politeness', 'other'];

    // Basic validation
    if (!language || !validCategories.includes(category)) {
      return { language: 'en', category: 'other', requiresWebsearch: false, websearchExplanation: "" };
    }

    // If not 'germany', force no websearch
    if (category !== 'germany') {
      requiresWebsearch = false;
      websearchExplanation = "";
    } else {
      // If 'germany' but missing or invalid requiresWebsearch, set defaults
      if (typeof requiresWebsearch !== "boolean") {
        requiresWebsearch = false;
        websearchExplanation = "";
      }
    }

    return { language, category, requiresWebsearch, websearchExplanation };
  } catch (err) {
    console.error('Classification error:', err);
    return { language: 'en', category: 'other', requiresWebsearch: false, websearchExplanation: "" };
  }
}

module.exports = { classifyMessage };
