const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const { login, logout, gotoPage, closePopup } = require('../services/browser');
const { getConfig } = require('../utils/helpers');
const { sendMessage } = require('../services/telegram');

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

const runRullet = async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        protocolTimeout: 600000 * 25
    });

    try {
        const [page] = await browser.pages();
        page.on('dialog', async dialog => {
            await dialog.accept();
        });

        const { ID_DATA2, TIME } = getConfig();
        for (let i = 0; i < ID_DATA2.length; i++) {
            try {
                await retry(async () => {
                    await gotoPage(page, 'https://onairslot.com/');
                    await page.setViewport({ width: 1920, height: 1080 });
                    await closePopup(page);
                    await login(page, ID_DATA2[i]);
                    await new Promise((page) => setTimeout(page, TIME));
                    await closePopup(page);
                    for (let j = 0; j < 3; j++) {
                        await gotoPage(page, 'https://onairslot.com/bbs/board.php?bo_table=roulette');
                        await new Promise((page) => setTimeout(page, TIME));
                        let frame = await page.waitForFrame(async frame => { return frame.name() === 'player' });
                        await new Promise((frame) => setTimeout(frame, TIME));
                        await frame.click("#spinRoulette");
                    }
                    console.log(`runRullet ${ID_DATA2[i]} ${moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss")} 완료`);
                    await gotoPage(page, 'https://onairslot.com/');
                    await new Promise((page) => setTimeout(page, TIME));
                    await closePopup(page);
                    await logout(page);
                    await new Promise((page) => setTimeout(page, TIME));
                });
            } catch (e) {
                console.log(`룰렛 에러: ID=${ID_DATA2[i]}, 메시지=${e.message}, Stack=${e.stack}`);
                sendMessage(`룰렛 실패: ID=${ID_DATA2[i]}, 에러=${e.message}`);
                await logout(page);
                continue;
            }
        }
    } catch (e) {
        console.log(`룰렛 치명적인 에러: ${e.message}, Stack=${e.stack}`);
        sendMessage(`룰렛 치명적 에러: ${e.message}`);
    } finally {
        try {
            await browser.close();
            console.log("runRullet end");
        } catch (e) {
            console.log(`룰렛 브라우저 종료 에러: ${e.message}, Stack=${e.stack}`);
            sendMessage(`룰렛 브라우저 종료 실패: ${e.message}`);
        }
    }
};

module.exports = { runRullet };