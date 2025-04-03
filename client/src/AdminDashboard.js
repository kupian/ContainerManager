import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Modal, Button, Form } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

function AdminDashboard({ onLogout }) {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("containers");
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchContainers = async () => {
      try {
        const response = await axios.get("/api/admin/containers", { withCredentials: true });
        setContainers(response.data.containers);
      } catch (error) {
        console.error("Error fetching containers:", error);
        if (error.response?.status === 401) {
          toast.error("Authentication required");
          handleLogout();
        } else {
          toast.error("Failed to load containers");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchContainers();
    
    // Set up auto-refresh every 10 seconds
    const intervalId = setInterval(() => {
      fetchContainers();
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, [refreshTrigger]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (activeTab === "users") {
        try {
          const response = await axios.get("/api/admin/users", { withCredentials: true });
          setUsers(response.data.users);
          setAdmins(response.data.admins);
        } catch (error) {
          console.error("Error fetching users:", error);
          toast.error("Failed to load users");
        }
      }
    };

    fetchUsers();
  }, [activeTab, refreshTrigger]);

  const handleContainerAction = async (clientId, action) => {
    try {
      await axios.post(`/api/admin/container/${clientId}/action`, { action }, { withCredentials: true });
      toast.success(`Container ${action} operation successful`);
      // Refresh containers list
      setRefreshTrigger(prevTrigger => prevTrigger + 1);
    } catch (error) {
      console.error(`Error performing ${action} action:`, error);
      toast.error(`Failed to ${action} container: ${error.response?.data?.error || "Unknown error"}`);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/admin/logout", {}, { withCredentials: true });
      toast.success("Logged out successfully");
      onLogout();
      navigate('/admin');
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");
    }
  };

  const handleAddUser = async () => {
    if (!newUsername.trim()) {
      toast.error("Username is required");
      return;
    }

    try {
      await axios.post("/api/admin/users", { 
        username: newUsername,
        is_admin: isAdmin
      }, { withCredentials: true });
      
      toast.success(`User ${newUsername} added successfully`);
      setShowAddUserModal(false);
      setNewUsername("");
      setIsAdmin(false);
      // Refresh users list
      setRefreshTrigger(prevTrigger => prevTrigger + 1);
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error(error.response?.data?.error || "Failed to add user");
    }
  };

  const handleDeleteUser = async (username) => {
    if (window.confirm(`Are you sure you want to delete user ${username}?`)) {
      try {
        await axios.delete(`/api/admin/users/${username}`, { withCredentials: true });
        toast.success(`User ${username} deleted successfully`);
        // Refresh users list
        setRefreshTrigger(prevTrigger => prevTrigger + 1);
      } catch (error) {
        console.error("Error deleting user:", error);
        toast.error(error.response?.data?.error || "Failed to delete user");
      }
    }
  };

  const goToUserDashboard = () => {
    navigate('/');
  };

  return (
    <div className="admin-dashboard">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Admin Dashboard</h2>
        <div>
          <button className="btn btn-secondary me-2" onClick={goToUserDashboard}>
            Go to User Dashboard
          </button>
          <button className="btn btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === "containers" ? "active" : ""}`} 
            onClick={() => setActiveTab("containers")}
          >
            Containers
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === "users" ? "active" : ""}`} 
            onClick={() => setActiveTab("users")}
          >
            User Management
          </button>
        </li>
      </ul>

      {activeTab === "containers" && (
        <div>
          <div className="mb-3">
            <button 
              className="btn btn-primary mb-3"
              onClick={() => setRefreshTrigger(prevTrigger => prevTrigger + 1)}
            >
              Refresh Data
            </button>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">Loading containers...</p>
            </div>
          ) : containers.length === 0 ? (
            <div className="alert alert-info">No containers found</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>Image</th>
                    <th>Status</th>
                    <th>Container ID</th>
                    <th>Ports</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {containers.map((container) => (
                    <tr key={container.container_id}>
                      <td>{container.client_id}</td>
                      <td>{container.image}</td>
                      <td>
                        <span className={`badge ${
                          container.status === "running" 
                            ? "bg-success" 
                            : container.status === "exited" 
                              ? "bg-danger" 
                              : "bg-warning"
                        }`}>
                          {container.status}
                        </span>
                      </td>
                      <td>{container.container_id.substring(0, 12)}</td>
                      <td>
                        {Object.entries(container.ports).length > 0 ? (
                          <ul className="list-unstyled mb-0">
                            {Object.entries(container.ports).map(([containerPort, hostPort]) => (
                              <li key={containerPort}>{containerPort} → {hostPort}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted">No ports mapped</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-2">
                          {container.status === "running" && (
                            <>
                              <button 
                                className="btn btn-warning btn-sm"
                                onClick={() => handleContainerAction(container.client_id, "restart")}
                              >
                                Restart
                              </button>
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleContainerAction(container.client_id, "stop")}
                              >
                                Stop
                              </button>
                            </>
                          )}
                          {container.status === "exited" && (
                            <button 
                              className="btn btn-success btn-sm"
                              onClick={() => handleContainerAction(container.client_id, "start")}
                            >
                              Start
                            </button>
                          )}
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleContainerAction(container.client_id, "destroy")}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "users" && (
        <div>
          <div className="mb-3">
            <button 
              className="btn btn-primary mb-3"
              onClick={() => setShowAddUserModal(true)}
            >
              Add New User
            </button>
          </div>

          <table className="table table-striped table-bordered">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((username) => (
                <tr key={username}>
                  <td>{username}</td>
                  <td>
                    {admins.includes(username) ? (
                      <span className="badge bg-danger">Admin</span>
                    ) : (
                      <span className="badge bg-info">User</span>
                    )}
                  </td>
                  <td>
                    {username !== "admin" && (
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteUser(username)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      <Modal show={showAddUserModal} onHide={() => setShowAddUserModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add New User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter username"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Grant admin privileges"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddUserModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddUser}>
            Add User
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default AdminDashboard;