const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
require("dotenv").config();
const errorHandler = require("./errorHandler");

// ✅ Load OpenRouter API key from .env
const apiKey = process.env.OPENROUTER_API_KEY;

console.log("OpenRouter API Key Loaded:", apiKey ? "Yes ✅" : "No ❌");

// ✅ OpenRouter API URL
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

const app = express();

// ✅ Middleware
app.use(express.json());
app.use(cors());

// ✅ Serve Static Files (Chat UI)
app.use(express.static(path.join(__dirname, "public")));

// ✅ Suppress favicon.ico 404 errors
app.get("/favicon.ico", (req, res) => res.status(204));

// ✅ Root Route Serves HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Chatbot API Route
app.post("/chat", async (req, res) => {
  console.log("Received request:", req.body);

  if (!req.body || !req.body.message) {
    return res
      .status(400)
      .json({ error: 'Invalid request. Expected {"message":"Hello"}' });
  }

  const userMessage = req.body.message;

  // ✅ Prepare the request payload for OpenRouter API with the correct model identifier
  const requestData = {
    model: "deepseek-r1:free", // Updated model identifier
    messages: [
      { role: "system", content: "You are an immigration expert helping people move to Germany." },
      { role: "user", content: userMessage },
    ],
  };

  try {
    // ✅ Send the request to OpenRouter API
    const response = await axios.post(API_URL, requestData, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    console.log("OpenRouter API Response:", response.data);

    // ✅ Extract and send the AI's response back to the client
    const aiReply =
      response.data.choices?.[0]?.message?.content ||
      "Error: No valid response from OpenRouter.";
    res.status(200).json({ reply: aiReply });
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
