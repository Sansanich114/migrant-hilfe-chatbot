// classification.js

/**
 * classifyQueryWithDeepSeek
 * -------------------------
 * Uses the DeepSeek model (e.g., deepseek/deepseek-chat:free) to determine
 * if the conversation is about immigrating to or living in Germany.
 *
 * @param {object} openai              The OpenAI (OpenRouter) client instance
 * @param {Array} entireConversation   The full array of messages so far
 *                                     (e.g. [{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }, ...])
 * @param {string} currentUserMessage  The user's new message to classify
 * @returns {Promise<string|null>}     Returns 'germany' or 'other' if classification is successful, or null if it fails
 */
async function classifyQueryWithDeepSeek(openai, entireConversation, currentUserMessage) {
    // Convert all existing conversation messages into a single text block.
    // Each message has a "role" (system, user, assistant) and a "content" string.
    const conversationText = entireConversation
      .map(m => `${m.role}: ${m.content}`)
      .join('\\n');
  
    // Build a prompt that includes the entire conversation plus the new user message.
    // We strictly instruct the model to respond with 'germany' or 'other'.
    const classificationPrompt = `
  You are a strict classifier for determining if a conversation is about immigrating to or living in Germany.
  Below is the entire conversation so far, followed by the user's newest message:
  
  Conversation So Far:
  ${conversationText}
  
  User's New Message:
  \"${currentUserMessage}\"
  
  If, given all this context, the user is indeed asking about Germany (immigration, living, working, or studying in Germany),
  respond with exactly \"germany\".
  
  Otherwise, respond with exactly \"other\".
  `.trim();
  
    try {
      const classificationRes = await openai.chat.completions.create({
        model: 'deepseek/deepseek-chat:free', // Same model used for classification
        messages: [{ role: 'system', content: classificationPrompt }],
        temperature: 0,   // Deterministic
        max_tokens: 5,    // Only need a short answer
        search: false     // Classification doesn't need retrieval
      });
  
      // Extract the classification. We expect 'germany' or 'other'.
      const classification = classificationRes.choices[0].message.content.trim().toLowerCase();
      console.log('Classification result:', classification);
  
      if (classification === 'germany' || classification === 'other') {
        return classification;
      }
      // If it returns something unexpected, treat that as null (failure to classify).
      return null;
    } catch (err) {
      console.error('Classification error:', err);
      return null; // Return null on error
    }
  }
  
  module.exports = { classifyQueryWithDeepSeek };
  