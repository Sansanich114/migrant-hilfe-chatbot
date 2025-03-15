const User = require('../models/User');
const Conversation = require('../models/Conversation');
const classificationService = require('../services/classificationService');
const openaiService = require('../services/openaiService');
const { parseAiResponse, stripFormatting } = require('../utils/helpers');

const chat = async (req, res) => {
  const { userId, conversationId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: "userId and message are required." });
  }

  try {
    // Find the user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Retrieve the conversation by ID or by userId
    let conversation = conversationId
      ? await Conversation.findById(conversationId)
      : await Conversation.findOne({ userId });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // Classify the user's new message
    const classification = await classificationService.classifyMessage(
      conversation.messages,
      message
    );
    const { language, category, requiresWebsearch } = classification;

    // If user has a default language set, we can override if classification finds a different one
    const finalLanguage = language || user.profileInfo.language || "en";
    if (user.profileInfo.language !== finalLanguage) {
      user.profileInfo.language = finalLanguage;
      await user.save();
    }

    // Add user's message to conversation history
    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    let replyData;
    // Route the request based on the category
    if (category === "politeness") {
      replyData = await openaiService.generatePolitenessReply(conversation, finalLanguage);
    } else if (category === "germany") {
      replyData = await openaiService.generateGermanyReply(
        conversation,
        message,
        finalLanguage,
        requiresWebsearch
      );
    } else {
      replyData = await openaiService.generateOffTopicReply(conversation, finalLanguage);
    }

    // Save assistant reply in the conversation
    conversation.messages.push({
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });

    await conversation.save();

    // Send the final JSON back
    return res.status(200).json(replyData);
  } catch (err) {
    console.error("Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
};

module.exports = { chat };
