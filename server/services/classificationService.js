// server/services/classificationService.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const { Configuration, OpenAIApi } = OpenAI;

const configuration = new Configuration({
  apiKey: process.env.OPENROUTER_API_KEY,
});
const openai = new OpenAIApi(configuration);

export async function classifyMessage(conversationMessages, currentUserMessage) {
  const conversationText = conversationMessages.map(m => `${m.role}: ${m.content}`).join('\n');

  const classificationPrompt = `
You are a strict classifier that identifies three things about the user's newest message:

1) Determine the language of the user's newest message (e.g., "en", "de", "tr", etc.).
2) Identify the category of the user's newest message. The category can be:
   - "germany" if the message is about immigrating to or living in Germany, or advances the immigration consultation.
   - "politeness" if the message is a greeting, introduction, thank you, farewell, or a neutral statement that does not advance the consultation.
   - "other" if it is off-topic with no mention of Germany or immigration.
3) If the category is "germany", decide whether external research (websearch) is required to provide an accurate and up-to-date response. For example, if the query mentions time-sensitive topics like "COVID-19", "Corona", "entry rules", "visa requirements", or "recent changes in the law", then set "requiresWebsearch" to true and provide a brief explanation in "websearchExplanation". Otherwise, set it to false.

Below is the entire conversation so far, followed by the user's newest message:

Conversation So Far:
${conversationText}

User's New Message:
"${currentUserMessage}"

Please return ONLY raw JSON (do not include any markdown formatting) of the form:
{
  "language": "...",
  "category": "...",
  "requiresWebsearch": true/false,
  "websearchExplanation": "..."
}
  `.trim();

  try {
    const response = await openai.createChatCompletion({
      model: 'text-davinci-003',
      messages: [{ role: 'system', content: classificationPrompt }],
      temperature: 0,
      max_tokens: 150,
    });

    const rawOutput = response.data.choices[0].message.content.trim();
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

    if (!language || !validCategories.includes(category)) {
      return { language: 'en', category: 'other', requiresWebsearch: false, websearchExplanation: "" };
    }
    if (category !== 'germany') {
      requiresWebsearch = false;
      websearchExplanation = "";
    } else {
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
