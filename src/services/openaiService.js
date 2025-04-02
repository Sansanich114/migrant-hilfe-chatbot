import dotenv from 'dotenv';
dotenv.config();

import { OpenAI } from 'openai';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { parseAiResponse } from '../../server/utils/helpers.js';
import { loadPropertiesData } from '../../server/utils/staticData.js';

const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const hfApiKey = process.env.HF_API_KEY;

if (!openRouterApiKey) {
  throw new Error('Missing environment variable: OPENROUTER_API_KEY');
}
if (!hfApiKey) {
  throw new Error('Missing environment variable: HF_API_KEY');
}

const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'X-OpenRouter-Api-Key': openRouterApiKey,
  },
});

const fallbackSystemPrompt = "You are Sasha, a friendly sales agent at Beispiel Immobilien GMBH.";

// --------------------------------------------------------------------
// Read the agencyWithEmbeddings.json file from the scripts folder.
let agencyWithEmbeddings = [];
try {
  const agencyPath = path.join(process.cwd(), 'scripts', 'agency', 'agencyWithEmbeddings.json');
  const data = await fs.readFile(agencyPath, 'utf8');
  agencyWithEmbeddings = JSON.parse(data);
} catch (err) {
  console.error("Error reading agencyWithEmbeddings.json:", err);
  agencyWithEmbeddings = [];
}

// Pool token-level embeddings into a single vector.
function poolEmbeddings(tokenEmbeddings) {
  const embeddingDim = tokenEmbeddings[0].length;
  const pooledEmbedding = new Array(embeddingDim).fill(0);
  tokenEmbeddings.forEach(tokenVec => {
    tokenVec.forEach((val, i) => {
      pooledEmbedding[i] += val;
    });
  });
  return pooledEmbedding.map(val => val / tokenEmbeddings.length);
}

// Call the chat API with the provided messages.
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

// Get the query embedding using HuggingFace.
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

// Fallback reply if something goes wrong.
function fallbackReply() {
  return {
    reply: "I'm having trouble accessing our database. Let me connect you with a human agent.",
    suggestions: ["Contact an agent", "Try again later"]
  };
}

// Retrieve agency context using precomputed embeddings.
export async function getAgencyContext(queryText) {
  const queryEmbedding = await getQueryEmbedding(queryText);
  if (!queryEmbedding) {
    return "";
  }

  const MIN_SIMILARITY_THRESHOLD = 0.5;
  const validAgencies = agencyWithEmbeddings.filter(agency =>
    agency.embedding &&
    Array.isArray(agency.embedding) &&
    agency.embedding.length === queryEmbedding.length
  );

  const matches = validAgencies
    .map(agency => ({
      agency,
      score: cosineSimilarity(queryEmbedding, agency.embedding)
    }))
    .filter(match => match.score >= MIN_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const bestMatch = matches[0];

  if (bestMatch) {
    return `Company background: ${bestMatch.agency.name}, established ${bestMatch.agency.founded}. ${bestMatch.agency.whyChooseUs}`;
  }

  return "Beispiel Immobilien GMBH, your trusted real estate partner.";
}

// Generate a conversation summary.
export async function generateConversationSummary(conversation, language) {
  const summaryPrompt = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  summaryPrompt.push({
    role: "system",
    content: `Summarize briefly the conversation in ${language}. Return valid JSON: {"summary": "..."}.`
  });
  try {
    const rawOutput = await callDeepSeekChat(summaryPrompt, 0.5);
    const parsedOutput = parseAiResponse(rawOutput);
    return parsedOutput.summary || "";
  } catch (error) {
    return "";
  }
}

// Generate a salesman mode reply that guides the conversation and extracts valuable info.
export async function generateSalesmanReply(conversation, message, language) {
  const agencyContext = await getAgencyContext(message);
  const conversationSummary = await generateConversationSummary(conversation, language);

  const salesmanSystemPrompt = `
You are Sasha, a friendly sales agent at Beispiel Immobilien GMBH.
Your goal is to assist users with real estate inquiries and naturally guide the conversation to gather valuable information for lead capturing.
When a user asks about properties or expresses interest, ask one follow-up question at a time to collect details such as usage (private or business), location preferences, budget, property type, and personal contact information (name, email, phone) if mentioned.
Extract any valuable information from the user's response.
Keep your tone friendly and natural.
${agencyContext ? agencyContext : ""}
${conversationSummary ? "Summary so far: " + conversationSummary : ""}
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

  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  messagesForChat.push({ role: "system", content: salesmanSystemPrompt });
  messagesForChat.push({ role: "user", content: message });

  try {
    const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
    return parseAiResponse(rawOutput);
  } catch (error) {
    return fallbackReply();
  }
}

// Generate a polite reply.
export async function generatePolitenessReply(conversation, language) {
  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `Please provide a polite response in ${language}. Return valid JSON in the format: {"reply": "...", "suggestions": ["Option 1", "Option 2"]}`
  });
  try {
    const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
    return parseAiResponse(rawOutput);
  } catch (error) {
    return fallbackReply();
  }
}

// Generate an "other" reply to gently steer the conversation back to real estate.
export async function generateOtherReply(conversation, language) {
  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `The conversation should focus on real estate inquiries. Please provide a response that gently steers the conversation back to real estate. Return valid JSON in the format: {"reply": "I'm here to help with real estate inquiries. Let's focus on that.", "suggestions": ["Show properties", "Schedule meeting"]}`
  });
  try {
    const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
    return parseAiResponse(rawOutput);
  } catch (error) {
    return fallbackReply();
  }
}

// Utility: Calculate cosine similarity between two vectors.
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return normA && normB ? dotProduct / (normA * normB) : 0;
}
