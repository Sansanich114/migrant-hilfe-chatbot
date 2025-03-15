const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const chatRoutes = require('./routes/chatRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? "https://migrant-hilfe-chatbot.onrender.com"
        : "*",
  })
);
app.use(express.json());
app.use(express.static('public'));

app.use('/chat', chatRoutes);
app.use('/user', userRoutes);
app.use('/auth', authRoutes);

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/migrantHilfe')
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
