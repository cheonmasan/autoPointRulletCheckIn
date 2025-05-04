const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { login, logout, gotoPage, closePopup } = require('../services/browser');
const { getConfig } = require('../utils/config');
const { logger } = require('../utils/loggerHelper');

// ===== DB 설정 =====
const db = new sqlite3.Database(path.resolve(__dirname, '../commentHistory.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT,
      week_key TEXT,
      PRIMARY KEY (id, week_key)
    )
  `);
});

const getWeekRangeKey = (date = new Date()) => {
  const now = moment(date).tz('Asia/Seoul');
  const start = now.clone().startOf('week').add(11, 'hours'); // 일요일 11:00
  const end = start.clone().add(6, 'days').hour(18); // 토요일 18:00

  if (now.isBetween(start, end, null, '[)')) {
    return `${start.format('YYYY-MM-DD_HH')}~${end.format('YYYY-MM-DD_HH')}`;
  }
  return null;
};

const hasCommentedThisWeek = (id) => {
  const weekKey = getWeekRangeKey();
  if (!weekKey) return Promise.resolve(true); // 주간 범위 외는 차단
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM comments WHERE id = ? AND week_key = ?', [id, weekKey], (err, row) => {
      if (err) return reject(err);
      resolve(!!row);
    });
  });
};

const saveCommentThisWeek = (id) => {
  const weekKey = getWeekRangeKey();
  if (!weekKey) return Promise.resolve();
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO comments (id, week_key) VALUES (?, ?)', [id, weekKey], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

// ===== MAIN =====
const runLotto = async () => {
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

      const alreadyCommented = await hasCommentedThisWeek(id);
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
        await saveCommentThisWeek(id);
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