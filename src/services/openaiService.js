import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { OpenAI } from 'openai';
import { loadPropertiesData } from '../../server/utils/staticData.js';
import { parseAiResponse } from '../../server/utils/helpers.js';

dotenv.config();

const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const hfApiKey = process.env.HF_API_KEY;

if (!openRouterApiKey) throw new Error("Missing OPENROUTER_API_KEY");
if (!hfApiKey) throw new Error("Missing HF_API_KEY");

const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: { 'X-OpenRouter-Api-Key': openRouterApiKey },
});

const fallbackSystemPrompt = "You are Sasha, a friendly agent at Beispiel Immobilien GMBH. Always return valid JSON.";
const allProperties = loadPropertiesData();

let agencyChunks = [];
let propertyEmbeddings = [];

try {
  agencyChunks = JSON.parse(await fs.readFile(path.join(process.cwd(), 'scripts/agency/agencyWithEmbeddings.json')));
} catch (e) {
  console.error("⚠️ Could not load agency embeddings:", e.message);
}

try {
  const propData = JSON.parse(await fs.readFile(path.join(process.cwd(), 'scripts/properties/propertiesWithEmbeddings.json')));
  propertyEmbeddings = propData.embeddings;
} catch (e) {
  console.error("⚠️ Could not load property embeddings:", e.message);
}

// --- Utility functions ---
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return normA && normB ? dot / (normA * normB) : 0;
}

function poolEmbeddings(embs) {
  const dim = embs[0].length;
  const pooled = new Array(dim).fill(0);
  embs.forEach(vec => vec.forEach((v, i) => pooled[i] += v));
  return pooled.map(v => v / embs.length);
}

// --- Core services ---

async function callLLM(messages, temperature = 0.8) {
  if (!messages.some(m => m.role === "system")) {
    messages.unshift({ role: "system", content: fallbackSystemPrompt });
  }

  try {
    const res = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat:free",
      messages,
      temperature
    });

    const raw = res.choices?.[0]?.message?.content?.trim();
    if (!raw || typeof raw !== "string") return null;

    console.log("🧠 DeepSeek Raw Output:", raw);
    return raw.startsWith("{") ? raw : null;
  } catch (e) {
    console.error("LLM call failed:", e.message);
    return null;
  }
}

async function getQueryEmbedding(text) {
  try {
    const res = await axios.post(
      "https://api-inference.huggingface.co/models/intfloat/multilingual-e5-large-instruct",
      { inputs: "query: " + text, options: { wait_for_model: true } },
      { headers: { Authorization: `Bearer ${hfApiKey}` } }
    );

    const vector = Array.isArray(res.data?.[0][0])
      ? poolEmbeddings(res.data)
      : res.data?.[0];

    if (Array.isArray(vector) && vector.length === 768) return vector;

    console.warn("❌ Invalid embedding vector structure:", res.data);
    return null;
  } catch (e) {
    console.error("Embedding API error:", e.message);
    return null;
  }
}

// --- Data lookups ---

async function getBestAgencySnippet({ location, usage }) {
  const text = `real estate for ${usage || "residential"} in ${location || "Berlin"}`;
  const emb = await getQueryEmbedding(text);
  if (!emb) return agencyChunks[0]?.text || "Beispiel Immobilien GMBH – your Berlin experts.";

  let best = { score: -1, text: "" };
  for (const chunk of agencyChunks) {
    if (!chunk.embedding || chunk.embedding.length !== emb.length) continue;
    const score = cosineSimilarity(emb, chunk.embedding);
    if (score > best.score) best = { score, text: chunk.text };
  }
  return best.text || agencyChunks[0]?.text;
}

async function getBestProperty(info) {
  const { usage, location, budget, propertyType } = info;
  const query = `usage: ${usage}, location: ${location}, budget: ${budget}, propertyType: ${propertyType}`;
  const emb = await getQueryEmbedding(query);
  if (!emb) return null;

  let bestScore = -1, bestIndex = -1;
  for (let i = 0; i < propertyEmbeddings.length; i++) {
    const vec = propertyEmbeddings[i];
    if (!vec || vec.length !== emb.length) continue;
    const score = cosineSimilarity(emb, vec);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const threshold = 0.5;
  return bestScore >= threshold ? allProperties[bestIndex] : null;
}

// --- Main service ---

export async function generateSalesmanReply(convo, message, language = "en") {
  const summary = await getSummary(convo, language);
  const intent = await extractIntent(message, summary);

  if (!intent) return fallbackJson("Sorry, I couldn't understand your request.");

  const { extractedInfo, missingInfo } = intent;
  const hasEnough = extractedInfo.usage && extractedInfo.location && extractedInfo.budget && extractedInfo.propertyType;

  const agencySnippet = await getBestAgencySnippet(extractedInfo);
  const property = hasEnough ? await getBestProperty(extractedInfo) : null;

  const formatPriming = `
Return a strict JSON like:
{
  "reply": "I'd be happy to help! What's your budget?",
  "extractedInfo": {
    "usage": "residential",
    "location": "Berlin",
    "budget": "",
    "propertyType": "",
    "contact": { "name": "", "email": "", "phone": "" }
  },
  "suggestions": ["View 2-bedroom flats", "Book a meeting"]
}`;

  const prompt = `
You are Sasha, a professional real estate agent at Beispiel Immobilien GMBH.

Summary: ${summary}
User Info:
- Usage: ${extractedInfo.usage || "unknown"}
- Location: ${extractedInfo.location || "unknown"}
- Budget: ${extractedInfo.budget || "unknown"}
- Property Type: ${extractedInfo.propertyType || "unknown"}

Agency: ${agencySnippet}
${property ? `Suggested Property:\n${JSON.stringify(property, null, 2)}` : ""}
Missing Info: ${missingInfo.join(", ") || "none"}

Instructions:
- Sound natural and helpful
- Always reply as Sasha from the agency
- Only ask for one missing field at a time
${formatPriming}
`;

  const finalMessages = [
    { role: "system", content: fallbackSystemPrompt },
    ...convo.messages,
    { role: "system", content: prompt },
    { role: "user", content: message }
  ];

  const raw = await callLLM(finalMessages);
  const parsed = parseAiResponse(raw);

  if (!parsed || !parsed.reply) {
    return fallbackJson("I’m having trouble understanding you—can you rephrase?");
  }

  return {
    reply: parsed.reply,
    extractedInfo,
    suggestions: parsed.suggestions || []
  };
}

// --- Supporting helpers ---

async function getSummary(convo, lang = "English") {
  const msgs = [...convo.messages, {
    role: "system",
    content: `Summarize this chat in ${lang}. Return JSON: {"summary": "..." }`
  }];

  const raw = await callLLM(msgs, 0.5);
  return parseAiResponse(raw)?.summary || "";
}

async function extractIntent(message, summary) {
  const intentPrompt = [
    {
      role: "system",
      content: `
You are a smart intent extractor. Analyze the user message and return full structured JSON.

Return this JSON:
{
  "extractedInfo": {
    "usage": "...",
    "location": "...",
    "budget": "...",
    "propertyType": "...",
    "contact": { "name": "", "email": "", "phone": "" }
  },
  "missingInfo": [...],
  "userMood": "...",
  "urgency": "..."
}`
    },
    {
      role: "user",
      content: `Message: "${message}"\nSummary: "${summary}"`
    }
  ];
  const raw = await callLLM(intentPrompt, 0.2);
  return parseAiResponse(raw);
}

function fallbackJson(text = "Sorry, something went wrong.") {
  return {
    reply: text,
    extractedInfo: {
      usage: "", location: "", budget: "", propertyType: "",
      contact: { name: "", email: "", phone: "" }
    },
    suggestions: ["Contact an agent", "Try again later"]
  };
}
export {
  generateSalesmanReply,
  extractIntent,
  generateConversationSummary as generateConversationSummary
};
