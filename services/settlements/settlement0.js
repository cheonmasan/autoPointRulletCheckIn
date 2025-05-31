const { connect } = require("puppeteer-real-browser");
const moment = require('moment-timezone');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const TwoCaptcha = require("@2captcha/captcha-solver")

async function crawlSite0(index) {
    const URL = process.env[`settlement0_site${index}_URL`];
    const ID = process.env[`settlement0_site${index}_ID`];
    const PWD = process.env[`settlement0_site${index}_PWD`];
    const TWOCAPTCHA_API_KEY = process.env['TWOCAPTCHA_API_KEY'];
    const solver = new TwoCaptcha.Solver(TWOCAPTCHA_API_KEY, 10000)

    if (!URL || !ID || !PWD) {
        console.warn(`⚠️ site${index} 정보가 .env에 없습니다.`);
        return null;
    }

    // const browser = await puppeteer.launch({ headless: false });
    // const page = await browser.newPage();
    const { page, browser } = await connect({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox','--proxy-server=socks5://3.35.149.181:1080'],
        customConfig: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
            headers: {
                'Accept-Language': 'en-US,en;q=0.9',
            },
        },
        turnstile: true,
    });
    page.setViewport({ width: 1920, height: 1080 })

    page.on('dialog', async dialog => {
        await dialog.accept();
    });

    try {
        await page.goto(URL, { waitUntil: 'networkidle2' });

        if (index === 1) { //라바
            await new Promise(resolve => setTimeout(resolve, 10000));
            await page.waitForSelector('#userid', { timeout: 30000 });
            let loginSuccess = false;
            await page.type('#userid', ID);
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await page.type('#passwd', PWD);
                    const captchaElement = await page.$('#imgCaptcha');
                    if (!captchaElement) throw new Error('CAPTCHA 이미지 없음');

                    const screenshot = await captchaElement.screenshot({ encoding: 'base64' });

                    // 2Captcha로 해결
                    const solution = await solver.imageCaptcha({ body: screenshot, numeric: 1, min_len: 6, max_len: 6 });
                    console.table(solution);
                    if (!solution?.data) throw new Error('2Captcha 해결 실패');

                    // CAPTCHA 입력 필드 초기화
                    await page.evaluate(() => {
                        const captchaInput = document.querySelector('input[name="txtCaptcha"]');
                        if (captchaInput) captchaInput.value = ''; // 필드 초기화
                    });

                    // CAPTCHA 입력
                    await page.type('input[name="txtCaptcha"]', solution.data);

                    // 로그인 버튼 클릭
                    await Promise.all([
                        page.click('button[type="submit"]'),
                        page.waitForNavigation({ waitUntil: ['networkidle2', 'domcontentloaded'] })
                    ]);

                    await new Promise(resolve => setTimeout(resolve, 10000)); // 로그인 후 10초 대기
                    // 로그인 성공 여부 확인
                    if (!page.url().includes('login')) {
                        loginSuccess = true;
                        break;
                    }

                    console.warn(`index ${index}: 로그인 실패, 2Captcha 재시도 (${attempt}/3)`);
                    await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기
                } catch (e) {
                    console.warn(`index ${index}: 2Captcha 시도 ${attempt}/3 실패`, e);
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기
                    }
                }
            }

            if (!loginSuccess) {
                throw new Error('로그인 실패');
            }

            // 회원 리스트 페이지로 이동
            const memberListURL = `${URL}/member/list.asp?page=1&code_group=T1&code_no=S0&search_store_group=365&memType=all&myMember=&mb_sort1=&search_level=0&mode=&keyfield=userid&keyword=&mb_sort=&pagesize=20`;
            await page.goto(memberListURL, { waitUntil: 'networkidle2' });

            // 어제 날짜 계산
            const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY/MM/DD');

            // 가입자 수 및 블랙리스트 수 초기화
            let join = 0;
            let black = 0;

            // 1페이지 데이터 크롤링
            const pageData = await page.evaluate(() => {
                const rows = document.querySelectorAll('#lists .tr');
                return Array.from(rows).map(row => {
                    const cells = row.querySelectorAll('td');
                    const bgColor = row.getAttribute('bgcolor') || ''; // 색상 확인
                    return {
                        joinDate: cells[13]?.innerText.trim(), // 가입일자
                        bgColor: bgColor.trim(), // 배경색
                    };
                });
            });

            // 데이터 처리
            pageData.forEach(data => {
                if (data.joinDate.startsWith(yesterday)) {
                    join++; // 어제 가입자 수 증가
                    if (data.bgColor === '#FFE8BF') {
                        black++; // 배경색이 #FFE8BF인 경우 블랙리스트 수 증가
                    }
                }
            });

            // 정산 페이지로 이동
            const sdate = moment().tz('Asia/Seoul').subtract(1, 'days').startOf('month').format('YYYY-MM-DD');
            const edate = moment().tz('Asia/Seoul').format('YYYY-MM-DD');
            const accountDayURL = `${URL}/partner/account_day.asp?code_group=T2&code_no=S0&store_group=365&sdate=${sdate}&edate=${edate}&search_store_group=365&search_level=1`;
            await page.goto(accountDayURL, { waitUntil: 'networkidle2' });

            // 정산 데이터 크롤링
            const settlementData = await page.evaluate(() => {
                const rows = document.querySelectorAll('#lists .tr');
                const totals = document.querySelectorAll('tr:last-child .td_content_bg font'); // 합계 행 데이터
                let deposit = 0;
                let withdraw = 0;
                let charge = 0;

                // 어제 날짜 계산 (형식: YYYY-MM-DD)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const formattedYesterday = yesterday.toISOString().split('T')[0];

                // 어제 날짜와 일치하는 행 찾기
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    const dateCell = cells[1]?.innerText.trim(); // 날짜 열

                    if (dateCell && dateCell.startsWith(formattedYesterday)) {
                        const depositCell = cells[3]?.innerText.trim(); // 당일충전
                        const withdrawCell = cells[4]?.innerText.trim(); // 당일환전

                        // 당일충전 금액과 충전자 수 추출
                        if (depositCell) {
                            const depositMatch = depositCell.match(/([\d,]+)\s+\((\d+)\/(\d+)\)/);
                            if (depositMatch) {
                                deposit = parseInt(depositMatch[1].replace(/,/g, ''), 10); // 금액
                                charge = parseInt(depositMatch[3], 10); // 충전자 수
                            }
                        }

                        // 당일환전 금액 추출
                        if (withdrawCell) {
                            withdraw = parseInt(withdrawCell.replace(/,/g, ''), 10);
                        }
                    }
                });

                // 합계 행에서 총입금(totalIn)과 총출금(totalOut) 추출
                const totalIn = totals[0]?.innerText.trim().replace(/,/g, '') || '0'; // 합계 당일충전
                const totalOut = totals[1]?.innerText.trim().replace(/,/g, '') || '0'; // 합계 당일환전

                return {
                    charge, // 충전자 수
                    deposit, // 어제 입금 금액
                    withdraw, // 어제 출금 금액
                    totalIn: parseInt(totalIn, 10), // 총입금
                    totalOut: parseInt(totalOut, 10) // 총출금
                };
            });

            // 금액 포맷팅
            settlementData.deposit = settlementData.deposit.toLocaleString('en-US');
            settlementData.withdraw = settlementData.withdraw.toLocaleString('en-US');
            settlementData.totalIn = settlementData.totalIn.toLocaleString('en-US');
            settlementData.totalOut = settlementData.totalOut.toLocaleString('en-US');

            // 결과 반환
            return {
                site: '라바카지노', // 사이트 이름은 .env에서 가져오거나 별도 설정
                date: yesterday,
                join,
                black,
                ...settlementData
            };
        } else if (index === 2) { // 네임드
            await page.waitForSelector('input[name="login_id"]', { timeout: 30000 });
            await page.type('input[name="login_id"]', ID);
            await page.type('input[name="login_pw"]', PWD);
            await Promise.all([
                page.click('input[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            // 회원 리스트 크롤링
            const memberListURL = `${URL}/agent/member_list`;
            await page.goto(memberListURL, { waitUntil: 'networkidle2' });

            // 데이터가 로드될 때까지 대기
            await page.waitForSelector('.tb_data table tbody tr', { timeout: 60000 });

            // 어제 날짜 계산
            const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');

            // 가입자 수 및 블랙리스트 수 초기화
            let join = 0;
            let black = 0;

            // 회원 리스트 데이터 크롤링
            const memberData = await page.evaluate(() => {
                const rows = document.querySelectorAll('.tb_data table tbody tr');
                return Array.from(rows).map(row => {
                    const cells = row.querySelectorAll('td');
                    return {
                        joinDate: cells[13]?.innerText.trim(), // 가입일자
                        status: cells[14]?.innerText.trim()   // 상태 (정상, 차단, 탈퇴 등)
                    };
                });
            });

            // 데이터 처리
            memberData.forEach(data => {
                if (data.joinDate === yesterday) {
                    join++; // 어제 가입자 수 증가
                    if (data.status === '탈퇴' || data.status === '차단') {
                        black++; // 상태가 탈퇴 또는 차단인 경우 블랙리스트 수 증가
                    }
                }
            });

            // 정산 데이터 크롤링 함수
            async function crawlSettlementData(startDate, endDate) {
                const settlementURL = `${URL}/agent/daily_log_member?str=&order=&by=desc&start=${startDate}&end=${endDate}&mt=mb&str=`;
                await page.goto(settlementURL, { waitUntil: 'networkidle2' });

                let charge = 0;
                let deposit = 0;
                let withdraw = 0;

                // 페이징 처리
                let hasNextPage = true;
                while (hasNextPage) {
                    // 데이터가 로드될 때까지 대기
                    await page.waitForSelector('.tb_data table tbody', { timeout: 60000 });

                    // 현재 페이지 데이터 크롤링
                    const pageData = await page.evaluate(() => {
                        const noDataElement = document.querySelector('.tb_data table tbody .no_data');
                        if (noDataElement) {
                            // 데이터가 없는 경우
                            return [];
                        }

                        const rows = document.querySelectorAll('.tb_data table tbody tr');
                        return Array.from(rows).map(row => {
                            const cells = row.querySelectorAll('td');
                            return {
                                deposit: cells[9]?.innerText.trim(), // 충전 금액
                                withdraw: cells[10]?.innerText.trim() // 환전 금액
                            };
                        });
                    });

                    // 데이터가 없는 경우 처리
                    if (pageData.length === 0) {
                        console.log('데이터가 없습니다.');
                        break;
                    }

                    // 데이터 처리
                    pageData.forEach(data => {
                        const depositAmount = parseInt((data.deposit || '0').replace(/,/g, ''), 10) || 0;
                        const withdrawAmount = parseInt((data.withdraw || '0').replace(/,/g, ''), 10) || 0;

                        if (depositAmount > 0) {
                            charge++; // 충전 금액이 0보다 크면 charge 증가
                            deposit += depositAmount; // 충전 금액 합산
                        }

                        withdraw += withdrawAmount; // 환전 금액 합산
                    });

                    // 다음 페이지로 이동
                    const nextPageLink = await page.$('div.paging a[rel="next"]');
                    if (nextPageLink) {
                        const nextPageURL = await page.evaluate(el => el.href, nextPageLink);
                        await page.goto(nextPageURL, { waitUntil: 'networkidle2' });
                    } else {
                        hasNextPage = false; // 다음 페이지가 없으면 종료
                    }
                }

                return { charge, deposit, withdraw };
            }

            // 어제~어제 데이터 크롤링
            const yesterdayData = await crawlSettlementData(yesterday, yesterday);

            // 1일~어제 데이터 크롤링
            const firstDayOfMonth = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD');
            const monthToYesterdayData = await crawlSettlementData(firstDayOfMonth, yesterday);

            // 반환 데이터 포맷팅
            const settlementData = {
                site: '네임드', // 사이트 이름
                date: yesterday,
                join, // 회원 리스트에서 계산된 가입자 수
                black, // 회원 리스트에서 계산된 블랙리스트 수
                deposit: yesterdayData.deposit.toLocaleString('en-US'), // 어제 충전 금액
                withdraw: yesterdayData.withdraw.toLocaleString('en-US'), // 어제 환전 금액
                charge: yesterdayData.charge, // 어제 충전 회원 수
                totalIn: monthToYesterdayData.deposit.toLocaleString('en-US'), // 1일~어제 총 충전 금액
                totalOut: monthToYesterdayData.withdraw.toLocaleString('en-US') // 1일~어제 총 환전 금액
            };

            return settlementData;
        } else if (index === 3) { // 판도라
            await new Promise(resolve => setTimeout(resolve, 30000));
            await page.type('input[name="login_id"]', ID);
            await page.type('input[name="login_pw"]', PWD);
            await Promise.all([
                page.click('input[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            // 회원 리스트 크롤링
            const memberListURL = `${URL}/agent/member_list`;
            await page.goto(memberListURL, { waitUntil: 'networkidle2' });

            // 데이터가 로드될 때까지 대기
            await page.waitForSelector('.tb_data table tbody tr', { timeout: 60000 });

            // 어제 날짜 계산
            const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');

            // 가입자 수 및 블랙리스트 수 초기화
            let join = 0;
            let black = 0;

            // 회원 리스트 데이터 크롤링
            const memberData = await page.evaluate(() => {
                const rows = document.querySelectorAll('.tb_data table tbody tr');
                return Array.from(rows).map(row => {
                    const cells = row.querySelectorAll('td');
                    return {
                        joinDate: cells[13]?.innerText.trim(), // 가입일자
                        status: cells[14]?.innerText.trim()   // 상태 (정상, 차단, 탈퇴 등)
                    };
                });
            });

            // 데이터 처리
            memberData.forEach(data => {
                if (data.joinDate === yesterday) {
                    join++; // 어제 가입자 수 증가
                    if (data.status === '탈퇴' || data.status === '차단') {
                        black++; // 상태가 탈퇴 또는 차단인 경우 블랙리스트 수 증가
                    }
                }
            });

            // 정산 데이터 크롤링 함수
            async function crawlSettlementData(startDate, endDate) {
                const settlementURL = `${URL}/agent/daily_log_member?str=&order=&by=desc&start=${startDate}&end=${endDate}&mt=mb&str=`;
                await page.goto(settlementURL, { waitUntil: 'networkidle2' });

                let charge = 0;
                let deposit = 0;
                let withdraw = 0;

                // 페이징 처리
                let hasNextPage = true;
                while (hasNextPage) {
                    // 데이터가 로드될 때까지 대기
                    await page.waitForSelector('.tb_data table tbody', { timeout: 60000 });

                    // 현재 페이지 데이터 크롤링
                    const pageData = await page.evaluate(() => {
                        const noDataElement = document.querySelector('.tb_data table tbody .no_data');
                        if (noDataElement) {
                            // 데이터가 없는 경우
                            return [];
                        }

                        const rows = document.querySelectorAll('.tb_data table tbody tr');
                        return Array.from(rows).map(row => {
                            const cells = row.querySelectorAll('td');
                            return {
                                deposit: cells[9]?.innerText.trim(), // 충전 금액
                                withdraw: cells[10]?.innerText.trim() // 환전 금액
                            };
                        });
                    });

                    // 데이터가 없는 경우 처리
                    if (pageData.length === 0) {
                        console.log('데이터가 없습니다.');
                        break;
                    }

                    // 데이터 처리
                    pageData.forEach(data => {
                        const depositAmount = parseInt((data.deposit || '0').replace(/,/g, ''), 10) || 0;
                        const withdrawAmount = parseInt((data.withdraw || '0').replace(/,/g, ''), 10) || 0;

                        if (depositAmount > 0) {
                            charge++; // 충전 금액이 0보다 크면 charge 증가
                            deposit += depositAmount; // 충전 금액 합산
                        }

                        withdraw += withdrawAmount; // 환전 금액 합산
                    });

                    // 다음 페이지로 이동
                    const nextPageLink = await page.$('div.paging a[rel="next"]');
                    if (nextPageLink) {
                        const nextPageURL = await page.evaluate(el => el.href, nextPageLink);
                        await page.goto(nextPageURL, { waitUntil: 'networkidle2' });
                    } else {
                        hasNextPage = false; // 다음 페이지가 없으면 종료
                    }
                }

                return { charge, deposit, withdraw };
            }

            // 어제~어제 데이터 크롤링
            const yesterdayData = await crawlSettlementData(yesterday, yesterday);

            // 1일~어제 데이터 크롤링
            const firstDayOfMonth = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD');
            const monthToYesterdayData = await crawlSettlementData(firstDayOfMonth, yesterday);

            // 반환 데이터 포맷팅
            const settlementData = {
                site: '판도라', // 사이트 이름
                date: yesterday,
                join, // 회원 리스트에서 계산된 가입자 수
                black, // 회원 리스트에서 계산된 블랙리스트 수
                deposit: yesterdayData.deposit.toLocaleString('en-US'), // 어제 충전 금액
                withdraw: yesterdayData.withdraw.toLocaleString('en-US'), // 어제 환전 금액
                charge: yesterdayData.charge, // 어제 충전 회원 수
                totalIn: monthToYesterdayData.deposit.toLocaleString('en-US'), // 1일~어제 총 충전 금액
                totalOut: monthToYesterdayData.withdraw.toLocaleString('en-US') // 1일~어제 총 환전 금액
            };

            return settlementData;
        }
        return null;
    } catch (err) {
        console.error(`❌ site${index} 에러:`, err);
        return null;
    } finally {
        await browser.close();
    }
}

module.exports = { crawlSite0 };