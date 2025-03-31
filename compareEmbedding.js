console.log("Starting embedding comparison...");

import { getQueryEmbedding } from "./server/services/openaiService.js";

async function compare() {
  const sampleText = "This is a test sentence for comparing embeddings.";
  const apiEmbedding = await getQueryEmbedding(sampleText);
  console.log("API Embedding Dimension:", apiEmbedding ? apiEmbedding.length : "undefined");
  console.log("API Embedding:", apiEmbedding);
}

compare().catch(err => console.error("Error in compare:", err));
