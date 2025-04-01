import dotenv from 'dotenv';
dotenv.config();

import { OpenAI } from 'openai';
import axios from 'axios';
import { parseAiResponse } from '../../server/utils/helpers.js';
import { loadPropertiesData } from '../../server/utils/staticData.js';

// Updated import path:
// Previously: '../../scripts/agency/agencyWithEmbeddings.json'
// Now using the new correct relative location:
const agencyWithEmbeddingsModule = await import('../scripts/agency/agencyWithEmbeddings.json', { assert: { type: "json" } });
const agencyWithEmbeddings = agencyWithEmbeddingsModule.default;

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

// Generate a qualified reply based on property search and context.
export async function generateQualifiedReply(conversation, message, language) {
  const queryEmbedding = await getQueryEmbedding(message);
  if (!queryEmbedding) {
    return fallbackReply();
  }
  const properties = await loadPropertiesData();
  const validProperties = properties.filter(p =>
    p.embedding &&
    Array.isArray(p.embedding) &&
    p.embedding.length === queryEmbedding.length
  );
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

  const agencyContext = await getAgencyContext(message);
  const conversationSummary = await generateConversationSummary(conversation, language);
  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  const enhancedSystemPrompt = `
${agencyContext}
${conversationSummary ? `Summary so far: ${conversationSummary}` : ""}
Based on your preferences (similarity score: ${bestMatch?.score?.toFixed(2) || 'N/A'}), ${propertySnippet} Would you like to schedule a meeting?
  `.trim();
  messagesForChat.push({ role: "system", content: enhancedSystemPrompt });
  messagesForChat.push({
    role: "system",
    content: `Return valid JSON: {"reply": "...","suggestions": ["Yes, schedule meeting", "Show more options"]}`,
  });
  try {
    const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
    return parseAiResponse(rawOutput);
  } catch (error) {
    return fallbackReply();
  }
}

// Generate an exploratory reply for users exploring options.
export async function generateExploratoryReply(conversation, message, language) {
  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `Please provide an exploratory reply in ${language}. Return valid JSON in the format: {"reply": "...", "suggestions": ["Option 1", "Option 2"]}`
  });
  try {
    const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
    return parseAiResponse(rawOutput);
  } catch (error) {
    console.error("Error generating exploratory reply:", error);
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
    console.error("Error generating politeness reply:", error);
    return fallbackReply();
  }
}

// Generate an off-topic reply that brings the conversation back on track.
export async function generateOffTopicReply(conversation, language) {
  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `The conversation is strictly about real estate. Please provide a response that reminds the user of this focus and avoids answering unrelated questions. Return valid JSON in the format: {"reply": "I'm here to help with real estate inquiries. Let's focus on that.", "suggestions": ["Show properties", "Schedule meeting"]}`
  });
  try {
    const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
    return parseAiResponse(rawOutput);
  } catch (error) {
    console.error("Error generating off-topic reply:", error);
    return fallbackReply();
  }
}

// Generate a general advice reply with a concise answer.
export async function generateGeneralAdviceReply(conversation, language) {
  const messagesForChat = conversation.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
  messagesForChat.push({
    role: "system",
    content: `Please provide concise general real estate advice in ${language} (under 50 words). Return valid JSON in the format: {"reply": "...", "suggestions": ["Option 1", "Option 2"]}`
  });
  try {
    const rawOutput = await callDeepSeekChat(messagesForChat, 0.8);
    return parseAiResponse(rawOutput);
  } catch (error) {
    console.error("Error generating general advice reply:", error);
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
