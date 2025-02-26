const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const errorHandler = require('./errorHandler');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// ✅ Serve Static Files (Chat UI)
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Root Route Serves HTML
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Chatbot API Route
app.post("/chat", async (req, res) => {
    console.log("Received request:", req.body);
    
    if (!req.body || !req.body.message) {
        return res.status(400).json({ error: "Invalid request. Expected {\"message\":\"Hello\"}" });
    }

    // Dummy chatbot response
    const fakeResponse = {
        reply: `You said: "${req.body.message}". This is a test response!`
    };

    res.status(200).json(fakeResponse);
});

// Error Handler Middleware
app.use(errorHandler);

// Start Server on Render's assigned port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
