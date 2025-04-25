// utils/loggerHelper.js

const { BrowserWindow } = require('electron');

// Electron GUI로 로그 전송
function sendLog(type, message) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('log', { type, message });
  }
}

// 콘솔로그 가로채서 GUI로 전달
function hookLogs(type) {
  const originalLog = console.log;
  console.log = (...args) => {
    const message = args.join(' ');
    sendLog(type, message);
    originalLog.apply(console, args);
  };
}

// 명시적으로 로그 전송
function logger(type, message) {
  sendLog(type, message);
}

module.exports = {
  hookLogs,
  logger
};
