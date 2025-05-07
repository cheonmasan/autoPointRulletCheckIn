const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const { logger } = require('../utils/loggerHelper'); // 로거 가져오기
dotenv.config();

const token1 = process.env.TELEGRAM_TOKEN1;
const chatId1 = process.env.TELEGRAM_CHAT_ID1;
const bot1 = new TelegramBot(token1, { polling: true });

const token2 = process.env.TELEGRAM_TOKEN2;
const chatId2 = process.env.TELEGRAM_CHAT_ID2;
const bot2 = new TelegramBot(token2, { polling: true });

// 메시지 보내기
const sendMessage = async (message) => {
    await bot1.sendMessage(chatId1, message);
};

// 메시지 보내기
const sendMessage2 = async (postType, postWrId, isSucess) => {
    if(isSucess) {
        await bot2.sendMessage(chatId2, `게시판 타입: ${postType}, 게시글 ID: ${postWrId} 삭제를 완료했습니다.`);
    }else{
        await bot2.sendMessage(chatId, `게시판 타입: ${postType}, 게시글 ID: ${postWrId} 삭제 중 오류가 발생했습니다.`);
    }
};

// 메시지 수신 및 처리
bot2.on('message', (msg) => {
    const receivedChatId = msg.chat.id; // 메시지를 보낸 사용자의 채팅 ID
    const text = msg.text; // 사용자가 보낸 메시지 내용
    logger('detection', `📩 받은 메시지: ${text} (채팅 ID: ${receivedChatId})`);
});

// 게시물 정보를 텔레그램으로 전송
const sendPostToTelegram = async (post) => {
    const message = `
        종류: ${post.type}
        아이디: ${post.id}
        닉네임: ${post.nickname}
        제목: ${post.originalTitle}
        내용: ${post.originalContent}
        날짜: ${post.date}
        링크: ${post.link}
        게시글Id: ${post.wrId}
    `;

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '링크 열기', url: post.link } // 링크는 URL로 처리
                ]
            ]
        }
    };

    await bot2.sendMessage(chatId2, message, options);
};

module.exports = { sendMessage, sendPostToTelegram, sendMessage2 };