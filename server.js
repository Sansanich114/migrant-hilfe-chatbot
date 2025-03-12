/************************************************************************
 * server.js
 ************************************************************************/
const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const { OpenAI } = require("openai");
const axios = require("axios"); // For Google Custom Search
require("dotenv").config();
const errorHandler = require("./errorHandler");

// Mongoose models
const User = require("./models/User");
const Conversation = require("./models/Conversation");

// Classification helper
const { classifyQueryWithDeepSeek } = require("./classification");

// ---------------------------------------------------
// 1) API Keys for Google Custom Search
//    (Preferably store these in .env, not hard-coded)
const GOOGLE_CSE_ID = "12a578c30ca6c42b3";  // from your message
const GOOGLE_CSE_KEY = "AIzaSyClfHTLNCis9..."; // from your message

// ---------------------------------------------------
// 2) OpenRouter / DeepSeek API
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("❌ OPENROUTER_API_KEY not set. Check your .env file or Render configuration.");
} else {
  console.log("✅ OpenRouter API Key Loaded Successfully.");
}

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://openrouter.ai/api/v1"
});

// ---------------------------------------------------
// 3) Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/migrantHilfe";
mongoose.connect(mongoURI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// ---------------------------------------------------
// 4) Express App Setup
const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? "https://migrant-hilfe-chatbot.onrender.com"
    : "*"
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------
// 5) System Prompt (Simplified for a 13-year-old)
const systemPrompt = `
You are Sasha, a friendly migration assistant who explains things in simple language (easy enough for a 13-year-old, but still accurate).
Rules:
1. Your answers should be short and clear.
2. No direct links. Summarize any info you find.
3. If you have extra facts from web research, put them in your answer.
4. At the end, return valid JSON:
   {
     "reply": "...",
     "suggestions": ["...", "...", "..."]
   }
`.trim();

/**
 * Helper function to strip stray markdown or bullet symbols
 */
function stripFormatting(text) {
  return text.replace(/\*\*|- |# /g, "").trim();
}

/**
 * Helper function to parse the AI response.
 * It extracts the JSON block between the first "{" and the last "}".
 */
function parseAiResponse(raw) {
  let jsonString = raw.trim();
  const firstBrace = jsonString.indexOf("{");
  const lastBrace = jsonString.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    parsed = { reply: stripFormatting(raw), suggestions: [] };
  }
  if (!parsed.reply || !parsed.reply.trim()) {
    parsed.reply = "Sorry, I don't have an answer right now.";
  }
  return parsed;
}

// ---------------------------------------------------
// 6) Create a new user profile
app.post("/createProfile", async (req, res) => {
  try {
    const newUser = new User({
      subscriptionType: "free",
      freeUsageCount: 0,
      profileInfo: req.body.profileInfo || {}
    });
    const savedUser = await newUser.save();

    const conversation = new Conversation({
      userId: savedUser._id,
      conversationName: "Default Conversation",
      messages: [{ role: "system", content: systemPrompt }],
    });
    await conversation.save();

    res.status(201).json({ userId: savedUser._id, conversationId: conversation._id });
  } catch (err) {
    console.error("Error creating profile:", err);
    res.status(500).json({ error: "Failed to create profile" });
  }
});

// ---------------------------------------------------
// 7) Create a new conversation
app.post("/createConversation", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required." });
  try {
    const conversation = new Conversation({
      userId,
      conversationName: "New Conversation",
      messages: [{ role: "system", content: systemPrompt }]
    });
    await conversation.save();
    res.status(201).json({ conversationId: conversation._id });
  } catch(err) {
    console.error("Error creating new conversation:", err);
    res.status(500).json({ error: "Unable to create new conversation." });
  }
});

// ---------------------------------------------------
// 8) Retrieve a user profile and list of conversations
app.get("/profile/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const conversations = await Conversation.find({ userId: req.params.userId }).lean();
    res.status(200).json({ user, conversations });
  } catch (err) {
    console.error("Error retrieving profile:", err);
    res.status(500).json({ error: "Failed to retrieve profile" });
  }
});

// ---------------------------------------------------
// 9) Main /chat endpoint
app.post("/chat", async (req, res) => {
  const { userId, conversationId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: "userId and message are required." });
  }

  try {
    // Find user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find conversation
    let conversation = conversationId
      ? await Conversation.findById(conversationId)
      : await Conversation.findOne({ userId });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // 1) Classify message
    const classification = await classifyQueryWithDeepSeek(openai, conversation.messages, message);
    const { language, category, requiresWebsearch } = classification;

    // 2) Update user's language if changed
    const finalLanguage = language || user.profileInfo.language || "en";
    if (user.profileInfo.language !== finalLanguage) {
      user.profileInfo.language = finalLanguage;
      await user.save();
    }

    // 3) Add user's message to conversation
    conversation.messages.push({ role: "user", content: message, timestamp: new Date() });

    // 4) Handle each category
    if (category === "politeness") {
      // Polite greeting or farewell
      const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");
      const politenessPrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

The user is just being polite. Respond in ${finalLanguage} with a short, friendly greeting. Return valid JSON.
`.trim();

      const result = await openai.chat.completions.create({
        model: "deepseek/deepseek-chat:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: politenessPrompt }
        ],
        temperature: 0.8,
        max_tokens: 500
      });

      const apiResponse = result.choices[0].message.content;
      const parsedResponse = parseAiResponse(apiResponse);

      // Save assistant reply
      conversation.messages.push({
        role: "assistant",
        content: parsedResponse.reply,
        timestamp: new Date()
      });
      await conversation.save();

      return res.status(200).json(parsedResponse);

    } else if (category === "germany") {
      // If user needs official info or current details, do a Google search
      let googleSummary = "";
      if (requiresWebsearch) {
        try {
          const googleRes = await axios.get("https://customsearch.googleapis.com/customsearch/v1", {
            params: {
              key: GOOGLE_CSE_KEY,
              cx: GOOGLE_CSE_ID,
              q: message
            }
          });
          const items = googleRes.data.items || [];
          const topResults = items.slice(0, 3);
          const snippets = topResults.map(item => item.snippet).join("\n");
          googleSummary = `Here are some things I found:\n${snippets}`;
        } catch (err) {
          console.error("Google Search error:", err);
          googleSummary = "I couldn't find extra info right now.";
        }
      }

      // Build final prompt for DeepSeek
      const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");
      const fullPrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

Additional info (no direct links):
${googleSummary}

Answer in ${finalLanguage}. Return JSON like:
{
  "reply": "...",
  "suggestions": ["...", "...", "..."]
}
`.trim();

      const result = await openai.chat.completions.create({
        model: "deepseek/deepseek-chat:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: fullPrompt }
        ],
        temperature: 0.8,
        max_tokens: 500
      });

      const apiResponse = result.choices[0].message.content;
      const parsedResponse = parseAiResponse(apiResponse);

      // Save assistant reply
      conversation.messages.push({
        role: "assistant",
        content: parsedResponse.reply,
        timestamp: new Date()
      });
      await conversation.save();

      return res.status(200).json(parsedResponse);

    } else {
      // category === "other" => off-topic
      const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");
      const offTopicPrompt = `
${systemPrompt}

Conversation so far:
${promptMessages}

The user asked something off-topic. Respond in ${finalLanguage} politely, saying you can only help with migration or Germany. Return valid JSON.
`.trim();

      const result = await openai.chat.completions.create({
        model: "deepseek/deepseek-chat:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: offTopicPrompt }
        ],
        temperature: 0.8,
        max_tokens: 500
      });

      const apiResponse = result.choices[0].message.content;
      const parsedResponse = parseAiResponse(apiResponse);

      conversation.messages.push({
        role: "assistant",
        content: parsedResponse.reply,
        timestamp: new Date()
      });
      await conversation.save();

      return res.status(200).json(parsedResponse);
    }

  } catch (err) {
    console.error("Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
});

// ---------------------------------------------------
// 10) Clear conversation history
app.post("/clearHistory", async (req, res) => {
  const { userId, conversationId } = req.body;
  if (!userId || !conversationId) {
    return res.status(400).json({ error: "userId and conversationId are required." });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });

    conversation.messages = [{ role: "system", content: systemPrompt }];
    await conversation.save();
    res.status(200).json({ message: "Conversation history cleared." });
  } catch (err) {
    console.error("Error clearing history:", err);
    res.status(500).json({ error: "Unable to clear history." });
  }
});

// ---------------------------------------------------
// 11) Introduction endpoint (AI-based greeting)
app.get("/intro", async (req, res) => {
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

    const introPrompt = `
${systemPrompt}

The user's language is ${finalLanguage}.
Give a short greeting as Sasha. Return valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "...", "..."]
}
`.trim();

    const result = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: introPrompt }
      ],
      temperature: 0.8,
      max_tokens: 500
    });

    let apiResponse = result.choices[0].message.content;
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(apiResponse);
    } catch (e) {
      parsedResponse = { reply: apiResponse, suggestions: [] };
    }

    if (!parsedResponse.reply || !parsedResponse.reply.trim()) {
      parsedResponse.reply = "Hi! I'm Sasha. How can I help you with moving to Germany?";
    }

    return res.status(200).json(parsedResponse);

  } catch (error) {
    console.error("Intro Error:", error);
    return res.status(500).json({ error: "Unable to process introduction request." });
  }
});

// ---------------------------------------------------
// 12) Start the server
app.listen(3000, () => console.log("✅ Server running on port 3000"));
