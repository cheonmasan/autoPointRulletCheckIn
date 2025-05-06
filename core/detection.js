const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment-timezone'); // moment 라이브러리 추가
const { sendPostToTelegram } = require('../services/telegram'); // 텔레그램 전송 함수 가져오기
const { logger } = require('../utils/loggerHelper')

// 게시판 URL 리스트
const boardUrls = [
  "https://onairslot.com/bbs/board.php?bo_table=free",
  "https://onairslot.com/bbs/board.php?bo_table=greet",
  "https://onairslot.com/bbs/board.php?bo_table=slot"
];

// 부적절한 키워드 리스트
const inappropriateKeywords = [
  "섹파", "미친페이", "텔비포함", "조건만남","조건 만남","조건녀","조건 녀","평타이상"
];

// 키워드 필터링 함수
function containsInappropriateKeywords(text) {
  return inappropriateKeywords.some(keyword => text.includes(keyword));
}

// 현재 날짜를 KST 기준 "MM.DD" 형식으로 반환하는 함수
function getTodayDateKST() {
  return moment().tz("Asia/Seoul").format("MM.DD"); // KST 기준 오늘 날짜 반환
}

// 키워드 탐지 함수
async function detectKeywordsFromBoard(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const elements = $('li.d-md-table-row');
    const detectedPosts = []; // 항상 배열로 초기화

    for (const element of elements) {
      let title, link, nickname, id, date, content, type, wrId;

      if (url.includes('free')) {
        type = 'free';
        title = $(element).find('a.na-subject').text().trim();
        link = $(element).find('a.na-subject').attr('href');
        nickname = $(element).find('a.sv_member').text().trim();
        id = new URL($(element).find('a.sv_member').attr('href'), url).searchParams.get('mb_id');
        date = $(element).find('.nw-6').text().replace(/등록일/g, '').replace(/\s+/g, ' ').trim();
        wrId = new URL(link, url).searchParams.get('wr_id');
      } else if (url.includes('greet')) {
        type = 'greet';
        title = $(element).find('a.na-subject').text().trim();
        link = $(element).find('a.na-subject').attr('href');
        nickname = $(element).find('a.sv_member').text().trim();
        id = new URL($(element).find('a.sv_member').attr('href'), url).searchParams.get('mb_id');
        date = $(element).find('.nw-6').text().replace(/등록일/g, '').replace(/\s+/g, ' ').trim();
        wrId = new URL(link, url).searchParams.get('wr_id');
      } else if (url.includes('slot')) {
        type = 'slot';
        title = $(element).find('a.na-subject').text().trim();
        link = $(element).find('a.na-subject').attr('href');
        nickname = $(element).find('a.sv_member').text().trim();
        id = new URL($(element).find('a.sv_member').attr('href'), url).searchParams.get('mb_id');
        date = $(element).find('.nw-6').text().replace(/등록일/g, '').replace(/\s+/g, ' ').trim();
        wrId = new URL(link, url).searchParams.get('wr_id');
      }

      // 게시글 내용 가져오기
      if (link) {
        const fullLink = new URL(link, url).href;
        content = await fetchPostContent(fullLink);
      }

      const originalTitle = title;
      const originalContent = content;

      title = extractKorean(title);
      content = extractKorean(content);

      // 날짜가 시간 형식(예: 12:33)인 경우 오늘 날짜로 변경
      if (/^\d{2}:\d{2}$/.test(date)) {
        date = getTodayDateKST(); // 오늘 날짜로 변경
      }

      // 부적절한 키워드 필터링
      const containsInappropriate = containsInappropriateKeywords(title) || containsInappropriateKeywords(content);
      if (containsInappropriate) {
        logger('detection', `🚨 부적절한 게시글 탐지: 게시판: ${type} 아이디: ${id}, 닉네임: ${nickname}, 제목: ${title}, 내용: ${content}, 링크: ${link} wrId ${wrId}`);
        await sendPostToTelegram({ type, id, nickname, title, content, date, link, originalTitle, originalContent, wrId });
        detectedPosts.push({ type, id, nickname, title, content, date, link, originalTitle, originalContent, wrId });
      }
    }

    return detectedPosts; // 항상 배열 반환
  } catch (error) {
    console.error(`❌ ${url}에서 데이터를 가져오는 중 오류 발생:`, error);
    return []; // 오류 발생 시 빈 배열 반환
  }
}

// 게시글 내용 가져오기 함수
async function fetchPostContent(link) {
  try {
    const response = await axios.get(link);
    const $ = cheerio.load(response.data);

    // 게시글 내용 추출 (예: .view-content 클래스 사용)
    const content = $('.view-content').text().trim(); // .view-content로 변경
    return content;
  } catch (error) {
    console.error(`❌ 게시글 내용 가져오는 중 오류 발생: ${link}`, error);
    return null;
  }
}

// 한글만 남기기 함수
function extractKorean(text) {
  return text.replace(/[^가-힣\s]/g, '').trim(); // 한글과 공백만 남기기
}

async function runDetection() {
  const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
  logger('detection', `runDetection 매크로 시작 한국 시간: ${koreaTime}`);
  logger('detection', "🔍 즉시 게시판 탐색 시작...");
  try {
    for (const url of boardUrls) {
      const detectedPosts = await detectKeywordsFromBoard(url);
      if (detectedPosts.length > 0) {
        // 탐지된 게시물 출력
        detectedPosts.forEach(post => {
          logger('detection', `아이디: ${post.id}, 닉네임: ${post.nickname}, 제목: ${post.title}, 내용: ${post.content}, 등록날짜: ${post.date}, 링크: ${post.link}`);
        });

        // 탐지된 게시글을 텔레그램으로 전송
        for (const post of detectedPosts) {
          await sendPostToTelegram(post); // 텔레그램으로 게시글 전송
        }
      } else {
        logger('detection', `✅ ${url}에서 탐지된 게시물이 없습니다.`);
      }
    }
  } catch (error) {
    logger('detection', "🔍 즉시 게시판 탐색 중 오류 발생:", error);
  }
}

module.exports = { runDetection };