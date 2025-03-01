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

app.get("/favicon.ico", (req, res) => res.status(204));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// A helper function to strip away formatting (bold, bullets, headings, etc.)
function stripFormatting(text) {
  return text
    .replace(/\*\*/g, "")  // remove bold markers (**)
    .replace(/^- /gm, "")  // remove bullet markers at line start (- )
    .replace(/^# /gm, "")  // remove heading markers (# )
    .trim();
}

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://openrouter.ai/api/v1"
});

app.post("/chat", async (req, res) => {
  console.log("Received request:", req.body);
  
  if (!req.body || !req.body.message) {
    return res.status(400).json({ error: 'Invalid request. Expected {"message":"Hello"}' });
  }

  const userMessage = req.body.message;

  try {
    const result = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat:free",
      messages: [
        {
          role: "system",
          content: `
"You are DeepSeek, a full-featured assistant for migrants planning to move to Germany. Your role is to guide users through the migration process by asking simple, sequential questions to get a complete picture of each person's situation. This allows you to offer highly personalized recommendations and provide support at every stage of the journey. You do not redirect users to official websites or provide links to government agencies. All necessary information must be given directly here without leaving the platform. Keep answers short, quickly readable, and free of unnecessary details. Cover key aspects of migration such as visas, residence permits, work, education, housing, adaptation, healthcare, integration, and legal questions in a way that is easy for a beginner to understand. Use simple language and clarify details only as needed, based on the user's knowledge level. Present instructions as clear next actions: what to do, where to go, and which documents to prepare. Avoid overwhelming users with too much information at once. If a user asks where they should go next, provide only one place or action they need to take right now. If the next step depends on more details, ask one clarifying question before giving the final answer. When you need more information about the user, ask only one question at a time, phrased simply as if speaking to a fifth grader. If a user's request is unrelated to moving to Germany, respond briefly that you are here to help with migration to Germany. Stay focused on providing relevant, actionable information for newcomers with minimal background knowledge."
You are an assistant providing very concise answers. 
- Respond in no more than 2 short sentences.
- Do not use any bold text, bullet points, or numbered lists.
- Keep your text minimal, with no special formatting.
`
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    // Extract the raw response
    const rawReply = result.choices[0].message.content;
    // Strip away extra formatting
    const finalReply = stripFormatting(rawReply);

    console.log("OpenRouter API Response:", finalReply);
    res.status(200).json({ reply: finalReply });
  } catch (error) {
    console.error("OpenRouter API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Error: Unable to process request." });
  }
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
