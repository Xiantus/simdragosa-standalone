const http = require('http')

jest.mock('electron', () => ({
  app: { isPackaged: false, isQuiting: false, whenReady: jest.fn(() => Promise.resolve()), on: jest.fn(), quit: jest.fn() },
  BrowserWindow: jest.fn(),
  dialog: { showErrorBox: jest.fn() },
  ipcMain: { on: jest.fn() }
}))
jest.mock('electron-store', () => jest.fn().mockImplementation(() => ({
  get: jest.fn((key, def) => def),
  set: jest.fn()
})))
jest.mock('./tray', () => ({ createTray: jest.fn(), destroyTray: jest.fn() }))
jest.mock('./updater', () => ({ setupAutoUpdater: jest.fn(), checkForUpdatesManually: jest.fn() }))

const { waitForBackend, findPython } = require('./main')

describe('waitForBackend', () => {
  test('resolves when backend responds 200', async () => {
    const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok') })
    await new Promise(r => server.listen(0, '127.0.0.1', r))
    const { port } = server.address()
    await expect(waitForBackend(port, 5000)).resolves.toBeUndefined()
    server.close()
  })

  test('rejects after timeout when backend never starts', async () => {
    await expect(waitForBackend(19998, 500)).rejects.toThrow('Backend startup timeout')
  })
})

describe('findPython', () => {
  test('returns a non-empty string for the python executable', () => {
    // CI always has python available (py, python3, or python)
    const result = findPython()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
