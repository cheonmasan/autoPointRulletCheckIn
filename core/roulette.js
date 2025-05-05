const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const { login, logout, gotoPage, closePopup } = require('../services/browser');
const { getConfig } = require('../utils/config');
const { logger } = require('../utils/loggerHelper')

const runRoulette = async () => {
    const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
    logger('roulette', `runRoulette 매크로 시작 한국 시간: ${koreaTime}`);
    const browser = await puppeteer.launch({
        headless: 'new',
        protocolTimeout: 600000 * 25
    });

    try {
        const [page] = await browser.pages();
        page.on('dialog', async dialog => {
            logger('roulette', `알림 => ${dialog.message()}`);
            await dialog.accept();
        });

        const { ID_DATA2, TIME } = getConfig();
        for (let i = 0; i < ID_DATA2.length; i++) {
            await gotoPage(page, 'https://onairslot.com/');
            await page.setViewport({ width: 1920, height: 1080 });
            await closePopup(page);
            await login(page, ID_DATA2[i]);
            await new Promise((page) => setTimeout(page, TIME));
            try {
                for (let j = 0; j < 3; j++) {
                    await gotoPage(page, 'https://onairslot.com/bbs/board.php?bo_table=roulette');
                    await new Promise((page) => setTimeout(page, TIME));
                    let frame = await page.waitForFrame(async frame => { return frame.name() === 'player' });
                    await new Promise((frame) => setTimeout(frame, TIME));
                    await frame.click("#spinRoulette");
                }
                logger('roulette', `runRoulette ${ID_DATA2[i]} ${moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss")} 완료`);
                await gotoPage(page, 'https://onairslot.com/');
                await new Promise((page) => setTimeout(page, TIME));
                await logout(page);
                await new Promise((page) => setTimeout(page, TIME));
            } catch (e) {
                logger('roulette', `runRoulette j for try catch error ${e}`);
                await logout(page);
                continue;
            }
        }
    } catch (e) {
        logger('roulette', `runRoulette run try catch error ${e}`);
    } finally {
        await browser.close();
        logger('roulette', `runRoulettet end`);
    }
};

module.exports = { runRoulette };