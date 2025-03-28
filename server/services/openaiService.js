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
 * Hugging Face-based function to generate embeddings using the 
 * "sentence-transformers/all-MiniLM-L6-v2" model.
 * Now sends the payload as { inputs: [text] } to ensure correct format.
 */
export async function getQueryEmbedding(text) {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
      { inputs: [text] },
      {
        headers: {
          Authorization: `Bearer ${hfApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    // The HF Inference API returns an array with a single embedding, e.g. [[0.123, 0.456, ...]]
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
 * Generate a qualified real estate reply:
 * - Uses the embedding to find the best matching property,
 * - Provides the best offer,
 * - And suggests moving to scheduling a meeting.
 */
export async function generateQualifiedReply(conversation, message, language) {
  // Get user query embedding
  const queryEmbedding = await getQueryEmbedding(message);
  let bestProperty = null;
  let bestScore = -Infinity;

  // Retrieve all properties from MongoDB
  const properties = await Property.find({});

  // Compare query embedding to each property’s stored embedding
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
    propertySnippet = `Our best match is: ${bestProperty.title} priced at ${bestProperty.price}, located at ${bestProperty.address}.`;
  } else {
    propertySnippet = "We couldn't find a property that matches your criteria.";
  }

  // Build prompt for a qualified reply
  const messagesForChat = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messagesForChat.push({
    role: "system",
    content: `Based on your preferences, ${propertySnippet} Would you like to schedule a meeting with our agent to view this property?`,
  });

  messagesForChat.push({
    role: "system",
    content: `
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["Yes, schedule a meeting", "No, show me more options"]
}
    `.trim(),
  });

  const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
  return parseAiResponse(rawOutput);
}

/**
 * Generate an exploratory real estate reply:
 * - Provides property options,
 * - And asks follow-up questions to clarify user preferences.
 */
export async function generateExploratoryReply(conversation, message, language) {
  // You might still use the embedding here for context,
  // but the prompt will encourage further details.
  const messagesForChat = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messagesForChat.push({
    role: "system",
    content: `I understand you're exploring real estate options. Could you please tell me more about your preferred location, budget, or property type?`,
  });

  messagesForChat.push({
    role: "system",
    content: `
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["Tell me more about your budget", "Specify a preferred location", "I need more guidance"]
}
    `.trim(),
  });

  const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
  return parseAiResponse(rawOutput);
}

/**
 * Generate a short, polite greeting reply with real estate suggestions.
 */
export async function generatePolitenessReply(conversation, language) {
  const messagesForChat = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messagesForChat.push({
    role: "system",
    content: `
The user is greeting or being polite. Respond briefly and politely, then offer a couple of real estate-related suggestions.
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["View properties", "Schedule a consultation"]
}
    `.trim(),
  });

  const rawOutput = await callDeepSeekChat(messagesForChat, 0.7);
  return parseAiResponse(rawOutput);
}

/**
 * Generate a short "off-topic" reply that gently redirects the user back to real estate.
 */
export async function generateOffTopicReply(conversation, language) {
  const messagesForChat = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messagesForChat.push({
    role: "system",
    content: `
User's message is off-topic. Please guide the user back to discussing their real estate needs.
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["View listings", "Contact an agent"]
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
Respond in ${language} with a short introduction about our real estate services.
Offer a couple of suggestions for what the user can ask next, in valid JSON:
{
  "reply": "...",
  "suggestions": ["Browse properties", "Schedule a consultation"]
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
