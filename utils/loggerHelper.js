const { BrowserWindow } = require('electron');

function sendLog(type, message) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('log', { type, message });
  }
}

// 사용자가 명시적으로 호출하는 전용 로거
function logger(type, message) {
  sendLog(type, message);
}

module.exports = {
  logger,
};
