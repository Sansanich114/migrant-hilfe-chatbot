// src/controllers/chatController.js
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import {
  generateSalesmanReply,
  generatePolitenessReply,
  generateOtherReply
} from "../services/openaiService.js";
import { classifyMessage } from "../services/classificationService.js";

export async function chat(req, res) {
  try {
    const { conversationId, message, userId: clientUserId } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    // Step 0: Handle user creation
    let userId = clientUserId;
    if (!userId) {
      const newUser = new User({
        email: `anon_${Date.now()}@example.com`,
        password: "anonymous",
      });
      await newUser.save();
      userId = newUser._id.toString();
    }

    // Step 1: Load or create conversation
    let conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      conversation = new Conversation({
        userId,
        conversationName: "Default Conversation",
        messages: [
          {
            role: "system",
            content: process.env.SYSTEM_PROMPT || "Default system prompt",
          },
          {
            role: "assistant",
            content: "Welcome to the chat. How can I help you with your real estate needs today?",
            timestamp: new Date(),
          },
        ],
      });
      await conversation.save();
      return res.status(200).json({
        reply: "Welcome to the chat. How can I help you with your real estate needs today?",
        conversationId: conversation._id.toString(),
        userId,
      });
    }

    // Step 2: Append user message
    conversation.messages.push({ role: "user", content: message, timestamp: new Date() });

    // Step 3: Classify the intent
    const { category, language } = await classifyMessage(conversation.messages, message);

    // Step 4: Generate response using category-specific logic
    let replyData;
    if (category === "salesman") {
      replyData = await generateSalesmanReply(conversation, message, language);
    } else if (category === "politeness") {
      replyData = await generatePolitenessReply(conversation, language);
    } else {
      replyData = await generateOtherReply(conversation, language);
    }

    // Step 5: Append assistant response
    conversation.messages.push({
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });

    // Step 6: Save conversation
    conversation.summary = replyData.summary || "";
    await conversation.save();

    // Step 7: Return structured response
    return res.status(200).json({
      ...replyData,
      conversationId: conversation._id.toString(),
      userId,
    });

  } catch (err) {
    console.error("💥 Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
}