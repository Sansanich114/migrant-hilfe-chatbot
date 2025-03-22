import fs from "fs";
import path from "path";
import Conversation from "../models/Conversation.js";
import { classifyMessage } from "../services/classificationService.js";
import {
  generatePolitenessReply,
  generateRealEstateReply,
  generateOffTopicReply,
  generateConversationSummary
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
    if (!conversation) {
      // Attempt to load the salesman tutorial from the text file
      const tutorialPath = path.join(process.cwd(), "server", "tutorials", "salesmanTutorial.txt");
      let tutorialText = "";

      try {
        tutorialText = fs.readFileSync(tutorialPath, "utf8");
      } catch (err) {
        console.error("Could not load salesmanTutorial.txt:", err);
        // Fallback text if file not found
        tutorialText = "You are a real estate assistant with a pragmatic sales approach.";
      }

      // Create a new conversation with the tutorial as the system message
      conversation = new Conversation({
        userId: userId || null, // store null if no userId was provided
        conversationName: "Default Conversation",
        messages: [
          {
            role: "system",
            content: tutorialText,
          },
        ],
      });

      // Add a short static intro as the first assistant response
      const staticIntro = {
        reply: "Hello and welcome to Real Estate Beispiel GmbH! I'm here to help you find the perfect property. Let's discuss your needs, and I'll do my best to arrange a meeting with one of our expert agents.",
        suggestions: ["Show me properties", "I want to buy", "I want to rent"],
      };

      conversation.messages.push({
        role: "assistant",
        content: staticIntro.reply,
        timestamp: new Date(),
      });

      await conversation.save();

      // Return the static intro plus the newly created conversationId
      staticIntro.conversationId = conversation._id.toString();
      return res.status(200).json(staticIntro);
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
