import mongoose from "mongoose";

const PropertySchema = new mongoose.Schema({
  title: String,
  price: String,
  size: String,
  rooms: String,
  features: [String],
  address: String,
  contactAgent: String,
  builtYear: { type: Number, default: 0 },  // If you don't have data, store 0 or omit
  monthlyCosts: { type: String, default: "" },
  specialNote: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Property", PropertySchema);
