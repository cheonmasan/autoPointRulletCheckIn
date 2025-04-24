const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(token, { polling: true });

const sendMessage = async (message) => {
    await bot.sendMessage(chatId, message);
};

module.exports = { sendMessage };