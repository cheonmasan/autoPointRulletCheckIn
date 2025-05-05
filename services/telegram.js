const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
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

// 메시지 수신 및 처리
bot2.on('message', (msg) => {
    const receivedChatId = msg.chat.id; // 메시지를 보낸 사용자의 채팅 ID
    const text = msg.text; // 사용자가 보낸 메시지 내용

    console.log(`📩 받은 메시지: ${text} (채팅 ID: ${receivedChatId})`);

    // 특정 명령 처리
    if (text === '/delete') {
        // 예: 삭제 명령 처리
        sendMessage('삭제 명령을 처리합니다.');
        // 여기서 삭제 로직을 호출하세요.
    } else {
        sendMessage(`"${text}" 메시지를 받았습니다.`);
    }
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
    `;

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '삭제', callback_data: `delete:${post.id}` }, // 게시글 ID만 포함
                    { text: '링크 열기', url: post.link } // 링크는 URL로 처리
                ]
            ]
        }
    };

    await bot2.sendMessage(chatId2, message, options);
};

bot2.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data; // 버튼에서 전달된 데이터
    const messageId = callbackQuery.message.message_id; // 메시지 ID
    const chatId = callbackQuery.message.chat.id; // 채팅 ID

    if (data.startsWith('delete:')) {
        // const [, postId, postLink] = data.split(':'); // 게시글 ID와 링크 추출
        // console.log(`🗑️ 삭제 요청: 게시글 ID ${postId}, 링크: ${postLink}`);

        // // 여기서 삭제 로직을 호출하세요.
        // await bot.sendMessage(chatId, `게시글 ID ${postId} (링크: ${postLink}) 삭제를 처리합니다.`);
        console.log("🗑️ 삭제 요청: ", data);
    }

    // 콜백 응답
    await bot2.answerCallbackQuery(callbackQuery.id);
});

module.exports = { sendMessage, sendPostToTelegram };