const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment-timezone');
const { sendMessage } = require('./telegram');

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

const checkinGetData = async () => {
    const url = `https://onairslot.com/plugin/attendance/`;
    let response;
    try {
        response = await retry(async () => {
            return await axios.get(url, { timeout: 10000 });
        });
    } catch (e) {
        console.log(`출석 데이터 가져오기 에러: ${e.message}, Stack=${e.stack}`);
        sendMessage(`출석 데이터 가져오기 실패: ${e.message}`);
        throw e;
    }

    const $ = cheerio.load(response.data);
    const currentDay = moment().tz("Asia/Seoul").format("DD");
    let checkInCount = 0;

    // 테이블 셀을 순회하며 현재 날짜에 해당하는 데이터만 추출
    $('#attendance_layer > table > tbody > tr > td > div:nth-child(1) > a > span').each((index, element) => {
        const day = $(element).text().trim();
        if (day === currentDay) {
            const countElement = $(element).parent().parent().next();
            checkInCount = parseInt(countElement.text().trim()) || 0;
            return false; // 현재 날짜 찾았으면 루프 종료
        }
    });

    if (!checkInCount) {
        console.log(`현재 날짜(${currentDay})의 출석 데이터를 찾을 수 없음`);
        sendMessage(`현재 날짜(${currentDay})의 출석 데이터 없음`);
    }

    return checkInCount;
};

module.exports = { checkinGetData };