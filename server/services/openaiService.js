// server/services/openaiService.js
import { OpenAI } from "openai";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

import { parseAiResponse } from "../utils/helpers.js";
import Property from "../models/Property.js";

// 1) Load environment variables
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const hfApiKey = process.env.HF_API_KEY;

// 2) Ensure both are present
if (!openRouterApiKey) {
  throw new Error("Missing environment variable: OPENROUTER_API_KEY");
}
if (!hfApiKey) {
  throw new Error("Missing environment variable: HF_API_KEY");
}

// 3) Configure the OpenAI wrapper for OpenRouter (chat usage)
const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "X-OpenRouter-Api-Key": openRouterApiKey,
  },
});

// Minimal fallback system prompt for chat
const fallbackSystemPrompt = "You are a helpful real estate assistant.";

/**
 * Helper function to call the DeepSeek Chat model via OpenRouter.
 * We inject a system message if none is present.
 */
async function callDeepSeekChat(messages, temperature = 0.8) {
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

/**
 * 4) Hugging Face-based function to generate embeddings
 *    using the "sentence-transformers/all-MiniLM-L6-v2" model.
 */
export async function getQueryEmbedding(text) {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${hfApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    // The HF Inference API typically returns an array with a single embedding
    // e.g. [[0.123, 0.456, ...]]
    const [embedding] = response.data;
    return embedding;
  } catch (error) {
    console.error("Error computing query embedding:", error.response?.data || error.message);
    return null;
  }
}

/**
 * Helper: Compute cosine similarity between two vectors of the same length.
 */
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}

/**
 * Generate a real estate-related reply:
 * 1) Get the embedding for the user message from Hugging Face
 * 2) Compare with your precomputed property embeddings
 * 3) Provide best match property snippet
 * 4) Call the chat model to build a final answer
 */
export async function generateRealEstateReply(conversation, message, language) {
  // 1) Get user query embedding
  const queryEmbedding = await getQueryEmbedding(message);
  let bestProperty = null;
  let bestScore = -Infinity;

  // 2) Retrieve all properties from MongoDB
  const properties = await Property.find({});

  // 3) Compare query embedding to each property’s stored embedding
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

  let propertySnippet;
  if (bestProperty) {
    propertySnippet = `Best match: ${bestProperty.title} - ${bestProperty.price} located at ${bestProperty.address}.`;
  } else {
    propertySnippet = "No matching property found.";
  }

  // 4) Build prompt for the chat model
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

  // 5) Generate final answer using OpenRouter
  const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
  return parseAiResponse(rawOutput);
}

/**
 * Generate a short, polite greeting reply + real estate suggestions.
 */
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

/**
 * Generate a short "off-topic" reply that gently redirects user back to real estate.
 */
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

/**
 * Generate a short introduction reply in the user's preferred language.
 */
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

/**
 * Generate a short summary of the conversation so far.
 */
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
