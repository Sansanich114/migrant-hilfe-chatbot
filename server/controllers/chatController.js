// redemo/server/controllers/chatController.js
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { classifyMessage } from "../services/classificationService.js";
import { 
  generatePolitenessReply, 
  generateRealEstateReply, 
  generateOffTopicReply, 
  generateIntroReply,
  generateConversationSummary  // <-- Added this function import
} from "../services/openaiService.js";

export async function chat(req, res) {
  try {
    const { conversationId, message, userId: clientUserId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    let userId = clientUserId;
    if (!userId) {
      const newUser = new User({
        email: `anon_${Date.now()}@example.com`,
        password: "anonymous"
      });
      await newUser.save();
      userId = newUser._id.toString();
    }

    let conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      conversation = new Conversation({
        userId,
        conversationName: "Default Conversation",
        messages: [{ role: "system", content: process.env.SYSTEM_PROMPT || "Default system prompt" }],
      });

      const introData = await generateIntroReply("en");
      conversation.messages.push({
        role: "assistant",
        content: introData.reply,
        timestamp: new Date(),
      });

      await conversation.save();

      introData.conversationId = conversation._id.toString();
      introData.userId = userId;
      return res.status(200).json(introData);
    }

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

    // Now generate a summary for the conversation
    conversation.summary = await generateConversationSummary(conversation, classification.language);
    await conversation.save();

    replyData.conversationId = conversation._id.toString();
    replyData.userId = userId;
    return res.status(200).json(replyData);

  } catch (err) {
    console.error("Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
}
