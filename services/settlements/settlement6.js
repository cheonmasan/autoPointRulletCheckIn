const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });


async function crawlSite6(index) {
    const URL = process.env[`settlement6_site${index}_URL`];
    const ID = process.env[`settlement6_site${index}_ID`];
    const PWD = process.env[`settlement6_site${index}_PWD`];

    if (!URL || !ID || !PWD) {
        console.warn(`⚠️ site${index} 정보가 .env에 없습니다.`);
        return null;
    }

    const browser = await puppeteer.launch({ 
        headless: 'new', 
        args: [
            '--no-sandbox', // 샌드박스 비활성화 (권장되지 않지만 일부 환경에서 필요)
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled', // 자동화 탐지 방지
            '--disable-infobars', // "Chrome이 자동화 소프트웨어에 의해 제어되고 있습니다" 메시지 숨김
            '--window-size=1920,1080', // 브라우저 창 크기 설정
            '--ignore-certificate-errors', // SSL 인증서 오류 무시
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' // 일반적인 사용자 에이전트 설정
        ],
        defaultViewport: null, // 기본 뷰포트 비활성화 (전체 화면 사용)
        ignoreDefaultArgs: ['--enable-automation'], // 자동화 탐지 방지
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('dialog', async dialog => {
        await dialog.accept();
    });

    try {
        await page.goto(URL, { waitUntil: ['networkidle2', 'domcontentloaded'] });

        // 날짜 범위 설정
        const today = moment().tz('Asia/Seoul');
        const currentDate = today.date();
        if (currentDate !== 1 && currentDate !== 16) {
            console.warn(`⚠️ 오늘(${today.format('YYYY-MM-DD')})은 1일 또는 16일이 아닙니다. 검색 실행 안 함.`);
            return [];
        }

        let startDate, endDate;
        if (currentDate === 1) {
            startDate = moment().tz('Asia/Seoul').subtract(2, 'month').date(16);
            endDate = moment().tz('Asia/Seoul').subtract(2, 'month').endOf('month');
        } else {
            startDate = moment().tz('Asia/Seoul').startOf('month');
            endDate = moment().tz('Asia/Seoul').date(15);
        }

        const dateRange = [];
        for (let d = moment(startDate); d.isSameOrBefore(endDate); d.add(1, 'days')) {
            dateRange.push(d.format('YYYY-MM-DD'));
        }

        // 날짜별 데이터 초기화
        const dailyData = dateRange.map(date => ({
            date,
            join: 0,
            black: 0,
            charge: 0,
            deposit: 0,
            withdraw: 0,
            totalIn: '0',
            totalOut: '0'
        }));

        if (index === 1) { // 젠
            // 로그인 입력
            await page.type('input[name="uid"]', ID);
            await page.type('input[name="pwd"]', PWD);
            await page.type('input[name="captcha"]', '1111');

            // 로그인 버튼 클릭
            await Promise.all([
                page.click('button[onclick="login()"]'),
                page.waitForNavigation({ waitUntil: ['networkidle2', 'domcontentloaded'] })
            ]);

            await new Promise(resolve => setTimeout(resolve, 20000));

            // 로그인 성공 여부 확인
            const currentUrl = page.url();
            if (currentUrl.includes('proc/loginProcess.php')) {
                console.error('index 1: 로그인 실패, URL:', currentUrl);
                return dateRange.map(date => ({
                    site: '젠',
                    date,
                    join: 0,
                    black: 0,
                    charge: 0,
                    deposit: '0',
                    withdraw: '0',
                    totalIn: '0',
                    totalOut: '0'
                }));
            }

            // 프레임 찾기
            const frames = page.frames();
            let targetFrame = null;
            let sidebarFrame = null;
            for (const frame of frames) {
                const hasTable = await frame.evaluate(() => {
                    const table = document.querySelector('.table.table-bordered tbody tr');
                    if (table) return true;
                    return false;
                });
                const hasSidebar = await frame.evaluate(() => {
                    const sidebar = document.querySelector('.nav.nav-pills.nav-sidebar');
                    if (sidebar) return true;
                    return false;
                });
                if (hasTable) targetFrame = frame;
                if (hasSidebar) sidebarFrame = frame;
            }

            if (!targetFrame || !sidebarFrame) {
                console.warn('index 1: 테이블 또는 사이드바 프레임 찾기 실패');
                return dateRange.map(date => ({
                    site: '젠',
                    date,
                    join: 0,
                    black: 0,
                    charge: 0,
                    deposit: '0',
                    withdraw: '0',
                    totalIn: '0',
                    totalOut: '0'
                }));
            }

            await targetFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 30000 }
            );

            // 회원 데이터 크롤링
            const cellData = await targetFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                if (rows.length === 0) return [];
                const data = [];
                for (const row of rows) {
                    const cells = row.querySelectorAll('td');
                    let regDate = '';
                    let status = '';
                    if (cells[9]) regDate = cells[9].textContent.trim();
                    if (cells[10]) status = cells[10].textContent.trim();
                    data.push({ regDate, status });
                }
                return data;
            });

            if (cellData.length === 0) {
                console.warn('index 1: /main.php 테이블 데이터 없음');
            }

            for (const res of cellData) {
                if (!res.regDate) continue;
                const regDate = res.regDate.slice(0, 10);
                const dateIndex = dailyData.findIndex(d => d.date === regDate);
                if (dateIndex !== -1) {
                    dailyData[dateIndex].join++;
                    if (res.status === '탈퇴') dailyData[dateIndex].black++;
                }
            }

            // depositList.php 로드
            const viewFrame = frames.find(f => {
                const name = f.name();
                if (name === 'ViewFrm') return true;
                return false;
            });
            if (!viewFrame) {
                console.warn('index 1: ViewFrm 프레임 찾기 실패');
                return dailyData.map(d => ({
                    site: '젠',
                    date: d.date,
                    join: d.join,
                    black: d.black,
                    charge: 0,
                    deposit: '0',
                    withdraw: '0',
                    totalIn: '0',
                    totalOut: '0'
                }));
            }

            await sidebarFrame.click('a[href="depositList.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 20000));

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // deposit 데이터 검색
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, startDate.format('YYYY-MM-DD'));
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, endDate.format('YYYY-MM-DD'));
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 20000));

            let searchSuccess = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await viewFrame.waitForFunction(
                        () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                        { timeout: 60000 }
                    );
                    searchSuccess = true;
                    break;
                } catch (e) {
                    console.warn(`index 1: deposit 검색 결과 대기 재시도 (${attempt}/3):`, e.message);
                    const html = await viewFrame.content();
                }
            }

            const depositByDate = {};
            const idsByDate = {};
            dateRange.forEach(date => {
                depositByDate[date] = 0;
                idsByDate[date] = new Set();
            });

            if (searchSuccess) {
                const tbodyContent = await viewFrame.evaluate(() => document.querySelector('.table.table-bordered tbody').innerHTML);

                let pageLinks = [];
                let attempts = 3;
                while (attempts--) {
                    try {
                        pageLinks = await viewFrame.evaluate(() => {
                            const links = document.querySelectorAll('.pagination a');
                            const pageNumbers = [];
                            for (const link of links) {
                                const match = link.href.match(/goPage\('(\d+)'\)/);
                                if (match) pageNumbers.push(match[1]);
                            }
                            return pageNumbers;
                        });
                        break;
                    } catch (e) {
                        console.warn(`index 1: deposit 페이지네이션 읽기 재시도 (${3 - attempts}/3):`, e.message);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                const totalPages = pageLinks.length > 0 ? Math.max(...pageLinks.map(Number)) + 1 : 1;

                for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                    if (pageNum > 0) {
                        await viewFrame.evaluate(page => window.goPage(page), pageNum);
                        await new Promise(resolve => setTimeout(resolve, 20000));
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 20000));
                    }

                    let pageLoadSuccess = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            await viewFrame.waitForFunction(
                                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                                { timeout: 60000 }
                            );
                            pageLoadSuccess = true;
                            break;
                        } catch (e) {
                            console.warn(`index 1: deposit 페이지 ${pageNum + 1} 테이블 로드 재시도 (${attempt}/3):`, e.message);
                        }
                    }

                    if (!pageLoadSuccess) {
                        console.warn(`index 1: deposit 페이지 ${pageNum + 1} 테이블 로드 실패`);
                        continue;
                    }

                    const pageData = await viewFrame.evaluate(() => {
                        const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                        const data = [];
                        for (const row of rows) {
                            const cells = row.querySelectorAll('td');
                            let id = '';
                            let amount = '0';
                            let processDate = '';
                            let status = '';
                            if (cells[0]) id = cells[0].textContent.trim();
                            if (cells[1]) amount = cells[1].textContent.trim();
                            if (cells[4]) processDate = cells[4].textContent.trim();
                            if (cells[5]) status = cells[5].textContent.trim().replace(/<[^>]+>/g, '');
                            data.push({ id, amount, processDate, status });
                        }
                        return data;
                    });

                    for (const res of pageData) {
                        if (!res.processDate || !res.id || res.status !== '완료') continue;
                        const processDate = res.processDate.slice(0, 10);
                        if (depositByDate[processDate] !== undefined) {
                            const amount = parseInt(res.amount.replace(/[^0-9]/g, '')) || 0;
                            depositByDate[processDate] += amount;
                            idsByDate[processDate].add(res.id);
                        }
                    }
                }
            } else {
                console.warn('index 1: deposit 검색 결과 로드 실패');
            }

            dailyData.forEach(d => {
                d.charge = idsByDate[d.date] ? idsByDate[d.date].size : 0;
                d.deposit = depositByDate[d.date] ? depositByDate[d.date].toLocaleString('en-US') : '0';
            });

            // withdrawList.php 로드
            await sidebarFrame.click('a[href="withdrawList.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 20000));

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // withdraw 데이터 검색
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, startDate.format('YYYY-MM-DD'));
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, endDate.format('YYYY-MM-DD'));
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 20000));

            searchSuccess = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await viewFrame.waitForFunction(
                        () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                        { timeout: 60000 }
                    );
                    searchSuccess = true;
                    break;
                } catch (e) {
                    console.warn(`index 1: withdraw 검색 결과 대기 재시도 (${attempt}/3):`, e.message);
                }
            }

            const withdrawByDate = {};
            dateRange.forEach(date => withdrawByDate[date] = 0);

            if (searchSuccess) {
                let pageLinks = [];
                let attempts = 3;
                while (attempts--) {
                    try {
                        pageLinks = await viewFrame.evaluate(() => {
                            const links = document.querySelectorAll('.pagination a');
                            const pageNumbers = [];
                            for (const link of links) {
                                const match = link.href.match(/goPage\('(\d+)'\)/);
                                if (match) pageNumbers.push(match[1]);
                            }
                            return pageNumbers;
                        });
                        break;
                    } catch (e) {
                        console.warn(`index 1: withdraw 페이지네이션 읽기 재시도 (${3 - attempts}/3):`, e.message);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                const totalPages = pageLinks.length > 0 ? Math.max(...pageLinks.map(Number)) + 1 : 1;

                for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                    if (pageNum > 0) {
                        await viewFrame.evaluate(page => window.goPage(page), pageNum);
                        await new Promise(resolve => setTimeout(resolve, 20000));
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 20000));
                    }

                    let pageLoadSuccess = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            await viewFrame.waitForFunction(
                                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                                { timeout: 60000 }
                            );
                            pageLoadSuccess = true;
                            break;
                        } catch (e) {
                            console.warn(`index 1: withdraw 페이지 ${pageNum + 1} 테이블 로드 재시도 (${attempt}/3):`, e.message);
                        }
                    }

                    if (!pageLoadSuccess) {
                        console.warn(`index 1: withdraw 페이지 ${pageNum + 1} 테이블 로드 실패`);
                        continue;
                    }

                    const pageData = await viewFrame.evaluate(() => {
                        const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                        const data = [];
                        for (const row of rows) {
                            const cells = row.querySelectorAll('td');
                            let id = '';
                            let amount = '0';
                            let processDate = '';
                            let status = '';
                            if (cells[1]) id = cells[1].textContent.trim();
                            if (cells[3]) amount = cells[3].textContent.trim();
                            if (cells[5]) processDate = cells[5].textContent.trim();
                            if (cells[6]) status = cells[6].textContent.trim().replace(/<[^>]+>/g, '');
                            data.push({ id, amount, processDate, status });
                        }
                        return data;
                    });

                    for (const res of pageData) {
                        if (!res.processDate || !res.id || res.status !== '완료') continue;
                        const processDate = res.processDate.slice(0, 10);
                        if (withdrawByDate[processDate] !== undefined) {
                            const amount = parseInt(res.amount.replace(/[^0-9]/g, '')) || 0;
                            withdrawByDate[processDate] += amount;
                        }
                    }
                }
            } else {
                console.warn('index 1: withdraw 검색 결과 로드 실패');
            }

            dailyData.forEach(d => {
                d.withdraw = withdrawByDate[d.date] ? withdrawByDate[d.date].toLocaleString('en-US') : '0';
            });

            // agen_cal.php 로드
            await sidebarFrame.click('a[href="agen_cal.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 20000));

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // totalIn, totalOut 검색
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, startDate.format('YYYY-MM-DD'));
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, endDate.format('YYYY-MM-DD'));
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 20000));

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            const totals = await viewFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                let totalIn = '0';
                let totalOut = '0';
                if (rows[2]) {
                    const cells = rows[2].querySelectorAll('td');
                    if (cells[1]) totalIn = cells[1].textContent.trim();
                }
                if (rows[3]) {
                    const cells = rows[3].querySelectorAll('td');
                    if (cells[1]) totalOut = cells[1].textContent.trim();
                }
                return { totalIn, totalOut };
            });

            const results = dailyData.map(d => ({
                site: '젠',
                date: d.date,
                join: d.join,
                black: d.black,
                charge: d.charge,
                deposit: d.deposit,
                withdraw: d.withdraw,
                totalIn: parseInt(totals.totalIn.replace(/[^0-9]/g, '')) ? parseInt(totals.totalIn.replace(/[^0-9]/g, '')).toLocaleString('en-US') : '0',
                totalOut: parseInt(totals.totalOut.replace(/[^0-9]/g, '')) ? parseInt(totals.totalOut.replace(/[^0-9]/g, '')).toLocaleString('en-US') : '0'
            }));

            return results;
        } else if (index === 2) { // 빌드
            // 로그인 입력
            await page.type('input[name="uid"]', ID);
            await page.type('input[name="pwd"]', PWD);
            await page.type('input[name="captcha"]', '1111');

            // 로그인 버튼 클릭
            await Promise.all([
                page.click('button[onclick="login()"]'),
                page.waitForNavigation({ waitUntil: ['networkidle2', 'domcontentloaded'] })
            ]);

            await new Promise(resolve => setTimeout(resolve, 20000));

            // 로그인 성공 여부 확인
            const currentUrl = page.url();
            if (currentUrl.includes('proc/loginProcess.php')) {
                console.error('index 2: 로그인 실패, URL:', currentUrl);
                return dateRange.map(date => ({
                    site: '빌드',
                    date,
                    join: 0,
                    black: 0,
                    charge: 0,
                    deposit: '0',
                    withdraw: '0',
                    totalIn: '0',
                    totalOut: '0'
                }));
            }

            // 프레임 찾기
            const frames = page.frames();
            let targetFrame = null;
            let sidebarFrame = null;
            for (const frame of frames) {
                const hasTable = await frame.evaluate(() => {
                    const table = document.querySelector('.table.table-bordered tbody tr');
                    if (table) return true;
                    return false;
                });
                const hasSidebar = await frame.evaluate(() => {
                    const sidebar = document.querySelector('.nav.nav-pills.nav-sidebar');
                    if (sidebar) return true;
                    return false;
                });
                if (hasTable) targetFrame = frame;
                if (hasSidebar) sidebarFrame = frame;
            }

            if (!targetFrame || !sidebarFrame) {
                console.warn('index 2: 테이블 또는 사이드바 프레임 찾기 실패');
                return dateRange.map(date => ({
                    site: '빌드',
                    date,
                    join: 0,
                    black: 0,
                    charge: 0,
                    deposit: '0',
                    withdraw: '0',
                    totalIn: '0',
                    totalOut: '0'
                }));
            }

            await targetFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 30000 }
            );

            // 회원 데이터 크롤링
            const cellData = await targetFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                if (rows.length === 0) return [];
                const data = [];
                for (const row of rows) {
                    const cells = row.querySelectorAll('td');
                    let regDate = '';
                    let status = '';
                    if (cells[10]) regDate = cells[10].textContent.trim();
                    if (cells[12]) status = cells[12].textContent.trim();
                    data.push({ regDate, status });
                }
                return data;
            });

            if (cellData.length === 0) {
                console.warn('index 2: /main.php 테이블 데이터 없음');
            }

            for (const res of cellData) {
                if (!res.regDate) continue;
                const regDate = res.regDate.slice(0, 10);
                const dateIndex = dailyData.findIndex(d => d.date === regDate);
                if (dateIndex !== -1) {
                    dailyData[dateIndex].join++;
                    if (res.status === '탈퇴') dailyData[dateIndex].black++;
                }
            }

            // depositList_new.php 로드
            const viewFrame = frames.find(f => {
                const name = f.name();
                if (name === 'ViewFrm') return true;
                return false;
            });
            if (!viewFrame) {
                console.warn('index 2: ViewFrm 프레임 찾기 실패');
                return dailyData.map(d => ({
                    site: '빌드',
                    date: d.date,
                    join: d.join,
                    black: d.black,
                    charge: 0,
                    deposit: '0',
                    withdraw: '0',
                    totalIn: '0',
                    totalOut: '0'
                }));
            }

            await sidebarFrame.click('a[href="depositList_new.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 20000));

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // deposit 데이터 검색
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, startDate.format('YYYY-MM-DD'));
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, endDate.format('YYYY-MM-DD'));
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 20000));

            let searchSuccess = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await viewFrame.waitForFunction(
                        () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                        { timeout: 60000 }
                    );
                    searchSuccess = true;
                    break;
                } catch (e) {
                    console.warn(`index 2: deposit 검색 결과 대기 재시도 (${attempt}/3):`, e.message);
                    const html = await viewFrame.content();
                }
            }

            const depositByDate = {};
            const idsByDate = {};
            dateRange.forEach(date => {
                depositByDate[date] = 0;
                idsByDate[date] = new Set();
            });

            if (searchSuccess) {
                const tbodyContent = await viewFrame.evaluate(() => document.querySelector('.table.table-bordered tbody').innerHTML);

                let pageLinks = [];
                let attempts = 3;
                while (attempts--) {
                    try {
                        pageLinks = await viewFrame.evaluate(() => {
                            const links = document.querySelectorAll('.pagination a');
                            const pageNumbers = [];
                            for (const link of links) {
                                const match = link.href.match(/goPage\('(\d+)'\)/);
                                if (match) pageNumbers.push(match[1]);
                            }
                            return pageNumbers;
                        });
                        break;
                    } catch (e) {
                        console.warn(`index 2: deposit 페이지네이션 읽기 재시도 (${3 - attempts}/3):`, e.message);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                const totalPages = pageLinks.length > 0 ? Math.max(...pageLinks.map(Number)) + 1 : 1;

                for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                    if (pageNum > 0) {
                        await viewFrame.evaluate(page => window.goPage(page), pageNum);
                        await new Promise(resolve => setTimeout(resolve, 20000));
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 20000));
                    }

                    let pageLoadSuccess = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            await viewFrame.waitForFunction(
                                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                                { timeout: 60000 }
                            );
                            pageLoadSuccess = true;
                            break;
                        } catch (e) {
                            console.warn(`index 2: deposit 페이지 ${pageNum + 1} 테이블 로드 재시도 (${attempt}/3):`, e.message);
                        }
                    }

                    if (!pageLoadSuccess) {
                        console.warn(`index 2: deposit 페이지 ${pageNum + 1} 테이블 로드 실패`);
                        continue;
                    }

                    const pageData = await viewFrame.evaluate(() => {
                        const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                        const data = [];
                        for (const row of rows) {
                            const cells = row.querySelectorAll('td');
                            let id = '';
                            let amount = '0';
                            let processDate = '';
                            let status = '';
                            if (cells[1]) id = cells[1].textContent.trim();
                            if (cells[2]) amount = cells[2].textContent.trim();
                            if (cells[5]) processDate = cells[5].textContent.trim();
                            if (cells[6]) status = cells[6].textContent.trim().replace(/<[^>]+>/g, '');
                            data.push({ id, amount, processDate, status });
                        }
                        return data;
                    });

                    for (const res of pageData) {
                        if (!res.processDate || !res.id || res.status !== '완료') continue;
                        const processDate = res.processDate.slice(0, 10);
                        if (depositByDate[processDate] !== undefined) {
                            const amount = parseInt(res.amount.replace(/[^0-9]/g, '')) || 0;
                            depositByDate[processDate] += amount;
                            idsByDate[processDate].add(res.id);
                        }
                    }
                }
            } else {
                console.warn('index 2: deposit 검색 결과 로드 실패');
            }

            dailyData.forEach(d => {
                d.charge = idsByDate[d.date] ? idsByDate[d.date].size : 0;
                d.deposit = depositByDate[d.date] ? depositByDate[d.date].toLocaleString('en-US') : '0';
            });

            // withdrawList_new.php 로드
            await sidebarFrame.click('a[href="withdrawList_new.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 20000));

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // withdraw 데이터 검색
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, startDate.format('YYYY-MM-DD'));
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, endDate.format('YYYY-MM-DD'));
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 20000));

            searchSuccess = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await viewFrame.waitForFunction(
                        () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                        { timeout: 60000 }
                    );
                    searchSuccess = true;
                    break;
                } catch (e) {
                    console.warn(`index 2: withdraw 검색 결과 대기 재시도 (${attempt}/3):`, e.message);
                }
            }

            const withdrawByDate = {};
            dateRange.forEach(date => withdrawByDate[date] = 0);

            if (searchSuccess) {
                let pageLinks = [];
                let attempts = 3;
                while (attempts--) {
                    try {
                        pageLinks = await viewFrame.evaluate(() => {
                            const links = document.querySelectorAll('.pagination a');
                            const pageNumbers = [];
                            for (const link of links) {
                                const match = link.href.match(/goPage\('(\d+)'\)/);
                                if (match) pageNumbers.push(match[1]);
                            }
                            return pageNumbers;
                        });
                        break;
                    } catch (e) {
                        console.warn(`index 2: withdraw 페이지네이션 읽기 재시도 (${3 - attempts}/3):`, e.message);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                const totalPages = pageLinks.length > 0 ? Math.max(...pageLinks.map(Number)) + 1 : 1;

                for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                    if (pageNum > 0) {
                        await viewFrame.evaluate(page => window.goPage(page), pageNum);
                        await new Promise(resolve => setTimeout(resolve, 20000));
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 20000));
                    }

                    let pageLoadSuccess = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            await viewFrame.waitForFunction(
                                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                                { timeout: 60000 }
                            );
                            pageLoadSuccess = true;
                            break;
                        } catch (e) {
                            console.warn(`index 2: withdraw 페이지 ${pageNum + 1} 테이블 로드 재시도 (${attempt}/3):`, e.message);
                        }
                    }

                    if (!pageLoadSuccess) {
                        console.warn(`index 2: withdraw 페이지 ${pageNum + 1} 테이블 로드 실패`);
                        continue;
                    }

                    const pageData = await viewFrame.evaluate(() => {
                        const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                        const data = [];
                        for (const row of rows) {
                            const cells = row.querySelectorAll('td');
                            let id = '';
                            let amount = '0';
                            let processDate = '';
                            let status = '';
                            if (cells[1]) id = cells[1].textContent.trim();
                            if (cells[3]) amount = cells[3].textContent.trim();
                            if (cells[5]) processDate = cells[5].textContent.trim();
                            if (cells[6]) status = cells[6].textContent.trim().replace(/<[^>]+>/g, '');
                            data.push({ id, amount, processDate, status });
                        }
                        return data;
                    });

                    for (const res of pageData) {
                        if (!res.processDate || !res.id || res.status !== '완료') continue;
                        const processDate = res.processDate.slice(0, 10);
                        if (withdrawByDate[processDate] !== undefined) {
                            const amount = parseInt(res.amount.replace(/[^0-9]/g, '')) || 0;
                            withdrawByDate[processDate] += amount;
                        }
                    }
                }
            } else {
                console.warn('index 2: withdraw 검색 결과 로드 실패');
            }

            dailyData.forEach(d => {
                d.withdraw = withdrawByDate[d.date] ? withdrawByDate[d.date].toLocaleString('en-US') : '0';
            });

            // agen_cal.php 로드
            await sidebarFrame.click('a[href="agen_cal.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 20000));

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // totalIn, totalOut 검색
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, startDate.format('YYYY-MM-DD'));
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, endDate.format('YYYY-MM-DD'));
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 20000));

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            const totals = await viewFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                let totalIn = '0';
                let totalOut = '0';
                if (rows[2]) {
                    const cells = rows[2].querySelectorAll('td');
                    if (cells[1]) totalIn = cells[1].textContent.trim();
                }
                if (rows[3]) {
                    const cells = rows[3].querySelectorAll('td');
                    if (cells[1]) totalOut = cells[1].textContent.trim();
                }
                return { totalIn, totalOut };
            });

            const results = dailyData.map(d => ({
                site: '빌드',
                date: d.date,
                join: d.join,
                black: d.black,
                charge: d.charge,
                deposit: d.deposit,
                withdraw: d.withdraw,
                totalIn: parseInt(totals.totalIn.replace(/[^0-9]/g, '')) ? parseInt(totals.totalIn.replace(/[^0-9]/g, '')).toLocaleString('en-US') : '0',
                totalOut: parseInt(totals.totalOut.replace(/[^0-9]/g, '')) ? parseInt(totals.totalOut.replace(/[^0-9]/g, '')).toLocaleString('en-US') : '0'
            }));

            return results;
        }
        return null;
    } catch (err) {
        console.error(`❌ site${index} 에러:`, err);
        return null;
    } finally {
        await browser.close();
    }
}

module.exports = { crawlSite6 };