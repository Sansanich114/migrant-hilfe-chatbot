from sentence_transformers import SentenceTransformer
import json
import os

def main():
    # Get the base directory where this script is located
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Path to the agencyData.json file (which should include multiple sections/chunks)
    agency_data_path = os.path.join(base_dir, "agencyData.json")
    
    # Load the agency data JSON file (expects a dict with section names as keys)
    with open(agency_data_path, "r", encoding="utf-8-sig") as f:
        agency_data = json.load(f)
    
    # Initialize the SentenceTransformer model
    model = SentenceTransformer("all-mpnet-base-v2")
    
    # Prepare a list to hold the chunked embeddings for the agency data.
    # Each chunk corresponds to one section (e.g., "General Information", "Management Team", etc.)
    chunks = []
    
    for section, content in agency_data.items():
        # Only process if there is non-empty content
        if isinstance(content, str) and content.strip():
            # Combine section header with its content to form a descriptive text representation
            chunk_text = f"{section}: {content.strip()}"
            # Generate the embedding for the chunk
            embedding = model.encode(chunk_text)
            # Append the chunk with its embedding to the list
            chunks.append({
                "section": section,
                "text": chunk_text,
                "embedding": embedding.tolist()
            })
        # If content is a list of strings, join them into a single text block.
        elif isinstance(content, list) and content:
            joined_content = " ".join(item.strip() for item in content if isinstance(item, str) and item.strip())
            if joined_content:
                chunk_text = f"{section}: {joined_content}"
                embedding = model.encode(chunk_text)
                chunks.append({
                    "section": section,
                    "text": chunk_text,
                    "embedding": embedding.tolist()
                })
    
    # Define the output file path for the chunked agency embeddings JSON
    output_path = os.path.join(base_dir, "agencyWithEmbeddings.json")
    
    # Save the list of chunk embeddings to the output file in JSON format
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2)
    
    print("Agency embeddings generated and saved to", output_path)

if __name__ == "__main__":
    main()
