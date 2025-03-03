const express = require("express");
const cors = require("cors");
const path = require("path");
const { OpenAI } = require("openai");
require("dotenv").config();
const errorHandler = require("./errorHandler");

const apiKey = process.env.OPENROUTER_API_KEY;
console.log("OpenRouter API Key Loaded:", apiKey ? "Yes ✅" : "No ❌");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// Store conversation history for each user (in-memory storage)
const conversationHistory = {};

// Helper function to strip away formatting
function stripFormatting(text) {
  return text
    .replace(/\*\*/g, "")  // remove bold markers (**)
    .replace(/^- /gm, "")   // remove bullet markers at line start (- )
    .replace(/^# /gm, "")   // remove heading markers (# )
    .trim();
}

// Helper function to detect repetitive responses
function isResponseRepetitive(response) {
  const sentences = response.split(". ");
  const uniqueSentences = new Set(sentences);
  return uniqueSentences.size < sentences.length;
}

// Helper function to check if the question is relevant
function isRelevantQuestion(message) {
  const relevantKeywords = [
    "germany", "visa", "embassy", "migration", "residence", "work", "education",
    "housing", "healthcare", "integration", "legal", "documents", "permit"
  ];
  const lowerCaseMessage = message.toLowerCase();
  return relevantKeywords.some(keyword => lowerCaseMessage.includes(keyword));
}

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://openrouter.ai/api/v1"
});

// Define the system prompt
const systemPrompt = `
You are DeepSeek, a full-featured assistant for migrants planning to move to Germany. Your role is to guide users through the migration process by providing detailed, accurate, and actionable information. You should cover all aspects of migration, including visas, residence permits, work, education, housing, adaptation, healthcare, integration, and legal questions. 

- Provide all necessary information directly without redirecting users to external platforms.
- Use simple language and clarify details based on the user's knowledge level.
- Present instructions as clear next actions: what to do, where to go, and which documents to prepare.
- Avoid overwhelming users with too much information at once. If the next step depends on more details, ask one clarifying question before giving the final answer.
- If a user's request is unrelated to moving to Germany, respond briefly that you are here to help with migration to Germany.
- Stay focused on providing relevant, actionable information for newcomers with minimal background knowledge.
- Use the internet search feature to provide the most accurate and up-to-date information when necessary.
- Respond in no more than 2-3 short sentences unless more detail is explicitly requested.
- Do not use any bold text, bullet points, or numbered lists.
- Keep your text minimal, with no special formatting.
- **Do not repeat yourself. Provide concise and clear answers without looping or redundancy.**
`;

// New GET endpoint to serve the introduction message
app.get("/intro", async (req, res) => {
  try {
    const result = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat:free",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: "Introduce yourself and explain how you can help migrants planning to move to Germany."
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    const rawReply = result.choices[0].message.content;
    const finalReply = stripFormatting(rawReply);
    res.status(200).json({ reply: finalReply });
  } catch (error) {
    console.error("OpenRouter API Error on /intro:", error.response?.data || error.message);
    res.status(500).json({ error: "Error: Unable to process introduction request." });
  }
});

app.post("/chat", async (req, res) => {
  console.log("Received request body:", req.body); // Log the request body

  // Handle pre-flight OPTIONS requests explicitly
  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }

  // Check if required fields are present
  if (!req.body || !req.body.message) {
    console.error("Missing required fields in request body:", req.body);
    return res.status(400).json({ error: 'Invalid request. Expected {"message":"Hello"}' });
  }

  // Generate a temporary userId if not provided
  const userId = req.body.userId || `temp-${Date.now()}`;
  const message = req.body.message;

  // Initialize conversation history for the user if it doesn't exist
  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [
      {
        role: "system",
        content: systemPrompt
      }
    ];
  }

  // Add the user's message to the conversation history
  conversationHistory[userId].push({
    role: "user",
    content: message
  });

  // Check if the question is relevant
  if (!isRelevantQuestion(message)) {
    const finalReply = "I'm here to help with migration to Germany. Please ask me questions related to that!";
    conversationHistory[userId].push({
      role: "assistant",
      content: finalReply
    });
    return res.status(200).json({ reply: finalReply });
  }

  try {
    const result = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat:free",
      messages: conversationHistory[userId], // Pass the entire conversation history
      temperature: 0.8, // Increased temperature to reduce repetition
      max_tokens: 200, // Limit response length
      search: true // Enable internet search
    });

    // Extract the raw response
    let rawReply = result.choices[0].message.content;
    let finalReply = stripFormatting(rawReply);

    // Check for repetitive responses
    if (isResponseRepetitive(finalReply)) {
      finalReply = "Let me know if you need more details or have another question!";
    }

    // Add the bot's response to the conversation history
    conversationHistory[userId].push({
      role: "assistant",
      content: finalReply
    });

    console.log("OpenRouter API Response:", finalReply);
    res.status(200).json({ reply: finalReply });
  } catch (error) {
    console.error("OpenRouter API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Error: Unable to process request." });
  }
});

// Serve the index.html file for the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});