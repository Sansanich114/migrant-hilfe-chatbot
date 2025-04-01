import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { classifyMessage } from "../services/classificationService.js";
import { 
  generatePolitenessReply, 
  generateQualifiedReply, 
  generateExploratoryReply, 
  generateOffTopicReply, 
  generateConversationSummary,
  generateGeneralAdviceReply
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
      // Instead of generating an intro reply, add a default welcome message.
      conversation.messages.push({
        role: "assistant",
        content: "Welcome to the chat. How can I help you with your real estate needs today?",
        timestamp: new Date(),
      });
      await conversation.save();
      return res.status(200).json({
        reply: "Welcome to the chat. How can I help you with your real estate needs today?",
        conversationId: conversation._id.toString(),
        userId: userId
      });
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
    } else if (classification.category === "realestate_exploratory") {
      replyData = await generateExploratoryReply(conversation, message, classification.language);
    } else if (classification.category === "realestate_qualified") {
      replyData = await generateQualifiedReply(conversation, message, classification.language);
    } else if (classification.category === "general_advice") {
      replyData = await generateGeneralAdviceReply(conversation, classification.language);
    } else {
      replyData = await generateOffTopicReply(conversation, classification.language);
    }

    conversation.messages.push({
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });

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
