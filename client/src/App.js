import React, { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ClientInput from "./ClientInput";
import ContainerActions from "./ContainerActions";
import ContainerStatus from "./ContainerStatus";
import { API_URL } from "./config";

function App() {
  const [clientId, setClientId] = useState("");
  const [containerId, setContainerId] = useState("");
  const [image, setImage] = useState("ubuntu");

  // Fetch existing container when Client ID is updated
  useEffect(() => {
    if (!clientId.trim()) {
      setContainerId("");
      return;
    }

    const fetchContainer = async () => {
      try {
        const response = await axios.post(`${API_URL}/get`, { client_id: clientId });
        setContainerId(response.data.container_id);
      } catch (error) {
        setContainerId(""); // No container found
      }
    };

    fetchContainer();
  }, [clientId]);

  // Handle API requests (spawn, restart, destroy)
  const handleRequest = async (endpoint) => {
    try {
      const payload = { client_id: clientId };
      if (endpoint === "spawn") payload.image = image.image;

      const response = await axios.post(`${API_URL}/${endpoint}`, payload);
      toast.success(response.data.message);

      if (endpoint === "spawn") setContainerId(response.data.container_id);
      if (endpoint === "destroy") setContainerId("");
    } catch (error) {
      toast.error(error.response?.data?.error || "Request failed");
    }
  };

  return (
    <div className="container mt-5">
      <ToastContainer />
      <h2 className="mb-4 text-center">Docker Container Manager</h2>

      <div className="card p-4 shadow-sm">
        {/* Client Input Form */}
        <ClientInput clientId={clientId} setClientId={setClientId} image={image} setImage={setImage} />

        {/* Container Actions (Buttons) */}
        <ContainerActions clientId={clientId} containerId={containerId} handleRequest={handleRequest} />

        {/* Container Status */}
        <ContainerStatus containerId={containerId} />
      </div>
    </div>
  );
}

export default App;