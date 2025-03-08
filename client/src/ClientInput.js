import React from "react";

function ClientInput({ clientId, setClientId, image, setImage }) {
  return (
    <div>
      <div className="mb-3">
        <label className="form-label">Client ID</label>
        <input
          type="text"
          className="form-control"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Enter client ID"
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Docker Image</label>
        <input
          type="text"
          className="form-control"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="Enter image (e.g., ubuntu, nginx)"
        />
      </div>
    </div>
  );
}

export default ClientInput;