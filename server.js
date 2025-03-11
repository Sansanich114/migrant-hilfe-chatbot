const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const { OpenAI } = require("openai");
require("dotenv").config();
const errorHandler = require("./errorHandler");

// Import Mongoose models
const User = require("./models/User");
const Conversation = require("./models/Conversation");

// Import classification helper
const { classifyQueryWithDeepSeek } = require("./classification");

const apiKey = process.env.OPENROUTER_API_KEY;
console.log("OpenRouter API Key Loaded:", apiKey ? "Yes ✅" : "No ❌");

const app = express();

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/migrantHilfe";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

app.use(cors({ origin: process.env.NODE_ENV === "production" ? "https://migrant-hilfe-chatbot.onrender.com" : "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: { Authorization: `Bearer ${apiKey}` }
});

// Updated system prompt
const systemPrompt = `
You are Sasha, a professional migration assistant helping people move to and integrate into life in Germany. You chat like a real person—short, natural, and direct.

Rules:
1. Keep responses short and simple, like a real conversation.
2. Ask only one question at a time before moving forward.
3. Answer only one topic at a time, even if the user asks multiple things.
4. Always clarify what the user needs before giving too much detail.
5. No external links. Summarize external info instead.
6. Stay Germany-focused. Politely decline unrelated questions.

Example Chat:

User: Hi, I want to move to Germany. Also, how much does rent cost in Berlin?  
Sasha: Got it! Are you moving for work, study, or something else?  

User: I want to find a job there.  
Sasha: Makes sense. Do you already have a job offer, or are you planning to search after you arrive?  

User: I don’t have an offer yet.  
Sasha: Then you might need a Job Seeker Visa. It gives you six months to find work. Want to know how to apply?  

User: Yes, and I also asked about rent.  
Sasha: We’ll get to that soon. First, are you applying from your home country or somewhere else?  

When a user starts a conversation, introduce yourself naturally:  
"Hey, I’m Sasha, your personal immigration assistant for Germany. What do you need help with?"
`;

// Mapping of language codes to introductory messages
const introMessages = {
  en: "Hey, I’m Sasha, your personal immigration assistant for Germany. What do you need help with?",
  de: "Hallo, ich bin Sasha, dein persönlicher Migrationsassistent für Deutschland. Wie kann ich dir helfen?",
  tr: "Merhaba, ben Sasha, Almanya için kişisel göçmen asistanınız. Size nasıl yardımcı olabilirim?",
  // add more languages as needed
};

// Helper function to strip formatting from AI responses
function stripFormatting(text) {
  return text.replace(/\*\*|- |# /g, "").trim();
}

// Create a new user profile
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

// Retrieve a user profile and list conversations
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

// Chat Endpoint
app.post("/chat", async (req, res) => {
  const { userId, conversationId, message } = req.body;
  if (!userId || !message) return res.status(400).json({ error: "userId and message are required." });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let conversation = conversationId
      ? await Conversation.findById(conversationId)
      : await Conversation.findOne({ userId });

    if (!conversation) return res.status(404).json({ error: "Conversation not found." });

    // Use classification to determine the type of request.
    const classification = await classifyQueryWithDeepSeek(openai, conversation.messages, message);

    // If classification fails or is "other", return a default message.
    if (!classification || classification === "other") {
      return res.status(200).json({
        reply: "I’m only here to help with immigration and life in Germany. Let me know if you have a question about that."
      });
    } else if (classification === "politeness") {
      return res.status(200).json({
        reply: "Thank you for your message! If you have any questions about immigrating to or living in Germany, feel free to ask. Bye for now!"
      });
    }

    conversation.messages.push({ role: "user", content: message, timestamp: new Date() });
    const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");

    const result = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `User Profile: ${JSON.stringify(user.profileInfo)}\nConversation:\n${promptMessages}` }
      ],
      temperature: 0.8
    });

    let reply = result.choices[0].message.content;
    conversation.messages.push({ role: "assistant", content: reply, timestamp: new Date() });
    await conversation.save();

    res.status(200).json({ reply: stripFormatting(reply) });
  } catch (err) {
    console.error("Error in /chat:", err);
    res.status(500).json({ error: "Unable to process request." });
  }
});

// Clear conversation history
app.post("/clearHistory", async (req, res) => {
  const { userId, conversationId } = req.body;
  if (!userId || !conversationId) return res.status(400).json({ error: "userId and conversationId are required." });

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

// Introduction endpoint with multilingual support.
app.get("/intro", async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const introMsg = introMessages[lang] || introMessages['en'];
    res.status(200).json({ reply: introMsg });
  } catch (error) {
    console.error("Intro Error:", error);
    res.status(500).json({ error: "Unable to process introduction request." });
  }
});

app.listen(3000, () => console.log("✅ Server running on port 3000"));
