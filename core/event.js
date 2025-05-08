const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const { login, logout, gotoPage, closePopup } = require('../services/browser');
const { getConfig } = require('../utils/config');
const { logger } = require('../utils/loggerHelper');
const { shuffle } = require('../utils/helpers');
const { hasCommentedThisWeek, saveCommentThisWeek, hasCommentedThisEvent, saveCommentThisEvent } = require('../utils/db'); // DB 관련 함수 가져오기

const runEvent = async (eventUrl, type) => {
    const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
    logger('event', `runEvent ${type} 매크로 시작 한국 시간: ${koreaTime}`);
    const browser = await puppeteer.launch({
        headless: 'new',
        protocolTimeout: 600000 * 25
    });

    if(type === 'lotto') {
        try {
            const [page] = await browser.pages();
            page.on('dialog', async dialog => {
                logger('event', `알림 => ${dialog.message()}`);
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
                    logger('event', `${id} → 댓글 작성 불가 시간 (${now.format("YYYY-MM-DD HH:mm:ss")}) → 건너뜀`);
                    continue;
                }

                const alreadyCommented = await hasCommentedThisWeek(id, moment);
                if (alreadyCommented) {
                    logger('event', `${id} → 이번 주 이미 댓글 작성함. 건너뜀`);
                    continue;
                }

                try {
                    await gotoPage(page, 'https://onairslot.com/');
                    await page.setViewport({ width: 1920, height: 1080 });
                    await closePopup(page);
                    await login(page, id);

                    await gotoPage(page, eventUrl);
                    await page.waitForSelector('#wr_content');

                    const bonusNumber = Math.floor(Math.random() * 45) + 1;
                    const comment = `보너스볼 ${bonusNumber}번`;

                    await page.type('#wr_content', comment);
                    await page.click('#btn_submit');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    await saveCommentThisWeek(id, moment);
                    logger('event', `${id} 댓글 작성 완료 → "${comment}"`);
                    await logout(page);

                    const totalMinutes = Math.floor(Math.random() * (410 - 180 + 1)) + 180;
                    const waitMs = totalMinutes * 60 * 1000;
                    logger('event', `${id} 다음 루틴까지 대기: ${Math.floor(totalMinutes / 60)}시간 ${totalMinutes % 60}분`);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                } catch (e) {
                    logger('event', `${id} 처리 중 오류: ${e}`);
                    await logout(page);
                    continue;
                }
            }

        } catch (e) {
            logger('event', `runEvent 전체 오류: ${e}`);
        } finally {
            await browser.close();
            logger('event', `runEvent 종료`);
        }
    }

    if(type === 'slotjackpot' || type === 'movieking' || type === 'actionking') {
        try {
            const [page] = await browser.pages();
            page.on('dialog', async dialog => {
                logger('event', `알림 => ${dialog.message()}`);
                await dialog.accept();
            });

            const { ID_DATA3 } = getConfig();

            let Id3 = ID_DATA3;
            shuffle(Id3,4)

            for (let i = 0; i < Id3.length; i++) {
                const id = Id3[i];

                const alreadyCommented = await hasCommentedThisEvent(id, type);
                if (alreadyCommented) {
                    logger('event', `${id} → 이미 댓글 작성함. 건너뜀`);
                    continue;
                }

                try {
                    await gotoPage(page, 'https://onairslot.com/');
                    await page.setViewport({ width: 1920, height: 1080 });
                    await closePopup(page);
                    await login(page, id);

                    await gotoPage(page, eventUrl);
                    await page.waitForSelector('#wr_content');

                    let comments = [
                        "확인했습니다.", 
                        "참여 완료!", 
                        "좋은 하루 되세요!", 
                        "참여했어요.", 
                        "감사합니다!", 
                        "응원합니다!", 
                        "확인!", 
                        "확인~!", 
                        "확인 완료했어~", 
                        "확인 완료했어!", 
                        "고마워요!", 
                        "잘 보고 갑니다.", 
                        "참여 완료했습니다.", 
                        "확인 완료!", 
                        "좋은 이벤트네요!", 
                        "굿!", 
                        "잘 봤습니다.", 
                        "확인 완료했어.", 
                        "좋은 하루 보내세요!", 
                        "참여 완료요!", 
                        "확인했어요!"
                    ];
                    const randomIndex = Math.floor(Math.random() * comments.length);

                    const comment = comments[randomIndex];

                    await page.type('#wr_content', comment);
                    await page.click('#btn_submit');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    await saveCommentThisEvent(id, type);
                    logger('event', `${id} 댓글 작성 완료 → "${comment}"`);
                    await logout(page);

                    const totalMinutes = Math.floor(Math.random() * (410 - 180 + 1)) + 180;
                    const waitMs = totalMinutes * 60 * 1000;
                    logger('event', `${id} 다음 루틴까지 대기: ${Math.floor(totalMinutes / 60)}시간 ${totalMinutes % 60}분`);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                } catch (e) {
                    logger('event', `${id} 처리 중 오류: ${e}`);
                    await logout(page);
                    continue;
                }
            }

        } catch (e) {
            logger('event', `runEvent 전체 오류: ${e}`);
        } finally {
            await browser.close();
            logger('event', `runEvent 종료`);
        }
    }
};

module.exports = { runEvent };