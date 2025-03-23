import React from "react";

function ContainerStatus({ containerId, ports }) {
  // Use window.location.hostname to get the current server's IP/hostname
  const serverHostname = window.location.hostname;
  
  if (!containerId) {
    return (
      <div className="alert alert-secondary mt-3" role="alert">
        No container active. Enter a client ID and spawn a container.
      </div>
    );
  }
  
  return (
    <div className="mt-3">
      <div className="alert alert-success" role="alert">
        Container is active
      </div>
      <div className="card mt-2">
        <div className="card-header">Container Details</div>
        <div className="card-body">
          <p className="card-text"><strong>ID:</strong> {containerId.substring(0, 12)}...</p>
          
          {ports && Object.keys(ports).length > 0 ? (
            <div>
              <p className="card-text"><strong>Exposed Ports:</strong></p>
              <ul className="list-group">
                {Object.entries(ports).map(([containerPort, hostPort]) => (
                  <li key={containerPort} className="list-group-item">
                    Container port {containerPort} → Server port {hostPort}
                    {containerPort.includes('80/') || containerPort.includes('443/') || 
                     containerPort.includes('8080/') || containerPort.includes('3000/') ? (
                      <a 
                        href={`http://${serverHostname}:${hostPort}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-primary float-end"
                      >
                        Open
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
              
              <div className="alert alert-info mt-3">
                <h5>Connection Information</h5>
                <p>
                  <strong>Use the following format to connect:</strong><br/>
                  <code>{serverHostname}:PORT</code>
                </p>
                <p>
                  Replace PORT with the corresponding server port for the service you want to access.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="card-text text-warning">No exposed ports found. This may happen if:</p>
              <ul>
                <li>The container doesn't expose any ports</li>
                <li>The port information is not being correctly retrieved</li>
                <li>The container is still starting up</li>
              </ul>
              <button 
                className="btn btn-sm btn-info" 
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContainerStatus;