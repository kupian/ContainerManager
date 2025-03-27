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
# Store container port mappings
container_ports = {}

# Load Docker images from JSON config
def load_docker_images():
    with open("images.json", "r") as f:
        return json.load(f)

DOCKER_IMAGES = load_docker_images()

def get_container_ports(container):
    """Extract port mappings from a container"""
    # Reload container to get fresh data
    container.reload()
    
    port_mappings = {}
    if container.attrs['NetworkSettings']['Ports']:
        for container_port, host_bindings in container.attrs['NetworkSettings']['Ports'].items():
            if host_bindings:  # If the port is actually mapped
                # Extract port number and protocol from format like '3000/tcp'
                port_num, protocol = container_port.split('/')
                # Get the host port it's mapped to
                host_port = host_bindings[0]['HostPort']
                # Get the host IP
                host_ip = host_bindings[0]['HostIp'] or 'localhost'
                port_mappings[container_port] = {
                    'hostPort': host_port,
                    'hostIp': host_ip
                }
    
    return port_mappings

@app.route("/spawn", methods=["POST"])
def spawn_container():
    data = request.json
    client_id = data["client_id"]
    if client_id in client_containers:
        return jsonify({"error": "Client already has a container"}), 400
    
    try:
        image_name = data["image"]
        image = client.images.get(image_name)
    except docker.errors.ImageNotFound:
        return jsonify({"error": f"Image {image_name} not found"}), 400
    
    # Get exposed ports from image configuration
    image_config = client.api.inspect_image(image_name)
    port_bindings = {}
    
    # Create port bindings for all exposed ports
    if image_config.get('Config', {}).get('ExposedPorts'):
        for port_proto in image_config['Config']['ExposedPorts'].keys():
            # Set to None to let Docker assign a random host port
            port_bindings[port_proto] = None
    
    # If no ports are exposed in the image, expose some common ports
    if not port_bindings:
        port_bindings = {
            '3000/tcp': None,
            '8080/tcp': None,
            '80/tcp': None
        }
    
    try:
        # Run container with bridge networking and publish ports to random host ports
        container = client.containers.run(
            image, 
            detach=True, 
            name=f"client_{client_id}",
            ports=port_bindings,
            # Add host.docker.internal mapping for easy access to host
            extra_hosts={"host.docker.internal": "host-gateway"},
            # Pass container ID as a label for easier management
            labels={"client_id": client_id}
        )
        
        # Get container details after it's running
        container.reload()
        
        # Extract the randomly assigned port mappings
        port_mappings = {}
        if container.attrs['NetworkSettings']['Ports']:
            for container_port, host_bindings in container.attrs['NetworkSettings']['Ports'].items():
                if host_bindings:  # If the port is actually mapped
                    host_port = host_bindings[0]['HostPort']
                    port_mappings[container_port] = host_port
        
        # Store container and port information
        client_containers[client_id] = container.id
        container_ports[container.id] = port_mappings
        
        # Get the host IP for connection information
        host_ip = "localhost"  # Default to localhost
        
        # Try to get a better host IP for external access
        try:
            # This will get the IP of the Docker host from the container's perspective
            import socket
            host_ip = socket.gethostbyname(socket.gethostname())
        except:
            pass
        
        return jsonify({
            "message": "Container spawned successfully", 
            "container_id": container.id,
            "ports": port_mappings,
            "network_mode": "bridge",
            "host_ip": host_ip,
            "note": "Container ports are mapped to random host ports. For external access, use the host's IP address with the mapped ports."
        })
        
    except Exception as e:
        return jsonify({"error": f"Failed to spawn container: {str(e)}"}), 500

@app.route("/get", methods=["POST"])
def get_container():
    client_id = request.json["client_id"]
    if client_id not in client_containers:
        return jsonify({"error": "No container found"}), 404
    
    container_id = client_containers[client_id]
    
    # Get the latest port mappings
    ports = container_ports.get(container_id, {})
    
    # If we have a container but no ports, try to refresh the port data
    if not ports:
        try:
            container = client.containers.get(container_id)
            container.reload()
            
            # Extract port mappings
            if container.attrs['NetworkSettings']['Ports']:
                for container_port, host_bindings in container.attrs['NetworkSettings']['Ports'].items():
                    if host_bindings:
                        host_port = host_bindings[0]['HostPort']
                        ports[container_port] = host_port
                
                # Update our cache
                container_ports[container_id] = ports
        except Exception as e:
            print(f"Error refreshing port data: {str(e)}")
    
    return jsonify({
        "message": "Container found", 
        "container_id": container_id,
        "ports": ports
    })

@app.route("/restart", methods=["POST"])
def restart_container():
    client_id = request.json["client_id"]
    if client_id not in client_containers:
        return jsonify({"error": "No container found"}), 404
    
    container_id = client_containers[client_id]
    
    try:
        container = client.containers.get(container_id)
        container.restart()
        
        # Refresh port mappings after restart
        container.reload()
        port_mappings = {}
        
        if container.attrs['NetworkSettings']['Ports']:
            for container_port, host_bindings in container.attrs['NetworkSettings']['Ports'].items():
                if host_bindings:
                    host_port = host_bindings[0]['HostPort']
                    port_mappings[container_port] = host_port
        
        # Update stored port mappings
        container_ports[container_id] = port_mappings
        
        return jsonify({
            "message": "Container restarted",
            "ports": port_mappings
        })
    except Exception as e:
        return jsonify({"error": f"Failed to restart container: {str(e)}"}), 500

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
    
    container_id = client_containers[client_id]
    container = client.containers.get(container_id)
    container.remove(force=True)
    
    # Clean up port mappings
    if container_id in container_ports:
        del container_ports[container_id]
    
    del client_containers[client_id]
    return jsonify({"message": "Container destroyed"})

if __name__ == "__main__":
    app.run(port=5000, debug=True, use_reloader=True)