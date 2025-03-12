const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const { OpenAI } = require("openai");
require("dotenv").config();
const errorHandler = require("./errorHandler");

// Mongoose models
const User = require("./models/User");
const Conversation = require("./models/Conversation");

// Classification helper
const { classifyQueryWithDeepSeek } = require("./classification");

const apiKey = process.env.OPENROUTER_API_KEY;
console.log("OpenRouter API Key Loaded:", apiKey ? "Yes ✅" : "No ❌");

const app = express();

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/migrantHilfe";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? "https://migrant-hilfe-chatbot.onrender.com"
    : "*"
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: { Authorization: `Bearer ${apiKey}` }
});

/**
 * Updated system prompt with:
 * 1. JSON-only output (no code fences).
 * 2. Rule #9: If user has multiple questions, some about Germany and some off-topic (like math),
 *    only address the Germany portion and politely decline the rest.
 */
const systemPrompt = `
You are Sasha, a professional migration assistant helping people move to and integrate into life in Germany. You chat like a real person—short, natural, and direct.
Rules:
1. Keep responses short and simple, like a real conversation.
2. Ask only one question at a time before moving forward.
3. Answer only one topic at a time, even if the user asks multiple things.
4. Always clarify what the user needs before giving too much detail.
5. No external links. Summarize external info instead.
6. Stay Germany-focused. Politely decline unrelated questions.
7. At the end of your response, output **only** valid JSON of the form:
   {
     "reply": "...",
     "suggestions": ["...", "...", "..."]
   }
   with 3 follow-up suggestions about immigrating to or living in Germany.
   (No code fences or triple backticks.)
8. Respond in the language specified by the user (userLanguage).
9. If the user's message has multiple requests, some about Germany and some off-topic (like math),
   only address the Germany portion and politely decline the off-topic part.
`.trim();

/**
 * Helper function to strip stray markdown or bullet symbols
 */
function stripFormatting(text) {
  return text.replace(/\*\*|- |# /g, "").trim();
}

/**
 * Updated helper function to parse the AI response.
 * It extracts the JSON block between the first "{" and the last "}".
 */
const parseAiResponse = (raw) => {
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
  // If reply is empty, set a fallback to avoid Mongoose validation errors
  if (!parsed.reply || !parsed.reply.trim()) {
    parsed.reply = "Entschuldigung, ich habe gerade keine Antwort gefunden.";
  }
  return parsed;
};

// 1) Create a new user profile
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

// New endpoint to create a new conversation (for multiple chat feature)
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

// 2) Retrieve a user profile and list conversations
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

/**
 * 3) /chat endpoint
 *    - Classifies the message (language + category)
 *    - Updates user language if needed
 *    - Builds AI prompt for "politeness", "germany", or "other"
 *    - Returns JSON: { reply, suggestions }
 */
app.post("/chat", async (req, res) => {
  const { userId, conversationId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: "userId and message are required." });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let conversation = conversationId
      ? await Conversation.findById(conversationId)
      : await Conversation.findOne({ userId });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // Step 1: Classify the new message
    const { language, category } = await classifyQueryWithDeepSeek(openai, conversation.messages, message);

    // Step 2: If the detected language differs from what's in the DB, update it
    const finalLanguage = language || user.profileInfo.language || 'en';
    if (user.profileInfo.language !== finalLanguage) {
      user.profileInfo.language = finalLanguage;
      await user.save();
    }

    // We'll push the user's message now
    conversation.messages.push({ role: "user", content: message, timestamp: new Date() });

    if (category === "politeness") {
      // Build a prompt for polite greetings
      const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");
      const politenessPrompt = `
${systemPrompt}

User Profile: ${JSON.stringify(user.profileInfo)}
Conversation:
${promptMessages}

The user's last message is "politeness". 
Please respond in ${finalLanguage} with a short, friendly greeting or acknowledgement, 
then provide a JSON object:
{
  "reply": "...",
  "suggestions": ["...", "...", "..."]
}
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

      conversation.messages.push({
        role: "assistant",
        content: parsedResponse.reply,
        timestamp: new Date()
      });
      await conversation.save();

      return res.status(200).json(parsedResponse);

    } else if (category === "germany") {
      // Normal immigration-related response
      const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");
      const fullPrompt = `
${systemPrompt}
User Profile: ${JSON.stringify(user.profileInfo)}
Conversation:
${promptMessages}

Please respond in ${finalLanguage}. 
Provide your answer and at the end, output JSON:
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

      conversation.messages.push({
        role: "assistant",
        content: parsedResponse.reply,
        timestamp: new Date()
      });
      await conversation.save();

      return res.status(200).json(parsedResponse);

    } else {
      // category === "other" -> AI-generated polite decline
      const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");
      const offTopicPrompt = `
${systemPrompt}

User Profile: ${JSON.stringify(user.profileInfo)}
Conversation:
${promptMessages}

The user's last message is "other" (off-topic). 
Please respond in ${finalLanguage} with a short, polite refusal to off-topic questions, 
reminding them you can only help with immigration or life in Germany. 
Then provide a JSON object:
{
  "reply": "...",
  "suggestions": ["...", "...", "..."]
}
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

// 4) Clear conversation history (no longer used for new chat creation)
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

/**
 * 5) Introduction endpoint with AI-based generation
 *    Instead of static strings, we do an AI request to greet the user in their language
 */
app.get("/intro", async (req, res) => {
  try {
    const { userId, lang } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "No userId provided." });
    }

    // Find user in DB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Fallback to query param or 'en'
    const finalLanguage = user.profileInfo.language || lang || 'en';

    // Build an AI prompt for an introduction
    const introPrompt = `
${systemPrompt}

The user's language is ${finalLanguage}.
Please provide a short introduction as Sasha, a personal immigration assistant for Germany.
Output only valid JSON:
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
      // fallback if JSON parse fails
      parsedResponse = { reply: apiResponse, suggestions: [] };
    }

    // If the AI gave no reply, fallback
    if (!parsedResponse.reply || !parsedResponse.reply.trim()) {
      parsedResponse.reply = "Hallo, ich bin Sasha, dein persönlicher Assistent für Migration nach Deutschland!";
    }

    return res.status(200).json(parsedResponse);

  } catch (error) {
    console.error("Intro Error:", error);
    return res.status(500).json({ error: "Unable to process introduction request." });
  }
});

app.listen(3000, () => console.log("✅ Server running on port 3000"));
