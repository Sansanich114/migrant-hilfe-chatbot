import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();
import { parseAiResponse } from "../utils/helpers.js";
import Property from "../models/Property.js";

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

// Minimal fallback if no system message is present
const fallbackSystemPrompt = "You are a helpful real estate assistant.";

/**
 * A generic function to call the chat model.
 * Ensures we have at least one system message in the chain.
 */
async function callDeepSeekChat(messages, temperature = 0.8) {
  // If no system message is present, insert a fallback
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
 * Compute the cosine similarity between two vectors.
 */
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}

/**
 * Get an embedding for a given text using the OpenRouter API.
 */
async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    // Adjust path according to response structure
    return response.data.data[0].embedding;
  } catch (error) {
    console.error("Embedding error:", error);
    return null;
  }
}

/**
 * Generate a real estate related reply using the conversation so far.
 * Uses semantic search to find the best matching property and injects that data.
 */
export async function generateRealEstateReply(conversation, message, language) {
  // Compute an embedding for the user's query
  const queryEmbedding = await getEmbedding(message);
  let bestProperty = null;
  let bestScore = -Infinity;

  // Retrieve all properties (in production, consider using a pre-filter)
  const properties = await Property.find({});
  if (queryEmbedding) {
    for (const property of properties) {
      // Assume each property document has a precomputed 'embedding' field (an array of numbers)
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

  // Build the messages for the language model prompt.
  // The conversation.messages already include all prior context, including any web search context.
  const messages = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Inject the property snippet into the context for semantic grounding
  messages.push({
    role: "system",
    content: `Based on the query, the most relevant property is: ${propertySnippet}`,
  });

  // Append the system instruction to return valid JSON
  messages.push({
    role: "system",
    content: `
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
    `.trim(),
  });

  const rawOutput = await callDeepSeekChat(messages, 0.8);
  return parseAiResponse(rawOutput);
}

/**
 * Generate a reply for polite/greeting messages.
 */
export async function generatePolitenessReply(conversation, language) {
  const messages = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messages.push({
    role: "system",
    content: `
The user is greeting or being polite. Respond briefly and politely, then offer 1 or 2 short suggestions about real estate, in valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
    `.trim(),
  });

  const rawOutput = await callDeepSeekChat(messages, 0.7);
  return parseAiResponse(rawOutput);
}

/**
 * Generate a reply for off-topic queries.
 */
export async function generateOffTopicReply(conversation, language) {
  const messages = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messages.push({
    role: "system",
    content: `
User's message is off-topic. Politely guide them back to real estate topics. Return valid JSON:
{
  "reply": "...",
  "suggestions": ["...", "..."]
}
    `.trim(),
  });

  const rawOutput = await callDeepSeekChat(messages, 0.7);
  return parseAiResponse(rawOutput);
}

/**
 * Optional function for an AI-based introduction.
 */
export async function generateIntroReply(language) {
  const messages = [
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

  const rawOutput = await callDeepSeekChat(messages, 0.7);
  return parseAiResponse(rawOutput);
}

/**
 * Generate a short summary of the conversation so far.
 */
export async function generateConversationSummary(conversation, language) {
  const messages = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messages.push({
    role: "system",
    content: `
Please provide a short summary in ${language} of the conversation so far,
focusing on property interests, location, and budget.
    `.trim(),
  });

  try {
    const rawOutput = await callDeepSeekChat(messages, 0.5);
    return rawOutput.trim();
  } catch (err) {
    console.error("Error generating conversation summary:", err);
    return "";
  }
}
