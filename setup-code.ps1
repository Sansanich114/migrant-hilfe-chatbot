# --- app.js ---
Set-Content -Path "app.js" -Value @"
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const chatRoutes = require('./routes/chatRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(cors({ origin: process.env.NODE_ENV === "production" ? "https://migrant-hilfe-chatbot.onrender.com" : "*" }));
app.use(express.json());
app.use(express.static('public'));

// Connect Routes
app.use('/chat', chatRoutes);
app.use('/user', userRoutes);

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
"@;

# --- routes/chatRoutes.js ---
Set-Content -Path "routes/chatRoutes.js" -Value @"
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/', chatController.chat);

module.exports = router;
"@;

# --- routes/userRoutes.js ---
Set-Content -Path "routes/userRoutes.js" -Value @"
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/createProfile', userController.createProfile);
router.post('/createConversation', userController.createConversation);
router.get('/profile/:userId', userController.getProfile);
router.patch('/renameConversation', userController.renameConversation);
router.delete('/deleteConversation', userController.deleteConversation);
router.delete('/deleteAllUserData', userController.deleteAllUserData);

module.exports = router;
"@;

# --- controllers/chatController.js ---
Set-Content -Path "controllers/chatController.js" -Value @"
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const classificationService = require('../services/classificationService');
const openaiService = require('../services/openaiService');
const { searchGoogle } = require('../services/googleSearchService');
const { parseAiResponse, stripFormatting } = require('../utils/helpers');

exports.chat = async (req, res) => {
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

    if (!conversation) return res.status(404).json({ error: "Conversation not found." });

    // Classify message
    const classification = await classificationService.classifyMessage(conversation.messages, message);
    const { language, category, requiresWebsearch } = classification;

    const finalLanguage = language || user.profileInfo.language || "en";
    if (user.profileInfo.language !== finalLanguage) {
      user.profileInfo.language = finalLanguage;
      await user.save();
    }

    conversation.messages.push({ role: "user", content: message, timestamp: new Date() });

    let replyData;
    if (category === "politeness") {
      replyData = await openaiService.generatePolitenessReply(conversation, finalLanguage);
    } else if (category === "germany") {
      replyData = await openaiService.generateGermanyReply(conversation, message, finalLanguage, requiresWebsearch);
    } else {
      replyData = await openaiService.generateOffTopicReply(conversation, finalLanguage);
    }

    conversation.messages.push({ role: "assistant", content: replyData.reply, timestamp: new Date() });
    await conversation.save();

    return res.status(200).json(replyData);

  } catch (err) {
    console.error("Error in /chat:", err);
    return res.status(500).json({ error: "Unable to process request." });
  }
};

module.exports = { chat };
"@;

# --- controllers/userController.js ---
Set-Content -Path "controllers/userController.js" -Value @"
const User = require('../models/User');
const Conversation = require('../models/Conversation');

exports.createProfile = async (req, res) => {
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
      messages: [{ role: "system", content: process.env.SYSTEM_PROMPT }]
    });
    await conversation.save();

    res.status(201).json({ userId: savedUser._id, conversationId: conversation._id });
  } catch (err) {
    console.error("Error creating profile:", err);
    res.status(500).json({ error: "Failed to create profile" });
  }
};

exports.createConversation = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required." });
  try {
    const conversation = new Conversation({
      userId,
      conversationName: "New Conversation",
      messages: [{ role: "system", content: process.env.SYSTEM_PROMPT }]
    });
    await conversation.save();
    res.status(201).json({ conversationId: conversation._id });
  } catch(err) {
    console.error("Error creating new conversation:", err);
    res.status(500).json({ error: "Unable to create new conversation." });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const conversations = await Conversation.find({ userId: req.params.userId }).lean();
    res.status(200).json({ user, conversations });
  } catch (err) {
    console.error("Error retrieving profile:", err);
    res.status(500).json({ error: "Failed to retrieve profile" });
  }
};

exports.renameConversation = async (req, res) => {
  const { conversationId, newName } = req.body;
  if (!conversationId || !newName) {
    return res.status(400).json({ error: "conversationId and newName are required." });
  }
  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    conversation.conversationName = newName;
    await conversation.save();
    return res.status(200).json({ message: "Conversation renamed successfully." });
  } catch (err) {
    console.error("Error renaming conversation:", err);
    res.status(500).json({ error: "Unable to rename conversation." });
  }
};

exports.deleteConversation = async (req, res) => {
  const { conversationId } = req.body;
  if (!conversationId) {
    return res.status(400).json({ error: "conversationId is required." });
  }
  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    await conversation.deleteOne();
    return res.status(200).json({ message: "Conversation deleted successfully." });
  } catch (err) {
    console.error("Error deleting conversation:", err);
    res.status(500).json({ error: "Unable to delete conversation." });
  }
};

exports.deleteAllUserData = async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }
  try {
    await Conversation.deleteMany({ userId });
    await User.findByIdAndDelete(userId);
    return res.status(200).json({ message: "All user data deleted successfully." });
  } catch (err) {
    console.error("Error deleting all user data:", err);
    res.status(500).json({ error: "Unable to delete all user data." });
  }
};
"@;

# --- services/openaiService.js ---
Set-Content -Path "services/openaiService.js" -Value @"
const OpenAI = require('openai');
const { parseAiResponse } = require('../utils/helpers');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

const systemPrompt = process.env.SYSTEM_PROMPT || \`
You are Sasha, a friendly migration assistant who explains things in simple language (easy enough for a 13-year-old, but still accurate).
Rules:
1. Your answers should be short and clear.
2. No direct links. Summarize any info you find.
3. If you have extra facts from web research, put them in your answer.
4. Provide exactly 2 short suggestions that are relevant next questions the user might ask.
5. Return valid JSON:
   {
     "reply": "...",
     "suggestions": ["...", "..."]
   }
\`.trim();

async function generateReply(prompt) {
  const result = await openai.chat.completions.create({
    model: 'deepseek/deepseek-chat:free',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 500
  });
  return parseAiResponse(result.choices[0].message.content);
}

async function generateGermanyReply(conversation, message, language, requiresWebsearch) {
  let googleSummary = "";
  if (requiresWebsearch) {
    const googleSearchService = require('./googleSearchService');
    googleSummary = await googleSearchService.getGoogleSummary(message);
  }
  const promptMessages = conversation.messages.map(m => \`\${m.role}: \${m.content}\`).join("\n");
  const germanyPrompt = \`
\${systemPrompt}

Conversation so far:
\${promptMessages}

Additional info:
\${googleSummary}

Answer in \${language}. Provide exactly 2 short suggestions for next questions.
\`.trim();
  return await generateReply(germanyPrompt);
}

async function generatePolitenessReply(conversation, language) {
  const promptMessages = conversation.messages.map(m => \`\${m.role}: \${m.content}\`).join("\n");
  const politenessPrompt = \`
\${systemPrompt}
Conversation:
\${promptMessages}
Respond politely in \${language}.
\`.trim();
  return await generateReply(politenessPrompt);
}

async function generateOffTopicReply(conversation, language) {
  const promptMessages = conversation.messages.map(m => \`\${m.role}: \${m.content}\`).join("\n");
  const offTopicPrompt = \`
\${systemPrompt}
Conversation:
\${promptMessages}
Inform politely in \${language} that you're only able to help about Germany or migration.
\`.trim();
  return await generateReply(offTopicPrompt);
}

module.exports = {
  generateGermanyReply,
  generatePolitenessReply,
  generateOffTopicReply,
};
"@;

# --- services/googleSearchService.js ---
Set-Content -Path "services/googleSearchService.js" -Value @"
const axios = require('axios');

async function getGoogleSummary(query) {
  try {
    const res = await axios.get('https://customsearch.googleapis.com/customsearch/v1', {
      params: {
        key: process.env.GOOGLE_CSE_KEY,
        cx: process.env.GOOGLE_CSE_ID,
        q: query
      }
    });
    const items = res.data.items ? res.data.items.slice(0,3) : [];
    return items.map(item => item.snippet).join("\n");
  } catch (err) {
    console.error("Google Search error:", err);
    return "I couldn't find extra info right now.";
  }
}

module.exports = { getGoogleSummary };
"@;

# --- services/classificationService.js ---
Set-Content -Path "services/classificationService.js" -Value @"
const { classifyQueryWithDeepSeek } = require('../classification');

async function classifyMessage(conversationMessages, currentUserMessage) {
  return await classifyQueryWithDeepSeek(null, conversationMessages, currentUserMessage);
}

module.exports = { classifyMessage };
"@;

# --- utils/helpers.js ---
Set-Content -Path "utils/helpers.js" -Value @"
function stripFormatting(text) {
  return text.replace(/\*\*|- |# /g, "").trim();
}

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
  if (!Array.isArray(parsed.suggestions)) {
    parsed.suggestions = [];
  }
  return parsed;
}

module.exports = { stripFormatting, parseAiResponse };
"@;

# --- config/default.js ---
Set-Content -Path "config/default.js" -Value @"
require('dotenv').config();

module.exports = {
  mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/migrantHilfe',
  port: process.env.PORT || 3000,
  systemPrompt: process.env.SYSTEM_PROMPT || \`
You are Sasha, a friendly migration assistant who explains things in simple language (easy enough for a 13-year-old, but still accurate).
Rules:
1. Your answers should be short and clear.
2. No direct links. Summarize any info you find.
3. If you have extra facts from web research, put them in your answer.
4. Provide exactly 2 short suggestions that are relevant next questions the user might ask.
5. Return valid JSON:
   {
     "reply": "...",
     "suggestions": ["...", "..."]
   }
\`.trim()
};
"@;

Write-Host "🎉 All project files have been populated with the correct code!"
