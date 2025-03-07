const express = require("express");
const path = require("path");
const cors = require("cors");
const { OpenAI } = require("openai");
require("dotenv").config();
const errorHandler = require("./errorHandler");

const apiKey = process.env.OPENROUTER_API_KEY;
console.log("OpenRouter API Key Loaded:", apiKey ? "Yes ✅" : "No ❌");

const app = express();

// In development, free port 3000 if already in use.
// In production (on Render), skip this.
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
});

// Instead of storing a summary, we store the full conversation history per user.
const conversationHistory = {};

const systemPrompt = `
You are DeepSeek, an assistant guiding migrants planning to move to Germany. Provide clear, actionable guidance covering visas, residence permits, employment, education, housing, healthcare, integration, and legal matters. Avoid repetition, external redirects, and excessive details. Keep answers concise and ask clarifying questions if needed.
`;

// Helper function to strip formatting from AI responses
function stripFormatting(text) {
  return text.replace(/\*\*|- |# /g, "").trim();
}

app.post("/chat", async (req, res) => {
  const userId = req.body.userId || `temp-${Date.now()}`;
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ error: "Message required." });
  }

  // Initialize conversation history for this user if it doesn't exist.
  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [];
    // Always start with the system prompt.
    conversationHistory[userId].push({ role: "system", content: systemPrompt });
  }

  // Append the new user message to the conversation history.
  conversationHistory[userId].push({ role: "user", content: userMessage });

  try {
    const result = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat:free",
      messages: conversationHistory[userId],
      temperature: 0.8,
      max_tokens: 300,
      search: true,
    });

    let reply = result.choices[0].message.content;
    // Append the assistant's reply to the conversation history.
    conversationHistory[userId].push({ role: "assistant", content: reply });
    res.status(200).json({ reply: stripFormatting(reply) });
  } catch (error) {
    console.error("OpenRouter API Error:", error);
    res.status(500).json({ error: "Unable to process request." });
  }
});

app.get("/intro", async (req, res) => {
  try {
    // For an introduction, we start a fresh conversation with the system prompt.
    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Introduce yourself and explain how you can help migrants planning to move to Germany.",
      },
    ];
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
