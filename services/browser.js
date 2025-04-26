const puppeteer = require('puppeteer');
const { getConfig } = require('../utils/config');

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
    let errorMessage = '';
    try {
        await retry(async () => {
            const closeButtons = await page.$$('button.hd_pops_close');
            if (closeButtons.length === 0) {
                console.log('팝업 없음, 스킵');
                return;
            }
            for (const button of closeButtons) {
                try {
                    await button.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (e) {
                    console.log(`팝업 닫기 실패: ${e.message}`);
                    hasError = true;
                }
            }
        }, 3, 20000);
    } catch (e) {
        errorMessage = e.message;
        console.log(`팝업 처리 중 오류: ${e.message}, Stack: ${e.stack}`);
        hasError = true;
    }
    if (hasError && errorMessage) {
        console.log(`팝업 닫기 오류 기록: ${errorMessage}`);
    }
};

const login = async (page, id) => {
    const { TIME, PASSWORD } = getConfig();
    try {
        await retry(async () => {
            await page.waitForNetworkIdle({ timeout: 20000 });
            await page.waitForFunction(
                () => !!document.querySelector('#outlogin_mb_id'),
                { timeout: 20000 }
            );
            await page.type('#outlogin_mb_id', id);
            await page.waitForFunction(
                () => !!document.querySelector('#outlogin_mb_password'),
                { timeout: 20000 }
            );
            await page.type('#outlogin_mb_password', PASSWORD);
            await new Promise((page) => setTimeout(page, TIME));
            await page.click("#basic_outlogin > div:nth-child(4) > button");
            await new Promise((page) => setTimeout(page, TIME));
            const isLoggedIn = await page.$('#nt_body > div > div > div.col-md-3.order-md-1.na-col');
            if (!isLoggedIn) throw new Error('로그인 실패');
        });
    } catch (e) {
        console.log(`로그인 에러: ID=${id}, 메시지=${e.message}, Stack=${e.stack}`);
        throw e;
    }
};

const logout = async (page) => {
    const { TIME } = getConfig();
    try {
        await retry(async () => {
            await page.goto("https://onairslot.com/bbs/logout.php");
            await new Promise((page) => setTimeout(page, TIME));
        });
    } catch (e) {
        console.log(`로그아웃 에러: ${e.message}, Stack=${e.stack}`);
    }
};

const gotoPage = async (page, url) => {
    try {
        await retry(async () => {
            await page.goto(url, { timeout: 30000, waitUntil: 'networkidle0' });
        });
    } catch (e) {
        console.log(`페이지 이동 에러: URL=${url}, 메시지=${e.message}, Stack=${e.stack}`);
        throw e;
    }
};

module.exports = { closePopup, login, logout, gotoPage };