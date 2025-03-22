// server/controllers/chatController.js

import Conversation from "../models/Conversation.js";
import { classifyMessage } from "../services/classificationService.js";
import {
  generatePolitenessReply,
  generateRealEstateReply,
  generateOffTopicReply,
  generateConversationSummary,
  generateIntroReply
} from "../services/openaiService.js";

// (Optional) If you want to query Property data from your local DB
import Property from "../models/Property.js";

export async function chat(req, res) {
  const { conversationId, message, userId } = req.body;

  // 1) Validate that a message was provided
  if (!message) {
    return res.status(400).json({ error: "message is required." });
  }

  // 2) Enforce that a valid userId is provided
  if (!userId) {
    return res.status(400).json({ error: "userId is required. Please log in." });
  }

  try {
    let conversation;

    // 3) If conversationId is provided, try to load an existing conversation
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    }

    // 4) If no conversation is found, create a new one
    if (!conversation) {
      conversation = new Conversation({
        userId: userId, // userId is required per your schema
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

      // Return the intro data plus the newly created conversationId
      introData.conversationId = conversation._id.toString();
      return res.status(200).json(introData);
    }

    // 5) Conversation exists; process the user's new message
    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // Classify the user’s message
    const classification = await classifyMessage(conversation.messages, message);

    let replyData;
    if (classification.category === "politeness") {
      // Polite greeting flow
      replyData = await generatePolitenessReply(conversation, classification.language);
    } else if (classification.category === "realestate") {
      // REAL ESTATE FLOW
      // Example: parse location from user’s message, then query Property data
      const locationRegex = /berlin/i;
      const locationMatch = message.match(locationRegex);
      const location = locationMatch ? "Berlin" : null;

      let properties = [];
      if (location) {
        properties = await Property.find({
          address: { $regex: location, $options: "i" },
        });
      }

      // Then pass data to generateRealEstateReply (you can modify that function to accept properties)
      replyData = await generateRealEstateReply(conversation, message, classification.language);
    } else {
      // Off-topic flow
      replyData = await generateOffTopicReply(conversation, classification.language);
    }

    // Add the assistant reply to the conversation
    conversation.messages.push({
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });

    // Update the conversation summary
    const summary = await generateConversationSummary(conversation, classification.language);
    conversation.summary = summary;

    await conversation.save();

    // Include the conversationId in the response
    replyData.conversationId = conversation._id.toString();
    return res.status(200).json(replyData);

  } catch (err) {
    console.error("Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
}
