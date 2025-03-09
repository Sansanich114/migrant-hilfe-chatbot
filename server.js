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

const apiKey = process.env.OPENROUTER_API_KEY;
console.log("OpenRouter API Key Loaded:", apiKey ? "Yes ✅" : "No ❌");

const app = express();

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/migrantHilfe";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// In development, free port 3000 if already in use.
if (process.env.NODE_ENV !== "production") {
  const net = require("net");
  const serverCheck = net.createServer();
  serverCheck.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log("Port 3000 is in use. Trying to free it...");
      require("child_process").execSync("taskkill /F /IM node.exe");
      console.log("Previous process killed. Restarting server...");
      process.exit(1);
    }
  });
  serverCheck.once("listening", () => serverCheck.close());
  serverCheck.listen(3000);
}

// Setup CORS.
// When in production, restrict origin to your Render domain.
const allowedOrigin =
  process.env.NODE_ENV === "production"
    ? "https://migrant-hilfe-chatbot.onrender.com"
    : "*";
app.use(cors({ origin: allowedOrigin }));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: { Authorization: `Bearer ${apiKey}` }
});


const systemPrompt = `
You are DeepSeek, an assistant guiding migrants planning to move to Germany.
Provide clear, actionable guidance covering visas, residence permits, employment, education, housing, healthcare, integration, and legal matters.
Avoid repetition, external redirects, and excessive details.
Keep answers concise and ask clarifying questions if needed.
`;

// Helper function to strip formatting from AI responses
function stripFormatting(text) {
  return text.replace(/\*\*|- |# /g, "").trim();
}

// --- Endpoint to create a new user profile ---
app.post("/createProfile", async (req, res) => {
  try {
    // Create a new user with default free subscription and freeUsageCount = 0
    const newUser = new User({
      subscriptionType: "free",
      freeUsageCount: 0,
      profileInfo: req.body.profileInfo || {},
    });
    const savedUser = await newUser.save();

    // Create a default conversation for free users
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

// --- Endpoint to retrieve a user profile and list conversations ---
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

// --- Chat Endpoint ---
app.post("/chat", async (req, res) => {
  const { userId, conversationId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: "userId and message are required." });
  }

  try {
    // Retrieve the user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // If user is free and has reached the free trial limit, block further messages.
    if (user.subscriptionType === "free" && user.freeUsageCount >= 10) {
      return res.status(403).json({ error: "Free usage limit reached. Please upgrade." });
    }

    // Load the conversation. For free users, use the default conversation if conversationId is not provided.
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    } else {
      conversation = await Conversation.findOne({ userId: userId });
    }
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });

    // Append user's message to the conversation
    conversation.messages.push({ role: "user", content: message, timestamp: new Date() });

    // Build the prompt by combining the user's profile information and conversation history.
    // (For simplicity, we just join the messages.)
    const promptMessages = conversation.messages.map(m => `${m.role}: ${m.content}`).join("\n");

    const result = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat:free",
      messages: [{ role: "system", content: systemPrompt },
                 { role: "user", content: `User Profile: ${JSON.stringify(user.profileInfo)}\nConversation:\n${promptMessages}` }],
      temperature: 0.8,
      max_tokens: 300,
      search: true,
    });

    let reply = result.choices[0].message.content;
    conversation.messages.push({ role: "assistant", content: reply, timestamp: new Date() });

    // Save the conversation
    await conversation.save();

    // If the user is free, increment the freeUsageCount.
    if (user.subscriptionType === "free") {
      user.freeUsageCount += 1;
      await user.save();
    }

    res.status(200).json({ reply: stripFormatting(reply) });
  } catch (err) {
    console.error("Error in /chat:", err);
    res.status(500).json({ error: "Unable to process request." });
  }
});

// --- Endpoint to clear a conversation (for registered users) ---
app.post("/clearHistory", async (req, res) => {
  const { userId, conversationId } = req.body;
  if (!userId || !conversationId) {
    return res.status(400).json({ error: "userId and conversationId are required." });
  }
  try {
    // Only allow clearing if the user is not free
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.subscriptionType === "free") {
      return res.status(403).json({ error: "Free users cannot clear history." });
    }
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

// Introduction endpoint
app.get("/intro", async (req, res) => {
  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: "Introduce yourself and explain how you can help migrants planning to move to Germany.",
    },
  ];
  try {
    const result = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat:free",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });
    const rawReply = result.choices[0].message.content;
    res.status(200).json({ reply: stripFormatting(rawReply) });
  } catch (error) {
    console.error("Intro Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Unable to process introduction request." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
