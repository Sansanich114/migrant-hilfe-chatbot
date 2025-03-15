const User = require('../models/User');
const Conversation = require('../models/Conversation');
const openaiService = require('../services/openaiService');

// Create a new user profile
const createProfile = async (req, res) => {
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
};

// Create a new conversation
const createConversation = async (req, res) => {
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
};

// Retrieve a user profile and list of conversations
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const conversations = await Conversation.find({ userId: req.params.userId }).lean();
    res.status(200).json({ user, conversations });
  } catch (err) {
    console.error("Error retrieving profile:", err);
    res.status(500).json({ error: "Failed to retrieve profile" });
  }
};

// Rename a conversation
const renameConversation = async (req, res) => {
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
};

// Delete a conversation
const deleteConversation = async (req, res) => {
  const { conversationId } = req.body;
  if (!conversationId) {
    return res.status(400).json({ error: "conversationId is required." });
  }
  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    await conversation.deleteOne();
    return res.status(200).json({ message: "Conversation deleted successfully." });
  } catch (err) {
    console.error("Error deleting conversation:", err);
    res.status(500).json({ error: "Unable to delete conversation." });
  }
};

// Delete ALL user data
const deleteAllUserData = async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }
  try {
    await Conversation.deleteMany({ userId });
    await User.findByIdAndDelete(userId);
    return res.status(200).json({ message: "All user data deleted successfully." });
  } catch (err) {
    console.error("Error deleting all user data:", err);
    res.status(500).json({ error: "Unable to delete all user data." });
  }
};

// NEW: Intro route controller
// Replicates the logic from your old server.js for an AI-generated greeting
const intro = async (req, res) => {
  try {
    const { userId, lang } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "No userId provided." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Decide which language to use
    const finalLanguage = user.profileInfo.language || lang || "en";

    // Generate the intro message using openaiService
    const responseData = await openaiService.generateIntroReply(finalLanguage);

    return res.status(200).json(responseData);
  } catch (err) {
    console.error("Intro Error:", err);
    return res.status(500).json({ error: "Unable to process introduction request." });
  }
};

// Export all
module.exports = {
  createProfile,
  createConversation,
  getProfile,
  renameConversation,
  deleteConversation,
  deleteAllUserData,
  // NEW
  intro,
};
