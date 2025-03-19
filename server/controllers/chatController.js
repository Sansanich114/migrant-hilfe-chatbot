import Conversation from "../models/Conversation.js";
import { classifyMessage } from "../services/classificationService.js";
import {
  generatePolitenessReply,
  generateRealEstateReply,
  generateOffTopicReply,
  generateConversationSummary,
  generateIntroReply
} from "../services/openaiService.js";

export async function chat(req, res) {
  const { conversationId, message, userId } = req.body;
  if (!message) {
    return res.status(400).json({ error: "message is required." });
  }
  try {
    let conversation;
    // Try to load an existing conversation
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    }
    // If no conversation exists, create one for this user
    if (!conversation) {
      if (!userId) {
        // In your ideal flow, the user should have been created beforehand.
        return res.status(400).json({ error: "userId is required to create a new conversation." });
      }
      conversation = new Conversation({
        userId: userId,
        conversationName: "Default Conversation",
        messages: [
          {
            role: "system",
            content: process.env.SYSTEM_PROMPT || "Default system prompt",
          },
        ],
      });
      // Generate an introductory message from the assistant
      const introData = await generateIntroReply("en");
      conversation.messages.push({
        role: "assistant",
        content: introData.reply,
        timestamp: new Date(),
      });
      await conversation.save();
      // Return the introductory message to the client
      return res.status(200).json(introData);
    }

    // Conversation exists; process the user's message
    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });
    const classification = await classifyMessage(conversation.messages, message);
    let replyData;
    if (classification.category === "politeness") {
      replyData = await generatePolitenessReply(conversation, classification.language);
    } else if (classification.category === "realestate") {
      replyData = await generateRealEstateReply(conversation, message, classification.language);
    } else {
      replyData = await generateOffTopicReply(conversation, classification.language);
    }
    conversation.messages.push({
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });
    const summary = await generateConversationSummary(conversation, classification.language);
    conversation.summary = summary;
    await conversation.save();
    return res.status(200).json(replyData);
  } catch (err) {
    console.error("Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
}
