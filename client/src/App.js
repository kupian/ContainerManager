import React, { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ClientInput from "./ClientInput";
import ContainerActions from "./ContainerActions";
import ContainerStatus from "./ContainerStatus";

function App() {
  const [clientId, setClientId] = useState("");
  const [containerId, setContainerId] = useState("");
  const [ports, setPorts] = useState({});
  const [image, setImage] = useState("ubuntu");

  // Fetch existing container when Client ID is updated
  useEffect(() => {
    if (!clientId.trim()) {
      setContainerId("");
      setPorts({});
      return;
    }

    const fetchContainer = async () => {
      try {
        const response = await axios.post("/get", { client_id: clientId });
        console.log("Container data:", response.data);
        setContainerId(response.data.container_id);
        setPorts(response.data.ports || {});
      } catch (error) {
        console.error("Error fetching container:", error);
        setContainerId("");
        setPorts({});
      }
    };

    fetchContainer();
  }, [clientId]);

  // Handle API requests (spawn, restart, destroy)
  const handleRequest = async (endpoint) => {
    try {
      const payload = { client_id: clientId };
      if (endpoint === "spawn") payload.image = image.image;

      console.log(`Sending ${endpoint} request:`, payload);
      
      const response = await axios.post(`/${endpoint}`, payload);
      console.log(`${endpoint} response:`, response.data);
      
      toast.success(response.data.message);

      if (endpoint === "spawn") {
        setContainerId(response.data.container_id);
        setPorts(response.data.ports || {});
      } else if (endpoint === "restart") {
        setPorts(response.data.ports || {});
      } else if (endpoint === "destroy") {
        setContainerId("");
        setPorts({});
      }
    } catch (error) {
      console.error(`Error in ${endpoint}:`, error);
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
        <ContainerStatus containerId={containerId} ports={ports} />
      </div>
      Please reach out to Alexander C regarding any issues using this client.
    </div>
  );
}

export default App;