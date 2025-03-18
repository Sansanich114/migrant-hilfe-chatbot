// server/controllers/userController.js
import dotenv from "dotenv";
dotenv.config();

import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import * as openaiService from "../services/openaiService.js";

export async function createProfile(req, res) {
  try {
    const newUser = new User({
      subscriptionType: "free",
      freeUsageCount: 0,
      profileInfo: req.body.profileInfo || {},
    });
    const savedUser = await newUser.save();

    const conversation = new Conversation({
      userId: savedUser._id,
      conversationName: "Default Conversation",
      messages: [
        { role: "system", content: process.env.SYSTEM_PROMPT || "Default system prompt" },
      ],
    });
    await conversation.save();

    res.status(201).json({ userId: savedUser._id, conversationId: conversation._id });
  } catch (err) {
    console.error("Error creating profile:", err);
    res.status(500).json({ error: "Failed to create profile" });
  }
}

export async function createConversation(req, res) {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required." });
  try {
    const conversation = new Conversation({
      userId,
      conversationName: "New Conversation",
      messages: [
        { role: "system", content: process.env.SYSTEM_PROMPT || "Default system prompt" },
      ],
    });
    await conversation.save();
    res.status(201).json({ conversationId: conversation._id });
  } catch (err) {
    console.error("Error creating new conversation:", err);
    res.status(500).json({ error: "Unable to create new conversation." });
  }
}

export async function getProfile(req, res) {
  try {
    const user = await User.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const conversations = await Conversation.find({ userId: req.params.userId }).lean();
    res.status(200).json({ user, conversations });
  } catch (err) {
    console.error("Error retrieving profile:", err);
    res.status(500).json({ error: "Failed to retrieve profile" });
  }
}

export async function renameConversation(req, res) {
  const { conversationId, newName } = req.body;
  if (!conversationId || !newName) {
    return res.status(400).json({ error: "conversationId and newName are required." });
  }
  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    conversation.conversationName = newName;
    await conversation.save();
    return res.status(200).json({ message: "Conversation renamed successfully." });
  } catch (err) {
    console.error("Error renaming conversation:", err);
    res.status(500).json({ error: "Unable to rename conversation." });
  }
}

export async function deleteConversation(req, res) {
  const { conversationId, userId } = req.body;
  if (!conversationId || !userId) {
    return res.status(400).json({ error: "conversationId and userId are required." });
  }
  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    await conversation.deleteOne();

    // If no conversations remain, create a default one
    const remaining = await Conversation.find({ userId });
    if (remaining.length === 0) {
      const defaultConv = new Conversation({
        userId,
        conversationName: "Default Conversation",
        messages: [
          { role: "system", content: process.env.SYSTEM_PROMPT || "Default system prompt" },
        ],
      });
      await defaultConv.save();
    }
    return res.status(200).json({ message: "Conversation deleted successfully." });
  } catch (err) {
    console.error("Error deleting conversation:", err);
    res.status(500).json({ error: "Unable to delete conversation." });
  }
}

export async function deleteAllChatHistory(req, res) {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }
  try {
    await Conversation.deleteMany({ userId });
    // After deletion, create a new default conversation
    const defaultConv = new Conversation({
      userId,
      conversationName: "Default Conversation",
      messages: [
        { role: "system", content: process.env.SYSTEM_PROMPT || "Default system prompt" },
      ],
    });
    await defaultConv.save();
    return res.status(200).json({
      message: "All chat history deleted and default conversation created.",
    });
  } catch (err) {
    console.error("Error deleting all chat history:", err);
    res.status(500).json({ error: "Unable to delete all chat history." });
  }
}

export async function intro(req, res) {
  try {
    const { userId, lang } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "No userId provided." });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    const finalLanguage = user.profileInfo.language || lang || "en";
    const responseData = await openaiService.generateIntroReply(finalLanguage);
    return res.status(200).json(responseData);
  } catch (err) {
    console.error("Intro Error:", err);
    return res.status(500).json({ error: "Unable to process introduction request." });
  }
}
