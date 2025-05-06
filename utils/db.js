const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// DB 초기화
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

// 주간 키 생성 함수
const getWeekRangeKey = (moment, date = new Date()) => {
    const now = moment(date).tz('Asia/Seoul');
    const start = now.clone().startOf('week').add(11, 'hours'); // 일요일 11:00
    const end = start.clone().add(6, 'days').hour(18); // 토요일 18:00

    if (now.isBetween(start, end, null, '[)')) {
        return `${start.format('YYYY-MM-DD_HH')}~${end.format('YYYY-MM-DD_HH')}`;
    }
    return null;
};

// 주간 댓글 여부 확인
const hasCommentedThisWeek = (id, moment) => {
    const weekKey = getWeekRangeKey(moment);
    if (!weekKey) return Promise.resolve(true); // 주간 범위 외는 차단
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM comments WHERE id = ? AND week_key = ?', [id, weekKey], (err, row) => {
            if (err) return reject(err);
            resolve(!!row);
        });
    });
};

// 주간 댓글 저장
const saveCommentThisWeek = (id, moment) => {
    const weekKey = getWeekRangeKey(moment);
    if (!weekKey) return Promise.resolve();
    return new Promise((resolve, reject) => {
        db.run('INSERT OR IGNORE INTO comments (id, week_key) VALUES (?, ?)', [id, weekKey], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
};

module.exports = {
    db,
    getWeekRangeKey,
    hasCommentedThisWeek,
    saveCommentThisWeek
};