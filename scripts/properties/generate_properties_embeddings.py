from sentence_transformers import SentenceTransformer
import json
import os

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
    
    # Prepare a list to hold the embeddings for each property
    embeddings = []
    
    # Process each property in the list
    for property_item in properties_data:
        # Extract relevant fields
        title = property_item.get("title", "")
        features = property_item.get("features", [])
        # If features is a list, join them into a single string
        if isinstance(features, list):
            features_text = " ".join(features)
        else:
            features_text = features
        special_note = property_item.get("specialNote", "")
        
        # Create a text representation by combining the fields
        text_representation = f"{title}. {features_text}. {special_note}"
        
        # Generate the embedding for this property's text representation
        embedding = model.encode(text_representation)
        embeddings.append(embedding.tolist())
    
    # Define the output file path for the embeddings JSON
    output_path = os.path.join(base_dir, "propertiesWithEmbeddings.json")
    
    # Save the list of embeddings to the output file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"embeddings": embeddings}, f, indent=2)
    
    print("Properties embeddings generated and saved to", output_path)

if __name__ == "__main__":
    main()
