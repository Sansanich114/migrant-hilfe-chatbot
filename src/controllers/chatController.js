// src/controllers/chatController.js
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { classifyAndRespond } from "../services/openaiService.js";

export async function chat(req, res) {
  try {
    const { conversationId, message, userId: clientUserId } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    // Handle user creation
    let userId = clientUserId;
    if (!userId) {
      const newUser = new User({
        email: `anon_${Date.now()}@example.com`,
        password: "anonymous",
      });
      await newUser.save();
      userId = newUser._id.toString();
    }

    // Load or create conversation
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

    // Append user message
    conversation.messages.push({ role: "user", content: message, timestamp: new Date() });

    // Generate everything in a single call
    const replyData = await classifyAndRespond(conversation, message);
    if (!replyData) {
      return res.status(500).json({ error: "AI did not return a valid response." });
    }

    // Append assistant response
    conversation.messages.push({
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });

    // Save updated conversation summary
    conversation.summary = replyData.summary || "";
    await conversation.save();

    // Return reply
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