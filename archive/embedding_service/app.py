from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

app = Flask(__name__)

# Temporary endpoint to verify the service is running
@app.route('/', methods=['GET'])
def index():
    return "Embedding Service is Running!"

# Load the SentenceTransformer model once at startup
model = SentenceTransformer('all-mpnet-base-v2')

# Endpoint to generate embedding for a given text
@app.route('/embed', methods=['POST'])
def embed():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400

    text = data['text']
    # Generate the embedding and convert it to a list for JSON serialization
    embedding = model.encode(text).tolist()
    return jsonify({'embedding': embedding})

if __name__ == '__main__':
    # Run the Flask development server on port 5000, listening on all network interfaces
    app.run(host='0.0.0.0', port=4999)
