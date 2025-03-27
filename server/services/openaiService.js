// redemo/server/services/openaiService.js
import { OpenAI } from "openai";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();
import { parseAiResponse } from "../utils/helpers.js";
import Property from "../models/Property.js";

// Use the OpenRouter API key for both chat and embeddings.
const apiKey = process.env.OPENROUTER_API_KEY || "DUMMY_PLACEHOLDER";
if (!process.env.OPENROUTER_API_KEY) {
  console.warn("Warning: OPENROUTER_API_KEY environment variable is not set. Using a dummy placeholder.");
}

const openai = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "X-OpenRouter-Api-Key": apiKey,
  },
});

// Minimal fallback system prompt.
const fallbackSystemPrompt = "You are a helpful real estate assistant.";

// Generic function to call the chat model.
async function callDeepSeekChat(messages, temperature = 0.8) {
  // Ensure at least one system message is present.
  const hasSystem = messages.some((m) => m.role === "system");
  if (!hasSystem) {
    messages.unshift({
      role: "system",
      content: fallbackSystemPrompt,
    });
  }
  const response = await openai.chat.completions.create({
    model: "deepseek/deepseek-chat:free",
    messages,
    temperature,
    max_tokens: 500,
  });
  return response.choices[0].message.content;
}

// UPDATED: Use OpenRouter's API key and endpoint for embeddings
export async function getQueryEmbedding(text) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/embeddings",
      {
        model: "text-embedding-ada-002",
        input: text,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
      }
    );
    return response.data.data[0].embedding;
  } catch (error) {
    console.error("Error computing query embedding:", error.response?.data || error.message);
    return null;
  }
}

// Helper: Compute cosine similarity between two vectors.
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}

// --- REAL ESTATE REPLY using precomputed embeddings ---
export async function generateRealEstateReply(conversation, message, language) {
  // Get the embedding for the user's message using our new function.
  const queryEmbedding = await getQueryEmbedding(message);
  let bestProperty = null;
  let bestScore = -Infinity;

  // Retrieve all properties from MongoDB.
  const properties = await Property.find({});
  if (queryEmbedding) {
    for (const property of properties) {
      if (property.embedding && Array.isArray(property.embedding)) {
        const score = cosineSimilarity(queryEmbedding, property.embedding);
        if (score > bestScore) {
          bestScore = score;
          bestProperty = property;
        }
      }
    }
  }

  let propertySnippet = "";
  if (bestProperty) {
    propertySnippet = `Best match: ${bestProperty.title} - ${bestProperty.price} located at ${bestProperty.address}.`;
  } else {
    propertySnippet = "No matching property found.";
  }

  // Build messages for the chat model prompt.
  const messagesForChat = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `Based on the query, the most relevant property is: ${propertySnippet}`,
  });
  messagesForChat.push({
    role: "system",
    content: `
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
    `.trim(),
  });

  const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
  return parseAiResponse(rawOutput);
}

export async function generatePolitenessReply(conversation, language) {
  const messagesForChat = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `
The user is greeting or being polite. Respond briefly and politely, then offer 1 or 2 short suggestions about real estate, in valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
    `.trim(),
  });
  const rawOutput = await callDeepSeekChat(messagesForChat, 0.7);
  return parseAiResponse(rawOutput);
}

export async function generateOffTopicReply(conversation, language) {
  const messagesForChat = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `
User's message is off-topic. Politely guide them back to real estate topics. Return valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
    `.trim(),
  });
  const rawOutput = await callDeepSeekChat(messagesForChat, 0.7);
  return parseAiResponse(rawOutput);
}

export async function generateIntroReply(language) {
  const messagesForChat = [
    {
      role: "system",
      content: fallbackSystemPrompt,
    },
    {
      role: "system",
      content: `
Respond in ${language} with a short introduction about real estate assistance.
Offer 1 or 2 suggestions for what they can ask next, in valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
      `.trim(),
    },
  ];
  const rawOutput = await callDeepSeekChat(messagesForChat, 0.7);
  return parseAiResponse(rawOutput);
}

export async function generateConversationSummary(conversation, language) {
  const messagesForChat = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `
Please provide a short summary in ${language} of the conversation so far,
focusing on property interests, location, and budget.
    `.trim(),
  });
  try {
    const rawOutput = await callDeepSeekChat(messagesForChat, 0.5);
    return rawOutput.trim();
  } catch (err) {
    console.error("Error generating conversation summary:", err);
    return "";
  }
}
