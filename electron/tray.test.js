jest.mock('./updater', () => ({
  checkForUpdatesManually: jest.fn()
}))
jest.mock('electron', () => ({
  Tray: jest.fn().mockImplementation(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
  })),
  Menu: {
    buildFromTemplate: jest.fn().mockReturnValue({})
  },
  nativeImage: {
    createFromPath: jest.fn().mockReturnValue({
      resize: jest.fn().mockReturnValue({})
    })
  },
  app: { isQuiting: false, quit: jest.fn() }
}))

const { createTray, destroyTray } = require('./tray')

describe('createTray', () => {
  const mockWindow = {
    isVisible: jest.fn().mockReturnValue(true),
    isAlwaysOnTop: jest.fn().mockReturnValue(false),
    hide: jest.fn(),
    show: jest.fn(),
    setAlwaysOnTop: jest.fn()
  }
  const mockStore = { get: jest.fn(), set: jest.fn() }
  const mockApp = { isQuiting: false, quit: jest.fn() }

  test('creates a tray instance', () => {
    const { Tray } = require('electron')
    createTray(mockWindow, mockStore, mockApp)
    expect(Tray).toHaveBeenCalled()
  })

  test('destroyTray cleans up without error', () => {
    createTray(mockWindow, mockStore, mockApp)
    expect(() => destroyTray()).not.toThrow()
  })
})
