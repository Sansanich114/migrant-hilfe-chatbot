import dotenv from 'dotenv';
dotenv.config();

import { OpenAI } from 'openai';
import axios from 'axios';
import { parseAiResponse } from '../utils/helpers.js';
import { loadPropertiesData } from '../utils/staticData.js';  // Use static properties data

// 1) Load environment variables
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const hfApiKey = process.env.HF_API_KEY;

if (!openRouterApiKey) {
  throw new Error('Missing environment variable: OPENROUTER_API_KEY');
}
if (!hfApiKey) {
  throw new Error('Missing environment variable: HF_API_KEY');
}

// 2) Configure the OpenAI wrapper for OpenRouter (chat usage)
const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'X-OpenRouter-Api-Key': openRouterApiKey,
  },
});

// Minimal fallback system prompt including agency identity
const fallbackSystemPrompt = "You are Sasha, a friendly sales agent at Beispiel Immobilien GMBH.";

/**
 * Helper function to call the DeepSeek Chat model via OpenRouter.
 * Injects the system message if not already present.
 */
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

/**
 * Generate an embedding using the Hugging Face "intfloat/multilingual-e5-large-instruct" model.
 */
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
    const data = response.data;
    console.log("Raw data from HF:", data);
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error("No embeddings returned:", data);
      return null;
    }
    if (Array.isArray(data[0])) {
      const tokenEmbeddings = data;
      const embeddingDim = tokenEmbeddings[0].length;
      const pooledEmbedding = new Array(embeddingDim).fill(0);
      tokenEmbeddings.forEach(tokenVec => {
        if (Array.isArray(tokenVec)) {
          tokenVec.forEach((val, i) => {
            pooledEmbedding[i] += val;
          });
        }
      });
      for (let i = 0; i < embeddingDim; i++) {
        pooledEmbedding[i] /= tokenEmbeddings.length;
      }
      return pooledEmbedding;
    } else {
      return data;
    }
  } catch (error) {
    console.error("Error computing query embedding:", error.response?.data || error.message);
    return null;
  }
}

/**
 * Generate a qualified reply using static property data.
 */
export async function generateQualifiedReply(conversation, message, language) {
  const queryEmbedding = await getQueryEmbedding(message);
  let bestProperty = null;
  let bestScore = -Infinity;
  const properties = loadPropertiesData();
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
    propertySnippet = `Our best match is: ${bestProperty.title}, priced at ${bestProperty.price}, located at ${bestProperty.address}.`;
  } else {
    propertySnippet = "We couldn't find a property that matches your criteria.";
  }
  
  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `Based on your preferences, ${propertySnippet} Would you like to schedule a meeting with our agent?`
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
 * Generate an exploratory reply.
 */
export async function generateExploratoryReply(conversation, message, language) {
  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: "I understand you're exploring real estate options. Could you please tell me more about your preferred location, budget, or property type?"
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
 * Generate a polite greeting reply.
 */
export async function generatePolitenessReply(conversation, language) {
  const messagesForChat = conversation.messages.map(m => ({
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
 * Generate an off-topic reply.
 */
export async function generateOffTopicReply(conversation, language) {
  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `
User's message is off-topic. Please guide the conversation back to discussing your real estate needs.
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
 * Generate an introduction reply.
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
Hello, I'm Sasha, your friendly real estate assistant at Beispiel Immobilien GMBH.
Before we begin, could you please tell me your name? If you’re a returning user, I’d love to greet you by name.
Return valid JSON of the form:
{
  "reply": "...",
  "suggestions": ["My name is [Name]", "Continue without name"]
}
      `.trim(),
    },
  ];
  const rawOutput = await callDeepSeekChat(messagesForChat, 0.7);
  return parseAiResponse(rawOutput);
}

/**
 * Generate a conversation summary.
 */
export async function generateConversationSummary(conversation, language) {
  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `Please provide a short summary in ${language} of the conversation so far, focusing on property interests, location, and budget.`
  });
  try {
    const rawOutput = await callDeepSeekChat(messagesForChat, 0.5);
    return rawOutput.trim();
  } catch (err) {
    console.error("Error generating conversation summary:", err);
    return "";
  }
}

/**
 * Helper: cosine similarity between two vectors.
 */
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}
