const usedPorts = new Set();

function getUnusedPort(minPort, maxPort) {
    let port = 0;

    while (port === 0 || usedPorts.has(port)) {
        port = Math.floor(Math.random() * (maxPort - minPort + 1) + minPort);
    }

    usedPorts.add(port);

    return port;
}

function releasePort(port) {
    usedPorts.delete(port);
}

module.exports = { getUnusedPort, releasePort };
