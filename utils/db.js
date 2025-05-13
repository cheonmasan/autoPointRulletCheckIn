const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment-timezone'); // moment-timezone 모듈 추가
const os = require('os'); // Import os module

// Set the database path to always point to the user's home directory's commentHistory.db
const dbPath = path.join(os.homedir(), 'commentHistory.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT,
            week_key TEXT,
            PRIMARY KEY (id, week_key)
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY, -- AUTOINCREMENT 제거
            userId TEXT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            date TEXT NOT NULL,
            image1 TEXT,
            image2 TEXT,
            image3 TEXT,
            image4 TEXT,
            image5 TEXT,
            created_at TEXT NOT NULL,
            isUpload INTEGER DEFAULT 0
        )
    `);
})
                
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

// 이벤트 댓글 여부 확인
const hasCommentedThisEvent = (id, event) => {
    const key = event;
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM comments WHERE id = ? AND week_key = ?', [id, event], (err, row) => {
            if (err) return reject(err);
            resolve(!!row);
        });
    });
};

// 이벤트 댓글 저장
const saveCommentThisEvent = (id, event) => {
    const key = event;
    return new Promise((resolve, reject) => {
        db.run('INSERT OR IGNORE INTO comments (id, week_key) VALUES (?, ?)', [id, event], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
};

// 게시글 삽입 함수
const insertPost = (title, content, date, images, id) => {
    const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'); // 현재 시간
    const [image1, image2, image3, image4, image5] = images; // 최대 5개의 이미지 분리
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO posts (title, content, date, id, image1, image2, image3, image4, image5, created_at, isUpload)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, content, date, id, image1, image2, image3, image4, image5, createdAt, 0], // isUpload 기본값: 0
            function (err) {
                if (err) return reject(err);
                resolve(this.lastID); // 삽입된 게시글의 ID 반환
            }
        );
    });
};

/**
 * 업로드 할 게시글 가져오기
 */
const getUploadedPosts = () => {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, title, content, image1, image2, image3, image4, image5 
             FROM posts 
             WHERE isUpload = 1`,
            [],
            (err, rows) => {
                if (err) return reject(err);

                // 이미지 배열로 변환
                const posts = rows.map(row => ({
                    id: row.id,
                    title: row.title,
                    content: row.content,
                    images: [row.image1, row.image2, row.image3, row.image4, row.image5].filter(img => img), // null 제거
                }));

                resolve(posts);
            }
        );
    });
};

/**
 * 게시글 업로드 완료 상태로 업데이트
 * @param {string} id - 업데이트할 게시글의 ID
 * @returns {Promise<void>}
 */
const markPostAsUploaded = (userId, id) => {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE posts SET userId = ?, isUpload = 2 WHERE id = ?`,
            [userId, id],
            function (err) {
                if (err) return reject(err);
                resolve();
            }
        );
    });
};

module.exports = {
    db,
    getWeekRangeKey,
    hasCommentedThisWeek,
    saveCommentThisWeek,
    hasCommentedThisEvent,
    saveCommentThisEvent,
    insertPost,
    getUploadedPosts,
    markPostAsUploaded
};