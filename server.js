const express = require("express");
const cors = require("cors");
const path = require("path");
const { OpenAI } = require("openai"); // Ensure you've installed this package via npm install openai
require("dotenv").config();
const errorHandler = require("./errorHandler");

// ✅ Load OpenRouter API key from .env
const apiKey = process.env.OPENROUTER_API_KEY;
console.log("OpenRouter API Key Loaded:", apiKey ? "Yes ✅" : "No ❌");

const app = express();

// ✅ Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

app.get("/favicon.ico", (req, res) => res.status(204));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Initialize OpenAI client with OpenRouter settings
const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://openrouter.ai/api/v1" // Base URL for OpenRouter API
});

// ✅ Chatbot API Route using OpenAI client
app.post("/chat", async (req, res) => {
  console.log("Received request:", req.body);
  
  if (!req.body || !req.body.message) {
    return res.status(400).json({ error: 'Invalid request. Expected {"message":"Hello"}' });
  }

  const userMessage = req.body.message;

  try {
    // Create chat completion using the correct model identifier for DeepSeek R1 (free version)
    const result = await openai.chat.completions.create({
      model: "deepseek/deepseek-r1:free", // Correct model identifier for free DeepSeek R1
      messages: [
        {
          role: "system",
          content: "You are an immigration expert helping people move to Germany."
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });
    
    // Extract the reply message from the result
    const { message } = result.choices[0];
    console.log("OpenRouter API Response:", message.content);
    res.status(200).json({ reply: message.content });
  } catch (error) {
    console.error("OpenRouter API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Error: Unable to process request." });
  }
});

// ✅ Error Handler Middleware
app.use(errorHandler);

// ✅ Start Server on Render's assigned port
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
