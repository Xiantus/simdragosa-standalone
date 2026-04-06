const net = require('net')

function findFreePort(startPort = 49152) {
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
