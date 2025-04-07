import docker
import docker.errors
import json
import os
from flask import Flask, request, jsonify, session, redirect, url_for
from flask_cors import CORS
from rapidfuzz import process
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev_secret_key_change_in_production')
CORS(app, supports_credentials=True)
client = docker.from_env()

# Store client-container mappings
client_containers = {}
# Store container port mappings
container_ports = {}

# Load Docker images from JSON config
def load_docker_images():
    with open("images.json", "r") as f:
        return json.load(f)

# Load authorized users from JSON config
def load_authorized_users():
    try:
        with open("authorized_users.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        # Create default authorized_users.json if it doesn't exist
        default_auth = {
            "users": ["user1", "user2", "user3", "admin"],
            "admins": ["admin"],
            "admin_credentials": {
                "username": "admin",
                "password": "containeradmin123" 
            }
        }
        with open("authorized_users.json", "w") as f:
            json.dump(default_auth, f, indent=2)
        return default_auth

DOCKER_IMAGES = load_docker_images()
AUTH_CONFIG = load_authorized_users()

# Authentication decorators
def is_authorized_user(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        data = request.json
        if not data or "client_id" not in data:
            return jsonify({"error": "Client ID is required"}), 400
        
        client_id = data["client_id"]
        if client_id not in AUTH_CONFIG["users"]:
            return jsonify({"error": "Unauthorized client ID"}), 403
            
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_logged_in' not in session or not session['admin_logged_in']:
            return jsonify({"error": "Admin authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

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

def get_image_config(image_name):
    """Get the configuration for an image from the images.json file"""
    for img in DOCKER_IMAGES:
        if img["image"] == image_name:
            return img
    return None

@app.route("/api/auth/verify", methods=["POST"])
def verify_user():
    data = request.json
    if not data or "client_id" not in data:
        return jsonify({"error": "Client ID is required"}), 400
        
    client_id = data["client_id"]
    is_valid = client_id in AUTH_CONFIG["users"]
    
    return jsonify({
        "valid": is_valid,
        "is_admin": client_id in AUTH_CONFIG["admins"] if is_valid else False
    })

@app.route("/api/auth/admin/login", methods=["POST"])
def admin_login():
    data = request.json
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Username and password required"}), 400
    
    admin_creds = AUTH_CONFIG["admin_credentials"]
    if data["username"] == admin_creds["username"] and data["password"] == admin_creds["password"]:
        session['admin_logged_in'] = True
        session['admin_username'] = data["username"]
        return jsonify({"success": True, "message": "Login successful"})
    
    return jsonify({"error": "Invalid credentials"}), 401

@app.route("/api/auth/admin/logout", methods=["POST"])
def admin_logout():
    session.pop('admin_logged_in', None)
    session.pop('admin_username', None)
    return jsonify({"success": True, "message": "Logout successful"})

@app.route("/api/admin/containers", methods=["GET"])
@admin_required
def get_all_containers():
    try:
        containers = []
        for client_id, container_id in list(client_containers.items()):
            try:
                container = client.containers.get(container_id)
                container.reload()
                container_info = {
                    "client_id": client_id,
                    "container_id": container_id,
                    "status": container.status,
                    "image": container.image.tags[0] if container.image.tags else "unknown",
                    "created": container.attrs["Created"],
                    "ports": container_ports.get(container_id, {})
                }
                containers.append(container_info)
            except docker.errors.NotFound:
                # Container no longer exists, remove from our mappings
                del client_containers[client_id]
                if container_id in container_ports:
                    del container_ports[container_id]
        
        return jsonify({"containers": containers})
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve containers: {str(e)}"}), 500

@app.route("/api/admin/container/<client_id>/action", methods=["POST"])
@admin_required
def admin_container_action(client_id):
    if client_id not in client_containers:
        return jsonify({"error": "No container found for this client"}), 404
    
    data = request.json
    if not data or "action" not in data:
        return jsonify({"error": "Action required"}), 400
    
    action = data["action"]
    container_id = client_containers[client_id]
    
    try:
        container = client.containers.get(container_id)
        
        if action == "restart":
            container.restart()
            container.reload()
            port_mappings = {}
            
            if container.attrs['NetworkSettings']['Ports']:
                for container_port, host_bindings in container.attrs['NetworkSettings']['Ports'].items():
                    if host_bindings:
                        host_port = host_bindings[0]['HostPort']
                        port_mappings[container_port] = host_port
            
            container_ports[container_id] = port_mappings
            return jsonify({
                "message": f"Container for client {client_id} restarted",
                "ports": port_mappings
            })
            
        elif action == "stop":
            container.stop()
            return jsonify({"message": f"Container for client {client_id} stopped"})
            
        elif action == "start":
            container.start()
            container.reload()
            port_mappings = {}
            
            if container.attrs['NetworkSettings']['Ports']:
                for container_port, host_bindings in container.attrs['NetworkSettings']['Ports'].items():
                    if host_bindings:
                        host_port = host_bindings[0]['HostPort']
                        port_mappings[container_port] = host_port
            
            container_ports[container_id] = port_mappings
            return jsonify({
                "message": f"Container for client {client_id} started",
                "ports": port_mappings
            })
            
        elif action == "destroy":
            container.remove(force=True)
            del client_containers[client_id]
            if container_id in container_ports:
                del container_ports[container_id]
            return jsonify({"message": f"Container for client {client_id} destroyed"})
            
        else:
            return jsonify({"error": "Invalid action. Supported actions: restart, stop, start, destroy"}), 400
            
    except Exception as e:
        return jsonify({"error": f"Failed to perform action: {str(e)}"}), 500

@app.route("/api/admin/users", methods=["GET"])
@admin_required
def get_users():
    return jsonify({"users": AUTH_CONFIG["users"], "admins": AUTH_CONFIG["admins"]})

@app.route("/api/admin/users", methods=["POST"])
@admin_required
def add_user():
    data = request.json
    if not data or "username" not in data:
        return jsonify({"error": "Username is required"}), 400
    
    username = data["username"]
    is_admin = data.get("is_admin", False)
    
    if username in AUTH_CONFIG["users"]:
        return jsonify({"error": "User already exists"}), 400
    
    AUTH_CONFIG["users"].append(username)
    if is_admin:
        AUTH_CONFIG["admins"].append(username)
    
    with open("authorized_users.json", "w") as f:
        json.dump(AUTH_CONFIG, f, indent=2)
    
    return jsonify({"message": f"User {username} added successfully"})

@app.route("/api/admin/users/<username>", methods=["DELETE"])
@admin_required
def delete_user(username):
    if username not in AUTH_CONFIG["users"]:
        return jsonify({"error": "User not found"}), 404
    
    if username == "admin":
        return jsonify({"error": "Cannot delete default admin user"}), 400
    
    AUTH_CONFIG["users"].remove(username)
    if username in AUTH_CONFIG["admins"]:
        AUTH_CONFIG["admins"].remove(username)
    
    with open("authorized_users.json", "w") as f:
        json.dump(AUTH_CONFIG, f, indent=2)
    
    return jsonify({"message": f"User {username} deleted successfully"})

@app.route("/spawn", methods=["POST"])
@is_authorized_user
def spawn_container():
    data = request.json
    client_id = data["client_id"]
    if client_id in client_containers:
        return jsonify({"error": "Client already has a container"}), 400
    
    try:
        # Get image configuration from JSON
        image_name = data["image"]
        image_config_json = get_image_config(image_name)
        
        # Try to get the image
        try:
            image = client.images.get(image_name)
        except docker.errors.ImageNotFound:
            return jsonify({"error": f"Image {image_name} not found"}), 400
        
        # Get exposed ports from image configuration
        image_inspect = client.api.inspect_image(image_name)
        port_bindings = {}
        
        # Create port bindings for all exposed ports
        if image_inspect.get('Config', {}).get('ExposedPorts'):
            for port_proto in image_inspect['Config']['ExposedPorts'].keys():
                # Set to None to let Docker assign a random host port
                port_bindings[port_proto] = None
        
        # If no ports are exposed in the image, expose some common ports
        if not port_bindings:
            port_bindings = {
                '3000/tcp': None,
                '8080/tcp': None,
                '80/tcp': None
            }
        
        # Handle volume mounts if specified in the image JSON config
        volumes = {}
        if image_config_json and "volumes" in image_config_json:
            for host_path, container_path in image_config_json["volumes"].items():
                # Expand ~ to user's home directory
                if host_path.startswith("~"):
                    host_path = os.path.expanduser(host_path)
                volumes[host_path] = {"bind": container_path, "mode": "rw"}
        
        # Run container with bridge networking and publish ports to random host ports
        container = client.containers.run(
            image, 
            detach=True, 
            name=f"client_{client_id}",
            ports=port_bindings,
            # Add host.docker.internal mapping for easy access to host
            extra_hosts={"host.docker.internal": "host-gateway"},
            # Pass container ID as a label for easier management
            labels={"client_id": client_id},
            # Add volume mounts if specified
            volumes=volumes if volumes else None
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
@is_authorized_user
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
@is_authorized_user
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
@is_authorized_user
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
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    app.run(host=host, port=port, debug=True, use_reloader=True)