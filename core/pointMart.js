const moment = require('moment-timezone');
const { login, logout, gotoPage, closePopup } = require('../services/browser');
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

const purchasePoints = async (page, url, time) => {
    await gotoPage(page, url);
    await new Promise((page) => setTimeout(page, time));
    if (parseInt(moment().tz("Asia/Seoul").format("HH")) < 19) {
        await page.click("#btn_submit");
    }
    await new Promise((page) => setTimeout(page, 30000));
    await closePopup(page);
    await new Promise((page) => setTimeout(page, time));
};

const buyPoint = async (page, id, i, nextTime) => {
    try {
        await retry(async () => {
            await gotoPage(page, 'https://onairslot.com/');
            await page.setViewport({ width: 1920, height: 1080 });
            await closePopup(page);
            await login(page, id);
            await new Promise((page) => setTimeout(page, getConfig().TIME));
            await page.waitForSelector("#nt_body > div > div > div.col-md-3.order-md-1.na-col > div.d-none.d-md-block.mb-4 > div > div.btn-group.w-100 > a:nth-child(3)", { timeout: 10000 });
            await closePopup(page);
            const text = await page.$eval('#nt_body > div > div > div.col-md-3.order-md-1.na-col > div.d-none.d-md-block.mb-4 > div > div.d-flex.align-items-center.mb-3 > div.flex-grow-1.pt-2 > a > b', span => span.innerText);
            const point = parseInt(text.replaceAll(",", "").replace("P", ""));
            let count = rand(1, 100);
            let where = rand(1, 10);
            const { TIME, POINT_SITES } = getConfig();

            let site, amount, url;
            if (where > 9) site = POINT_SITES.brother;
            else if (where > 5) site = POINT_SITES.nimo;
            else site = POINT_SITES.buy;

            if (point > 100000 && count > 98) {
                amount = 100000;
            } else if ((point > 100000 && count > 88) || (point > 50000 && count > 88)) {
                amount = 50000;
            } else if (point > 10000) {
                amount = 10000;
            } else {
                console.log(`포인트 부족: ${text.replace("P", "")} 구매 불가`);
                await new Promise((page) => setTimeout(page, 30000));
                await logout(page);
                await new Promise((page) => setTimeout(page, TIME));
                return;
            }

            url = site.urls[amount];
            console.log('runPointMart', i + 1, id, moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss"), `포인트[${point}] 구매[${amount / 10000}만] 사이트[${site.name}] 약`, nextTime / 60000, "분 후");

            await purchasePoints(page, url, TIME);
            await logout(page);
            await new Promise((page) => setTimeout(page, nextTime));
        });
    } catch (e) {
        console.log(`포인트 구매 에러: ID=${id}, 메시지=${e.message}, Stack=${e.stack}`);
        sendMessage(`포인트 구매 실패: ID=${id}, 에러=${e.message}`);
        await logout(page);
    }
};

const runPointMart = async () => {
    let time = parseInt(moment().tz("Asia/Seoul").format("HH"));
    console.log("시간", time);
    if (10 <= time && time <= 19) {
        sendMessage("포인트구매 매크로 시작했습니다.");
    }
    global.running1 = true;

    const browser = await puppeteer.launch({
        headless: 'new',
        protocolTimeout: 600000 * 25
    });

    try {
        const [page] = await browser.pages();
        page.on('dialog', async dialog => {
            await dialog.accept();
        });

        const { ID_DATA1, ID_DATA2 } = getConfig();
        for (let i = 0; i < 3; i++) {
            try {
                let time = parseInt(moment().tz("Asia/Seoul").format("HH"));
                if (10 <= time && time < 19) {
                    await buyPoint(page, ID_DATA1[i], i, 60000);
                }
            } catch (e) {
                console.log(`포인트 마트 에러 발생1: ID=${ID_DATA1[i]}, 메시지=${e.message}, Stack=${e.stack}`);
                sendMessage(`포인트 마트 에러1: ID=${ID_DATA1[i]}, 에러=${e.message}`);
                await logout(page);
                continue;
            }
        }

        for (let i = 0; i < 30; i++) {
            let time = parseInt(moment().tz("Asia/Seoul").format("HH"));
            if (10 <= time && time < 19) {
                let cnt = rand(20, 40);
                try {
                    await buyPoint(page, ID_DATA2[i], i, cnt * 60000);
                } catch (e) {
                    console.log(`포인트 마트 에러 발생2: ID=${ID_DATA2[i]}, 메시지=${e.message}, Stack=${e.stack}`);
                    sendMessage(`포인트 마트 에러2: ID=${ID_DATA2[i]}, 에러=${e.message}`);
                    await logout(page);
                    continue;
                }
            } else {
                i = 30;
            }
        }
        sendMessage("금일 포인트 매크로 완료되었습니다.");
        global.running1 = false;
        global.isSend1 = false;
    } catch (e) {
        console.log(`포인트 마트 치명적인 에러 발생1: ${e.message}, Stack=${e.stack}`);
        sendMessage(`포인트 마트 치명적 에러: ${e.message}`);
        global.running1 = false;
        global.isSend1 = false;
    } finally {
        try {
            await browser.close();
            console.log("runPointMart end", moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss"));
        } catch (e) {
            console.log(`포인트 마트 치명적인 에러 발생: ${e.message}, Stack=${e.stack}`);
            sendMessage(`포인트 마트 브라우저 종료 실패: ${e.message}`);
            global.running1 = false;
            global.isSend1 = false;
        }
    }
};

module.exports = { runPointMart, buyPoint };