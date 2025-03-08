import React from "react";

function ContainerStatus({ containerId }) {
  return (
    containerId && (
      <div className="alert alert-info mt-3">
        Container ID: <strong>{containerId}</strong>
      </div>
    )
  );
}

export default ContainerStatus;