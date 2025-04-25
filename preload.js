const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  runCheckIn: () => ipcRenderer.invoke('run-checkin'),
  runPointMart: () => ipcRenderer.invoke('run-pointmart'),
  runRoulette: () => ipcRenderer.invoke('run-roulette'),
  onLog: (callback) => ipcRenderer.on('log', (_event, data) => callback(data.type, data.message)),
  onStatusUpdate: (callback) => ipcRenderer.on('status-update', (_event, data) => callback(data.type, data.status)),
});
