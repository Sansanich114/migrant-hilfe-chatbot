// server/dbConnections.js

import mongoose from "mongoose";

// 1) Connect to the personality DB (shared across projects)
export const personalityConnection = mongoose.createConnection(
  process.env.PERSONALITY_DB_URI || "mongodb://localhost:27017/salesmanPersonality",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
personalityConnection.once("open", () => {
  console.log("✅ Connected to Personality DB!");
});

// 2) Connect to the property DB (project-specific)
export const propertyConnection = mongoose.createConnection(
  process.env.PROPERTY_DB_URI || "mongodb://localhost:27017/realEstateDemo",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
propertyConnection.once("open", () => {
  console.log("✅ Connected to Property DB!");
});
