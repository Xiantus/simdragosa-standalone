import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../shared/ipc'

const api: ElectronAPI = {
  // Characters
  getCharacters: () => ipcRenderer.invoke('getCharacters'),
  upsertCharacter: (char) => ipcRenderer.invoke('upsertCharacter', char),
  deleteCharacter: (id) => ipcRenderer.invoke('deleteCharacter', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('getSettings'),
  saveSettings: (partial) => ipcRenderer.invoke('saveSettings', partial),
  getJobResults: () => ipcRenderer.invoke('getJobResults'),
  deleteResult: (char_id, difficulty, build_label, char_name, spec) => ipcRenderer.invoke('deleteResult', char_id, difficulty, build_label, char_name, spec),
  fetchItemNames: (itemIds) => ipcRenderer.invoke('fetchItemNames', itemIds),
  writeLua: () => ipcRenderer.invoke('writeLua'),

  // Sim
  startSim: (selections) => ipcRenderer.invoke('startSim', selections),
  cancelJobs: () => ipcRenderer.invoke('cancelJobs'),
  exportLua: () => ipcRenderer.invoke('exportLua'),

  // Playwright
  installPlaywright: () => ipcRenderer.invoke('installPlaywright'),
  isPlaywrightInstalled: () => ipcRenderer.invoke('isPlaywrightInstalled'),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('checkForUpdates'),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Overlay mode
  getOverlayMode: () => ipcRenderer.invoke('getOverlayMode'),
  setOverlayMode: (enabled: boolean) => ipcRenderer.invoke('setOverlayMode', enabled),
  onOverlayChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, enabled: boolean) => callback(enabled)
    ipcRenderer.on('overlay:changed', handler)
    return () => ipcRenderer.off('overlay:changed', handler)
  },

  // Push events (main → renderer)
  onJobUpdate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, update: any) => callback(update)
    ipcRenderer.on('job:update', handler)
    return () => ipcRenderer.off('job:update', handler)
  },
  onJobDone: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, done: any) => callback(done)
    ipcRenderer.on('job:done', handler)
    return () => ipcRenderer.off('job:done', handler)
  },
  onJobError: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, err: any) => callback(err)
    ipcRenderer.on('job:error', handler)
    return () => ipcRenderer.off('job:error', handler)
  },
  onPlaywrightProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: any) => callback(progress)
    ipcRenderer.on('playwright:progress', handler)
    return () => ipcRenderer.off('playwright:progress', handler)
  },
  onUpdateReady: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('update:ready', handler)
    return () => ipcRenderer.off('update:ready', handler)
  },
  restartAndUpdate: () => ipcRenderer.send('update:restart'),

  onSimcExport: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: any) => callback(entry)
    ipcRenderer.on('simc:export', handler)
    return () => ipcRenderer.off('simc:export', handler)
  },
  dismissSimcExport: (charKey, timestamp) => ipcRenderer.send('simc:dismiss', charKey, timestamp),
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('platform', process.platform)
