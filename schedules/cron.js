const cron = require('node-cron');
const moment = require('moment-timezone');
const { runCheckIn } = require('../core/checkin');
const { runPointMart } = require('../core/pointMart');
const { runRoulette } = require('../core/roulette');
const { runDetection } = require('../core/detection');
const { checkinGetData } = require('../services/scraper');
const { sendMessage } = require('../services/telegram');
const { logger } = require('../utils/loggerHelper')

global.running = false;
global.isSend = false;
global.running1 = false;
global.isSend1 = false;

const scheduleTasks = (updateStatus) => {
    cron.schedule("*/30 * * * *", async () => {
        logger('checkin', `출석 global.running=${global.running} global.isSend=${global.isSend}`);
        logger('pointmart', `포인트 마트 global.running1=${global.running1} global.isSend1=${global.isSend1}`);

        global.checkInCount = await checkinGetData();
        logger('checkin', `global.checkInCount ${global.checkInCount}`);

        if (global.running == true) {
        } else {
            if (global.isSend == false && global.checkInCount <= 80 && global.checkInCount != 0) {
                let time = parseInt(moment().tz("Asia/Seoul").format("HH"));
                logger('checkin', `시간 ${time}`);
                sendMessage("출석 매크로 고장!!!");
                global.isSend = true;
                const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
                logger('checkin',`runCheckIn 매크로 시작 한국 시간: ${koreaTime}`);
                await new Promise((page) => setTimeout(page, 10000));
                updateStatus('checkin', true); 
                runCheckIn(92, 113);
                updateStatus('checkin', false); 
            }
        }
        if (global.running1 == true) {
        } else {
            if (global.isSend1 == false) {
                let time = parseInt(moment().tz("Asia/Seoul").format("HH"));
                logger('pointmart', `시간 ${time}`);
                if (10 <= time && time < 19) {
                    sendMessage("포인트마트 매크로 고장!!!");
                    global.isSend1 = true;
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
         await runDetection();
        updateStatus('detection', false)
    });
};

module.exports = { scheduleTasks };