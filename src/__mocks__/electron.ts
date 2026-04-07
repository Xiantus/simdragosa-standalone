// Mock electron module for Jest tests
const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
}

const ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  send: jest.fn(),
}

const app = {
  getPath: jest.fn((name: string) => {
    if (name === 'userData') return 'C:/mock/userData'
    return 'C:/mock/' + name
  }),
  on: jest.fn(),
  whenReady: jest.fn(() => Promise.resolve()),
  quit: jest.fn(),
  isPackaged: false,
}

const BrowserWindow = jest.fn().mockImplementation(() => ({
  loadFile: jest.fn(),
  on: jest.fn(),
  webContents: { send: jest.fn() },
}))

const contextBridge = {
  exposeInMainWorld: jest.fn(),
}

export { ipcMain, ipcRenderer, app, BrowserWindow, contextBridge }
export default { ipcMain, ipcRenderer, app, BrowserWindow, contextBridge }
