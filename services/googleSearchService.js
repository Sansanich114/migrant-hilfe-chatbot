const axios = require('axios');

async function getGoogleSummary(query) {
  try {
    const res = await axios.get('https://customsearch.googleapis.com/customsearch/v1', {
      params: {
        key: process.env.GOOGLE_CSE_KEY,
        cx: process.env.GOOGLE_CSE_ID,
        q: query,
      },
    });
    const items = res.data.items ? res.data.items.slice(0, 3) : [];
    return items.map(item => item.snippet).join("\n");
  } catch (err) {
    console.error("Google Search error:", err);
    return "I couldn't find extra info right now.";
  }
}

module.exports = { getGoogleSummary };
