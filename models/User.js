const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  subscriptionType: { type: String, default: "free" }, // "free" or "paid"
  freeUsageCount: { type: Number, default: 0 },
  profileInfo: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
