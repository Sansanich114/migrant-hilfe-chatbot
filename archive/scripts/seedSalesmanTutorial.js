import mongoose from "mongoose";
import SalesmanTutorial from "../server/models/SalesmanTutorial.js";

async function seedSalesmanTutorial() {
  try {
    // 1) Connect to your MongoDB (adjust the URI as needed)
    await mongoose.connect("mongodb://localhost:27017/realEstateDemo", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // 2) Clear existing data (optional)
    await SalesmanTutorial.deleteMany({});

    // 3) Insert your new salesman tutorial
    await SalesmanTutorial.create({
      title: "Pragmatic Sales Approach",
      content: \`
This is the sales approach text for the chatbot. It explains how to handle
conversations in a direct, polite, and results-driven manner. We highlight
the agency's reputation, encourage the user to schedule a meeting, and
avoid small talk that doesn't lead to a viewing or consultation.

1. Greet politely, referencing the agency.
2. Ask the user about their property needs or budget.
3. If uncertain, propose relevant listings or solutions quickly.
4. Emphasize scheduling a meeting for deeper discussion.
5. Maintain a confident but respectful tone.
6. Keep the conversation short and action-oriented.
\`
    });

    console.log("Salesman tutorial seeded successfully.");
  } catch (err) {
    console.error("Seeding salesman tutorial error:", err);
  } finally {
    mongoose.connection.close();
  }
}

seedSalesmanTutorial();
