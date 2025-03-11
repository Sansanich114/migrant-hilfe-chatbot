/**
 * classification.js
 *
 * classifyQueryWithDeepSeek
 * --------------------------
 * Uses the DeepSeek model to determine if the conversation is about immigrating to or living in Germany,
 * or if it contains polite phrases (greetings, thank-yous, introductions, goodbyes).
 *
 * Returns one of: "germany", "politeness", or "other".
 */
async function classifyQueryWithDeepSeek(openai, entireConversation, currentUserMessage) {
  // Convert all existing conversation messages into a single text block.
  const conversationText = entireConversation.map(m => `${m.role}: ${m.content}`).join('\n');

  // Build an updated classification prompt that distinguishes three categories.
  const classificationPrompt = `
You are a strict classifier for determining the topic of a conversation.
Below is the entire conversation so far, followed by the user's newest message:

Conversation So Far:
${conversationText}

User's New Message:
"${currentUserMessage}"

If the user's message is a direct question or request regarding immigrating to, living in, working in, or studying in Germany, respond with exactly "germany".
If the user's message is a greeting, introduction, thank you, goodbye, or any polite phrase that does not ask for further immigration-related details, respond with exactly "politeness".
Otherwise, respond with exactly "other".
  `.trim();

  try {
    const classificationRes = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat:free',
      messages: [{ role: 'system', content: classificationPrompt }],
      temperature: 0,
      max_tokens: 5,
      search: false
    });

    const classification = classificationRes.choices[0].message.content.trim().toLowerCase();
    console.log('Classification result:', classification);

    if (classification === 'germany' || classification === 'politeness' || classification === 'other') {
      return classification;
    }
    return null;
  } catch (err) {
    console.error('Classification error:', err);
    return null;
  }
}

module.exports = { classifyQueryWithDeepSeek };
