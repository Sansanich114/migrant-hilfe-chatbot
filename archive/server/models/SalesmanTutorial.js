﻿import mongoose from "mongoose";

const SalesmanTutorialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("SalesmanTutorial", SalesmanTutorialSchema);
