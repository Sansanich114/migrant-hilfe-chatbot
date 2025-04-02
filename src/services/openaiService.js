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

// Fallback system prompt (instructing plain JSON without markdown)
const fallbackSystemPrompt = "You are Sasha, a friendly sales agent at Beispiel Immobilien GMBH. Respond only with plain JSON without any markdown formatting.";

// --------------------------------------------------------------------
// 1) Load chunked agency data from JSON (pre-calculated embeddings with text chunks)
let chunkedAgencyData = [];
try {
  const agencyPath = path.join(process.cwd(), 'scripts', 'agency', 'agencyWithEmbeddings.json');
  const data = await fs.readFile(agencyPath, 'utf8');
  chunkedAgencyData = JSON.parse(data);
} catch (err) {
  console.error("Error reading agencyWithEmbeddings.json:", err);
  chunkedAgencyData = [];
}

// 2) Load the property embeddings from JSON
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

// 3) Load the actual property data to align with the embeddings
const allProperties = loadPropertiesData();

// --------------------------------------------------------------------
// Utility: Cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return normA && normB ? dotProduct / (normA * normB) : 0;
}

// Utility: Pool token-level embeddings into one vector
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

// --------------------------------------------------------------------
// Call the chat API with the provided messages
async function callDeepSeekChat(messages, temperature = 0.8) {
  const hasSystem = messages.some(m => m.role === 'system');
  if (!hasSystem) {
    messages.unshift({
      role: 'system',
      content: fallbackSystemPrompt,
    });
  }
  const response = await openai.chat.completions.create({
    model: 'deepseek/deepseek-chat:free',
    messages,
    temperature,
    max_tokens: 500,
  });
  return response.choices[0].message.content;
}

// --------------------------------------------------------------------
// Get the query embedding using HuggingFace's E5 model
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
        },
      }
    );

    if (Array.isArray(response.data)) {
      if (Array.isArray(response.data[0]) && !Array.isArray(response.data[0][0])) {
        // Single embedding vector
        return response.data[0];
      } else if (Array.isArray(response.data[0][0])) {
        // Token-level embeddings => pool them
        return poolEmbeddings(response.data);
      }
    }
    return null;
  } catch (error) {
    console.error("Error computing query embedding:", error.response?.data || error.message);
    return null;
  }
}

// --------------------------------------------------------------------
// Fallback reply in case of errors
function fallbackReply() {
  return {
    reply: "I'm having trouble accessing our database. Let me connect you with a human agent.",
    suggestions: ["Contact an agent", "Try again later"]
  };
}

// --------------------------------------------------------------------
// Get agency snippet using multi-chunk approach
export async function getAgencySnippet(userMessage) {
  const queryEmbedding = await getQueryEmbedding(userMessage);
  if (!queryEmbedding) return "";

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

  if (bestScore >= THRESH && bestChunk) {
    return bestChunk.text;
  }
  return "Beispiel Immobilien GMBH, your trusted real estate partner. (General snippet...)";
}

// --------------------------------------------------------------------
// Retrieve the best-fitting property from the lead data
export async function getBestProperty(leadData) {
  const usage = leadData.usage || "";
  const location = leadData.location || "";
  const budget = leadData.budget || "";
  const propertyType = leadData.propertyType || "";
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
  if (bestScore >= THRESH && bestIdx >= 0 && bestIdx < allProperties.length) {
    return allProperties[bestIdx];
  }
  return null;
}

// --------------------------------------------------------------------
// Generate conversation summary
export async function generateConversationSummary(conversation, language) {
  const messages4 = conversation.messages.map(m => ({
    role: m.role,
    content: m.content
  }));
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
// Generate a "salesman" mode reply
export async function generateSalesmanReply(conversation, message, language, leadData) {
  const agencySnippet = await getAgencySnippet(message);
  const convSummary = await generateConversationSummary(conversation, language);

  let propertySnippet = "";
  if (leadData) {
    const prop = await getBestProperty(leadData);
    if (prop) {
      propertySnippet = `
Best Fitting Property:
Title: ${prop.title}
Price: ${prop.price}
Size: ${prop.size}
Rooms: ${prop.rooms}
Features: ${prop.features.join(", ")}
Address: ${prop.address}
...`;
    }
  }

  const salesmanPrompt = `
You are Sasha, a friendly sales agent at Beispiel Immobilien GMBH.
Your goal is to assist users with real estate inquiries, gather valuable lead information, and, when applicable, propose the best-fitting property.
Always respond in plain JSON without markdown formatting.
Agency snippet: ${agencySnippet}
${convSummary ? "Summary so far: " + convSummary : ""}
${propertySnippet ? "Property snippet:\n" + propertySnippet : ""}

Return valid JSON in the following format:
{
  "reply": "Your response here",
  "extractedInfo": {
    "usage": "...",
    "location": "...",
    "budget": "...",
    "propertyType": "...",
    "contact": {"name": "", "email": "", "phone": ""}
  },
  "suggestions": ["Follow-up option 1", "Follow-up option 2"]
}
  `.trim();

  const finalMsgArr = conversation.messages.map(m => ({ role: m.role, content: m.content }));
  finalMsgArr.push({ role: "system", content: salesmanPrompt });
  finalMsgArr.push({ role: "user", content: message });

  try {
    const rawOutput = await callDeepSeekChat(finalMsgArr, 0.8);
    return parseAiResponse(rawOutput);
  } catch (err) {
    console.error("generateSalesmanReply error:", err);
    return fallbackReply();
  }
}

// --------------------------------------------------------------------
// Generate a polite reply
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

// --------------------------------------------------------------------
// Generate an "other" reply to steer conversation back to real estate
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
