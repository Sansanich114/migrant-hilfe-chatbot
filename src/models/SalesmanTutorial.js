// server/models/SalesmanTutorial.js
import { personalityConnection } from "../dbConnections.js";
import mongoose from "mongoose";

const SalesmanTutorialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Use personalityConnection instead of mongoose
export default personalityConnection.model("SalesmanTutorial", SalesmanTutorialSchema);
