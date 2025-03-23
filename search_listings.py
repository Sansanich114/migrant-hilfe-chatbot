import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# Define your property listings again (the same order as used in generate_embeddings.py)
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

# Load the precomputed embeddings saved by generate_embeddings.py
embeddings = np.load('listings_embeddings.npy').astype('float32')

# Create a FAISS index using IndexFlatL2 (Euclidean distance)
index = faiss.IndexFlatL2(embeddings.shape[1])
index.add(embeddings)  # Add all the property embeddings to the index

# Function to search for the best matching listing given a user query
def search(query, model):
    # Convert the query to its embedding
    query_embedding = model.encode([query]).astype('float32')
    # Search the index for the nearest neighbor (k=1 returns the single best match)
    distances, indices = index.search(query_embedding, k=1)
    best_index = indices[0][0]
    return listings[best_index], distances[0][0]

# Load the same Sentence Transformer model used for generating embeddings
model = SentenceTransformer('all-mpnet-base-v2')

# Example user query
if __name__ == '__main__':
    user_query = "I want a flat that is close to all the city action in Berlin."
    best_listing, distance = search(user_query, model)
    print("Best matching listing:")
    print(best_listing)
    print("Similarity distance:", distance)
