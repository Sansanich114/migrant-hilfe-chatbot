import mongoose from "mongoose";
import Agency from "../server/models/Agency.js";

async function seedAgency() {
  try {
    // 1) Connect to your MongoDB (adjust URI as needed)
    await mongoose.connect("mongodb://localhost:27017/realEstateDemo", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // 2) Clear existing agency data (optional)
    await Agency.deleteMany({});

    // 3) Insert your agency info as one doc
    await Agency.create({
      name: "Real Estate Beispiel GmbH",
      location: "Berlin, Deutschland",
      founded: 2005,
      employees: 25,
      website: "www.realestatebeispiel.de",
      contact: "+49 30 123 456 78 | info@realestatebeispiel.de",

      history: `
Real Estate Beispiel GmbH wurde 2005 von zwei Kindheitsfreunden, Maximilian Becker und Sophia Müller, gegründet, 
die eine gemeinsame Leidenschaft für Berlins Architektur und Stadtentwicklung teilten. Beide in Berlin geboren 
und aufgewachsen, erlebten sie die Transformation der Stadt nach dem Mauerfall und sahen eine Chance, Menschen 
bei der Orientierung auf dem wachsenden Immobilienmarkt zu helfen.

Beginnend mit einem kleinen Büro in Charlottenburg und nur drei Mitarbeitern, erlangte das Unternehmen schnell 
einen Ruf für seinen persönlichen Service und sein tiefes lokales Wissen. Im Laufe der Jahre erweiterte Real Estate 
Beispiel GmbH sein Team und seine Dienstleistungen und wurde zu einem vertrauenswürdigen Namen für Käufer, Verkäufer 
und Investoren. Heute ist die Agentur stolz darauf, über 1.000 erfolgreiche Transaktionen vermittelt zu haben und 
weiterhin mit der dynamischen Immobilienlandschaft Berlins zu wachsen.
      `.trim(),

      officeAddress: `
Real Estate Beispiel GmbH
Hardenbergstraße 12
10623 Berlin, Deutschland
      `.trim(),

      officeHours: `
Montag bis Freitag: 9:00 – 19:00 Uhr
Samstag: 10:00 – 16:00 Uhr
Sonntag: Geschlossen
      `.trim(),

      salesTeam: `
Unser engagiertes Verkaufsteam steht Ihnen für alle Anfragen zur Verfügung:

1. Maximilian Becker (Mitgründer & Senior Agent)
   - Spezialisierung: Luxusimmobilien, Investitionsmöglichkeiten
   - E-Mail: maximilian.becker@realestatebeispiel.de
   - Telefon: +49 30 123 456 79

2. Sophia Müller (Mitgründerin & Senior Agentin)
   - Spezialisierung: Wohnimmobilien, Familienhäuser
   - E-Mail: sophia.mueller@realestatebeispiel.de
   - Telefon: +49 30 123 456 80

3. Lukas Hoffmann (Spezialist für Gewerbeimmobilien)
   - Spezialisierung: Büroflächen, Einzelhandelseinheiten
   - E-Mail: lukas.hoffmann@realestatebeispiel.de
   - Telefon: +49 30 123 456 81

4. Anna Weber (Spezialistin für Mietimmobilien)
   - Spezialisierung: Wohnungen, Kurzzeitmieten
   - E-Mail: anna.weber@realestatebeispiel.de
   - Telefon: +49 30 123 456 82

5. Felix Braun (Immobilienverwaltung & Investitionen)
   - Spezialisierung: Portfoliomanagement, ROI-Optimierung
   - E-Mail: felix.braun@realestatebeispiel.de
   - Telefon: +49 30 123 456 83
      `.trim(),

      faq: `
F: Wie kann ich eine Besichtigung vereinbaren?
A: Kontaktieren Sie einfach den zuständigen Makler per E-Mail oder Telefon, um einen Termin zu vereinbaren.

F: Bieten Sie auch Finanzierungsberatung an?
A: Ja, wir arbeiten mit renommierten Finanzierungspartnern zusammen, um Ihnen die besten Konditionen zu bieten.

F: Kann ich meine Immobilie über Sie verkaufen oder vermieten?
A: Selbstverständlich! Wir bieten umfassende Dienstleistungen für Verkäufer und Vermieter, inklusive Marktanalyse und Marketing.

F: Wie hoch sind Ihre Provisionen?
A: Unsere Provisionen richten sich nach Art und Umfang der Dienstleistung. Gerne erstellen wir Ihnen ein individuelles Angebot.

F: Unterstützen Sie auch internationale Kunden?
A: Ja, wir betreuen Kunden aus der ganzen Welt und bieten Unterstützung in mehreren Sprachen an.
      `.trim(),

      whyChooseUs: `
1. Lokales Know-how: Wir kennen Berlin wie unsere Westentasche.
2. Persönlicher Service: Maßgeschneiderte Lösungen für jeden Kunden.
3. Transparenz: Keine versteckten Kosten oder Überraschungen.
4. Starkes Netzwerk: Kontakte in der ganzen Stadt.
5. Nachhaltigkeit: Fokus auf energieeffiziente und umweltfreundliche Immobilien.
      `.trim(),

      closing: `
Besuchen Sie uns noch heute in unserem Büro in Charlottenburg oder kontaktieren Sie uns, 
um eine Besichtigung zu vereinbaren. Wir helfen Ihnen, Ihre Traumimmobilie in Berlin zu finden!
      `.trim(),
    });

    console.log("Agency seeded successfully.");
  } catch (err) {
    console.error("Seeding agency error:", err);
  } finally {
    mongoose.connection.close();
  }
}

seedAgency();
