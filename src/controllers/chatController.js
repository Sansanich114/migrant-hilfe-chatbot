// src/controllers/chatController.js

import User from "../models/User.js";
import {
  generateSalesmanReply,
  generatePolitenessReply,
  generateOtherReply,
  getBestAgencySnippet,
  getBestProperty,
} from "../services/openaiService.js";
import { classifyMessage } from "../services/classificationService.js";
import {
  getSessionMessages,
  saveSessionMessage,
} from "../services/memoryStore.js";

export async function chat(req, res) {
  try {
    const { sessionId, message, userId: clientUserId } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: "Missing sessionId or message." });
    }

    // Step 0: Handle user creation if none provided
    let userId = clientUserId;
    if (!userId) {
      const newUser = new User({
        email: `anon_${Date.now()}@example.com`,
        password: "anonymous",
      });
      await newUser.save();
      userId = newUser._id.toString();
    }

    // Step 1: Get session memory (last 20 messages)
    const messages = getSessionMessages(sessionId);

    // Step 2: Save user message to session
    saveSessionMessage(sessionId, {
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // Step 3: Load user profile for personalization
    const user = await User.findById(userId);
    const userProfile = user?.profileInfo || {};

    // Step 4: Classify the user message
    const { category, language } = await classifyMessage(messages, message);

    // Step 5: Prepare convo object with embeddings + profile
    const agencySnippet = await getBestAgencySnippet(message);
    const fakeExtractedInfo = {
      ...userProfile,
      ...guessMinimalIntent(message), // fallback in case LLM gives nothing
    };
    const bestProperty = await getBestProperty(fakeExtractedInfo);
    const propertySnippet = bestProperty?.description || "";

    const conversation = {
      messages,
      userProfile,
      agencySnippet,
      propertySnippet,
    };

    // Step 6: Generate reply
    let replyData;
    if (category === "salesman") {
      replyData = await generateSalesmanReply(conversation, message, language);
    } else if (category === "politeness") {
      replyData = await generatePolitenessReply(conversation, language);
    } else {
      replyData = await generateOtherReply(conversation, language);
    }

    // Step 7: Save assistant reply to session
    saveSessionMessage(sessionId, {
      role: "assistant",
      content: replyData.reply,
      timestamp: new Date(),
    });

    // Step 8: Merge extractedInfo into User.profileInfo
    if (replyData.extractedInfo && user) {
      user.profileInfo = {
        ...user.profileInfo,
        ...replyData.extractedInfo,
      };
      await user.save();
    }

    // Step 9: Return structured response
    return res.status(200).json({
      ...replyData,
      sessionId,
      userId,
    });

  } catch (err) {
    console.error("💥 Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
}

// Optional fallback if LLM doesn't extract anything
function guessMinimalIntent(text) {
  const lower = text.toLowerCase();
  return {
    location: lower.includes("berlin") ? "Berlin" : lower.includes("hamburg") ? "Hamburg" : "",
    propertyType: lower.includes("office") ? "commercial" : lower.includes("apartment") ? "apartment" : "",
    budget: lower.includes("€") ? "undisclosed" : "",
    usage: lower.includes("rent") ? "rent" : lower.includes("buy") ? "buy" : "",
  };
}
