import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  message: { type: String },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Lead", LeadSchema);
