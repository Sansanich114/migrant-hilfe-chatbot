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
// Initialize OpenAI with OpenRouter
const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'X-OpenRouter-Api-Key': openRouterApiKey,
  },
});

// --------------------------------------------------------------------
// Fallback system prompt
const fallbackSystemPrompt = "You are Sasha, a friendly sales agent at Beispiel Immobilien GMBH.";

// --------------------------------------------------------------------
// 1) Load the chunked agency data from JSON (generated with our new chunking approach)
let chunkedAgencyData = [];
try {
  const agencyPath = path.join(process.cwd(), 'scripts', 'agency', 'agencyWithEmbeddings.json');
  const data = await fs.readFile(agencyPath, 'utf8');
  chunkedAgencyData = JSON.parse(data); // expected to be { chunks: [ {id, title, text, embedding}, ... ] }
  // If the JSON contains a "chunks" field, use that:
  if (chunkedAgencyData.chunks) {
    chunkedAgencyData = chunkedAgencyData.chunks;
  }
} catch (err) {
  console.error("Error reading agencyWithEmbeddings.json:", err);
  chunkedAgencyData = [];
}

// --------------------------------------------------------------------
// 2) Load the property embeddings
let propertiesWithEmbeddings = [];
try {
  const propertiesPath = path.join(process.cwd(), 'scripts', 'properties', 'propertiesWithEmbeddings.json');
  const pData = await fs.readFile(propertiesPath, 'utf8');
  const parsed = JSON.parse(pData);
  // Expect structure: { "embeddings": [ [...], [...], ... ] }
  propertiesWithEmbeddings = parsed.embeddings;
} catch (err) {
  console.error("Error reading propertiesWithEmbeddings.json:", err);
  propertiesWithEmbeddings = [];
}

// 3) Load the actual property data (to get full metadata for the matched property)
const allProperties = loadPropertiesData();

// --------------------------------------------------------------------
// Utility: Pool token-level embeddings into one vector
function poolEmbeddings(tokenEmbeddings) {
  const embeddingDim = tokenEmbeddings[0].length;
  const pooled = new Array(embeddingDim).fill(0);
  tokenEmbeddings.forEach(tok => {
    tok.forEach((val, i) => {
      pooled[i] += val;
    });
  });
  return pooled.map(v => v / tokenEmbeddings.length);
}

// Utility: Cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return normA && normB ? (dotProduct / (normA * normB)) : 0;
}

// --------------------------------------------------------------------
// Chat API call
async function callDeepSeekChat(messages, temperature = 0.8) {
  // Ensure that there's a system message; if not, insert the fallback prompt.
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
// Get query embedding using HuggingFace E5 model
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
        // Token-level embeddings: pool them
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
// Fallback reply
function fallbackReply() {
  return {
    reply: "I'm having trouble accessing our database. Let me connect you with a human agent.",
    suggestions: ["Contact an agent", "Try again later"]
  };
}

// --------------------------------------------------------------------
// Agency Context: Multi-chunk snippet selection
export async function getAgencySnippet(userMessage) {
  const queryEmbedding = await getQueryEmbedding(userMessage);
  if (!queryEmbedding) return "";

  const SIMILARITY_THRESHOLD = 0.5;
  // For multi-chunk retrieval, you might choose to either select the best chunk
  // or combine several chunks that score above a threshold.
  // Here, we select the best matching chunk for simplicity.
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

  if (bestScore >= SIMILARITY_THRESHOLD && bestChunk) {
    // Return the text of the best matching chunk
    return bestChunk.text;
  }
  // Fallback general snippet if no chunk passes the threshold
  return "Beispiel Immobilien GMBH, your trusted real estate partner. (General company background...)";
}

// --------------------------------------------------------------------
// Property Context: Get the best-fitting property based on captured lead data
export async function getBestProperty(leadData) {
  // Build a composite query from valuable lead information.
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
  const PROPERTY_THRESHOLD = 0.5;
  if (bestScore >= PROPERTY_THRESHOLD && bestIdx >= 0 && bestIdx < allProperties.length) {
    return allProperties[bestIdx];
  }
  return null;
}

// --------------------------------------------------------------------
// Generate conversation summary
export async function generateConversationSummary(conversation, language) {
  const summaryMessages = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  summaryMessages.push({
    role: "system",
    content: `Summarize briefly the conversation in ${language}. Return valid JSON: {"summary": "..."}.`
  });
  try {
    const rawOutput = await callDeepSeekChat(summaryMessages, 0.5);
    const parsedOutput = parseAiResponse(rawOutput);
    return parsedOutput.summary || "";
  } catch (error) {
    console.error("Summary error:", error);
    return "";
  }
}

// --------------------------------------------------------------------
// Generate a salesman reply that integrates agency snippet, conversation summary, and best property if found.
export async function generateSalesmanReply(conversation, message, language, leadData) {
  // Get agency snippet (using multi-chunk approach)
  const agencySnippet = await getAgencySnippet(message);
  // Generate conversation summary
  const convSummary = await generateConversationSummary(conversation, language);

  // Get best property if lead data is provided
  let propertySnippet = "";
  if (leadData) {
    const bestProp = await getBestProperty(leadData);
    if (bestProp) {
      propertySnippet = `
Best Fitting Property:
Title: ${bestProp.title}
Price: ${bestProp.price}
Size: ${bestProp.size}
Rooms: ${bestProp.rooms}
Features: ${bestProp.features.join(", ")}
Address: ${bestProp.address}
...`;
    }
  }

  // Build the system prompt including agency snippet, conversation summary, and property snippet
  const salesmanPrompt = `
You are Sasha, a friendly sales agent at Beispiel Immobilien GMBH.
Your goal is to assist users with real estate inquiries and gather valuable information for lead capturing.
Ask one follow-up question at a time to collect details such as usage (private or business), location, budget, property type, and contact information (name, email, phone) if mentioned.
Extract any valuable information from the user's responses.
Agency Information: ${agencySnippet}
${convSummary ? "Conversation Summary: " + convSummary : ""}
${propertySnippet ? propertySnippet : ""}

Return valid JSON in the following format:
{
  "reply": "Your response text here",
  "extractedInfo": {
    "usage": "...",
    "location": "...",
    "budget": "...",
    "propertyType": "...",
    "contact": {"name": "...", "email": "...", "phone": "..."}
  },
  "suggestions": ["Follow-up option 1", "Follow-up option 2"]
}
  `.trim();

  // Build the final message array for the chat API call
  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({ role: "system", content: salesmanPrompt });
  messagesForChat.push({ role: "user", content: message });

  try {
    const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
    return parseAiResponse(rawOutput);
  } catch (error) {
    console.error("generateSalesmanReply error:", error);
    return fallbackReply();
  }
}

// --------------------------------------------------------------------
// Generate a polite reply
export async function generatePolitenessReply(conversation, language) {
  const msgs = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  msgs.push({
    role: "system",
    content: `Please provide a polite response in ${language}. Return valid JSON in the format: {"reply": "...", "suggestions": ["Option 1", "Option 2"]}`
  });
  try {
    const rawOutput = await callDeepSeekChat(msgs, 0.8);
    return parseAiResponse(rawOutput);
  } catch (err) {
    return fallbackReply();
  }
}

// --------------------------------------------------------------------
// Generate an "other" reply to gently steer the conversation back to real estate.
export async function generateOtherReply(conversation, language) {
  const msgs = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  msgs.push({
    role: "system",
    content: `The conversation should focus on real estate inquiries. Provide a response that gently steers the conversation back to real estate. Return valid JSON in the format: {"reply": "I'm here to help with real estate inquiries. Let's focus on that.", "suggestions": ["Show properties", "Schedule meeting"]}`
  });
  try {
    const rawOutput = await callDeepSeekChat(msgs, 0.8);
    return parseAiResponse(rawOutput);
  } catch (err) {
    return fallbackReply();
  }
}
