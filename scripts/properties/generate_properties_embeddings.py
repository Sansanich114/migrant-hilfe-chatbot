#!/usr/bin/env python3
import json
import os
from sentence_transformers import SentenceTransformer

def main():
    # Determine the base directory (where the script is located)
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Path to the properties data JSON file
    properties_data_path = os.path.join(base_dir, "propertiesData.json")
    
    # Load the properties data (a list of property dictionaries)
    with open(properties_data_path, "r", encoding="utf-8-sig") as f:
        properties_data = json.load(f)

    # Initialize the SentenceTransformer model
    model = SentenceTransformer("all-mpnet-base-v2")

    # Prepare a list to hold the new output data, each item with property info + "embedding"
    output_data = []

    # Process each property in the list
    for property_item in properties_data:
        # Extract relevant fields
        title = property_item.get("title", "")
        features = property_item.get("features", [])
        if isinstance(features, list):
            features_text = " ".join(features)
        else:
            features_text = str(features)
        special_note = property_item.get("specialNote", "")

        # Create a text representation by combining the fields
        text_representation = f"{title}. {features_text}. {special_note}"

        # Generate the embedding for this property's text representation
        embedding = model.encode(text_representation)

        # Convert the embedding to a Python list (JSON-serializable)
        embedding_list = embedding.tolist()

        # Build an output dictionary for this property
        output_data.append({
            "title": title,
            "features": features,
            "specialNote": special_note,
            "embedding": embedding_list
        })

    # Define the output file path for the embeddings JSON
    output_path = os.path.join(base_dir, "propertiesWithEmbeddings.json")

    # Save our new output array
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    print("Properties embeddings generated and saved to", output_path)

if __name__ == "__main__":
    main()
