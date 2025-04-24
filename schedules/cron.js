const cron = require('node-cron');
const moment = require('moment-timezone');
const { runCheckIn } = require('../core/checkin');
const { runPointMart } = require('../core/pointMart');
const { runRullet } = require('../core/roulette');
const { checkinGetData } = require('../services/scraper');
const { sendMessage } = require('../services/telegram');

global.running = false;
global.isSend = false;
global.running1 = false;
global.isSend1 = false;

const scheduleTasks = () => {
    cron.schedule("*/30 * * * *", async () => {
        console.log('출석 global.running', global.running, 'global.isSend', global.isSend);
        console.log('포인트 마트 global.running1', global.running1, 'global.isSend1', global.isSend1);
        global.checkInCount = await checkinGetData();
        console.log('global.checkInCount', global.checkInCount);

        if (global.running == true) {
        } else {
            if (global.isSend == false && global.checkInCount <= 80 && global.checkInCount != 0) {
                let time = parseInt(moment().tz("Asia/Seoul").format("HH"));
                console.log("시간", time);
                sendMessage("출석 매크로 고장!!!");
                global.isSend = true;
                const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
                console.log(`runCheckIn 매크로 시작 한국 시간: ${koreaTime}`);
                await new Promise((page) => setTimeout(page, 10000));
                runCheckIn(92, 113);
            }
        }
        if (global.running1 == true) {
        } else {
            if (global.isSend1 == false) {
                let time = parseInt(moment().tz("Asia/Seoul").format("HH"));
                console.log("시간", time);
                if (10 <= time && time < 19) {
                    sendMessage("포인트마트 매크로 고장!!!");
                    global.isSend1 = true;
                    const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
                    console.log(`runPointMart 매크로 시작 한국 시간: ${koreaTime}`);
                    await new Promise((page) => setTimeout(page, 10000));
                    runPointMart();
                }
            }
        }
    });

    cron.schedule("00 10 * * *", async () => {
        const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
        console.log(`runPointMart 매크로 시작 한국 시간: ${koreaTime}`);
        runPointMart();
    });

    cron.schedule("00 02 * * *", async () => {
        const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
        console.log(`runRullet 매크로 시작 한국 시간: ${koreaTime}`);
        runRullet();
    });

    cron.schedule("0 0 * * *", async () => {
        const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
        console.log(`runCheckIn 매크로 시작 한국 시간: ${koreaTime}`);
        await new Promise((page) => setTimeout(page, 11000));
        runCheckIn(92, 113);
    });
};

module.exports = { scheduleTasks };