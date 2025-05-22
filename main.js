const { app, BrowserWindow, ipcMain } = require('electron');
const { getConfig, initConfig } = require('./utils/config');
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
const { runEvent } = require('./core/event');
const { runDetection } = require('./core/detection');
const { runCreatePost } = require('./core/createPost');
const { runExchange } = require('./core/exchange');

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
}

ipcMain.on('renderer-ready', () => {
    const { scheduleTasks } = require('./schedules/cron');
    scheduleTasks(updateStatus);
    Promise.all([
        (async () => {
            updateStatus('exchange', true);
            await runExchange();
            updateStatus('exchange', false);
        })(),
        (async () => {
            updateStatus('detection', true);
            await runDetection();
            updateStatus('detection', false);
        })()
    ]);
});


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

// 이벤트
ipcMain.handle('run-event', async () => {
    updateStatus('event', true);
    const [result1, result2, result3, result4] = await Promise.all([
        runEvent('https://onairslot.com/bbs/board.php?bo_table=event&wr_id=636', 'lotto'),
        runEvent('https://onairslot.com/bbs/board.php?bo_table=event&wr_id=797', 'slotjackpot'),
        runEvent('https://onairslot.com/bbs/board.php?bo_table=event&wr_id=820', 'movieking'),
        runEvent('https://onairslot.com/bbs/board.php?bo_table=event&wr_id=747', 'actionking')
    ]);
    updateStatus('event', false);
    return result;
});

// 탐지
ipcMain.handle('run-detection', async () => {
    updateStatus('detection', true);
    const result = await runDetection();
    updateStatus('detection', false);
    return result;
});

// 포스트 생성
ipcMain.handle('run-createpost', async () => {
    updateStatus('createpost', true);
    const result = await runCreatePost();
    updateStatus('createpost', false);
    return result;
});

// 환율 조회
ipcMain.handle('run-exchange', async () => {
    try {
        updateStatus('exchange', true);
        const rates = await runExchange();
        mainWindow.webContents.send('exchange-progress', { status: 'success', rates });
        updateStatus('exchange', false);
        return rates;
    } catch (error) {
        updateStatus('exchange', false);
        mainWindow.webContents.send('exchange-progress', { status: 'error', message: error.message });
        throw error;
    }
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

async function runSettlement0AndSend(isAuto) {
    const results = [];
    for (let i = 1; i <= 3; i++) {
        mainWindow.webContents.send('settlement-progress0', { current: i, total: 3 });
        const res = await crawlSite0(i);
        if (res) results.push(res);
    }
    if (isAuto) {
        // 자동 실행(크론 등)에서는 send로만 전달
        mainWindow.webContents.send('settlement0-result', results);
        return; // return 값 없음
    } else {
        // 버튼 클릭(렌더러 invoke) 시에는 return 값만 전달
        return results;
    }
}
ipcMain.handle('run-settlement0', async () => {
    return await runSettlement0AndSend(false);
});

ipcMain.handle('run-settlement0-lava', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress0', { current: 1, total: 1 });
    const res = await crawlSite0(1);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement0-named', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress0', { current: 1, total: 1 });
    const res = await crawlSite0(2);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement0-pandora', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress0', { current: 1, total: 1 });
    const res = await crawlSite0(3);
    if (res) results.push(res);
    return results;
});

async function runSettlement1AndSend(isAuto) {
    const results = [];
    for (let i = 1; i <= 5; i++) {
        mainWindow.webContents.send('settlement-progress1', { current: i, total: 5 });
        const res = await crawlSite1(i);
        if (res) results.push(res);
    }
    if (isAuto) {
        // 자동 실행(크론 등)에서는 send로만 전달
        mainWindow.webContents.send('settlement1-result', results);
        return; // return 값 없음
    } else {
        // 버튼 클릭(렌더러 invoke) 시에는 return 값만 전달
        return results;
    }
}
ipcMain.handle('run-settlement1', async () => {
    return await runSettlement1AndSend(false);
});

ipcMain.handle('run-settlement1-nimo', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress1', { current: 1, total: 1 });
    const res = await crawlSite1(1);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement1-bankcs', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress1', { current: 1, total: 1 });
    const res = await crawlSite1(2);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement1-bankking', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress1', { current: 1, total: 1 });
    const res = await crawlSite1(3);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement1-heavencs', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress1', { current: 1, total: 1 });
    const res = await crawlSite1(4);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement1-heavenking', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress1', { current: 1, total: 1 });
    const res = await crawlSite1(5);
    if (res) results.push(res);
    return results;
});

async function runSettlement2AndSend(isAuto) {
    const results = [];
    for (let i = 1; i <= 6; i++) {
        mainWindow.webContents.send('settlement-progress2', { current: i, total: 6 });
        const res = await crawlSite2(i);
        if (res) results.push(res);
    }
    if (isAuto) {
        // 자동 실행(크론 등)에서는 send로만 전달
        mainWindow.webContents.send('settlement2-result', results);
        return; // return 값 없음
    } else {
        // 버튼 클릭(렌더러 invoke) 시에는 return 값만 전달
        return results;
    }
}
ipcMain.handle('run-settlement2', async () => {
    return await runSettlement2AndSend(false);
});

ipcMain.handle('run-settlement2-samsung', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress2', { current: 1, total: 1 });
    const res = await crawlSite2(1);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement2-seven', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress2', { current: 1, total: 1 });
    const res = await crawlSite2(2);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement2-hyungjae', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress2', { current: 1, total: 1 });
    const res = await crawlSite2(3);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement2-nimo', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress2', { current: 1, total: 1 });
    const res = await crawlSite2(4);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement2-kkobuki', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress2', { current: 1, total: 1 });
    const res = await crawlSite2(5);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement2-hawaii', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress2', { current: 1, total: 1 });
    const res = await crawlSite2(6);
    if (res) results.push(res);
    return results;
});

async function runSettlement3AndSend(isAuto) {
    const results = [];
    for (let i = 1; i <= 6; i++) {
        mainWindow.webContents.send('settlement-progress3', { current: i, total: 6 });
        const res = await crawlSite3(i);
        if (res) results.push(res);
    }
    if (isAuto) {
        // 자동 실행(크론 등)에서는 send로만 전달
        mainWindow.webContents.send('settlement3-result', results);
        return; // return 값 없음
    } else {
        // 버튼 클릭(렌더러 invoke) 시에는 return 값만 전달
        return results;
    }
}
ipcMain.handle('run-settlement3', async () => {
    return await runSettlement3AndSend(false);
});

ipcMain.handle('run-settlement3-kkobuki', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress3', { current: 1, total: 1 });
    const res = await crawlSite3(1);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement3-nimo', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress3', { current: 1, total: 1 });
    const res = await crawlSite3(2);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement3-hyungjae', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress3', { current: 1, total: 1 });
    const res = await crawlSite3(3);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement3-hawaii', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress3', { current: 1, total: 1 });
    const res = await crawlSite3(4);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement3-samsung', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress3', { current: 1, total: 1 });
    const res = await crawlSite3(5);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement3-seven', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress3', { current: 1, total: 1 });
    const res = await crawlSite3(6);
    if (res) results.push(res);
    return results;
});

async function runSettlement4AndSend(isAuto) {
    const results = [];
    for (let i = 1; i <= 3; i++) {
        mainWindow.webContents.send('settlement-progress4', { current: i, total: 3 });
        const res = await crawlSite4(i);
        if (res) results.push(res);
    }
    if (isAuto) {
        // 자동 실행(크론 등)에서는 send로만 전달
        mainWindow.webContents.send('settlement4-result', results);
        return; // return 값 없음
    } else {
        // 버튼 클릭(렌더러 invoke) 시에는 return 값만 전달
        return results;
    }
}
ipcMain.handle('run-settlement4', async () => {
    return await runSettlement4AndSend(false);
});

ipcMain.handle('run-settlement4-build', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress4', { current: 1, total: 1 });
    const res = await crawlSite4(1);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement4-play', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress4', { current: 1, total: 1 });
    const res = await crawlSite4(2);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement4-zen', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress4', { current: 1, total: 1 });
    const res = await crawlSite4(3);
    if (res) results.push(res);
    return results;
});

async function runSettlement5AndSend(isAuto) {
    const results = [];
    for (let i = 1; i <= 3; i++) {
        mainWindow.webContents.send('settlement-progress5', { current: i, total: 3 });
        const res = await crawlSite5(i);
        if (res) results.push(res);
    }
    if (isAuto) {
        // 자동 실행(크론 등)에서는 send로만 전달
        mainWindow.webContents.send('settlement5-result', results);
        return; // return 값 없음
    } else {
        // 버튼 클릭(렌더러 invoke) 시에는 return 값만 전달
        return results;
    }
}

ipcMain.handle('run-settlement5', async () => {
    return await runSettlement5AndSend(false);
});

ipcMain.handle('run-settlement5-kkobuki', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress5', { current: 1, total: 1 });
    const res = await crawlSite5(1);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement5-nimo', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress5', { current: 1, total: 1 });
    const res = await crawlSite5(2);
    if (res) results.push(res);
    return results;
});

ipcMain.handle('run-settlement5-hyungjae', async () => {
    const results = [];
    mainWindow.webContents.send('settlement-progress5', { current: 1, total: 1 });
    const res = await crawlSite5(3);
    if (res) results.push(res);
    return results;
});

async function runSettlement6ZenAndSend(isAuto) {
    mainWindow.webContents.send('settlement-progress6-zen', { current: 1, total: 1 });
    const res = await crawlSite6(1);
    if (isAuto) {
        // 자동 실행(크론 등)에서는 send로만 전달
        mainWindow.webContents.send('settlement6-zen-result', res ? [res] : []);
        return; // return 값 없음
    } else {
        // 버튼 클릭(렌더러 invoke) 시에는 return 값만 전달
        return res || [];
    }
}
ipcMain.handle('run-settlement6-zen', async () => {
    return await runSettlement6ZenAndSend(false);
});

async function runSettlement6BuildAndSend(isAuto) {
    mainWindow.webContents.send('settlement-progress6-build', { current: 1, total: 1 });
    const res = await crawlSite6(2);
    if (isAuto) {
        // 자동 실행(크론 등)에서는 send로만 전달
        mainWindow.webContents.send('settlement6-build-result', res ? [res] : []);
        return; // return 값 없음
    } else {
        // 버튼 클릭(렌더러 invoke) 시에는 return 값만 전달
        return res || [];
    }
}
ipcMain.handle('run-settlement6-build', async () => {
    return await runSettlement6BuildAndSend(false);
});

module.exports = {
    runSettlement0AndSend,
    runSettlement1AndSend,
    runSettlement2AndSend,
    runSettlement3AndSend,
    runSettlement4AndSend,
    runSettlement5AndSend,
    runSettlement6ZenAndSend,
    runSettlement6BuildAndSend
};