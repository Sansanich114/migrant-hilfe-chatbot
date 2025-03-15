const axios = require('axios');

async function getGoogleSummary(query) {
  try {
    // Make the request to Google Custom Search
    const res = await axios.get('https://customsearch.googleapis.com/customsearch/v1', {
      params: {
        key: process.env.GOOGLE_CSE_KEY,
        cx: process.env.GOOGLE_CSE_ID,
        q: query,
      },
    });

    // Take the top 3 items (feel free to adjust as needed)
    const items = res.data.items ? res.data.items.slice(0, 3) : [];

    // Combine snippets into a single string
    // You could also pick the "best" snippet or do more sophisticated parsing
    const snippetText = items.map(item => item.snippet).join("\n\n");

    // Return the combined snippet text
    return snippetText || "No relevant info found from the web search.";
  } catch (err) {
    console.error("Google Search error:", err);
    // Return a fallback message if the search fails
    return "I couldn't find extra info right now.";
  }
}

module.exports = { getGoogleSummary };
