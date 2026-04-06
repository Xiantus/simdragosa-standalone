const { contextBridge } = require('electron')

// PORT is injected by main process via process.env before preload runs
contextBridge.exposeInMainWorld('SIMDRAGOSA_PORT', parseInt(process.env.SIMDRAGOSA_PORT || '5000'))
