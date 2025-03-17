// server/controllers/chatController.js
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import { classifyMessage } from "../services/classificationService.js";
import {
  generatePolitenessReply,
  generateGermanyReply,
  generateOffTopicReply,
  generateConversationSummary,
} from "../services/openaiService.js";

export async function chat(req, res) {
  const { userId, conversationId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: "userId and message are required." });
  }

  try {
    // 1) Find the user.
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 2) Retrieve the conversation (or default to one for the user).
    let conversation = conversationId
      ? await Conversation.findById(conversationId)
      : await Conversation.findOne({ userId });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // 3) Classify the user's new message.
    const classification = await classifyMessage(conversation.messages, message);
    const { language, category, requiresWebsearch } = classification;

    // 4) Update user's language if needed.
    const finalLanguage = language || user.profileInfo.language || "en";
    if (user.profileInfo.language !== finalLanguage) {
      user.profileInfo.language = finalLanguage;
      await user.save();
    }

    // 5) Add user's message to the conversation.
    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // 6) Generate a reply based on the classification.
    let replyData;
    if (category === "politeness") {
      replyData = await generatePolitenessReply(conversation, finalLanguage);
    } else if (category === "germany") {
      replyData = await generateGermanyReply(
        conversation,
        message,
        finalLanguage,
        requiresWebsearch
      );
    } else {
      replyData = await generateOffTopicReply(conversation, finalLanguage);
    }

    // 7) Add assistant's reply.
    conversation.messages.push({
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });

    // 8) Generate an updated summary of the conversation.
    const summary = await generateConversationSummary(conversation, finalLanguage);
    conversation.summary = summary;

    // 9) Save the conversation.
    await conversation.save();

    // 10) Return the response.
    return res.status(200).json(replyData);
  } catch (err) {
    console.error("Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
}
