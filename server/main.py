import docker
import docker.errors
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from rapidfuzz import process

app = Flask(__name__)
CORS(app)
client = docker.from_env()

# Store client-container mappings
client_containers = {}

# Load Docker images from JSON config
def load_docker_images():
    with open("images.json", "r") as f:
        return json.load(f)

DOCKER_IMAGES = load_docker_images()

@app.route("/spawn", methods=["POST"])
def spawn_container():
    data = request.json
    client_id = data["client_id"]
    if client_id in client_containers:
        return jsonify({"error": "Client already has a container"}), 400
    try:
        image = client.images.get(data["image"])
    except docker.errors.ImageNotFound:
        return jsonify({"error": "Image not found"}), 400
    
    
    container = client.containers.run(image, detach=True, name=f"client_{client_id}")
    client_containers[client_id] = container.id
    return jsonify({"message": "Container spawned", "container_id": container.id})

@app.route("/get", methods=["POST"])
def get_container():
    client_id = request.json["client_id"]
    if client_id not in client_containers:
        return jsonify({"error": "No container found"}), 404
    
    return jsonify({"message": "Container found", "container_id": client_containers[client_id]})

@app.route("/search", methods=["POST"])
def search_images():
    query = request.json["image"]
    docker_images = client.images.list()
    matches = process.extract(query, [img["label"] for img in DOCKER_IMAGES], limit=5)
   
    # Convert matched labels back to full dictionary entries
    return jsonify([DOCKER_IMAGES[idx] for _, score, idx in matches])

@app.route("/destroy", methods=["POST"])
def destroy_container():
    client_id = request.json["client_id"]
    if client_id not in client_containers:
        return jsonify({"error": "No container found"}), 404
    
    container = client.containers.get(client_containers[client_id])
    container.remove(force=True)
    del client_containers[client_id]
    return jsonify({"message": "Container destroyed"})

@app.route("/restart", methods=["POST"])
def restart_container():
    client_id = request.json["client_id"]
    if client_id not in client_containers:
        return jsonify({"error": "No container found"}), 404
    
    container = client.containers.get(client_containers[client_id])
    container.restart()
    return jsonify({"message": "Container restarted"})

if __name__ == "__main__":
    app.run(port=5000, debug=True, use_reloader=True)
