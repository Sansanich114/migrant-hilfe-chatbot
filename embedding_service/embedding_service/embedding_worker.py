import sys
import json
from sentence_transformers import SentenceTransformer

# Load the model once at startup
model = SentenceTransformer("all-MiniLM-L6-v2")

def process_input(text):
    # Wrap a single string in a list if needed
    if isinstance(text, str):
        text = [text]
    embeddings = model.encode(text).tolist()  # Convert NumPy array to list for JSON serialization
    return embeddings

def main():
    # Continuously read from STDIN line by line (each line is a JSON message)
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            data = json.loads(line)
            text = data.get("text")
            if text is None:
                response = {"error": "No text provided"}
            else:
                embeddings = process_input(text)
                response = {"embeddings": embeddings}
        except Exception as e:
            response = {"error": str(e)}
        # Write the response and flush to ensure it is sent immediately
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
