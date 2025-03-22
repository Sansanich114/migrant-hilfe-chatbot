// server/app.js

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import chatRoutes from "./routes/chatRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();

// Basic middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? "https://smart-realty-assistant-demo.com"
        : "*",
  })
);
app.use(express.json());
app.use(express.static("public"));

// Connect to your (single) MongoDB instance
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/realEstateDemo")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/chat", chatRoutes);
app.use("/user", userRoutes);

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
