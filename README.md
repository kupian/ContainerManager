# ContainerManager
A client to allow management of docker containers.

Define images in server/images.json, or use the provided `add.sh` script to add them. Run the server with `python` and the front-end with `npm start`. The server uses the Docker SDK to hook into your Docker daemon and spawn images. Each client ID is allowed to have a single container running at a time. The data is persistent for as long as the Flask server is running, so clients can close their browser and return, and when they enter their client ID the relevant container will be found again.