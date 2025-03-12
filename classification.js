/**
 * classification.js
 *
 * classifyQueryWithDeepSeek
 * --------------------------
 * Identifies:
 *   1) The language of the user's newest message (e.g., "en", "de", "tr", etc.)
 *   2) The category of the user's newest message:
 *      - "germany": if the message is about immigrating to or living in Germany,
 *         or it advances the immigration consultation (even if it includes some off-topic parts).
 *      - "politeness": if the message is a greeting, introduction, thank you, goodbye,
 *         or an uncertain statement like "I don't know" that does not advance the consultation.
 *      - "other": if it is purely off-topic with no mention of Germany or immigration.
 *   3) If the category is "germany", determine whether external research (websearch) is required
 *      to provide an accurate answer. Provide a brief explanation why websearch is needed.
 *      For "politeness" or "other", automatically set "requiresWebsearch" to false and "websearchExplanation" to an empty string.
 *
 * Returns: { language, category, requiresWebsearch, websearchExplanation }
 */

async function classifyQueryWithDeepSeek(openai, entireConversation, currentUserMessage) {
  // Convert the conversation to a single string
  const conversationText = entireConversation.map(m => `${m.role}: ${m.content}`).join('\n');

  // Updated classification prompt with a websearch explanation for "germany" queries.
  const classificationPrompt = `
You are a strict classifier that identifies three things about the user's newest message:

1) The language of the user's newest message (e.g., "en", "de", "tr", etc.).
2) The category of the user's newest message, which can be:
   - "germany" if the message is about immigrating to or living in Germany, or advances the immigration consultation.
   - "politeness" if the message is a greeting, introduction, thank you, goodbye, or an uncertain statement like "I don't know" that does not advance the consultation.
   - "other" if it is purely off-topic with no mention of Germany or immigration.
3) If the category is "germany", determine whether external research (websearch) is required to provide an accurate and up-to-date response.
   If required, set "requiresWebsearch" to true and provide a brief explanation in "websearchExplanation" (for example, if the query mentions official sources, government websites, forums, or asks for the latest updates).
   For "politeness" or "other", automatically set "requiresWebsearch" to false and "websearchExplanation" to an empty string.

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
      // Disable web search for classification
      tools: []
    });

    const rawOutput = classificationRes.choices[0].message.content.trim();
    console.log('Raw classification output:', rawOutput);

    // Attempt to parse the JSON the model returns
    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch (err) {
      console.error('Failed to parse classification JSON:', err);
      return { language: 'en', category: 'other', requiresWebsearch: false, websearchExplanation: "" };
    }

    let { language, category, requiresWebsearch, websearchExplanation } = parsed;
    const validCategories = ['germany', 'politeness', 'other'];

    // Validate the output; for non-germany categories, force websearch to false and empty explanation.
    if (!language || !validCategories.includes(category)) {
      return { language: 'en', category: 'other', requiresWebsearch: false, websearchExplanation: "" };
    }
    if (category !== "germany") {
      requiresWebsearch = false;
      websearchExplanation = "";
    } else {
      // For "germany", if requiresWebsearch is not explicitly true, default to false.
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

module.exports = { classifyQueryWithDeepSeek };
