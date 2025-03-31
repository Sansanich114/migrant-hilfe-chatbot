from sentence_transformers import SentenceTransformer
import json
import os

def main():
    # Get the directory where this script is located.
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Define the path to your agency data JSON file in the same directory.
    agency_data_path = os.path.join(base_dir, "agencyData.json")
    
    # Load the agency data using utf-8-sig to handle BOM.
    with open(agency_data_path, "r", encoding="utf-8-sig") as f:
        agency_data = json.load(f)
    
    # Combine key fields to form a text representation for embedding.
    fields = ["name", "history", "faq", "whyChooseUs", "closing"]
    text_representation = " ".join([agency_data.get(field, "") for field in fields])
    
    # Load the Sentence Transformer model.
    model = SentenceTransformer("all-mpnet-base-v2")
    
    # Generate the embedding for the agency text.
    embedding = model.encode(text_representation)
    
    # Define the output file path for the embedding JSON in the same directory.
    output_path = os.path.join(base_dir, "agencyWithEmbeddings.json")
    
    # Save the embedding into a JSON file.
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"embedding": embedding.tolist()}, f, indent=2)
    
    print("Agency embeddings generated and saved to", output_path)

if __name__ == "__main__":
    main()
