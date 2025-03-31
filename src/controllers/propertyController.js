import Property from "../models/Property.js";

export async function getProperties(req, res) {
  try {
const { location, budget, type } = req.query;
// Basic filter object
let filter = {};

if (location) {
  // e.g., if user typed "Mitte" or "Kreuzberg"
  filter.address = { $regex: location, $options: "i" };
}
// If budget is provided, you'd parse and compare with price (requires numeric approach)
// if (budget) { ... }

// if (type) { ... } // e.g. "luxuswohnung", "familienhaus", "gewerbe"

const properties = await Property.find(filter);
return res.json(properties);
  } catch (err) {
console.error("Error fetching properties:", err);
return res.status(500).json({ error: "Failed to fetch properties" });
  }
}
