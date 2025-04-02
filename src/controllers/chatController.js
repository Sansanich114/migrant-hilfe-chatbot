// src/controllers/chatController.js
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { classifyMessage } from "../services/classificationService.js";
import {
  generateSalesmanReply,
  generatePolitenessReply,
  generateOtherReply,
  generateConversationSummary,
} from "../services/openaiService.js";

export async function chat(req, res) {
  try {
    const { conversationId, message, userId: clientUserId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    // If no userId is provided, create an anonymous user.
    let userId = clientUserId;
    if (!userId) {
      const newUser = new User({
        email: `anon_${Date.now()}@example.com`,
        password: "anonymous",
      });
      await newUser.save();
      userId = newUser._id.toString();
    }

    // Find or create a conversation.
    let conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      conversation = new Conversation({
        userId,
        conversationName: "Default Conversation",
        messages: [
          { role: "system", content: process.env.SYSTEM_PROMPT || "Default system prompt" },
        ],
      });
      // Add a default welcome message.
      conversation.messages.push({
        role: "assistant",
        content: "Welcome to the chat. How can I help you with your real estate needs today?",
        timestamp: new Date(),
      });
      await conversation.save();
      return res.status(200).json({
        reply: "Welcome to the chat. How can I help you with your real estate needs today?",
        conversationId: conversation._id.toString(),
        userId,
      });
    }

    // Append the new user message.
    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // Classify the user's message.
    const classification = await classifyMessage(conversation.messages, message);

    let replyData;
    // Use new functions based on the category.
    if (classification.category === "politeness") {
      replyData = await generatePolitenessReply(conversation, classification.language);
    } else if (classification.category === "salesman") {
      replyData = await generateSalesmanReply(conversation, message, classification.language);
    } else {
      replyData = await generateOtherReply(conversation, classification.language);
    }

    // Append the assistant's reply.
    conversation.messages.push({
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });

    // Update the conversation summary.
    conversation.summary = await generateConversationSummary(conversation, classification.language);
    await conversation.save();

    // Return response with conversation and user IDs.
    replyData.conversationId = conversation._id.toString();
    replyData.userId = userId;
    return res.status(200).json(replyData);
  } catch (err) {
    console.error("Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
}
