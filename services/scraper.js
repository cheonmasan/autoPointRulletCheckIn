const axios = require('axios');
const cheerio = require('cheerio');
const { insertPost } = require('../utils/db'); // DB 삽입 함수 가져오기
const moment = require('moment-timezone');
const { logger } = require('../utils/loggerHelper');
dotenv = require('dotenv').config();

// 출석 체크 재시도용 함수
const retry = async (fn, maxRetries = 3, delay = 5000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (e) {
            console.log('checkin', `재시도 ${i + 1}/${maxRetries}: ${e.message}`);
            if (i === maxRetries - 1) throw e;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// ✅ 출석체크 데이터 가져오기
const checkinGetData = async () => {
    const url = `https://onairslot.com/plugin/attendance/`;
    let response;
    try {
        response = await retry(async () => {
            return await axios.get(url, { timeout: 10000 });
        });
    } catch (e) {
        console.log('checkin', `출석 데이터 가져오기 에러: ${e.message}, Stack=${e.stack}`);
        throw e;
    }

    const $ = cheerio.load(response.data);
    const currentDay = moment().tz("Asia/Seoul").format("DD");
    let checkInCount = 0;

    $('#attendance_layer > table > tbody > tr > td > div:nth-child(1) > a > span').each((index, element) => {
        const day = $(element).text().trim();
        if (day === currentDay) {
            const countElement = $(element).parent().parent().next();
            checkInCount = parseInt(countElement.text().trim()) || 0;
            return false;
        }
    });

    if (!checkInCount) {
        console.log('checkin', `현재 날짜(${currentDay})의 출석 데이터를 찾을 수 없음`);
    }
    return checkInCount;
};

// ✅ 활동왕 찾기용 스크랩
async function scrape(startDate, endDate, onProgress) {
    const dateRange = [];
    let current = moment(startDate);
    while (current.isSameOrBefore(endDate)) {
        dateRange.push(current.format('MM-DD'));
        current.add(1, 'day');
    }

    const startMoment = moment(startDate, 'YYYY-MM-DD');
    const startYear = startMoment.year();
    const postArray = [];
    const commentArray = [];
    const videoArray = [];
    let page = 1;
    let hasMorePages = true;

    // 게시물 스크래핑
    while (hasMorePages) {
        const url = `https://onairslot.com/bbs/new.php?gr_id=community&view=w&mb_id=&page=${page}`;
        try {
            const response = await axios.get(url);
            const $ = cheerio.load(response.data);
            const listItems = $('#new_list ul.na-table li');

            if (listItems.length === 0) {
                hasMorePages = false;
                onProgress({ page: 0, message: '게시물 스크래핑 완료!', log: `현재 게시물 url: ${url}, 항목 없음, 종료`, url });
                break;
            }

            let foundPosts = 0;
            let allPostsBeforeStart = true;

            listItems.each((index, element) => {
                const dayText = $(element).find('.nw-6').text().trim().replace('등록일', '').replace(/\s+/g, ' ');
                const logMessage = `현재 게시물 url: ${url}, 파싱 날짜: ${dayText}, 시작 날짜 - 끝 날짜: ${startDate} - ${endDate}`;
                onProgress({ page, message: `게시물 페이지 ${page} 처리 중...`, log: logMessage, url });

                let day;
                if (dayText.match(/^\s*\d{2}:\d{2}\s*$/)) {
                    day = moment().format('MM-DD');
                    allPostsBeforeStart = false;
                } else {
                    const dayMatch = dayText.match(/(\d{2}[-.]\d{2})/);
                    if (!dayMatch) {
                        return;
                    }
                    day = dayMatch[1].replace('.', '-');
                }

                const postDate = moment(`${startYear}-${day}`, 'YYYY-MM-DD');
                if (postDate.isBefore(startMoment, 'day')) {
                    return;
                } else {
                    allPostsBeforeStart = false;
                }

                if (dateRange.includes(day)) {
                    foundPosts++;
                    const name = $(element).find('.sv_member').text().trim();
                    const postObj = {
                        title: $(element).find('.na-subject').text().trim(),
                        name: name,
                        day: day,
                        board: $(element).find('.nw-8 a').attr('href').includes('bo_table=free') ? '자유게시판' : '슬롯리뷰게시판'
                    };
                    postArray.push(postObj);
                }
            });

            if (allPostsBeforeStart && foundPosts === 0) {
                hasMorePages = false;
                onProgress({ page: 0, message: '게시물 스크래핑 완료!', log: `현재 게시물 url: ${url}, 모든 게시물이 시작 날짜(${startDate})보다 이전, 종료`, url });
                break;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
            onProgress({ page, message: `게시물 페이지 ${page} 처리 중...`, log: null, url: null });
            page++;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                hasMorePages = false;
                onProgress({ page: 0, message: '게시물 스크래핑 완료!', log: `현재 게시물 url: ${url}, 404, 종료`, url });
            } else {
                throw error;
            }
        }
    }

    // 댓글 스크래핑
    page = 1;
    hasMorePages = true;

    while (hasMorePages) {
        const url = `https://onairslot.com/bbs/new.php?gr_id=community&view=c&mb_id=&page=${page}`;
        try {
            const response = await axios.get(url);
            const $ = cheerio.load(response.data);
            const listItems = $('#new_list ul.na-table li');

            if (listItems.length === 0) {
                hasMorePages = false;
                onProgress({ page: 0, message: '댓글 스크래핑 완료!', log: `현재 댓글 url: ${url}, 항목 없음, 종료`, url });
                break;
            }

            let foundComments = 0;
            let allCommentsBeforeStart = true;

            listItems.each((index, element) => {
                const dayText = $(element).find('.nw-6').text().trim().replace('등록일', '').replace(/\s+/g, ' ');
                const logMessage = `현재 댓글 url: ${url}, 파싱 날짜: ${dayText}, 시작 날짜 - 끝 날짜: ${startDate} - ${endDate}`;
                onProgress({ page, message: `댓글 페이지 ${page} 처리 중...`, log: logMessage, url });

                let day;
                if (dayText.match(/^\s*\d{2}:\d{2}\s*$/)) {
                    day = moment().format('MM-DD');
                    allCommentsBeforeStart = false;
                } else {
                    const dayMatch = dayText.match(/(\d{2}[-.]\d{2})/);
                    if (!dayMatch) {
                        return;
                    }
                    day = dayMatch[1].replace('.', '-');
                }

                const commentDate = moment(`${startYear}-${day}`, 'YYYY-MM-DD');
                if (commentDate.isBefore(startMoment, 'day')) {
                    return;
                } else {
                    allCommentsBeforeStart = false;
                }

                if (dateRange.includes(day)) {
                    foundComments++;
                    const name = $(element).find('.sv_member').text().trim();
                    const commentObj = {
                        name: name,
                        day: day
                    };
                    commentArray.push(commentObj);
                }
            });

            if (allCommentsBeforeStart && foundComments === 0) {
                hasMorePages = false;
                onProgress({ page: 0, message: '댓글 스크래핑 완료!', log: `현재 댓글 url: ${url}, 모든 댓글이 시작 날짜(${startDate})보다 이전, 종료`, url });
                break;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
            onProgress({ page, message: `댓글 페이지 ${page} 처리 중...`, log: null, url: null });
            page++;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                hasMorePages = false;
                onProgress({ page: 0, message: '댓글 스크래핑 완료!', log: `현재 댓글 url: ${url}, 404, 종료`, url });
            } else {
                throw error;
            }
        }
    }

    // 영상 스크래핑
    page = 1;
    hasMorePages = true;

    while (hasMorePages) {
        const url = `https://onairslot.com/bbs/board.php?bo_table=live&page=${page}`;
        try {
            const response = await axios.get(url);
            const $ = cheerio.load(response.data);
            const listItems = $('ul.row li.col.px-2.pb-4');

            if (listItems.length === 0) {
                hasMorePages = false;
                onProgress({ page: 0, message: '영상 스크래핑 완료!', log: `현재 영상 url: ${url}, 항목 없음, 종료`, url });
                break;
            }

            let foundVideos = 0;
            let allVideosBeforeStart = true;

            listItems.each((index, element) => {
                const dayText = $(element).find('.float-right.text-muted').text().trim().replace('등록일', '').replace(/\s+/g, ' ');
                const logMessage = `현재 영상 url: ${url}, 파싱 날짜: ${dayText}, 시작 날짜 - 끝 날짜: ${startDate} - ${endDate}`;
                onProgress({ page, message: `영상 페이지 ${page} 처리 중...`, log: logMessage, url });

                let day;
                if (dayText.match(/^\s*\d{2}:\d{2}\s*$/)) {
                    day = moment().format('MM-DD');
                    allVideosBeforeStart = false;
                } else {
                    const dayMatch = dayText.match(/(\d{2}\.\d{2})/);
                    if (!dayMatch) {
                        return;
                    }
                    day = dayMatch[1].replace('.', '-');
                }

                const videoDate = moment(`${startYear}-${day}`, 'YYYY-MM-DD');
                if (videoDate.isBefore(startMoment, 'day')) {
                    return;
                } else {
                    allVideosBeforeStart = false;
                }

                if (dateRange.includes(day)) {
                    const title = $(element).find('.na-subject').text().trim();
                    const nameMatch = title.match(/\[(.*?)\]/);
                    if (!nameMatch) {
                        return;
                    }
                    const name = nameMatch[1].replace('님', '').trim();

                    foundVideos++;
                    const videoObj = {
                        name: name,
                        day: day
                    };
                    videoArray.push(videoObj);
                }
            });

            if (allVideosBeforeStart && foundVideos === 0) {
                hasMorePages = false;
                onProgress({ page: 0, message: '영상 스크래핑 완료!', log: `현재 영상 url: ${url}, 모든 영상이 시작 날짜(${startDate})보다 이전, 종료`, url });
                break;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
            onProgress({ page, message: `영상 페이지 ${page} 처리 중...`, log: null, url: null });
            page++;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                hasMorePages = false;
                onProgress({ page: 0, message: '영상 스크래핑 완료!', log: `현재 영상 url: ${url}, 404, 종료`, url });
            } else {
                throw error;
            }
        }
    }

    const uniqueNames = [...new Set([...postArray.map(item => item.name), ...commentArray.map(item => item.name), ...videoArray.map(item => item.name)])];
    const results = uniqueNames.map(name => {
        const freePosts = postArray.filter(p => p.name === name && p.board === '자유게시판').length;
        const slotPosts = postArray.filter(p => p.name === name && p.board === '슬롯리뷰게시판').length;
        const comments = commentArray.filter(c => c.name === name).length;
        const videoUploads = videoArray.filter(v => v.name === name).length; // 'c' → 'v'로 수정
        const totalScore = (freePosts * 20) + (slotPosts * 30) + (comments * 10) + (videoUploads * 40);
        return { name, freePosts, slotPosts, comments, videoUploads, totalScore };
    });

    results.sort((a, b) => b.totalScore - a.totalScore);
    results.forEach((item, index) => {
        item.rank = index < 3 ? index + 1 : '';
    });

    return results;
}

async function slotmonsterScrape(){
    const crolling_site1_URL = process.env.crolling_site1_URL;

    try {
        for (let page = 1; page <= 1173; page++) {
            const pageUrl = `${crolling_site1_URL}&page=${page}`;
            console.log('createpost', `페이지 크롤링 시작: ${pageUrl}`);

            // 1. URL에서 HTML 가져오기
            const response = await axios.get(pageUrl);
            const html = response.data;

            // 2. Cheerio로 HTML 파싱
            const $ = cheerio.load(html);

            // 3. 게시글 목록에서 링크 추출
            const posts = [];
            $('.list-item').each((index, element) => {
                // 공지사항인지 확인
                const isNotice = $(element).find('.wr-icon.wr-notice').length > 0;
                if (isNotice) {
                    return; // 공지사항은 건너뜀
                }

                // 링크 추출
                const link = $(element).find('.wr-subject .item-subject').attr('href');
                if (link) {
                    const fullLink = link.startsWith('http') ? link : `https://interstic.io${link}`;
                    
                    // wr_id 추출
                    const wrIdMatch = fullLink.match(/wr_id=(\d+)/) || fullLink.match(/wr_id\/(\d+)/);
                    const wrId = wrIdMatch ? wrIdMatch[1] : null;

                    if (wrId) {
                        posts.push({ link: fullLink, wrId });
                    }
                }
            });

            // 4. 각 게시글 링크에 접속하여 데이터 가져오기
            for (const post of posts) {
                try {
                    const postResponse = await axios.get(post.link);
                    const postHtml = postResponse.data;
                    const $$ = cheerio.load(postHtml);

                    // 제목, 내용, 날짜 추출
                    const title = $$('h1[itemprop="headline"]').text().trim();
                    const content = $$('.view-content').text().trim();
                    const date = $$('span[itemprop="datePublished"]').attr('content') || moment().tz("Asia/Seoul").format("YYYY-MM-DD");

                    // 이미지 추출 (최대 5개)
                    const images = [];
                    $$('.view-content img').each((i, img) => {
                        if (i >= 5) return false; // 최대 5개까지만 처리
                        const imgSrc = $$(img).attr('src');
                        if (imgSrc) {
                            const absoluteUrl = imgSrc.startsWith('http') ? imgSrc : `https://interstic.io${imgSrc}`;
                            images.push(absoluteUrl); // 이미지 URL 저장
                        }
                    });

                    // DB에 저장 (wr_id 포함)
                    await insertPost(title, content, date, images, post.wrId);
                    console.log('createpost', `게시글 저장 완료: ${title}, wr_id: ${post.wrId}`);
                } catch (postError) {
                    console.log('createpost', `❌ 게시글 크롤링 중 오류 발생: ${post.link}, ${postError.message}`);
                }
            }
        }
    } catch (error) {
        console.log('createpost', `❌ 데이터 크롤링 중 오류 발생: ${error.message}`);
    }
}

// ✅ 모듈화
module.exports = {
    checkinGetData,
    scrape,
    slotmonsterScrape
};
