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

if (!openRouterApiKey) throw new Error('Missing OPENROUTER_API_KEY');
if (!hfApiKey) throw new Error('Missing HF_API_KEY');

const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: { 'X-OpenRouter-Api-Key': openRouterApiKey },
});

const fallbackSystemPrompt = "You are Sasha, a friendly sales agent at Beispiel Immobilien GMBH. Respond only with plain JSON.";

let chunkedAgencyData = [];
let propertiesWithEmbeddings = [];
const allProperties = loadPropertiesData();

try {
  const agencyPath = path.join(process.cwd(), 'scripts', 'agency', 'agencyWithEmbeddings.json');
  chunkedAgencyData = JSON.parse(await fs.readFile(agencyPath, 'utf8'));
} catch (err) {
  console.error("Error reading agencyWithEmbeddings.json:", err);
}

try {
  const propertiesPath = path.join(process.cwd(), 'scripts', 'properties', 'propertiesWithEmbeddings.json');
  const parsed = JSON.parse(await fs.readFile(propertiesPath, 'utf8'));
  propertiesWithEmbeddings = parsed.embeddings;
} catch (err) {
  console.error("Error reading propertiesWithEmbeddings.json:", err);
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return normA && normB ? dot / (normA * normB) : 0;
}

function poolEmbeddings(embeddings) {
  const dim = embeddings[0].length;
  const pooled = new Array(dim).fill(0);
  embeddings.forEach(vec => vec.forEach((v, i) => pooled[i] += v));
  return pooled.map(v => v / embeddings.length);
}

export async function callDeepSeekChat(messages, temperature = 0.8) {
  if (!messages.some(m => m.role === 'system')) {
    messages.unshift({ role: 'system', content: fallbackSystemPrompt });
  }
  try {
    const res = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat:free',
      messages,
      temperature,
    });

    const content = res.choices?.[0]?.message?.content?.trim();
    if (!content || typeof content !== 'string') {
      console.warn("⚠️ DeepSeek returned empty or invalid content.");
      return null;
    }

    console.log("🧠 DeepSeek Raw Output:", content);
    return content;
  } catch (err) {
    console.error("❌ DeepSeek API error:", err.message);
    return null;
  }
}

export async function getQueryEmbedding(text) {
  try {
    const res = await axios.post(
      "https://api-inference.huggingface.co/models/intfloat/multilingual-e5-large-instruct",
      { inputs: "query: " + text, options: { wait_for_model: true } },
      { headers: { Authorization: "Bearer " + hfApiKey, "Content-Type": "application/json" } }
    );
    if (Array.isArray(res.data)) {
      const vector = Array.isArray(res.data[0][0])
        ? poolEmbeddings(res.data)
        : Array.isArray(res.data[0])
        ? res.data[0]
        : null;

      if (Array.isArray(vector) && vector.length === 768) return vector;
    }
    console.warn("❌ Invalid embedding vector structure:", res.data);
    return null;
  } catch (err) {
    console.error("Embedding error:", err.response?.data || err.message);
    return null;
  }
}

export async function extractIntent(message, summary) {
  const messages = [{
    role: "system",
    content: `You are a smart intent extractor. Analyze the user's message and summary.

Return JSON:
{
  "extractedInfo": {
    "usage": "...",
    "location": "...",
    "budget": "...",
    "propertyType": "...",
    "contact": { "name": "", "email": "", "phone": "" }
  },
  "missingInfo": [...],
  "userMood": "...",
  "urgency": "..."
}`
  }, {
    role: "user",
    content: `Message: "${message}"\nSummary: "${summary}"`
  }];
  try {
    const raw = await callDeepSeekChat(messages, 0.2);
    return parseAiResponse(raw);
  } catch (err) {
    console.error("Intent extraction error:", err);
    return null;
  }
}

export async function generateConversationSummary(conversation, language) {
  const messages = [...conversation.messages.map(m => ({ role: m.role, content: m.content }))];
  messages.push({
    role: "system",
    content: `Summarize this chat in ${language}. Return plain JSON: {"summary": "..."}`
  });
  try {
    const raw = await callDeepSeekChat(messages, 0.5);
    return parseAiResponse(raw)?.summary || "";
  } catch (err) {
    console.error("Summary error:", err);
    return "";
  }
}

export async function getAgencySnippetFromIntent(intent) {
  const { location, usage } = intent?.extractedInfo || {};
  const queryText = `real estate agency for ${usage || "buyers"} in ${location || "Berlin"}`;
  const embedding = await getQueryEmbedding(queryText);
  if (!embedding) {
    console.warn("⚠️ Embedding failed. Using fallback snippet.");
    return chunkedAgencyData?.[0]?.text || "Beispiel Immobilien GMBH – your trusted Berlin real estate partner.";
  }

  let best = { score: -1, text: "" };
  for (const chunk of chunkedAgencyData) {
    if (!chunk.embedding || chunk.embedding.length !== embedding.length) continue;
    const score = cosineSimilarity(embedding, chunk.embedding);
    if (score > best.score) best = { score, text: chunk.text };
  }

  return best.text || chunkedAgencyData?.[0]?.text || "Beispiel Immobilien GMBH – your trusted Berlin real estate partner.";
}

export async function getBestProperty(data) {
  const { usage, location, budget, propertyType } = data || {};
  const query = `usage: ${usage}, location: ${location}, budget: ${budget}, propertyType: ${propertyType}`;
  const queryEmbedding = await getQueryEmbedding(query);
  if (!queryEmbedding) return null;

  let bestScore = -1;
  let bestIndex = -1;
  for (let i = 0; i < propertiesWithEmbeddings.length; i++) {
    const emb = propertiesWithEmbeddings[i];
    if (Array.isArray(emb) && emb.length === queryEmbedding.length) {
      const score = cosineSimilarity(emb, queryEmbedding);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
  }

  const THRESH = 0.5;
  return (bestScore >= THRESH && bestIndex >= 0) ? allProperties[bestIndex] : null;
}

export async function generateSalesmanReply(conversation, message, language) {
  console.log("🔹 [START] generateSalesmanReply");

  const summary = await generateConversationSummary(conversation, language);
  const intent = await extractIntent(message, summary);
  if (!intent) return fallbackJson("Intent extraction failed.");

  const extracted = intent.extractedInfo || {};
  const hasEnoughInfo = extracted.usage && extracted.location && extracted.budget && extracted.propertyType;

  let agencySnippet = await getAgencySnippetFromIntent(intent);
  if (!agencySnippet || agencySnippet.length < 5) {
    agencySnippet = "Beispiel Immobilien GMBH – full-service agency in Berlin since 2000.";
  }

  let propertySnippet = "";
  if (hasEnoughInfo) {
    const prop = await getBestProperty(extracted);
    if (prop) {
      propertySnippet = `Best-Fitting Property:\nTitle: ${prop.title}\nPrice: ${prop.price}\nSize: ${prop.size}\nRooms: ${prop.rooms}\nFeatures: ${prop.features.join(", ")}\nAddress: ${prop.address}`;
    }
  }

  const formatExample = `
Example JSON:
{
  "reply": "Great! I'd love to help you find a property in Berlin. What's your budget and preferred type of property?",
  "extractedInfo": {
    "usage": "residential",
    "location": "Berlin",
    "budget": "",
    "propertyType": "",
    "contact": { "name": "", "email": "", "phone": "" }
  },
  "suggestions": ["2-bedroom flats", "Schedule meeting"]
}
`;

  const prompt = `
You are Sasha, a professional real estate agent at Beispiel Immobilien GMBH.

Summary: ${summary}
User Info:
- Usage: ${extracted.usage || "unknown"}
- Location: ${extracted.location || "unknown"}
- Property Type: ${extracted.propertyType || "unknown"}
- Budget: ${extracted.budget || "unknown"}

Missing info: ${intent.missingInfo?.join(", ") || "none"}
Agency: ${agencySnippet}
${propertySnippet ? "\n" + propertySnippet : ""}

Instructions:
- Be helpful and natural
- Always act as Sasha from the agency
- Ask for one missing field at a time
- Only suggest property if enough info
${formatExample}

Now respond in the **exact** JSON format as shown above. No commentary, no prefix.
`.trim();

  const finalMessages = [
    { role: "system", content: fallbackSystemPrompt },
    ...conversation.messages.map(m => ({ role: m.role, content: m.content })),
    { role: "system", content: prompt },
    { role: "user", content: message },
  ];

  const raw = await callDeepSeekChat(finalMessages, 0.8);
  const parsed = parseAiResponse(raw);

  if (!parsed || !parsed.reply) {
    console.warn("❌ Parsed response is invalid:", parsed);
    return fallbackJson("Sorry, I couldn't generate a response.");
  }

  return {
    reply: parsed.reply,
    extractedInfo: extracted,
    suggestions: parsed.suggestions || [],
  };
}

function fallbackJson(message = "Let me connect you with a human agent.") {
  return {
    reply: message,
    extractedInfo: {
      usage: "", location: "", budget: "", propertyType: "",
      contact: { name: "", email: "", phone: "" }
    },
    suggestions: ["Contact an agent", "Try again later"]
  };
}

export async function generatePolitenessReply(conversation, language) {
  const agencySnippet = await getAgencySnippetFromIntent({ extractedInfo: {} });
  const politePrompt = `
You are Sasha, a friendly real estate agent at Beispiel Immobilien GMBH.

Agency info: ${agencySnippet}

Respond politely in ${language}. Avoid generic assistant tone. Make users feel welcome.

Return JSON: { "reply": "...", "suggestions": ["...", "..."] }
`;

  const messages = [
    { role: "system", content: fallbackSystemPrompt },
    ...conversation.messages.map(m => ({ role: m.role, content: m.content })),
    { role: "system", content: politePrompt },
  ];

  const raw = await callDeepSeekChat(messages, 0.8);
  const parsed = parseAiResponse(raw);
  return parsed?.reply
    ? { reply: parsed.reply, suggestions: parsed.suggestions || [] }
    : fallbackJson();
}

export async function generateOtherReply(conversation, language) {
  const agencySnippet = await getAgencySnippetFromIntent({ extractedInfo: {} });
  const redirectPrompt = `
You are Sasha, a real estate expert at Beispiel Immobilien GMBH.

Agency: ${agencySnippet}

The user's question is off-topic. Gently redirect them to talk about real estate.

Return JSON: {
  "reply": "I'm here to help with real estate inquiries. Let's focus on that.",
  "suggestions": ["Show properties", "Schedule meeting"]
}
`;

  const messages = [
    { role: "system", content: fallbackSystemPrompt },
    ...conversation.messages.map(m => ({ role: m.role, content: m.content })),
    { role: "system", content: redirectPrompt },
  ];

  const raw = await callDeepSeekChat(messages, 0.8);
  const parsed = parseAiResponse(raw);
  return parsed?.reply
    ? { reply: parsed.reply, suggestions: parsed.suggestions || [] }
    : fallbackJson();
}
