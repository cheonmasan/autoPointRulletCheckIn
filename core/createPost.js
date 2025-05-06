const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const { login, logout, gotoPage, closePopup } = require('../services/browser');
const { getConfig } = require('../utils/config');
const { logger } = require('../utils/loggerHelper')

const runCreatePost = async () => {
    const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
    logger('createpost', `runCreatePost 매크로 시작 한국 시간: ${koreaTime}`);
    const browser = await puppeteer.launch({
        headless: 'new',
        protocolTimeout: 600000 * 25
    });

    try {
        const [page] = await browser.pages();
        page.on('dialog', async dialog => {
            logger('createpost', `알림 => ${dialog.message()}`);
            await dialog.accept();
        });

    } catch (e) {
        logger('createpost', `runRoulette run try catch error ${e}`);
    } finally {
        await browser.close();
        logger('createpost', `runRoulettet end`);
    }
};

module.exports = { runCreatePost };