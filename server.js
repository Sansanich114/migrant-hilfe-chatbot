const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
const errorHandler = require('./errorHandler');

// Access the API key
const apiKey = process.env.DEEPSEEK_API_KEY;
console.log("DeepSeek API Key Loaded:", process.env.DEEPSEEK_API_KEY ? "Yes" : "No");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve Static Files (Chat UI)
app.use(express.static(path.join(__dirname, 'public')));

// Suppress favicon.ico 404 errors
app.get('/favicon.ico', (req, res) => res.status(204));

// Root Route Serves HTML
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Chatbot API Route
app.post("/chat", async (req, res) => {
    console.log("Received request:", req.body);

    if (!req.body || !req.body.message) {
        return res.status(400).json({ error: 'Invalid request. Expected {"message":"Hello"}' });
    }

    const userMessage = req.body.message;

    // Prepare the request payload for DeepSeek API
    const requestData = {
        model: 'deepseek-reasoner', // DeepSeek-R1 model identifier
        messages: [
            {
                role: 'system',
                content: 'You are an expert immigration advisor specializing in helping people move to Germany. Provide professional, friendly, and detailed answers about visas, work permits, and citizenship.',
            },
            { role: 'user', content: userMessage },
        ],
    };

    try {
        // Send the request to DeepSeek API
        const API_URL = 'https://api.deepseek.com/v1/chat/completions';
        const response = await axios.post(API_URL, requestData, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        // Extract and send the AI's response back to the client
        const aiReply = response.data.choices[0].message.content;
        res.status(200).json({ reply: aiReply });
    } catch (error) {
        if (error.response) {
            // Server responded with a status other than 2xx
            console.error('DeepSeek API Error:', error.response.data);
            res.status(error.response.status).json({ error: error.response.data.error.message });
        } else if (error.request) {
            // No response received from server
            console.error('No response from DeepSeek API:', error.request);
            res.status(500).json({ error: 'No response from DeepSeek API.' });
        } else {
            // Error setting up the request
            console.error('Error setting up request to DeepSeek API:', error.message);
            res.status(500).json({ error: 'Error setting up request to DeepSeek API.' });
        }
    }
});

// Error Handler Middleware
app.use(errorHandler);

// Start Server on Render's assigned port
const PORT = process.env.PORT || 3000;  // Use the correct port assigned by Render
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});
