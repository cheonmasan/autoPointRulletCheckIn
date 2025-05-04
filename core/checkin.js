const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const { login, logout, gotoPage, closePopup } = require('../services/browser');
const { checkinGetData } = require('../services/scraper');
const { sendMessage } = require('../services/telegram');
const { rand } = require('../utils/helpers');
const { getConfig } = require('../utils/config');
const { logger } = require('../utils/loggerHelper')

const retry = async (fn, maxRetries = 3, delay = 5000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (e) {
            logger('checkin', `재시도 ${i + 1}/${maxRetries}: ${e.message}`);
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
        args: ['--disable-features=site-per-process'],
        protocolTimeout: 600000 * 25
    });

    try {
        const [page] = await browser.pages();
        page.on('dialog', async dialog => {
            logger('checkin', `알림 =>, ${dialog.message()}`);
            await dialog.accept();
        });

        let randomData = rand(start, end);
        logger('checkin', `랜덤 ${randomData}`);
        global.checkInCount = checkinGetData();
        const { ID_DATA2, TIME } = getConfig();

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
                            ID_DATA2[i] = "sg500";
                        }
                        await login(page, ID_DATA2[i]);
                        await gotoPage(page, 'https://onairslot.com/plugin/attendance/');
                        await new Promise((page) => setTimeout(page, TIME));
                        const checkinButton = await page.evaluateHandle(() => {
                            return document.querySelector('#attendance_list > form > table > tbody > tr > td:nth-child(2) > input') ||
                                   document.querySelector('input[name="checkin"]');
                        });
                        if (!checkinButton.asElement()) {
                            logger('checkin', `ID=${ID_DATA2[i]} 이미 출석 완료`);
                            await gotoPage(page, 'https://onairslot.com/');
                            await closePopup(page);
                            await logout(page);
                            return;
                        }
                        await checkinButton.click();
                        await new Promise((page) => setTimeout(page, TIME));
                        await gotoPage(page, 'https://onairslot.com/');
                        await closePopup(page);
                        await logout(page);
                    });

                    let count;
                    let times = parseInt(moment().tz("Asia/Seoul").format("HH"));
                    if (times >= 23) {
                        sendMessage("금일 출석 매크로 완료되었습니다.");
                        global.running = false;
                        global.isSend = false;
                        i = randomData;
                    } else {
                        if (i < 20) {
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
                    logger('checkin', `runCheckIn 한국 시간: ${moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss")}`, i, "/", randomData, ID_DATA2[i], "약", count, "분 후");
                } catch (e) {
                    logger('checkin', `출석 체크 에러: ID=${ID_DATA2[i]}, 메시지=${e.message}, Stack=${e.stack}`);
                    await logout(page);
                    continue;
                }
            }
        }
    } catch (e) {
        logger('checkin', `출석 체크 치명적인 에러 발생1: ${e.message}, Stack=${e.stack}`);
        global.running = false;
        global.isSend = false;
    } finally {
        try {
            await browser.close();
            global.running = false;
            global.isSend = false;
            logger('checkin', `runCheckIn end", ${moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss")}`);
        } catch (e) {
            logger('checkin', `출석 체크 치명적인 에러 발생2: ${e.message}, Stack=${e.stack}`);
        }
    }
};

module.exports = { runCheckIn };