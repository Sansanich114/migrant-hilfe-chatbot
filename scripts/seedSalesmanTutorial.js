// scripts/seedSalesmanTutorial.js
import { personalityConnection } from "../server/dbConnections.js";
import SalesmanTutorial from "../server/models/SalesmanTutorial.js";

async function seedSalesmanTutorial() {
  try {
    // The connection is already opened by importing personalityConnection
    // Clear existing data (optional)
    await SalesmanTutorial.deleteMany({});

    // Insert your tutorial
    await SalesmanTutorial.create({
      title: "Pragmatic Sales Approach",
      content: `
We at Real Estate Beispiel GmbH... (full text)
...
`,
    });

    console.log("Salesman tutorial seeded successfully.");
  } catch (err) {
    console.error("Seeding salesman tutorial error:", err);
  } finally {
    // Close the connection
    personalityConnection.close();
  }
}

seedSalesmanTutorial();
