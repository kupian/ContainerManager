import React from "react";
import AsyncSelect from 'react-select/async';

const loadOptions = async (inputValue) => {
  try {
    const response = await fetch(
      `/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({"image": inputValue})
      });
    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error loading images:', error);
    return [];
  }
};

function ClientInput({ clientId, setClientId, image, setImage, isAuthorized }) {
  return (
    <div>
      <div className="mb-3">
        <label className="form-label">Client ID</label>
        <input
          type="text"
          className={`form-control ${clientId && !isAuthorized ? "is-invalid" : clientId && isAuthorized ? "is-valid" : ""}`}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Enter client ID"
        />
        {clientId && isAuthorized && (
          <div className="valid-feedback">
            This client ID is authorized
          </div>
        )}
        {clientId && !isAuthorized && (
          <div className="invalid-feedback">
            This client ID is not authorized
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label">Docker Image</label>
        
        <AsyncSelect
         loadOptions={loadOptions}
         value={image}
         isSearchable
         loadingMessage={() => "Searching..."}
         noOptionsMessage={({inputValue}) => 
          inputValue ? `No images found for ${inputValue}` : "Search by challenge name..."
        }
         onChange={(option) => setImage(option)}
         placeholder="Select an image..."
         isDisabled={!isAuthorized}
         />
      </div>
    </div>
  );
}

export default ClientInput;