import mongoose from "mongoose";
import Property from "../server/models/Property.js";

async function seedProperties() {
  try {
    // 1) Connect to your MongoDB (adjust the URI if needed)
    await mongoose.connect("mongodb://localhost:27017/realEstateDemo", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // 2) Clear existing property data (optional)
    await Property.deleteMany({});

    // 3) Insert your 10 property listings
    await Property.create([
      {
        title: "Luxuswohnung in Mitte",
        price: "€1.250.000",
        size: "120 qm",
        rooms: "3 Schlafzimmer, 2 Badezimmer",
        features: [
          "Hohe Decken",
          "bodentiefe Fenster",
          "moderne Küche",
          "Balkon mit Stadtblick",
          "Tiefgarage"
        ],
        address: "Nahe Alexanderplatz",
        contactAgent: "Maximilian Becker",
        builtYear: 0,
        monthlyCosts: "",
        specialNote: ""
      },
      {
        title: "Familienhaus in Prenzlauer Berg",
        price: "€850.000",
        size: "150 qm",
        rooms: "4 Schlafzimmer, 2 Badezimmer, Garten",
        features: [
          "Renoviertes Altbauhaus mit originalen Details",
          "energieeffiziente Heizung"
        ],
        address: "Ruhige Straße nahe Kollwitzplatz",
        contactAgent: "Sophia Müller",
        builtYear: 0,
        monthlyCosts: "",
        specialNote: ""
      },
      {
        title: "Gewerbefläche in Kreuzberg",
        price: "€2.300/Monat (Miete)",
        size: "80 qm",
        rooms: "N/A",
        features: [
          "Helle und geräumige Fläche",
          "ideal für ein Café oder Boutique"
        ],
        address: "Oranienstraße",
        contactAgent: "Lukas Hoffmann",
        builtYear: 0,
        monthlyCosts: "",
        specialNote: ""
      },
      {
        title: "Investitionsobjekt in Lichtenberg",
        price: "€450.000",
        size: "6 Wohnungen (gesamt 400 qm)",
        rooms: "N/A",
        features: [
          "Voll vermietet",
          "stabile Rendite"
        ],
        address: "Nahe Frankfurter Allee",
        contactAgent: "Felix Braun",
        builtYear: 0,
        monthlyCosts: "",
        specialNote: ""
      },
      {
        title: "Modernes Loft in Neukölln",
        price: "€620.000",
        size: "90 qm",
        rooms: "2 Schlafzimmer, 1 Badezimmer",
        features: [
          "Industriedesign",
          "Dachterrasse"
        ],
        address: "Nahe Tempelhofer Feld",
        contactAgent: "Anna Weber",
        builtYear: 0,
        monthlyCosts: "",
        specialNote: ""
      },
      {
        title: "Penthouse in Charlottenburg",
        price: "€1.800.000",
        size: "200 qm",
        rooms: "4 Schlafzimmer, 3 Badezimmer",
        features: [
          "Private Terrasse",
          "Smart-Home-Technologie",
          "Panoramablick"
        ],
        address: "Nahe Kurfürstendamm",
        contactAgent: "Maximilian Becker",
        builtYear: 0,
        monthlyCosts: "",
        specialNote: ""
      },
      {
        title: "Gemütliche Wohnung in Friedrichshain",
        price: "€380.000",
        size: "60 qm",
        rooms: "1 Schlafzimmer, 1 Badezimmer",
        features: [
          "Kürzlich renoviert",
          "Balkon",
          "Parkettboden"
        ],
        address: "Nahe Boxhagener Platz",
        contactAgent: "Sophia Müller",
        builtYear: 0,
        monthlyCosts: "",
        specialNote: ""
      },
      {
        title: "Bürofläche am Potsdamer Platz",
        price: "€3.500/Monat (Miete)",
        size: "150 qm",
        rooms: "N/A",
        features: [
          "Voll möbliert",
          "Besprechungsräume",
          "High-Speed-Internet"
        ],
        address: "Beste Geschäftslage",
        contactAgent: "Lukas Hoffmann",
        builtYear: 0,
        monthlyCosts: "",
        specialNote: ""
      },
      {
        title: "Stadthaus in Zehlendorf",
        price: "€1.100.000",
        size: "180 qm",
        rooms: "5 Schlafzimmer, 3 Badezimmer, Garten",
        features: [
          "Ruhige Wohngegend",
          "nahe Schulen und Parks"
        ],
        address: "Zehlendorf",
        contactAgent: "Felix Braun",
        builtYear: 0,
        monthlyCosts: "",
        specialNote: ""
      },
      {
        title: "Studio-Wohnung in Moabit",
        price: "€250.000",
        size: "40 qm",
        rooms: "1 Badezimmer, offener Wohnbereich",
        features: [
          "Bezahlbar",
          "ideal für Erstkäufer"
        ],
        address: "Nahe Tiergarten",
        contactAgent: "Anna Weber",
        builtYear: 0,
        monthlyCosts: "",
        specialNote: ""
      }
    ]);

    console.log("Properties seeded successfully.");
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    mongoose.connection.close();
  }
}

seedProperties();
