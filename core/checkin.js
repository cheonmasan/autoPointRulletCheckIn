const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const { login, logout, gotoPage, closePopup } = require('../services/browser');
const { checkinGetData } = require('../services/scraper');
const { sendMessage } = require('../services/telegram');
const { getConfig, rand } = require('../utils/helpers');

const retry = async (fn, maxRetries = 3, delay = 5000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (e) {
            console.log(`재시도 ${i + 1}/${maxRetries}: ${e.message}`);
            if (i === maxRetries - 1) throw e;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

const runCheckIn = async (start, end) => {
    if (global.isSend == true) {
        sendMessage("고장난 출석매크로 재시작완료!");
    }
    sendMessage("출석매크로 시작했습니다.");
    global.running = true;
    global.isSend = false;

    const browser = await puppeteer.launch({
        headless: 'new',
        protocolTimeout: 600000 * 25
    });

    try {
        const [page] = await browser.pages();
        page.on('dialog', async dialog => {
            console.log('알림 =>', dialog.message());
            await dialog.accept();
        });

        let randomData = rand(start, end);
        console.log('랜덤', randomData);
        const { ID_DATA3, TIME } = getConfig();

        for (let i = 0; i <= randomData; i++) {
            if (global.checkInCount >= randomData) {
                sendMessage("금일 출석 매크로 완료되었습니다.");
                global.running = false;
                global.isSend = false;
                i = randomData;
            } else {
                try {
                    await retry(async () => {
                        await gotoPage(page, 'https://onairslot.com/');
                        await page.setViewport({ width: 1920, height: 1080 });
                        await closePopup(page);
                        if (i == 0) {
                            ID_DATA3[i] = "sg500";
                        }
                        await login(page, ID_DATA3[i]);
                        await gotoPage(page, 'https://onairslot.com/plugin/attendance/');
                        await new Promise((page) => setTimeout(page, TIME));
                        await page.click("#attendance_list > form > table > tbody > tr > td:nth-child(2) > input");
                        await new Promise((page) => setTimeout(page, TIME));
                        await gotoPage(page, 'https://onairslot.com/');
                        await closePopup(page);
                        await logout(page);
                    });

                    let count;
                    let times = parseInt(moment().tz("Asia/Seoul").format("HH"));
                    console.log('times', times);
                    if (times >= 23) {
                        sendMessage("금일 출석 매크로 완료되었습니다.");
                        global.running = false;
                        global.isSend = false;
                        i = randomData;
                    } else {
                        if (i < 10) {
                            count = Math.floor(Math.random() * 1) + 1;
                            await new Promise((page) => setTimeout(page, count * 60000));
                        } else {
                            count = Math.floor(Math.random() * 20 - 5) + 1 + 5;
                            await new Promise((page) => setTimeout(page, count * 60000));
                        }
                        if (i == randomData) {
                            sendMessage("금일 출석 매크로 완료되었습니다.");
                            global.running = false;
                            global.isSend = false;
                        }
                    }
                    console.log(`runCheckIn 한국 시간: ${moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss")}`, i, "/", randomData, ID_DATA3[i], "약", count, "분 후");
                } catch (e) {
                    console.log(`출석 체크 에러: ID=${ID_DATA3[i]}, 메시지=${e.message}, Stack=${e.stack}`);
                    sendMessage(`출석 체크 실패: ID=${ID_DATA3[i]}, 에러=${e.message}`);
                    await logout(page);
                    continue;
                }
            }
        }
    } catch (e) {
        console.log(`출석 체크 치명적인 에러 발생1: ${e.message}, Stack=${e.stack}`);
        sendMessage(`출석 체크 치명적 에러: ${e.message}`);
        global.running = false;
        global.isSend = false;
    } finally {
        try {
            await browser.close();
            global.running = false;
            global.isSend = false;
            console.log("runCheckIn end", moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss"));
        } catch (e) {
            console.log(`출석 체크 치명적인 에러 발생2: ${e.message}, Stack=${e.stack}`);
            sendMessage(`출석 체크 브라우저 종료 실패: ${e.message}`);
            global.running = false;
            global.isSend = false;
        }
    }
};

module.exports = { runCheckIn };