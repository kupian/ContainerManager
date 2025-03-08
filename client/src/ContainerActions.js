import React from "react";

function ContainerActions({ clientId, containerId, handleRequest }) {
  return (
    <div className="d-flex gap-2">
      <button className="btn btn-success" onClick={() => handleRequest("spawn")}>
        Spawn Container
      </button>

      <button className="btn btn-warning" onClick={() => handleRequest("restart")} disabled={!containerId}>
        Restart
      </button>

      <button className="btn btn-danger" onClick={() => handleRequest("destroy")} disabled={!containerId}>
        Destroy
      </button>
    </div>
  );
}

export default ContainerActions;