// src/services/openaiService.js

import dotenv from "dotenv";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { OpenAI } from "openai";
import { loadPropertiesData } from "../../server/utils/staticData.js";
import { parseAiResponse, stripFormatting } from "../../server/utils/helpers.js";

dotenv.config();

const hfApiKey = process.env.HF_API_KEY;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
if (!openRouterApiKey) throw new Error("Missing OPENROUTER_API_KEY");

const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: { "X-OpenRouter-Api-Key": openRouterApiKey },
});

// A minimal system prompt insisting on valid JSON
const fallbackSystemPrompt =
  "You are Sasha, a friendly agent at Beispiel Immobilien GMBH. Always return valid JSON.";

// Load our static property data
const allProperties = loadPropertiesData();

let agencyChunks = [];
let propertyEmbeddings = [];
// Attempt to load precomputed embeddings from disk
try {
  const rawAgency = await fs.readFile(
    path.join(process.cwd(), "scripts/agency/agencyWithEmbeddings.json"),
    "utf-8"
  );
  agencyChunks = JSON.parse(rawAgency);

  const rawProps = await fs.readFile(
    path.join(process.cwd(), "scripts/property/propertyEmbeddings.json"),
    "utf-8"
  );
  propertyEmbeddings = JSON.parse(rawProps);
} catch {
  console.warn(
    "⚠️ Could not load precomputed embeddings; proceeding with empty arrays"
  );
}

// Define a function schema so we can use OpenAI function‑calling
const PROCESS_RESPONSE_FUNCTION = {
  name: "process_response",
  description: "Generate structured agent reply and metadata",
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string" },
      reply: { type: "string" },
      extractedInfo: {
        type: "object",
        properties: {
          usage: { type: "string" },
          location: { type: "string" },
          budget: { type: "string" },
          propertyType: { type: "string" },
          contact: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
            },
            required: ["name", "email", "phone"],
          },
        },
        required: ["usage", "location", "budget", "propertyType", "contact"],
      },
      missingInfo: { type: "array", items: { type: "string" } },
      userMood: { type: "string" },
      urgency: { type: "string" },
      suggestions: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "reply", "extractedInfo", "suggestions"],
  },
};

// Fallback object when all parsing fails
function fallbackJson(text = "⚠️ Fallback reply – no structured data.") {
  return {
    reply: text,
    extractedInfo: {
      usage: "",
      location: "",
      budget: "",
      propertyType: "",
      contact: { name: "", email: "", phone: "" },
    },
    suggestions: [],
  };
}

/**
 * Primary LLM caller. First tries function‑calling,
 * then repair+retry if JSON is bad, then falls back.
 */
async function callLLMWithCombinedOutput(messages, temperature = 0.7) {
  if (!messages.some((m) => m.role === "system")) {
    messages.unshift({ role: "system", content: fallbackSystemPrompt });
  }

  try {
    // First pass: function‑calling
    const res = await openai.chat.completions.create({
      model: "mistralai/mistral-small-3.1-24b-instruct:free",
      messages,
      temperature,
      functions: [PROCESS_RESPONSE_FUNCTION],
      function_call: { name: "process_response" },
    });

    const msg = res.choices?.[0]?.message;
    let parsed = null;

    // If we got a function_call, try JSON.parse directly
    if (msg.function_call?.arguments) {
      try {
        parsed = JSON.parse(msg.function_call.arguments);
      } catch {
        parsed = parseAiResponse(msg.function_call.arguments);
      }
    }

    // On parse failure, retry once with a strict JSON‑only prompt
    if (!parsed) {
      console.warn("🔄 LLM JSON parse failed — retrying with strict JSON-only ask");
      const retry = await openai.chat.completions.create({
        model: "mistralai/mistral-nemo:free",
        messages: [
          ...messages,
          {
            role: "system",
            content:
              "The last response was not valid JSON. Please reply with only the JSON object, no markdown or extra text.",
          },
        ],
        temperature,
      });
      const retryRaw = retry.choices[0].message.content.trim();
      parsed = parseAiResponse(retryRaw);
    }

    if (parsed) return parsed;
    console.error("❌ Both attempts failed, using fallback");
    return fallbackJson();
  } catch (e) {
    console.error("LLM call failed entirely:", e.message);
    return fallbackJson();
  }
}

/** Compute cosine similarity between two vectors */
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return normA && normB ? dot / (normA * normB) : 0;
}

/** Pool a batch of embeddings by averaging */
function poolEmbeddings(embs) {
  const dim = embs[0].length;
  const pooled = new Array(dim).fill(0);
  embs.forEach((vec) => vec.forEach((v, i) => (pooled[i] += v)));
  return pooled.map((v) => v / embs.length);
}

/** Get an embedding for a text query via HF Inference */
async function getQueryEmbedding(text) {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
      { inputs: text },
      { headers: { Authorization: `Bearer ${hfApiKey}` } }
    );
    const vector = response.data;
    // Some endpoints return [ [..], [..], ... ]
    return Array.isArray(vector[0]) ? poolEmbeddings(vector) : vector;
  } catch (e) {
    console.error("❌ HF embedding failed:", e.message);
    return null;
  }
}

/** Pick the best agency snippet based on cosine similarity */
async function getBestAgencySnippet(queryText) {
  const emb = await getQueryEmbedding(queryText);
  if (!emb) return agencyChunks[0]?.text || "";
  let best = { score: -1, text: "" };
  for (const chunk of agencyChunks) {
    if (!chunk.embedding || chunk.embedding.length !== emb.length) continue;
    const score = cosineSimilarity(emb, chunk.embedding);
    if (score > best.score) best = { score, text: chunk.text };
  }
  return best.text || agencyChunks[0]?.text || "";
}

/** Pick the best property based on extractedInfo */
async function getBestProperty(info) {
  const { usage, location, budget, propertyType } = info;
  const query = `usage: ${usage}, location: ${location}, budget: ${budget}, propertyType: ${propertyType}`;
  const emb = await getQueryEmbedding(query);
  if (!emb) return null;

  let bestScore = -1,
    bestIndex = -1;
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
  if (bestScore < threshold) return null;
  return allProperties[bestIndex] || null;
}

/** Generate a full JSON reply for the sales conversation */
async function generateSalesmanReply(convo, message, language = "en") {
  const formatPriming = `
Return JSON like:
{
  "summary": "...",
  "reply": "...",
  "extractedInfo": {
    "usage": "...",
    "location": "...",
    "budget": "...",
    "propertyType": "...",
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
${convo.messages.map((m) => `${m.role}: ${m.content}`).join("\n")}

User: ${message}

${formatPriming}
`;

  const messages = [
    { role: "system", content: fallbackSystemPrompt },
    ...convo.messages,
    { role: "system", content: prompt },
  ];
  const parsed = await callLLMWithCombinedOutput(messages);
  return parsed || fallbackJson();
}

/** Generate a polite follow‑up or apology */
async function generatePolitenessReply(convo, language = "English") {
  const prompt = `
You are Sasha, a friendly agent at Beispiel Immobilien. Continue politely.

Conversation so far:
${convo.messages.map((m) => `${m.role}: ${m.content}`).join("\n")}

Return JSON only: { "reply": "...", "suggestions": ["...", "..."] }`;
  const messages = [
    { role: "system", content: fallbackSystemPrompt },
    ...convo.messages,
    { role: "system", content: prompt },
  ];
  const parsed = await callLLMWithCombinedOutput(messages);
  return parsed || fallbackJson();
}

/** Generate any other free‑form reply */
async function generateOtherReply(convo, promptText) {
  const messages = [
    { role: "system", content: fallbackSystemPrompt },
    ...convo.messages,
    { role: "system", content: promptText },
  ];
  const parsed = await callLLMWithCombinedOutput(messages);
  return parsed || fallbackJson();
}

export {
  generateSalesmanReply,
  generatePolitenessReply,
  generateOtherReply,
};
