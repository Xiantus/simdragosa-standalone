const http = require('http')
const net = require('net')

// Mock electron modules so we can import main.js in tests
jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    isQuiting: false,
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn()
  },
  BrowserWindow: jest.fn(),
  dialog: { showErrorBox: jest.fn() },
  ipcMain: { on: jest.fn() }
}))
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((key, def) => def),
    set: jest.fn()
  }))
})

const { waitForBackend, getBackendPath } = require('./main')

describe('waitForBackend', () => {
  test('resolves when backend responds 200', async () => {
    // Start a tiny HTTP server to simulate the backend
    const server = http.createServer((req, res) => {
      res.writeHead(200)
      res.end('ok')
    })
    await new Promise(r => server.listen(0, '127.0.0.1', r))
    const { port } = server.address()

    await expect(waitForBackend(port, 5000)).resolves.toBeUndefined()
    server.close()
  })

  test('rejects after timeout when backend never starts', async () => {
    // Use a port nothing is listening on
    const port = 19998
    await expect(waitForBackend(port, 500)).rejects.toThrow('Backend startup timeout')
  })
})
