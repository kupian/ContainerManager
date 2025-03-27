import React from "react";
import AsyncSelect from 'react-select/async';
import { API_URL } from "./config";

const loadOptions = async (inputValue) => {
  try {
    const response = await fetch(
      `${API_URL}/search`, {
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
         />
      </div>
    </div>
  );
}

export default ClientInput;