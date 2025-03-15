// server/controllers/chatController.js
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const classificationService = require('../services/classificationService');
const openaiService = require('../services/openaiService');

// Chat controller logic
// Called by your /chat endpoint (see chatRoutes.js)
const chat = async (req, res) => {
  const { userId, conversationId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: "userId and message are required." });
  }

  try {
    // 1) Find the user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 2) Retrieve the conversation
    let conversation = conversationId
      ? await Conversation.findById(conversationId)
      : await Conversation.findOne({ userId });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // 3) Classify the user's new message
    const classification = await classificationService.classifyMessage(
      conversation.messages,
      message
    );
    const { language, category, requiresWebsearch } = classification;

    // 4) Update the user's language if it changed
    const finalLanguage = language || user.profileInfo.language || "en";
    if (user.profileInfo.language !== finalLanguage) {
      user.profileInfo.language = finalLanguage;
      await user.save();
    }

    // 5) Add user's message to conversation
    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // 6) Generate a reply based on the category
    let replyData;
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
      // category === "other"
      replyData = await openaiService.generateOffTopicReply(conversation, finalLanguage);
    }

    // 7) Save assistant's reply
    conversation.messages.push({
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });

    await conversation.save();

    // 8) Return the final JSON
    return res.status(200).json(replyData);

  } catch (err) {
    console.error("Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
};

module.exports = { chat };
