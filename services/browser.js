const puppeteer = require('puppeteer');
const { getConfig } = require('../utils/helpers');

const closePopup = async (page) => {
    let hasError = false;
    try {
        await page.waitForSelector('button.hd_pops_close', { timeout: 10000, visible: true });
        const closeButtons = await page.$$('button.hd_pops_close');
        for (const button of closeButtons) {
            try {
                await button.click();
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                console.log(`팝업 닫기 실패: ${e.message}`);
                hasError = true;
            }
        }
    } catch (e) {
        console.log(`팝업 처리 중 오류: ${e.message}`);
        hasError = true;
    }
    if (hasError) {
        const { sendMessage } = require('./telegram');
        sendMessage('팝업 닫기 중 오류 발생. 작업은 계속 진행됩니다.');
    }
};

const login = async (page, id, password) => {
    const { TIME } = getConfig();
    await page.waitForSelector("#outlogin_mb_id");
    await page.type('#outlogin_mb_id', id);
    await page.waitForSelector("#outlogin_mb_password");
    await page.type('#outlogin_mb_password', password);
    await new Promise((page) => setTimeout(page, TIME));
    await page.click("#basic_outlogin > div:nth-child(4) > button");
    await new Promise((page) => setTimeout(page, TIME));
};

const logout = async (page) => {
    const { TIME } = getConfig();
    await page.click("#nt_body > div > div > div.col-md-3.order-md-1.na-col > div.d-none.d-md-block.mb-4 > div > div.btn-group.w-100 > a:nth-child(3)");
    await new Promise((page) => setTimeout(page, TIME));
};

const gotoPage = async (page, url) => {
    await page.goto(url, { timeout: 0, waitUntil: 'load' });
};

module.exports = { closePopup, login, logout, gotoPage };