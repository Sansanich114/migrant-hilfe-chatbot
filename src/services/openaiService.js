import dotenv from 'dotenv';
dotenv.config();

import { OpenAI } from 'openai';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { parseAiResponse } from '../../server/utils/helpers.js';
import { loadPropertiesData } from '../../server/utils/staticData.js';

// --------------------------------------------------------------------
// Environment checks
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const hfApiKey = process.env.HF_API_KEY;

if (!openRouterApiKey) {
  throw new Error('Missing environment variable: OPENROUTER_API_KEY');
}
if (!hfApiKey) {
  throw new Error('Missing environment variable: HF_API_KEY');
}

// --------------------------------------------------------------------
// Initialize the Chat API with OpenRouter+OpenAI
const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'X-OpenRouter-Api-Key': openRouterApiKey,
  },
});

const fallbackSystemPrompt = "You are Sasha, a friendly sales agent at Beispiel Immobilien GMBH. Respond only with plain JSON without any markdown formatting.";

// --------------------------------------------------------------------
// Load embedded data
let chunkedAgencyData = [];
try {
  const agencyPath = path.join(process.cwd(), 'scripts', 'agency', 'agencyWithEmbeddings.json');
  const data = await fs.readFile(agencyPath, 'utf8');
  chunkedAgencyData = JSON.parse(data);
} catch (err) {
  console.error("Error reading agencyWithEmbeddings.json:", err);
  chunkedAgencyData = [];
}

let propertiesWithEmbeddings = [];
try {
  const propertiesPath = path.join(process.cwd(), 'scripts', 'properties', 'propertiesWithEmbeddings.json');
  const pData = await fs.readFile(propertiesPath, 'utf8');
  const parsed = JSON.parse(pData);
  propertiesWithEmbeddings = parsed.embeddings;
} catch (err) {
  console.error("Error reading propertiesWithEmbeddings.json:", err);
  propertiesWithEmbeddings = [];
}

const allProperties = loadPropertiesData();

// --------------------------------------------------------------------
// Utils
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return normA && normB ? dotProduct / (normA * normB) : 0;
}

function poolEmbeddings(tokenEmbeddings) {
  const embeddingDim = tokenEmbeddings[0].length;
  const pooled = new Array(embeddingDim).fill(0);
  tokenEmbeddings.forEach(tokenVec => {
    tokenVec.forEach((val, i) => {
      pooled[i] += val;
    });
  });
  return pooled.map(v => v / tokenEmbeddings.length);
}

export async function callDeepSeekChat(messages, temperature = 0.8) {
  const hasSystem = messages.some(m => m.role === 'system');
  if (!hasSystem) {
    messages.unshift({ role: 'system', content: fallbackSystemPrompt });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat:free',
      messages,
      temperature,
      max_tokens: 500,
    });

    if (!response?.choices?.[0]?.message?.content) {
      console.error("❌ DeepSeek returned no message. Full response:", response);
      return "I'm sorry, I couldn’t generate a response right now.";
    }

    return response.choices[0].message.content;
  } catch (err) {
    console.error("❌ DeepSeek API error:", err.message);
    return "I'm sorry, something went wrong while contacting the assistant.";
  }
}

export async function getQueryEmbedding(text) {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/intfloat/multilingual-e5-large-instruct",
      {
        inputs: "query: " + text,
        options: { wait_for_model: true }
      },
      {
        headers: {
          Authorization: "Bearer " + hfApiKey,
          "Content-Type": "application/json"
        }
      }
    );

    if (Array.isArray(response.data)) {
      if (Array.isArray(response.data[0]) && !Array.isArray(response.data[0][0])) {
        return response.data[0];
      } else if (Array.isArray(response.data[0][0])) {
        return poolEmbeddings(response.data);
      }
    }
    return null;
  } catch (error) {
    console.error("Error computing query embedding:", error.response?.data || error.message);
    return null;
  }
}

function fallbackReply() {
  return {
    reply: "I'm having trouble accessing our database. Let me connect you with a human agent.",
    suggestions: ["Contact an agent", "Try again later"]
  };
}

// --------------------------------------------------------------------
// Intent extraction
export async function extractIntent(message, summary) {
  const messages = [
    {
      role: "system",
      content: `You are a smart intent extractor. Analyze the user's message and the conversation summary. Return what we already know, what’s missing, and the tone.

Format:
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
    { role: "user", content: `Message: "${message}"\nSummary: "${summary}"` }
  ];

  try {
    const raw = await callDeepSeekChat(messages, 0.2);
    return parseAiResponse(raw);
  } catch (err) {
    console.error("Intent extraction error:", err);
    return null;
  }
}

// --------------------------------------------------------------------
// Snippet retrieval
export async function getAgencySnippetFromIntent(intent) {
  const { location, usage } = intent?.extractedInfo || {};
  let queryText = `real estate agency for ${usage || "buyers"} in ${location || "Berlin"}`;
  const queryEmbedding = await getQueryEmbedding(queryText);

  if (!queryEmbedding) {
    console.warn("⚠️ Query embedding failed. Using fallback snippet.");
    return "Beispiel Immobilien GMBH is a trusted Berlin-based real estate agency serving families, expats, and investors with personalized service.";
  }

  const THRESH = 0.5;
  let bestScore = -1;
  let bestChunk = null;

  for (const chunk of chunkedAgencyData) {
    if (!chunk.embedding || chunk.embedding.length !== queryEmbedding.length) continue;
    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    if (score > bestScore) {
      bestScore = score;
      bestChunk = chunk;
    }
  }

  return (bestScore >= THRESH && bestChunk)
    ? bestChunk.text
    : "Beispiel Immobilien GMBH is your Berlin-based partner for buying and selling homes.";
}

// --------------------------------------------------------------------
// Best-matching property
export async function getBestProperty(leadData) {
  const { usage, location, budget, propertyType } = leadData || {};
  const queryText = `usage: ${usage}, location: ${location}, budget: ${budget}, propertyType: ${propertyType}`;
  const queryEmbedding = await getQueryEmbedding(queryText);
  if (!queryEmbedding) return null;

  let bestScore = -1;
  let bestIdx = -1;

  for (let i = 0; i < propertiesWithEmbeddings.length; i++) {
    const emb = propertiesWithEmbeddings[i];
    if (Array.isArray(emb) && emb.length === queryEmbedding.length) {
      const score = cosineSimilarity(queryEmbedding, emb);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
  }

  const THRESH = 0.5;
  return (bestScore >= THRESH && bestIdx >= 0 && bestIdx < allProperties.length)
    ? allProperties[bestIdx]
    : null;
}

// --------------------------------------------------------------------
// Summary
export async function generateConversationSummary(conversation, language) {
  const messages4 = conversation.messages.map(m => ({ role: m.role, content: m.content }));
  messages4.push({
    role: "system",
    content: `Summarize briefly the conversation in ${language}. Return valid JSON: {"summary": "..."}. Please output plain JSON without markdown formatting.`
  });

  try {
    const rawOutput = await callDeepSeekChat(messages4, 0.5);
    const parsed = parseAiResponse(rawOutput);
    return parsed.summary || "";
  } catch (err) {
    console.error("Summary error:", err);
    return "";
  }
}

// --------------------------------------------------------------------
// Main sales reply logic
export async function generateSalesmanReply(conversation, message, language) {
  console.log("🔹 [START] generateSalesmanReply");

  const summary = await generateConversationSummary(conversation, language);
  console.log("📝 Summary:", summary);

  const intent = await extractIntent(message, summary);
  console.log("🧠 Extracted Intent:", intent);

  const extracted = intent?.extractedInfo || {};
  console.log("📦 Extracted Info:", extracted);

  const agencySnippet = await getAgencySnippetFromIntent(intent);
  console.log("🏢 Agency Snippet:", agencySnippet);

  let propertySnippet = "";
  const hasEnoughInfo = extracted.usage && extracted.location && extracted.budget && extracted.propertyType;
  console.log("✅ Has Enough Info for Property?", hasEnoughInfo);

  if (hasEnoughInfo) {
    const prop = await getBestProperty(extracted);
    if (prop) {
      propertySnippet = `Best-Fitting Property:\nTitle: ${prop.title}\nPrice: ${prop.price}\nSize: ${prop.size}\nRooms: ${prop.rooms}\nFeatures: ${prop.features.join(", ")}\nAddress: ${prop.address}`;
    } else {
      console.log("⚠️ No property matched.");
    }
  }

  const salesmanPrompt = `
You are Sasha, a friendly and professional real estate agent at Beispiel Immobilien GMBH. Speak like a real human.

Summary: ${summary}

Known info:
- Usage: ${extracted.usage || "unknown"}
- Location: ${extracted.location || "unknown"}
- Property Type: ${extracted.propertyType || "unknown"}
- Budget: ${extracted.budget || "unknown"}

Missing info: ${intent?.missingInfo?.join(", ") || "none"}

Agency snippet: ${agencySnippet}
${propertySnippet ? "\n" + propertySnippet : ""}

Instructions:
- Be helpful and sound natural
- Mention the agency as part of your identity
- Ask for one missing field at a time
- Only suggest property if enough info is collected
- Avoid robotic tone

Return JSON like:
{
  "reply": "...",
  "extractedInfo": { ... },
  "suggestions": ["...", "..."]
}
`.trim();

  const finalMsgArr = conversation.messages.map(m => ({ role: m.role, content: m.content }));
  finalMsgArr.push({ role: "system", content: salesmanPrompt });
  finalMsgArr.push({ role: "user", content: message });

  try {
    const rawOutput = await callDeepSeekChat(finalMsgArr, 0.8);
    console.log("🧠 Raw Output:", rawOutput);
    const parsed = parseAiResponse(rawOutput);
    console.log("✅ Parsed Response:", parsed);
    return parsed;
  } catch (err) {
    console.error("❌ generateSalesmanReply error:", err);
    return fallbackReply();
  }
}

// --------------------------------------------------------------------
// Other fallback paths
export async function generatePolitenessReply(conversation, language) {
  const msgs = conversation.messages.map(m => ({ role: m.role, content: m.content }));
  msgs.push({
    role: "system",
    content: `Please provide a polite response in ${language}. Return plain JSON in the format: {"reply": "...", "suggestions": ["Option 1", "Option 2"]}.`
  });

  try {
    const raw = await callDeepSeekChat(msgs, 0.8);
    return parseAiResponse(raw);
  } catch (err) {
    return fallbackReply();
  }
}

export async function generateOtherReply(conversation, language) {
  const msgs = conversation.messages.map(m => ({ role: m.role, content: m.content }));
  msgs.push({
    role: "system",
    content: `The conversation should focus on real estate inquiries. Provide a response that gently steers the conversation back to real estate. Return plain JSON in the format: {"reply": "I'm here to help with real estate inquiries. Let's focus on that.", "suggestions": ["Show properties", "Schedule meeting"]}.`
  });

  try {
    const raw = await callDeepSeekChat(msgs, 0.8);
    return parseAiResponse(raw);
  } catch (err) {
    return fallbackReply();
  }
}
