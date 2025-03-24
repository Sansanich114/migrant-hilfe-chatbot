import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { classifyMessage } from "../services/classificationService.js";
import {
  generatePolitenessReply,
  generateRealEstateReply,
  generateOffTopicReply,
  generateConversationSummary,
  generateIntroReply
} from "../services/openaiService.js";
import { getGoogleSummary } from "../services/googleSearchService.js";

export async function chat(req, res) {
  try {
    const { conversationId, message, userId: clientUserId } = req.body;

    // 1) Validate that a message was provided
    if (!message) {
      return res.status(400).json({ error: "message is required." });
    }

    // 2) If no userId was passed, create a new “anonymous” user
    let userId = clientUserId;
    if (!userId) {
      const newUser = new User({
        email: `anon_${Date.now()}@example.com`,
        password: "anonymous"
      });
      await newUser.save();
      userId = newUser._id.toString();
    }

    // 3) Attempt to load an existing conversation
    let conversation = null;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    }

    // 4) If no conversation is found, create a new one
    if (!conversation) {
      conversation = new Conversation({
        userId,
        conversationName: "Default Conversation",
        messages: [
          { role: "system", content: process.env.SYSTEM_PROMPT || "Default system prompt" }
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

      introData.conversationId = conversation._id.toString();
      introData.userId = userId;
      return res.status(200).json(introData);
    }

    // 5) Add the user's new message
    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // 6) Classify the user's message
    const classification = await classifyMessage(conversation.messages, message);

    // 7) Generate the appropriate reply
    let replyData;
    if (classification.category === "politeness") {
      replyData = await generatePolitenessReply(conversation, classification.language);
    } else if (classification.category === "realestate") {
      if (classification.requiresWebsearch) {
        const webSnippet = await getGoogleSummary(message);
        conversation.messages.push({
          role: "system",
          content: `Web context: ${webSnippet}`,
        });
      }
      replyData = await generateRealEstateReply(conversation, message, classification.language);
    } else {
      replyData = await generateOffTopicReply(conversation, classification.language);
    }

    // 8) Add the assistant's reply
    conversation.messages.push({
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });

    // 9) Update conversation summary
    const summary = await generateConversationSummary(conversation, classification.language);
    conversation.summary = summary;

    await conversation.save();

    replyData.conversationId = conversation._id.toString();
    replyData.userId = userId;
    return res.status(200).json(replyData);

  } catch (err) {
    console.error("Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
}
