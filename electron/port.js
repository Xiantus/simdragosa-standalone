const net = require('net')

// Start at 40000 — safely below Windows dynamic port range (49152+)
// which is heavily used by system services like RPC.
function findFreePort(startPort = 40000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => {
      // Port in use, try next
      resolve(findFreePort(startPort + 1))
    })
    server.listen(startPort, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

module.exports = { findFreePort }
