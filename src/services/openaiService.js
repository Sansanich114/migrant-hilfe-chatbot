// src/services/openaiService.js
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { OpenAI } from 'openai';
import { loadPropertiesData } from '../../server/utils/staticData.js';
import { parseAiResponse } from '../../server/utils/helpers.js';

dotenv.config();

const hfApiKey = process.env.HF_API_KEY;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
if (!openRouterApiKey) throw new Error("Missing OPENROUTER_API_KEY");

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

function isPoliteMessage(intent) {
  const emptyInfo = !intent.extractedInfo?.usage &&
                    !intent.extractedInfo?.location &&
                    !intent.extractedInfo?.budget &&
                    !intent.extractedInfo?.propertyType;
  return intent.userMood === "casual" && emptyInfo;
}

async function callLLMWithCombinedOutput(messages, temperature = 0.7) {
  if (!messages.some(m => m.role === "system")) {
    messages.unshift({ role: "system", content: fallbackSystemPrompt });
  }

  try {
    const res = await openai.chat.completions.create({
      model: "mistralai/mistral-7b-instruct:free",
      messages,
      temperature
    });

    const raw = res.choices?.[0]?.message?.content?.trim();
    if (!raw || typeof raw !== "string") return null;

    console.log("🧠 Mistral Combined Output:", raw);
    return parseAiResponse(raw);
  } catch (e) {
    console.error("LLM call failed:", e.message);
    return null;
  }
}

async function getQueryEmbedding(text) {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
      { inputs: text },
      { headers: { Authorization: `Bearer ${hfApiKey}` } }
    );

    const vector = response.data;

    if (Array.isArray(vector) && typeof vector[0] === "number") {
      return vector;
    } else if (Array.isArray(vector[0])) {
      return vector[0];
    }

    console.warn("❌ Invalid vector structure:", response.data);
    return null;
  } catch (err) {
    console.error("Embedding API error:", err.message);
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

// --- Unified response generator ---
async function generateSalesmanReply(convo, message, language = "en") {
  const formatPriming = `
Return JSON like:
{
  "summary": "...",
  "reply": "...",
  "extractedInfo": {
    "usage": "...", "location": "...", "budget": "...", "propertyType": "...",
    "contact": { "name": "", "email": "", "phone": "" }
  },
  "missingInfo": ["..."],
  "userMood": "...",
  "urgency": "...",
  "suggestions": ["...", "..."]
}`;

  const prompt = `
You are Sasha, a professional real estate agent at Beispiel Immobilien GMBH.

Conversation so far:
${convo.messages.map(m => `${m.role}: ${m.content}`).join("\n")}
User message: "${message}"

Instructions:
- Understand the full conversation
- Summarize it
- Extract user intent (usage, location, budget, propertyType, contact)
- Identify missing fields
- Guess mood and urgency
- Give a natural reply as Sasha
- Provide 2 helpful suggestions
${formatPriming}
`;

  const finalMessages = [
    { role: "system", content: fallbackSystemPrompt },
    { role: "user", content: prompt }
  ];

  const parsed = await callLLMWithCombinedOutput(finalMessages);

  if (!parsed || !parsed.reply) return fallbackJson("I’m not sure I understood that. Could you rephrase?");

  const { extractedInfo, missingInfo } = parsed;
  const hasEnough = extractedInfo?.usage && extractedInfo?.location && extractedInfo?.budget && extractedInfo?.propertyType;
  const agencySnippet = await getBestAgencySnippet(extractedInfo || {});
  const property = hasEnough ? await getBestProperty(extractedInfo) : null;

  return {
    reply: parsed.reply + (property ? `\n\nHere's a suggestion: ${property.title}` : ""),
    extractedInfo,
    suggestions: parsed.suggestions || []
  };
}

// --- Other replies (no change) ---
async function generatePolitenessReply(convo, language = "English") {
  const agencySnippet = await getBestAgencySnippet({});
  const prompt = `
You are Sasha from Beispiel Immobilien GMBH. A user greeted you politely.

Agency Info: ${agencySnippet}
Reply in ${language} and make the user feel welcome as Sasha.

Return JSON: { "reply": "...", "suggestions": ["...", "..."] }`;

  const messages = [
    { role: "system", content: fallbackSystemPrompt },
    ...convo.messages,
    { role: "system", content: prompt }
  ];

  const raw = await callLLMWithCombinedOutput(messages);
  return raw || fallbackJson();
}

async function generateOtherReply(convo, language = "English") {
  const agencySnippet = await getBestAgencySnippet({});
  const prompt = `
You are Sasha from Beispiel Immobilien GMBH. The user said something off-topic.

Agency Info: ${agencySnippet}
Gently guide them back to real estate topics in ${language}.

Return JSON: { "reply": "...", "suggestions": ["...", "..."] }`;

  const messages = [
    { role: "system", content: fallbackSystemPrompt },
    ...convo.messages,
    { role: "system", content: prompt }
  ];

  const raw = await callLLMWithCombinedOutput(messages);
  return raw || fallbackJson();
}

// --- Fallback ---
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
  generatePolitenessReply,
  generateOtherReply,
  generateSalesmanReply
};