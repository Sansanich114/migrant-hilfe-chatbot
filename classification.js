/**
 * classification.js
 *
 * classifyQueryWithDeepSeek
 * --------------------------
 * Identifies:
 *   1) The language of the user's newest message (e.g., "en", "de", "tr", etc.)
 *   2) The category of the user's newest message:
 *      - "germany": anything that moves the immigration consultation forward
 *        (questions, statements, follow-ups related to Germany or immigration).
 *      - "politeness": greetings, introductions, thank you, goodbye, or uncertain
 *        statements like "I don't know" that don't progress the immigration topic.
 *      - "other": purely off-topic or irrelevant content (math questions, random trivia).
 *
 * Returns: { language, category }
 */

async function classifyQueryWithDeepSeek(openai, entireConversation, currentUserMessage) {
  // Convert the conversation to a single string
  const conversationText = entireConversation.map(m => `${m.role}: ${m.content}`).join('\n');

  // Updated classification prompt that requests both language and category in JSON
  const classificationPrompt = `
You are a strict classifier that identifies two things about the user's newest message:

1) The language of the user's newest message (e.g., "en" for English, "de" for German, "tr" for Turkish, etc.).
2) The category of the user's newest message, which can be:
   - "germany" if the message is about immigrating to or living in Germany, or it is a statement/question that moves the immigration consultation forward.
   - "politeness" if the message is a greeting, introduction, thank you, goodbye, or an uncertain statement like "I don't know" that does not move the immigration consultation forward.
   - "other" if it is none of the above (purely off-topic).

Below is the entire conversation so far, followed by the user's newest message:

Conversation So Far:
${conversationText}

User's New Message:
"${currentUserMessage}"

Return ONLY valid JSON of the form:
{
  "language": "...",
  "category": "..."
}
`.trim();

  try {
    const classificationRes = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat:free',
      messages: [{ role: 'system', content: classificationPrompt }],
      temperature: 0,
      max_tokens: 100,
      search: false
    });

    const rawOutput = classificationRes.choices[0].message.content.trim();
    console.log('Raw classification output:', rawOutput);

    // Attempt to parse the JSON the model returns
    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch (err) {
      console.error('Failed to parse classification JSON:', err);
      return { language: 'en', category: 'other' };
    }

    const { language, category } = parsed;
    const validCategories = ['germany', 'politeness', 'other'];

    // Validate the model's output
    if (!language || !validCategories.includes(category)) {
      return { language: 'en', category: 'other' };
    }

    return { language, category };
  } catch (err) {
    console.error('Classification error:', err);
    return { language: 'en', category: 'other' };
  }
}

module.exports = { classifyQueryWithDeepSeek };
