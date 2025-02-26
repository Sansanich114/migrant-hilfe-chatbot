// Import necessary modules
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config(); // Load environment variables
const errorHandler = require('./errorHandler'); // Ensure this file exists

// Initialize the Express application
const app = express();

// Apply middleware
app.use(express.json()); // Parse JSON request bodies
app.use(cors()); // Enable Cross-Origin Resource Sharing

// Retrieve API key from environment variables
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Log API Key Status (for debugging)
console.log("DeepSeek API Key:", API_KEY ? "Loaded ✅" : "Not Loaded ❌");

// ✅ Fix: Define root route AFTER initializing `app`
app.get("/", (req, res) => {
    res.send("Migrant Hilfe Chatbot is Live! 🚀");
});

// Define the /chat route
app.post("/chat", async (req, res) => {
    console.log("Received request:", req.body);

    // Dummy response (Fake AI)
    const fakeResponse = {
        reply: `You said: "${req.body.message}". This is a test response!`
    };

    console.log("Responding with:", fakeResponse.reply);

    // ✅ Ensure the response sends JSON with a 200 status
    res.status(200).json(fakeResponse);
});

// Error Handling Middleware (Should Be the Last Middleware)
app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 3000; // Use the port Render gives you
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
