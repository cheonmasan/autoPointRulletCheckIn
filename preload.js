const { contextBridge, ipcRenderer } = require('electron');

// contextBridge.exposeInMainWorld('electronAPI', {
//   runCheckIn: () => ipcRenderer.invoke('run-checkin'),
//   runPointMart: () => ipcRenderer.invoke('run-pointmart'),
//   runRoulette: () => ipcRenderer.invoke('run-roulette'),
//   onLog: (callback) => ipcRenderer.on('log', (_event, data) => callback(data.type, data.message)),
//   onStatusUpdate: (callback) => ipcRenderer.on('status-update', (_event, data) => callback(data.type, data.status)),
// });

contextBridge.exposeInMainWorld('electronAPI', {
  // 출석 체크
  runCheckIn: () => ipcRenderer.invoke('run-checkin'),
  runPointMart: () => ipcRenderer.invoke('run-pointmart'),
  runRoulette: () => ipcRenderer.invoke('run-roulette'),

  // 로그 찍기
  onLog: (callback) => ipcRenderer.on('log', (_event, data) => callback(data.type, data.message)),

  // 상태 업데이트 (✅, ❌)
  onStatusUpdate: (callback) => ipcRenderer.on('status-update', (event, { type, status }) => callback(type, status)),
  // 🔥 활동왕 스크랩용 추가
  onScrapeProgress: (callback) => ipcRenderer.on('scrape-progress', (_event, data) => callback(data)),
  onScrapeResults: (callback) => ipcRenderer.on('scrape-results', (_event, results) => callback(results)),
  onScrapeError: (callback) => ipcRenderer.on('scrape-error', (_event, error) => callback(error)),
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
});