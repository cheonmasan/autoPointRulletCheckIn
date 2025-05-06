const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const { login, logout, gotoPage, closePopup } = require('../services/browser');
const { getConfig } = require('../utils/config');
const { logger } = require('../utils/loggerHelper');
const { hasCommentedThisWeek, saveCommentThisWeek } = require('../utils/db'); // DB 관련 함수 가져오기

const runLotto = async () => {
    const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
    logger('lotto', `runLotto 매크로 시작 한국 시간: ${koreaTime}`);
    const browser = await puppeteer.launch({
        headless: 'new',
        protocolTimeout: 600000 * 25
    });

    try {
        const [page] = await browser.pages();
        page.on('dialog', async dialog => {
            logger('lotto', `알림 => ${dialog.message()}`);
            await dialog.accept();
        });

        const { ID_DATA3 } = getConfig();

        for (let i = 0; i < ID_DATA3.length; i++) {
            const id = ID_DATA3[i];
            const now = moment().tz("Asia/Seoul");
            const day = now.day(); // 0~6
            const hour = now.hour();

            let canComment = false;
            if ((day === 0 && hour >= 11) || (day > 0 && day < 6) || (day === 6 && hour < 18)) {
                canComment = true;
            }

            if (!canComment) {
                logger('lotto', `${id} → 댓글 작성 불가 시간 (${now.format("YYYY-MM-DD HH:mm:ss")}) → 건너뜀`);
                continue;
            }

            const alreadyCommented = await hasCommentedThisWeek(id, moment);
            if (alreadyCommented) {
                logger('lotto', `${id} → 이번 주 이미 댓글 작성함. 건너뜀`);
                continue;
            }

            try {
                await gotoPage(page, 'https://onairslot.com/');
                await page.setViewport({ width: 1920, height: 1080 });
                await closePopup(page);
                await login(page, id);

                await gotoPage(page, 'https://onairslot.com/bbs/board.php?bo_table=event&wr_id=636');
                await page.waitForSelector('#wr_content');

                const bonusNumber = Math.floor(Math.random() * 45) + 1;
                const comment = `보너스볼 ${bonusNumber}번`;

                await page.type('#wr_content', comment);
                await page.click('#btn_submit');
                await new Promise(resolve => setTimeout(resolve, 3000));

                logger('lotto', `${id} 댓글 작성 완료 → "${comment}"`);
                await saveCommentThisWeek(id, moment);
                await logout(page);

                const totalMinutes = Math.floor(Math.random() * (410 - 180 + 1)) + 180;
                const waitMs = totalMinutes * 60 * 1000;
                logger('lotto', `${id} 다음 루틴까지 대기: ${Math.floor(totalMinutes / 60)}시간 ${totalMinutes % 60}분`);
                await new Promise(resolve => setTimeout(resolve, waitMs));

            } catch (e) {
                logger('lotto', `${id} 처리 중 오류: ${e}`);
                await logout(page);
                continue;
            }
        }

    } catch (e) {
        logger('lotto', `runLotto 전체 오류: ${e}`);
    } finally {
        await browser.close();
        logger('lotto', `runLotto 종료`);
    }
};

module.exports = { runLotto };