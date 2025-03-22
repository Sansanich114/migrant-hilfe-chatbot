import mongoose from "mongoose";

const AgencySchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  founded: { type: Number, required: true },
  employees: { type: Number, default: 0 },
  website: { type: String, required: true },
  contact: { type: String, required: true },
  // We'll store the main text details in nested fields
  history: { type: String, default: "" },
  officeAddress: { type: String, default: "" },
  officeHours: { type: String, default: "" },
  salesTeam: { type: String, default: "" },
  faq: { type: String, default: "" },
  whyChooseUs: { type: String, default: "" },
  closing: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Agency", AgencySchema);
