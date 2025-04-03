import React, { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ClientInput from "./ClientInput";
import ContainerActions from "./ContainerActions";
import ContainerStatus from "./ContainerStatus";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import AuthService from "./services/AuthService";

function UserDashboard() {
  const [clientId, setClientId] = useState("");
  const [containerId, setContainerId] = useState("");
  const [ports, setPorts] = useState({});
  const [image, setImage] = useState("ubuntu");
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Check if client ID is authorized when it changes
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!clientId.trim()) {
        setIsAuthorized(false);
        setContainerId("");
        setPorts({});
        return;
      }

      try {
        const authResult = await AuthService.verifyUser(clientId);
        setIsAuthorized(authResult.valid);
        
        if (authResult.valid) {
          fetchContainer();
        }
      } catch (error) {
        console.error("Error checking authorization:", error);
        setIsAuthorized(false);
      }
    };

    checkAuthorization();
  }, [clientId]);

  // Fetch existing container when authorized
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

  // Handle API requests (spawn, restart, destroy)
  const handleRequest = async (endpoint) => {
    if (!isAuthorized) {
      toast.error("Unauthorized client ID");
      return;
    }

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
    <div className="card p-4 shadow-sm">
      {/* Client Input Form */}
      <ClientInput 
        clientId={clientId} 
        setClientId={setClientId} 
        image={image} 
        setImage={setImage} 
        isAuthorized={isAuthorized}
      />

      {/* Authorization Warning */}
      {clientId && !isAuthorized && (
        <div className="alert alert-danger mb-3">
          This client ID is not authorized to spawn containers.
        </div>
      )}

      {/* Container Actions (Buttons) */}
      <ContainerActions 
        clientId={clientId} 
        containerId={containerId} 
        handleRequest={handleRequest}
        isAuthorized={isAuthorized}
      />

      {/* Container Status */}
      <ContainerStatus containerId={containerId} ports={ports} />
    </div>
  );
}

function AdminRoute({ element, adminLoggedIn }) {
  return adminLoggedIn ? element : <Navigate to="/admin" replace />;
}

function App() {
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  
  const handleAdminLogin = () => {
    setAdminLoggedIn(true);
  };

  const handleAdminLogout = () => {
    setAdminLoggedIn(false);
  };

  return (
    <Router>
      <div className="container mt-5">
        <ToastContainer />
        <h2 className="mb-4 text-center">Docker Container Manager</h2>

        <Routes>
          <Route path="/" element={<UserDashboard />} />
          <Route path="/admin" element={
            <AdminLogin onLoginSuccess={handleAdminLogin} />
          } />
          <Route path="/admin/dashboard" element={
            <AdminRoute 
              element={<AdminDashboard onLogout={handleAdminLogout} />} 
              adminLoggedIn={adminLoggedIn} 
            />
          } />
        </Routes>

        <div className="mt-3 text-center text-muted">
          Please reach out to Alexander C regarding any issues using this client.
        </div>
      </div>
    </Router>
  );
}

export default App;