import Lead from "../models/Lead.js";

export async function captureLead(req, res) {
  try {
    const { name, email, phone, message, conversationId } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required." });
    }
    const newLead = new Lead({
      name,
      email,
      phone,
      message,
      conversationId
    });
    await newLead.save();
    return res.status(201).json({ message: "Lead captured successfully." });
  } catch (error) {
    console.error("Lead capture error:", error);
    return res.status(500).json({ error: "Failed to capture lead." });
  }
}
