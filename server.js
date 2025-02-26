const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
const errorHandler = require('./errorHandler');

// Access the API key
const apiKey = process.env.DEEPSEEK_API_KEY;

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve Static Files (Chat UI)
app.use(express.static(path.join(__dirname, 'public')));

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
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', requestData, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        // Extract and send the AI's response back to the client
        const aiReply = response.data.choices[0].message.content;
        res.status(200).json({ reply: aiReply });
    } catch (error) {
        console.error('DeepSeek API Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error: Unable to process request.' });
    }
});

// Error Handler Middleware
app.use(errorHandler);

// Start Server on Render's assigned port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
