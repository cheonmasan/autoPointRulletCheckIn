const { app, BrowserWindow, ipcMain } = require('electron');
const { getConfig, initConfig } = require('./utils/config');
const { scheduleTasks } = require('./schedules/cron');
const { shuffle } = require('./utils/helpers');
const { scrape } = require('./services/scraper');
const { crawlSite0 } = require('./services/settlements/settlement0');
const { crawlSite1 } = require('./services/settlements/settlement1');
const { crawlSite2 } = require('./services/settlements/settlement2');
const { crawlSite3 } = require('./services/settlements/settlement3');
const { crawlSite4 } = require('./services/settlements/settlement4');
const { crawlSite5 } = require('./services/settlements/settlement5');
const { crawlSite6 } = require('./services/settlements/settlement6');
const path = require('path');
const { runCheckIn } = require('./core/checkin');
const { runPointMart } = require('./core/pointMart');
const { runRoulette } = require('./core/roulette');
const { runLotto } = require('./core/lotto');
const { runDetection } = require('./core/detection');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.on('did-finish-load', async () => {
        scheduleTasks(updateStatus);

        // 로또와 탐지 작업을 동시에 실행
        await Promise.all([
            (async () => {
                updateStatus('lotto', true);
                await runLotto();
                updateStatus('lotto', false);
            })(),
            (async () => {
                updateStatus('detection', true);
                await runDetection();
                updateStatus('detection', false);
            })()
        ]);
    });
}


function updateStatus(type, isRunning) {
    if (mainWindow) {
        mainWindow.webContents.send('status-update', { type, status: isRunning ? '✅' : '❌' });
    } else {
        console.warn(`⚠️ Main window is not ready. Cannot update status for: ${type}`);
    }
}

app.whenReady().then(async () => {
    createWindow();
    initConfig();
    const { ID_DATA1, ID_DATA2, ID_DATA3 } = getConfig();
    shuffle(ID_DATA1, 1);
    shuffle(ID_DATA2, 2);
    shuffle(ID_DATA3, 3);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// 출석 체크
ipcMain.handle('run-checkin', async () => {
    updateStatus('checkin', true);
    const result = await runCheckIn(92, 113);
    updateStatus('checkin', false);
    return result;
});

// 포인트 마트
ipcMain.handle('run-pointmart', async () => {
    updateStatus('pointmart', true);
    const result = await runPointMart();
    updateStatus('pointmart', false);
    return result;
});

// 룰렛
ipcMain.handle('run-roulette', async () => {
    updateStatus('roulette', true);
    const result = await runRoulette();
    updateStatus('roulette', false);
    return result;
});

// 로또
ipcMain.handle('run-lotto', async () => {
    updateStatus('lotto', true);
    const result = await runLotto();
    updateStatus('lotto', false);
    return result;
});

// 탐지
ipcMain.handle('run-detection', async () => {
    updateStatus('detection', true);
    const result = await runDetection();
    updateStatus('detection', false);
    return result;
});

// 활동왕 찾기 스크래핑
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

// 정산
ipcMain.handle('run-settlement0', async () => {
    const results = [];
    for (let i = 1; i <= 3; i++) {
        mainWindow.webContents.send('settlement-progress0', { current: i, total: 3 });
        const res = await crawlSite0(i);
        if (res) results.push(res);
    }
    return results;
});

ipcMain.handle('run-settlement1', async () => {
    const results = [];
    for (let i = 1; i <= 5; i++) {
        mainWindow.webContents.send('settlement-progress1', { current: i, total: 5 });
        const res = await crawlSite1(i);
        if (res) results.push(res);
    }
    return results;
});

ipcMain.handle('run-settlement2', async () => {
    const results = [];
    for (let i = 1; i <= 6; i++) {
        mainWindow.webContents.send('settlement-progress2', { current: i, total: 6 });
        const res = await crawlSite2(i);
        if (res) results.push(res);
    }
    return results;
});

ipcMain.handle('run-settlement3', async () => {
    const results = [];
    for (let i = 1; i <= 6; i++) {
        mainWindow.webContents.send('settlement-progress3', { current: i, total: 6 });
        const res = await crawlSite3(i);
        if (res) results.push(res);
    }
    return results;
});

ipcMain.handle('run-settlement4', async () => {
    const results = [];
    for (let i = 1; i <= 3; i++) {
        mainWindow.webContents.send('settlement-progress4', { current: i, total: 3 });
        const res = await crawlSite4(i);
        if (res) results.push(res);
    }
    return results;
});

ipcMain.handle('run-settlement5', async () => {
    const results = [];
    for (let i = 1; i <= 3; i++) {
        mainWindow.webContents.send('settlement-progress5', { current: i, total: 3 });
        const res = await crawlSite5(i);
        if (res) results.push(res);
    }
    return results;
});

ipcMain.handle('run-settlement6-zen', async () => {
    mainWindow.webContents.send('settlement-progress6-zen', { current: 1, total: 1 });
    const res = await crawlSite6(1);
    return res || [];
});

ipcMain.handle('run-settlement6-build', async () => {
    mainWindow.webContents.send('settlement-progress6-build', { current: 1, total: 1 });
    const res = await crawlSite6(2);
    return res || [];
});