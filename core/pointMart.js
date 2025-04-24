const { login, logout, gotoPage, closePopup } = require('../services/browser');
const { sendMessage } = require('../services/telegram');
const moment = require('moment-timezone');
const { getConfig, rand } = require('../utils/helpers');

const buyPoint = async (page, id, i, nextTime) => {
    await gotoPage(page, 'https://onairslot.com/');
    await page.setViewport({ width: 1920, height: 1080 });
    await closePopup(page);
    await login(page, id, process.env.PASSWORD);

    try {
        await page.waitForSelector("#nt_body > div > div > div.col-md-3.order-md-1.na-col > div.d-none.d-md-block.mb-4 > div > div.btn-group.w-100 > a:nth-child(3)");
    } catch (e) {
        console.log("timeout error");
    }
    await closePopup(page);
    const text = await page.$eval('#nt_body > div > div > div.col-md-3.order-md-1.na-col > div.d-none.d-md-block.mb-4 > div > div.d-flex.align-items-center.mb-3 > div.flex-grow-1.pt-2 > a > b', span => span.innerText);
    const point = parseInt(text.replaceAll(",", "").replace("P", ""));
    let count = rand(1, 100);
    let where = rand(1, 10);
    console.log('runPointMart', i + 1, id, moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss"), `포인트[${point < 10000 ? `${text.replace("P", "")} 구매 불가]` : `${text.replace("P", "")}] 구매[${count > 98 && point > 100000 ? "10만" : count > 88 && point > 50000 ? "5만" : "1만" }] 사이트[${where > 9 ? "형제카지노" : where > 6 ? "니모슬롯" : "꼬부기슬롯"}]` } 약`, nextTime / 60000, "분 후");

    const { TIME } = getConfig();
    const sites = {
        brother: { id1: 1, id2: 2, id3: 3 },
        nimo: { id1: 1, id2: 2, id3: 3 },
        buy: { id1: 1, id2: 2, id3: 3 }
    };

    let url;
    if (point > 100000 && count > 98) {
        url = where > 9 ? `https://onairslot.com//bbs/board.php?bo_table=point_brother&wr_id=${sites.brother.id3}` :
              where > 5 ? `https://onairslot.com//bbs/board.php?bo_table=point_nimo&wr_id=${sites.nimo.id3}` :
              `https://onairslot.com//bbs/board.php?bo_table=point_buy&wr_id=${sites.buy.id3}`;
    } else if ((point > 100000 && count > 88) || (point > 50000 && count > 88)) {
        url = where > 9 ? `https://onairslot.com//bbs/board.php?bo_table=point_brother&wr_id=${sites.brother.id2}` :
              where > 5 ? `https://onairslot.com//bbs/board.php?bo_table=point_nimo&wr_id=${sites.nimo.id2}` :
              `https://onairslot.com//bbs/board.php?bo_table=point_buy&wr_id=${sites.buy.id2}`;
    } else if (point > 10000) {
        url = where > 9 ? `https://onairslot.com//bbs/board.php?bo_table=point_brother&wr_id=${sites.brother.id1}` :
              where > 5 ? `https://onairslot.com//bbs/board.php?bo_table=point_nimo&wr_id=${sites.nimo.id1}` :
              `https://onairslot.com//bbs/board.php?bo_table=point_buy&wr_id=${sites.buy.id1}`;
    } else {
        await new Promise((page) => setTimeout(page, 30000));
        await logout(page);
        return;
    }

    await gotoPage(page, url);
    await new Promise((page) => setTimeout(page, TIME));
    if (parseInt(moment().tz("Asia/Seoul").format("HH")) < 19) {
        await page.click("#btn_submit");
    }
    await new Promise((page) => setTimeout(page, 30000));
    await closePopup(page);
    await new Promise((page) => setTimeout(page, TIME));
    await logout(page);
    await new Promise((page) => setTimeout(page, nextTime));
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
                console.log("포인트 마트 에러 발생1!", e);
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
                    console.log("포인트 마트 에러 발생2!", e);
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
        console.log("포인트 마트 치명적인 에러 발생1!");
        global.running1 = false;
        global.isSend1 = false;
    } finally {
        try {
            await browser.close();
            console.log("runPointMart end", moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss"));
        } catch (e) {
            console.log("포인트 마트 치명적인 에러 발생!");
            global.running1 = false;
            global.isSend1 = false;
            console.log("runPointMart auto Point market end", e);
        }
    }
};

module.exports = { runPointMart, buyPoint };