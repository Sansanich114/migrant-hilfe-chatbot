import Conversation from "../models/Conversation.js";
import { classifyMessage } from "../services/classificationService.js";
import {
  generatePolitenessReply,
  generateRealEstateReply,
  generateOffTopicReply,
  generateConversationSummary,
  generateIntroReply
} from "../services/openaiService.js";

export async function chat(req, res) {
  const { conversationId, message, userId } = req.body;
  
  // 1) Validate that a message was provided
  if (!message) {
    return res.status(400).json({ error: "message is required." });
  }

  try {
    let conversation;

    // 2) If conversationId is provided, try to load an existing conversation
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    }

    // 3) If no conversation is found, create a new one
    //    (We no longer return 400 if userId is missing)
    if (!conversation) {
      conversation = new Conversation({
        userId: userId || null, // store null if no userId was provided
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

    // 4) Conversation exists; process the user's new message
    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // Classify the user’s message
    const classification = await classifyMessage(conversation.messages, message);

    // Generate the appropriate reply
    let replyData;
    if (classification.category === "politeness") {
      replyData = await generatePolitenessReply(conversation, classification.language);
    } else if (classification.category === "realestate") {
      replyData = await generateRealEstateReply(conversation, message, classification.language);
    } else {
      replyData = await generateOffTopicReply(conversation, classification.language);
    }

    // Add the assistant reply to the conversation
    conversation.messages.push({
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });

    // Update summary
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
