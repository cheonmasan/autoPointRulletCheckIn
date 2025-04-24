const puppeteer = require('puppeteer');
const { getConfig } = require('../utils/helpers');
const { sendMessage } = require('./telegram');

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

const closePopup = async (page) => {
    let hasError = false;
    try {
        await retry(async () => {
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
        });
    } catch (e) {
        console.log(`팝업 처리 중 오류: ${e.message}, Stack: ${e.stack}`);
        hasError = true;
    }
    if (hasError) {
        sendMessage(`팝업 닫기 중 오류 발생: ${e.message}. 작업은 계속 진행됩니다.`);
    }
};

const login = async (page, id) => {
    const { TIME, PASSWORD } = getConfig();
    try {
        await retry(async () => {
            await page.waitForSelector("#outlogin_mb_id", { timeout: 10000 });
            await page.type('#outlogin_mb_id', id);
            await page.waitForSelector("#outlogin_mb_password");
            await page.type('#outlogin_mb_password', PASSWORD);
            await new Promise((page) => setTimeout(page, TIME));
            await page.click("#basic_outlogin > div:nth-child(4) > button");
            await new Promise((page) => setTimeout(page, TIME));
            // 로그인 성공 여부 확인
            const isLoggedIn = await page.$('#nt_body > div > div > div.col-md-3.order-md-1.na-col');
            if (!isLoggedIn) throw new Error('로그인 실패');
        });
    } catch (e) {
        console.log(`로그인 에러: ID=${id}, 메시지=${e.message}, Stack=${e.stack}`);
        sendMessage(`로그인 실패: ID=${id}, 에러=${e.message}`);
        throw e;
    }
};

const logout = async (page) => {
    const { TIME } = getConfig();
    try {
        await retry(async () => {
            await page.click("#nt_body > div > div > div.col-md-3.order-md-1.na-col > div.d-none.d-md-block.mb-4 > div > div.btn-group.w-100 > a:nth-child(3)");
            await new Promise((page) => setTimeout(page, TIME));
        });
    } catch (e) {
        console.log(`로그아웃 에러: ${e.message}, Stack=${e.stack}`);
        sendMessage(`로그아웃 실패: ${e.message}`);
    }
};

const gotoPage = async (page, url) => {
    try {
        await retry(async () => {
            await page.goto(url, { timeout: 30000, waitUntil: 'load' });
        });
    } catch (e) {
        console.log(`페이지 이동 에러: URL=${url}, 메시지=${e.message}, Stack=${e.stack}`);
        sendMessage(`페이지 이동 실패: URL=${url}, 에러=${e.message}`);
        throw e;
    }
};

module.exports = { closePopup, login, logout, gotoPage };