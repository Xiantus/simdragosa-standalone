jest.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: jest.fn(),
    checkForUpdates: jest.fn().mockResolvedValue({}),
    quitAndInstall: jest.fn()
  }
}))

jest.mock('electron', () => ({
  dialog: {
    showMessageBox: jest.fn().mockResolvedValue({ response: 1 }),
    showErrorBox: jest.fn()
  },
  app: { isPackaged: false, quit: jest.fn() }
}))

const { setupAutoUpdater, checkForUpdatesManually } = require('./updater')

describe('setupAutoUpdater', () => {
  test('registers event handlers without throwing', () => {
    const mockWindow = {}
    expect(() => setupAutoUpdater(mockWindow)).not.toThrow()
  })

  test('sets autoDownload to true', () => {
    const { autoUpdater } = require('electron-updater')
    const mockWindow = {}
    setupAutoUpdater(mockWindow)
    expect(autoUpdater.autoDownload).toBe(true)
  })
})

describe('checkForUpdatesManually', () => {
  test('shows dev mode dialog when not packaged', () => {
    const { dialog } = require('electron')
    checkForUpdatesManually({})
    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: 'Dev Mode' })
    )
  })
})
