import React from "react";

function ContainerActions({ clientId, containerId, handleRequest, isAuthorized }) {
  return (
    <div className="d-flex gap-2">
      <button 
        className="btn btn-success" 
        onClick={() => handleRequest("spawn")} 
        disabled={!isAuthorized}
      >
        Spawn Container
      </button>

      <button 
        className="btn btn-warning" 
        onClick={() => handleRequest("restart")} 
        disabled={!containerId || !isAuthorized}
      >
        Restart
      </button>

      <button 
        className="btn btn-danger" 
        onClick={() => handleRequest("destroy")} 
        disabled={!containerId || !isAuthorized}
      >
        Destroy
      </button>
    </div>
  );
}

export default ContainerActions;