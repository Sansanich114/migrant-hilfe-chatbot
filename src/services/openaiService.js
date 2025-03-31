import dotenv from 'dotenv';
dotenv.config();

import { OpenAI } from 'openai';
import axios from 'axios';
import { parseAiResponse } from '../utils/helpers.js';
import { loadPropertiesData } from '../../server/utils/staticData.js'; // note the adjusted relative path

// Load environment variables
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

// Helper function: poolEmbeddings for token-level responses
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

export async function getQueryEmbedding(text) {
  try {
    console.log("Sending query to HF API:", text);
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

    console.log("Full API response structure:", JSON.stringify(response.data, null, 2));

    if (Array.isArray(response.data)) {
      if (Array.isArray(response.data[0]) && !Array.isArray(response.data[0][0])) {
        console.log("Received single vector embedding");
        return response.data[0];
      } else if (Array.isArray(response.data[0][0])) {
        console.warn("Received token-level embeddings - pooling required");
        return poolEmbeddings(response.data);
      }
    }

    console.error("Unexpected response format:", response.data);
    return null;
  } catch (error) {
    console.error("Error computing query embedding:", error.response?.data || error.message);
    return null;
  }
}

function fallbackReply() {
  return {
    reply: "I'm having trouble accessing our property database. Let me connect you with a human agent.",
    suggestions: ["Contact an agent", "Try again later"]
  };
}

export async function generateQualifiedReply(conversation, message, language) {
  const queryEmbedding = await getQueryEmbedding(message);
  if (!queryEmbedding) {
    console.error("Failed to generate query embedding");
    return fallbackReply();
  }

  console.log(`Generated embedding dimensions: ${queryEmbedding.length}`);

  // Await the async data load
  const properties = await loadPropertiesData();
  const validProperties = properties.filter(p =>
    p.embedding &&
    Array.isArray(p.embedding) &&
    p.embedding.length === queryEmbedding.length
  );

  console.log(`Matching against ${validProperties.length} valid properties`);

  if (validProperties.length === 0) {
    console.error("No valid properties with matching embedding dimensions");
    return fallbackReply();
  }

  const MIN_SIMILARITY_THRESHOLD = 0.5;
  const matches = validProperties
    .map(property => ({
      property,
      score: cosineSimilarity(queryEmbedding, property.embedding)
    }))
    .filter(match => match.score >= MIN_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const bestMatch = matches[0];
  const propertySnippet = bestMatch
    ? `Our best match is: ${bestMatch.property.title}, priced at ${bestMatch.property.price}, located at ${bestMatch.property.address}.`
    : "We couldn't find a property that matches your criteria.";

  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  messagesForChat.push({
    role: "system",
    content: `Based on your preferences (similarity score: ${bestMatch?.score?.toFixed(2) || 'N/A'}), ${propertySnippet} Would you like to schedule a meeting?`
  });

  messagesForChat.push({
    role: "system",
    content: `Return valid JSON: {
      "reply": "...",
      "suggestions": ["Yes, schedule meeting", "Show more options"]
    }`.trim(),
  });

  try {
    const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
    return parseAiResponse(rawOutput);
  } catch (error) {
    console.error("Error generating reply:", error);
    return fallbackReply();
  }
}

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return normA && normB ? dotProduct / (normA * normB) : 0;
}

// (Additional reply functions can be added here if needed)
