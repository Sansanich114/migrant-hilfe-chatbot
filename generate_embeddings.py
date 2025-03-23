from sentence_transformers import SentenceTransformer
import numpy as np

# Define your property listings data.
# We combine all the important details into a single string for each listing.
listings = [
    "Luxuswohnung in Mitte, price: €1.250.000, size: 120 qm, rooms: 3 Schlafzimmer, 2 Badezimmer, features: Hohe Decken, bodentiefe Fenster, moderne Küche, Balkon, Tiefgarage, address: Rosa-Luxemburg-Straße 5, 10178 Berlin, monthlyCosts: ~€300, contactAgent: Maximilian Becker, specialNote: Ideal für Kapitalanleger oder Eigenbedarf",
    "Familienhaus in Prenzlauer Berg, price: €850.000, size: 150 qm, rooms: 4 Schlafzimmer, 2 Badezimmer, Garten, features: Renoviertes Altbauhaus, Stuckdecken, energieeffiziente Heizung, address: Stargarder Straße 22, 10437 Berlin, monthlyCosts: ~€200, contactAgent: Sophia Müller, specialNote: Familienfreundliche Umgebung, nahe Schulen",
    "Investitionsobjekt in Lichtenberg, price: €450.000, size: 400 qm (6 Wohnungen), rooms: 6 Einheiten, features: Voll vermietet, Stabile Rendite, builtYear: 1975, address: Weitlingstraße 110, 10317 Berlin, monthlyCosts: ~€600 (Gesamtobjekt), contactAgent: Felix Braun, specialNote: Perfekt für Investoren",
    "Modernes Loft in Neukölln, price: €620.000, size: 90 qm, rooms: 2 Schlafzimmer, 1 Badezimmer, features: Industriedesign, Dachterrasse, builtYear: 2010, address: Boddinstraße 12, 12053 Berlin, monthlyCosts: ~€220, contactAgent: Anna Weber, specialNote: Nahe Tempelhofer Feld",
    "Penthouse in Charlottenburg, price: €1.800.000, size: 200 qm, rooms: 4 Schlafzimmer, 3 Badezimmer, features: Private Terrasse, Smart-Home-Technologie, Panoramablick, builtYear: 2015, address: Kantstraße 50, 10627 Berlin, monthlyCosts: ~€400, contactAgent: Maximilian Becker, specialNote: Nahe Kurfürstendamm",
    "Gemütliche Wohnung in Friedrichshain, price: €380.000, size: 60 qm, rooms: 1 Schlafzimmer, 1 Badezimmer, features: Kürzlich renoviert, Balkon, Parkettboden, builtYear: 1920, address: Gärtnerstraße 5, 10245 Berlin, monthlyCosts: ~€150, contactAgent: Sophia Müller, specialNote: Nahe Boxhagener Platz",
    "Bürofläche am Potsdamer Platz, price: €3.500/Monat, size: 150 qm, rooms: Großraumbüro + Besprechungsräume, features: Voll möbliert, High-Speed-Internet, builtYear: 2002, address: Potsdamer Platz 1, 10785 Berlin, monthlyCosts: Inklusive Nebenkosten, contactAgent: Lukas Hoffmann, specialNote: Beste Geschäftslage",
    "Stadthaus in Zehlendorf, price: €1.100.000, size: 180 qm, rooms: 5 Schlafzimmer, 3 Badezimmer, Garten, features: Ruhige Wohngegend, Nahe Schulen und Parks, builtYear: 1985, address: Onkel-Tom-Straße 18, 14169 Berlin, monthlyCosts: ~€250, contactAgent: Felix Braun, specialNote: Perfekt für Familien",
    "Studio-Wohnung in Moabit, price: €250.000, size: 40 qm, rooms: 1 Badezimmer, offener Wohnbereich, features: Bezahlbar, Ideal für Erstkäufer, builtYear: 1995, address: Turmstraße 22, 10559 Berlin, monthlyCosts: ~€120, contactAgent: Anna Weber, specialNote: Nahe Tiergarten"
]

# Load the Sentence Transformer model (this one is free and works well)
model = SentenceTransformer('all-mpnet-base-v2')

# Generate embeddings for each listing
embeddings = model.encode(listings)

# Save the embeddings into a NumPy file for later use (e.g., for FAISS search)
np.save('listings_embeddings.npy', embeddings)

# For confirmation, print a snippet (first 5 numbers) of each embedding
for i, emb in enumerate(embeddings):
    print(f"Listing {i+1} embedding (first 5 numbers):", emb[:5])

print("Generated and saved embeddings for example listings.")
