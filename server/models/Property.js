import mongoose from "mongoose";

const PropertySchema = new mongoose.Schema({
  title: String,
  price: String,
  size: String,
  rooms: String,
  features: [String],
  builtYear: Number,
  address: String,
  monthlyCosts: String,
  contactAgent: String,
  specialNote: String,
});

export default mongoose.model("Property", PropertySchema);
