const { app, BrowserWindow, ipcMain } = require('electron');
const { getConfig, initConfig } = require('./utils/config');
const { scheduleTasks } = require('./schedules/cron');
const { shuffle } = require('./utils/helpers');
const { hookLogs } = require('./utils/loggerHelper');
const { scrape } = require('./services/scraper');
const path = require('path');

let mainWindow; // ✅ 전역으로 선언

function createWindow() {
  mainWindow = new BrowserWindow({ // ✅ 여기서 mainWindow로 직접 할당
    width: 800,
    height: 1080,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  mainWindow.loadFile('index.html');
}

function updateStatus(type, isRunning) {
  if (mainWindow) {
    mainWindow.webContents.send('status-update', { type, status: isRunning ? '✅' : '❌' });
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

// ✅ 출석 체크
ipcMain.handle('run-checkin', async () => {
  hookLogs('checkin');
  updateStatus('checkin', true);
  const { runCheckIn } = require('./core/checkin');
  const result = await runCheckIn(92, 113);
  updateStatus('checkin', false);
  return result;
});

// ✅ 포인트 마트
ipcMain.handle('run-pointmart', async () => {
  hookLogs('pointmart');
  updateStatus('pointmart', true);
  const { runPointMart } = require('./core/pointMart');
  const result = await runPointMart();
  updateStatus('pointmart', false);
  return result;
});

// ✅ 룰렛
ipcMain.handle('run-roulette', async () => {
  hookLogs('roulette');
  updateStatus('roulette', true);
  const { runRullet } = require('./core/roulette');
  const result = await runRullet();
  updateStatus('roulette', false);
  return result;
});

// ✅ 활동왕 찾기 스크래핑
ipcMain.on('start-scrape', async (event, { startDate, endDate }) => {
  try {
    const results = await scrape(startDate, endDate, (progress) => {
      mainWindow.webContents.send('scrape-progress', progress);
    });
    mainWindow.webContents.send('scrape-results', results);
  } catch (error) {
    console.error('Scrape error:', error);
    mainWindow.webContents.send('scrape-error', error.message);
  }
});
