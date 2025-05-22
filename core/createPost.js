const moment = require('moment-timezone');
const { logger } = require('../utils/loggerHelper');
const { sendMessage } = require('../services/telegram');
const { closePopup, login, gotoPage, logout } = require('../services/browser');
const puppeteer = require('puppeteer');
const { shuffle } = require('../utils/helpers');
const { xaiCall } = require('../api/xaiCall');
const { getUploadedPosts, markPostAsUploaded } = require('../utils/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const axios = require('axios');
const os = require('os');

// 이미지 URL을 로컬 파일로 다운로드하는 함수
const downloadImage = async (url, outputPath) => {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};

const validatePostTime = async (title, content) => {
    const now = moment().tz("Asia/Seoul"); // 현재 한국 시간
    const currentYear = now.year(); // 년도
    const currentMonth = now.month() + 1; // 월 (0부터 시작하므로 +1 필요)
    const currentDate = now.date(); // 일
    const currentDay = now.format('dddd'); // 요일
    const currentTime = now.format('HH:mm'); // 시간 (24시간 형식)

    console.log(`현재 시간: ${currentYear}년 ${currentMonth}월 ${currentDate}일 ${currentDay} ${currentTime}`);

    const prompt = `
        제목: ${title}
        내용: ${content}

        위 문구에서 시간 관련 표현이 있는지 확인해 주세요. 
        현재 시간은 ${currentYear}년 ${currentMonth}월 ${currentDate}일 ${currentDay} ${currentTime}입니다.
        만약 제목 또는는 내용에 시간 관련 표현이 있다면, 해당 표현이 현재 시간과 적합한지 판단해 주세요.
        굿밤은 무조건 밤이나 새벽에만 사용합니다.
        굿이브닝은 저녁에만 사용합니다.
        굿모닝은 아침에만 사용합니다. 
        아침과 아침시간은 06시~11시, 점심과 점심시간은 11시~14시, 저녁과 저녁시간은 17시~21시  범위를 벗어나면 안됩니다.
        A: 제목도 현재 시간과 맞는지, 안맞는지 비교 해주시고,
        B: 내용도 현재 시간과 맞는지, 안맞는지 비교 해주시고,
        A와 B가 모두 적합하다면 true로 해주세요
        A와 B에 시간 관련이 없다면 판단 후 true로 해주세요
        A에 시간관련이 있고, B에 시관관련이 없으면 A만 판단해주세요
        A에 시간관련이 없고, B에 시관관련이 있으면 B만 판단해주세요
        A와 B 중에 하나가 시간 관련이 있다면 엄격한 판단으로 해주세요
        오타가 있을 경우 이를 교정하여 적합성을 판단해 주세요.
        온슬은 온에어슬롯의 줄임말입니다.
        여기는 온에어슬롯 커뮤니티 자유게시판에 올릴 글입니다.
        장마 시기: 6월 하순부터 7월 말 사이
        출석 관련은 시간과 관련이 있습니다. 1등 대기는 오후 11시 30분부터 ~ 12시 사이로 보시면 됩니다. 00시에 초기화 됩니다.
        응답은 JSON 형식으로 반환해 주세요:
        {
            "isOkay": true/false, // 시간 관련 문구가 현재 시간과 적합하면 true, 아니면 false
            "reason": "적합/부적합 이유를 간단히 설명"
        }
    `;

    try {
        const response = await xaiCall(prompt); // AI 호출 결과를 기다림
        console.log('AI 응답:', response);
        return JSON.parse(response.trim()); // JSON 파싱 후 반환
    } catch (error) {
        console.error('AI 요청 실패:', error.message);
        throw error; // 에러를 호출한 곳으로 전달
    }
};

const runCreatePost = async () => {
    const koreaTime = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss");
    logger('createpost', `runCreatePost 매크로 시작 한국 시간: ${koreaTime}`);
    sendMessage('자유게시판 글쓰기 매크로 시작했습니다.');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--disable-gpu', '--disable-dev-shm-usage', '--disk-cache-dir=/tmp/cache'],
        protocolTimeout: 600000 * 25
    });
    const [page] = await browser.pages();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        page.on('dialog', async dialog => {
            console.log(`알림 => ${dialog.message()}`);
            await dialog.accept();
        });

        while (true) {
            const posts = await getUploadedPosts(); // DB에서 isUpload == 1인 게시글 가져오기
            if (posts.length === 0) {
                logger('createpost', '처리할 게시글이 없습니다. 작업 종료.');
                break; // 게시글이 없으면 루프 종료
            }

            logger('createpost', `총 ${posts.length}개의 게시글을 처리합니다.`);

            for (let index = 0; index < posts.length; index++) {
                const post = posts[index];
                const { id, title, content, images } = post;

                let ID_DATA2 = JSON.parse(process.env.ID_DATA2);
                shuffle(ID_DATA2, 0); // 배열 섞기
                logger('createpost', `현재 진행 중: ${index + 1}/${posts.length} (게시글 ID: ${id})`);
                console.log(`현재 진행 중: ${index + 1}/${posts.length} (게시글 ID: ${id})`);

                try {
                    // AI 시간 적절성 확인
                    const aiResponse = await validatePostTime(title, content);
                    if (!aiResponse.isOkay) {
                        logger('createpost', `게시글 ID ${id}는 시간 적절하지 않음(${aiResponse.reason}). 건너뜀.`);
                        continue;
                    }

                    const userId = ID_DATA2[0];
                    await gotoPage(page, 'https://onairslot.com');
                    await closePopup(page);
                    await login(page, userId);
                    logger('createpost', `로그인 완료: ${userId}`);

                    // 게시글 작성
                    await gotoPage(page, 'https://onairslot.com/bbs/write.php?bo_table=free');
                    await page.waitForSelector('#wr_subject', { timeout: 10000 });
                    await page.type('#wr_subject', title);

                    const editorFrame = page.frames().find(frame => frame.url().includes('SmartEditor2Skin.html'));
                    if (!editorFrame) throw new Error('SmartEditor2Skin.html iframe을 찾을 수 없습니다.');

                    await editorFrame.waitForSelector('button.se2_to_html', { visible: true, timeout: 10000 });
                    await editorFrame.evaluate(() => {
                        const button = document.querySelector('button.se2_to_html');
                        if (!button) throw new Error('HTML 버튼을 찾을 수 없습니다.');
                        button.click();
                    });

                    const isHtmlMode = await editorFrame.$eval('textarea.se2_input_htmlsrc', textarea => textarea.style.display !== 'none');
                    if (isHtmlMode) {
                        await editorFrame.type('textarea.se2_input_htmlsrc', content);
                    } else {
                        throw new Error('HTML 편집 모드로 전환 실패');
                    }

                    // 이미지 업로드 (최대 2개)
                    if (images && images.length > 0) {
                        const maxImages = Math.min(images.length, 2); // 최대 2개의 이미지만 업로드
                        logger('createpost', `이미지 업로드 시작 (총 ${maxImages}개)`);

                        const uploadedFiles = []; // 업로드된 파일 경로를 저장

                        for (let i = 0; i < maxImages; i++) {
                            const imageInputSelector = `#fwriteFile${i}`;
                            await page.waitForSelector(imageInputSelector, { timeout: 5000 });

                            // 이미지 URL을 로컬 파일로 다운로드
                            const homeDir = os.homedir(); // 홈 디렉토리
                            const localImagePath = path.join(homeDir, `image${i + 1}.jpg`);
                            await downloadImage(images[i], localImagePath);

                            // 로컬 파일 경로를 업로드
                            const inputElement = await page.$(imageInputSelector);
                            await inputElement.uploadFile(localImagePath);

                            logger('createpost', `이미지 ${i + 1} 업로드 완료: ${images[i]}`);

                            // 업로드된 파일 경로 저장
                            uploadedFiles.push(localImagePath);
                        }

                        // 게시글 작성 완료 후 버튼 클릭
                        await page.click('#btn_submit');
                        logger('createpost', `게시글 ID ${id} 작성 완료`);
                        await new Promise(resolve => setTimeout(resolve, 5000));

                        // Check if there are uploaded files before attempting to delete them
                        if (uploadedFiles && uploadedFiles.length > 0) {
                            for (const filePath of uploadedFiles) {
                                fs.unlink(filePath, (err) => {
                                    if (err) {
                                        logger('createpost', `임시 파일 삭제 실패: ${filePath}`);
                                    } else {
                                        logger('createpost', `임시 파일 삭제 완료: ${filePath}`);
                                    }
                                });
                            }
                        } else {
                            logger('createpost', '삭제할 업로드된 파일이 없습니다.');
                        }
                    } else {
                        logger('createpost', '이미지가 없어 업로드를 건너뜁니다.');

                        // 이미지가 없더라도 버튼 클릭
                        await page.click('#btn_submit');
                        logger('createpost', `게시글 ID ${id} 작성 완료`);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }

                    // DB 업데이트
                    await markPostAsUploaded(userId, id);
                    logger('createpost', `게시글 ID ${id}의 isUpload 상태를 2로 업데이트 완료`);
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // 로그아웃
                    await logout(page);
                    logger('createpost', '로그아웃 완료');

                    // 20분에서 50분 대기
                    const waitTime = Math.floor(Math.random() * (50 - 20 + 1) + 20) * 60 * 1000; // 20~50분 랜덤 대기
                    logger('createpost', `로그아웃 후 ${waitTime / 60000}분 대기 시작`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    logger('createpost', '대기 완료, 다음 작업 진행');
                } catch (error) {
                    logger('createpost', `게시글 ID ${id} 처리 중 오류 발생: ${error.message}`);
                    const currentUrl = page.url();
                    sendMessage(`게시글 ID ${id} 처리 중 오류 발생: ${error.message} 현재 페이지 URL: ${currentUrl}`);
                    await logout(page);
                }
            }
        }
    } catch (error) {
        logger('createpost', `runCreatePost 전체 오류: ${error.message}`);
    } finally {
        await browser.close();
        sendMessage('치명적인 에러 자유게시판 글쓰기 매크로 종료');
        logger('createpost', 'runCreatePost 매크로 종료');
    }
};

module.exports = { runCreatePost, validatePostTime };