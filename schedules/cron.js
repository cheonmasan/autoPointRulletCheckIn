const cron = require('node-cron');
const moment = require('moment-timezone');
const { runCheckIn } = require('../core/checkin');
const { runPointMart } = require('../core/pointMart');
const { runRoulette } = require('../core/roulette');
const { runDetection } = require('../core/detection');
const { runExchange } = require('../core/exchange');
const { checkinGetData } = require('../services/scraper');
const { sendMessage } = require('../services/telegram');
const { logger } = require('../utils/loggerHelper')
const { runSettlement0AndSend, runSettlement1AndSend, runSettlement2AndSend, runSettlement3AndSend, runSettlement4AndSend, runSettlement5AndSend, runSettlement6ZenAndSend, runSettlement6BuildAndSend } = require('../main');
const globalVars = require('../globalVariable'); // 전역 변수 가져오기

const scheduleTasks = (updateStatus) => {
    cron.schedule("*/30 * * * *", async () => {
        logger('checkin', `출석 globalVars.checkinIsRunning=${globalVars.checkinIsRunning} globalVars.checkinIsSend=${globalVars.checkinIsSend}`);
        logger('pointmart', `포인트 마트 globalVars.pointmartIsRunning=${globalVars.pointmartIsRunning} globalVars.pointmartIsSend=${globalVars.pointmartIsSend}`);

        globalVars.checkInCount = await checkinGetData();
        logger('checkin', `globalVars.checkInCount ${globalVars.checkInCount}`);

        if (globalVars.checkinIsRunning) {
            // 이미 실행 중
        } else {
            if (!globalVars.checkinIsSend && globalVars.checkInCount <= 80 && globalVars.checkInCount !== 0) {
                let time = parseInt(moment().tz("Asia/Seoul").format("HH"));
                logger('checkin', `시간 ${time}`);
                sendMessage("출석 매크로 고장!!!");
                globalVars.checkinIsSend = true;
                const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
                logger('checkin', `runCheckIn 매크로 시작 한국 시간: ${koreaTime}`);
                await new Promise((page) => setTimeout(page, 10000));
                updateStatus('checkin', true);
                runCheckIn(92, 113);
                updateStatus('checkin', false);
            }
        }

        if (globalVars.pointmartIsRunning) {
            // 이미 실행 중
        } else {
            if (!globalVars.pointmartIsSend) {
                let time = parseInt(moment().tz("Asia/Seoul").format("HH"));
                logger('pointmart', `시간 ${time}`);
                if (10 <= time && time < 19) {
                    sendMessage("포인트마트 매크로 고장!!!");
                    globalVars.pointmartIsSend = true;
                    const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
                    logger('pointmart', `runPointMart 매크로 시작 한국 시간: ${koreaTime}`);
                    await new Promise((page) => setTimeout(page, 10000));
                    updateStatus('pointmart', true);
                    runPointMart();
                    updateStatus('pointmart', false);
                }
            }
        }
    });

    cron.schedule("00 10 * * *", async () => {
        updateStatus('pointmart', true)
        await runPointMart();
        updateStatus('pointmart', false)
    });

    cron.schedule("00 02 * * *", async () => {
        updateStatus('roulette', true)
        await runRoulette();
        updateStatus('roulette', false)
    });

    cron.schedule("00 00 * * *", async () => {
        updateStatus('checkin', true)
        await runCheckIn(92, 113);
        updateStatus('checkin', false)
    });
    
    cron.schedule("*/5 * * * *", async () => {
        updateStatus('detection', true)
        await Promise.all([
            runExchange(),
            runDetection()
        ]);
        updateStatus('detection', false)
    });

    cron.schedule('15 00 * * *', async () => {
        await runSettlement0AndSend(true);
        await runSettlement1AndSend(true);
        await runSettlement2AndSend(true);
        await runSettlement3AndSend(true);
        await runSettlement4AndSend(true);
        await runSettlement5AndSend(true);
    });

    cron.schedule('15 00 1,16 * *', async () => {
        await runSettlement6ZenAndSend(true);
        await runSettlement6BuildAndSend(true);
    });
};

module.exports = { scheduleTasks };