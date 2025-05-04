const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  runCheckIn: () => ipcRenderer.invoke('run-checkin'),
  runPointMart: () => ipcRenderer.invoke('run-pointmart'),
  runRoulette: () => ipcRenderer.invoke('run-roulette'),
  onLog: (callback) => ipcRenderer.on('log', (_event, data) => callback(data.type, data.message)),
  onStatusUpdate: (callback) => ipcRenderer.on('status-update', (event, { type, status }) => callback(type, status)),
  onScrapeProgress: (callback) => ipcRenderer.on('scrape-progress', (_event, data) => callback(data)),
  onScrapeResults: (callback) => ipcRenderer.on('scrape-results', (_event, results) => callback(results)),
  onScrapeError: (callback) => ipcRenderer.on('scrape-error', (_event, error) => callback(error)),
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
  runSettlement1: () => ipcRenderer.invoke('run-settlement1'),
  runSettlement2: () => ipcRenderer.invoke('run-settlement2'),
  runSettlement3: () => ipcRenderer.invoke('run-settlement3'),
  runSettlement4: () => ipcRenderer.invoke('run-settlement4'),
  runSettlement5: () => ipcRenderer.invoke('run-settlement5'),
  onSettlementProgress1: (callback) => ipcRenderer.on('settlement-progress1', (_event, data) => callback(data)),
  onSettlementProgress2: (callback) => ipcRenderer.on('settlement-progress2', (_event, data) => callback(data)),
  onSettlementProgress3: (callback) => ipcRenderer.on('settlement-progress3', (_event, data) => callback(data)),
  onSettlementProgress4: (callback) => ipcRenderer.on('settlement-progress4', (_event, data) => callback(data)),
  onSettlementProgress5: (callback) => ipcRenderer.on('settlement-progress5', (_event, data) => callback(data))
});