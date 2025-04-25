const { app, BrowserWindow, ipcMain } = require('electron');
const { getConfig, initConfig } = require('./utils/config');
const { scheduleTasks } = require('./schedules/cron');
const { shuffle } = require('./utils/helpers');
const { hookLogs } = require('./utils/loggerHelper');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 1000,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  win.loadFile('index.html');
}

function updateStatus(type, isRunning) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('status-update', { type, status: isRunning ? '✅' : '❌' });
  }
}

app.whenReady().then(() => {
  createWindow();
  initConfig();
  const { ID_DATA1, ID_DATA2, ID_DATA3 } = getConfig();
  shuffle(ID_DATA1, 1);
  shuffle(ID_DATA2, 2);
  shuffle(ID_DATA3, 3);
  scheduleTasks(updateStatus);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('run-checkin', async () => {
  hookLogs('checkin');
  updateStatus('checkin', true);
  const { runCheckIn } = require('./core/checkin');
  const result = await runCheckIn(92, 113);
  updateStatus('checkin', false);
  return result;
});

ipcMain.handle('run-pointmart', async () => {
  hookLogs('pointmart');
  updateStatus('pointmart', true);
  const { runPointMart } = require('./core/pointMart');
  const result = await runPointMart();
  updateStatus('pointmart', false);
  return result;
});

ipcMain.handle('run-roulette', async () => {
  hookLogs('roulette');
  updateStatus('roulette', true);
  const { runRullet } = require('./core/roulette');
  const result = await runRullet();
  updateStatus('roulette', false);
  return result;
});