const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const dotenv = require('dotenv');
dotenv.config();

async function crawlSite4(index) {
    const URL = process.env[`settlement4_site${index}_URL`];
    const ID = process.env[`settlement4_site${index}_ID`];
    const PWD = process.env[`settlement4_site${index}_PWD`];

    if (!URL || !ID || !PWD) {
        console.warn(`⚠️ site${index} 정보가 .env에 없습니다.`);
        return null;
    }

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 }); // 화면 해상도 1920x1080

    page.on('dialog', async dialog => {
        await dialog.accept();
    });

    try {
        await page.goto(URL, { waitUntil: ['networkidle2', 'domcontentloaded'] });

        if (index === 1) { //빌드
            // 로그인 입력
            await page.type('input[name="uid"]', ID);
            await page.type('input[name="pwd"]', PWD);

            // CAPTCHA 입력
            await page.type('input[name="captcha"]', '1111');

            // 로그인 버튼 클릭
            await Promise.all([
                page.click('button[onclick="login()"]'),
                page.waitForNavigation({ waitUntil: ['networkidle2', 'domcontentloaded'] })
            ]);

            // 로그인 후 10초 대기
            await new Promise(resolve => setTimeout(resolve, 10000));

            // 로그인 성공 여부 확인
            const currentUrl = page.url();
            if (currentUrl.includes('proc/loginProcess.php')) {
                console.error('index 1: 로그인 실패, URL:', currentUrl);
                return null;
            }

            // 프레임 찾기
            const frames = page.frames();
            let targetFrame = null;
            let sidebarFrame = null;
            for (const frame of frames) {
                const hasTable = await frame.evaluate(() => !!document.querySelector('.table.table-bordered tbody tr'));
                const hasSidebar = await frame.evaluate(() => !!document.querySelector('.nav.nav-pills.nav-sidebar'));
                if (hasTable) targetFrame = frame;
                if (hasSidebar) sidebarFrame = frame;
            }

            if (!targetFrame || !sidebarFrame) {
                console.warn('index 1: 테이블 또는 사이드바 프레임 찾기 실패');
                const frameNames = frames.map(f => f.name() || f.url()).join(', ');
                console.log('index 1: 사용 가능한 프레임:', frameNames);
                return null;
            }

            // 테이블 데이터 로드 대기
            await targetFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 30000 }
            );

            const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
            let join = 0;
            let black = 0;

            // 회원 데이터 크롤링
            const cellData = await targetFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                if (!rows.length) return [];
                return Array.from(rows).map(row => {
                    const cells = row.querySelectorAll('td');
                    return {
                        regDate: cells[10]?.textContent.trim() || '',
                        status: cells[12]?.textContent.trim() || ''
                    };
                });
            });

            if (!cellData.length) {
                console.warn('index 1: /main.php 테이블 데이터 없음');
            }

            cellData.forEach(res => {
                if (!res.regDate) return;
                const regDate = res.regDate.slice(0, 10);
                if (regDate === yesterday) {
                    join++;
                    if (res.status === '탈퇴') black++;
                }
            });

            // ViewFrm 프레임에서 depositList_new.php 로드
            const viewFrame = frames.find(f => f.name() === 'ViewFrm');
            if (!viewFrame) {
                console.warn('index 1: ViewFrm 프레임 찾기 실패');
                return null;
            }

            await sidebarFrame.click('a[href="depositList_new.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15초 대기

            // 테이블 로드 대기
            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // 어제 날짜 설정
            const yesterdayDate = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 검색 후 15초 대기

            // 검색 결과 대기
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
                    console.warn(`index 1: 검색 결과 대기 재시도 (${attempt}/3):`, e.message);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (!searchSuccess) {
                console.warn('index 1: 검색 결과 로드 실패');
                return null;
            }

            const ids = new Set();

            // 페이지네이션 처리
            let pageLinks = [];
            let attempts = 3;
            while (attempts--) {
                try {
                    pageLinks = await viewFrame.evaluate(() => {
                        return Array.from(document.querySelectorAll('.pagination a')).map(a => a.href.match(/goPage\('(\d+)'\)/)?.[1]).filter(x => x);
                    });
                    break;
                } catch (e) {
                    console.warn(`index 1: 페이지네이션 읽기 재시도 (${3 - attempts}/3):`, e.message);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            const totalPages = pageLinks.length ? Math.max(...pageLinks.map(Number)) + 1 : 1;
            console.log('index 1: 총 페이지 수:', totalPages);

            for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                if (pageNum > 0) {
                    await viewFrame.evaluate(page => window.goPage(page), pageNum);
                    await new Promise(resolve => setTimeout(resolve, 15000)); // 페이지 이동 후 15초 대기
                } else {
                    await new Promise(resolve => setTimeout(resolve, 15000)); // 1페이지에서도 15초 대기
                }

                // 테이블 로드 대기
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
                        console.warn(`index 1: 페이지 ${pageNum + 1} 테이블 로드 재시도 (${attempt}/3):`, e.message);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                if (!pageLoadSuccess) {
                    console.warn(`index 1: 페이지 ${pageNum + 1} 테이블 로드 실패`);
                    return null;
                }

                const pageData = await viewFrame.evaluate(() => {
                    return Array.from(document.querySelectorAll('.table.table-bordered tbody tr')).map(row => {
                        const cells = row.querySelectorAll('td');
                        return {
                            id: cells[1]?.textContent.trim() || '',
                            status: cells[6]?.textContent.trim() || '',
                            processDate: cells[5]?.textContent.trim() || ''
                        };
                    });
                });

                pageData.forEach(res => {
                    if (!res.processDate || !res.id) return;
                    const processDate = res.processDate.slice(0, 10);
                    if (res.status === '완료' && processDate === yesterdayDate) {
                        ids.add(res.id);
                    }
                });
            }

            // /agen_cal.php로 이동
            await sidebarFrame.click('a[href="agen_cal.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15초 대기

            // 테이블 로드 대기
            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // 어제 데이터 (deposit, withdraw)
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 검색 후 15초 대기

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            const yesterdayTotals = await viewFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                return {
                    deposit: rows[2]?.querySelectorAll('td')[1]?.textContent.trim() || '0',
                    withdraw: rows[3]?.querySelectorAll('td')[1]?.textContent.trim() || '0'
                };
            });

            // 한 달 데이터 (totalIn, totalOut)
            const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD');
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, monthStart);
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 검색 후 15초 대기

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            const monthTotals = await viewFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                return {
                    totalIn: rows[2]?.querySelectorAll('td')[1]?.textContent.trim() || '0',
                    totalOut: rows[3]?.querySelectorAll('td')[1]?.textContent.trim() || '0'
                };
            });

            // 데이터 객체
            const data = {
                site: '빌드',
                date: yesterdayDate,
                join,
                black,
                charge: ids.size,
                deposit: parseInt(yesterdayTotals.deposit.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US'),
                withdraw: parseInt(yesterdayTotals.withdraw.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US'),
                totalIn: parseInt(monthTotals.totalIn.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US'),
                totalOut: parseInt(monthTotals.totalOut.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US')
            };

            return data;
        } else if (index === 2) { //플레이
            // 로그인 입력
            await page.type('input[name="uid"]', ID);
            await page.type('input[name="pwd"]', PWD);

            // CAPTCHA 입력
            await page.type('input[name="captcha"]', '1111');

            // 로그인 버튼 클릭
            await Promise.all([
                page.click('button[onclick="login()"]'),
                page.waitForNavigation({ waitUntil: ['networkidle2', 'domcontentloaded'] })
            ]);

            // 로그인 후 10초 대기
            await new Promise(resolve => setTimeout(resolve, 10000));

            // 로그인 성공 여부 확인
            const currentUrl = page.url();
            if (currentUrl.includes('proc/loginProcess.php')) {
                console.error('index 1: 로그인 실패, URL:', currentUrl);
                return null;
            }

            // 프레임 찾기
            const frames = page.frames();
            let targetFrame = null;
            let sidebarFrame = null;
            for (const frame of frames) {
                const hasTable = await frame.evaluate(() => !!document.querySelector('.table.table-bordered tbody tr'));
                const hasSidebar = await frame.evaluate(() => !!document.querySelector('.nav.nav-pills.nav-sidebar'));
                if (hasTable) targetFrame = frame;
                if (hasSidebar) sidebarFrame = frame;
            }

            if (!targetFrame || !sidebarFrame) {
                console.warn('index 1: 테이블 또는 사이드바 프레임 찾기 실패');
                const frameNames = frames.map(f => f.name() || f.url()).join(', ');
                console.log('index 1: 사용 가능한 프레임:', frameNames);
                return null;
            }

            // 테이블 데이터 로드 대기
            await targetFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 30000 }
            );

            const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
            let join = 0;
            let black = 0;

            // 회원 데이터 크롤링
            const cellData = await targetFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                if (!rows.length) return [];
                return Array.from(rows).map(row => {
                    const cells = row.querySelectorAll('td');
                    return {
                        regDate: cells[11]?.textContent.trim() || '',
                        status: cells[13]?.textContent.trim() || ''
                    };
                });
            });

            if (!cellData.length) {
                console.warn('index 1: /main.php 테이블 데이터 없음');
            }

            cellData.forEach(res => {
                if (!res.regDate) return;
                const regDate = res.regDate.slice(0, 10);
                if (regDate === yesterday) {
                    join++;
                    if (res.status === '탈퇴') black++;
                }
            });

            // ViewFrm 프레임에서 depositList_new.php 로드
            const viewFrame = frames.find(f => f.name() === 'ViewFrm');
            if (!viewFrame) {
                console.warn('index 1: ViewFrm 프레임 찾기 실패');
                return null;
            }

            await sidebarFrame.click('a[href="depositList.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15초 대기

            // 테이블 로드 대기
            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // 어제 날짜 설정
            const yesterdayDate = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 검색 후 15초 대기

            // 검색 결과 대기
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
                    console.warn(`index 1: 검색 결과 대기 재시도 (${attempt}/3):`, e.message);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (!searchSuccess) {
                console.warn('index 1: 검색 결과 로드 실패');
                return null;
            }

            const ids = new Set();

            // 페이지네이션 처리
            let pageLinks = [];
            let attempts = 3;
            while (attempts--) {
                try {
                    pageLinks = await viewFrame.evaluate(() => {
                        return Array.from(document.querySelectorAll('.pagination a')).map(a => a.href.match(/goPage\('(\d+)'\)/)?.[1]).filter(x => x);
                    });
                    break;
                } catch (e) {
                    console.warn(`index 1: 페이지네이션 읽기 재시도 (${3 - attempts}/3):`, e.message);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            const totalPages = pageLinks.length ? Math.max(...pageLinks.map(Number)) + 1 : 1;
            console.log('index 1: 총 페이지 수:', totalPages);

            for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                if (pageNum > 0) {
                    await viewFrame.evaluate(page => window.goPage(page), pageNum);
                    await new Promise(resolve => setTimeout(resolve, 15000)); // 페이지 이동 후 15초 대기
                } else {
                    await new Promise(resolve => setTimeout(resolve, 15000)); // 1페이지에서도 15초 대기
                }

                // 테이블 로드 대기
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
                        console.warn(`index 1: 페이지 ${pageNum + 1} 테이블 로드 재시도 (${attempt}/3):`, e.message);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                if (!pageLoadSuccess) {
                    console.warn(`index 1: 페이지 ${pageNum + 1} 테이블 로드 실패`);
                    return null;
                }

                const pageData = await viewFrame.evaluate(() => {
                    return Array.from(document.querySelectorAll('.table.table-bordered tbody tr')).map(row => {
                        const cells = row.querySelectorAll('td');
                        return {
                            id: cells[0]?.textContent.trim() || '',
                            status: cells[5]?.textContent.trim() || '',
                            processDate: cells[4]?.textContent.trim() || ''
                        };
                    });
                });

                pageData.forEach(res => {
                    if (!res.processDate || !res.id) return;
                    const processDate = res.processDate.slice(0, 10);
                    if (res.status === '완료' && processDate === yesterdayDate) {
                        ids.add(res.id);
                    }
                });
            }

            // /agen_cal.php로 이동
            await sidebarFrame.click('a[href="agen_cal.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15초 대기

            // 테이블 로드 대기
            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // 어제 데이터 (deposit, withdraw)
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 검색 후 15초 대기

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            const yesterdayTotals = await viewFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                return {
                    deposit: rows[2]?.querySelectorAll('td')[1]?.textContent.trim() || '0',
                    withdraw: rows[3]?.querySelectorAll('td')[1]?.textContent.trim() || '0'
                };
            });

            // 한 달 데이터 (totalIn, totalOut)
            const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD');
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, monthStart);
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 검색 후 15초 대기

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            const monthTotals = await viewFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                return {
                    totalIn: rows[2]?.querySelectorAll('td')[1]?.textContent.trim() || '0',
                    totalOut: rows[3]?.querySelectorAll('td')[1]?.textContent.trim() || '0'
                };
            });

            // 데이터 객체
            const data = {
                site: '플레이',
                date: yesterdayDate,
                join,
                black,
                charge: ids.size,
                deposit: parseInt(yesterdayTotals.deposit.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US'),
                withdraw: parseInt(yesterdayTotals.withdraw.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US'),
                totalIn: parseInt(monthTotals.totalIn.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US'),
                totalOut: parseInt(monthTotals.totalOut.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US')
            };

            return data;
        } else if (index === 3) { //젠
            // 로그인 입력
            await page.type('input[name="uid"]', ID);
            await page.type('input[name="pwd"]', PWD);

            // CAPTCHA 입력
            await page.type('input[name="captcha"]', '1111');

            // 로그인 버튼 클릭
            await Promise.all([
                page.click('button[onclick="login()"]'),
                page.waitForNavigation({ waitUntil: ['networkidle2', 'domcontentloaded'] })
            ]);

            // 로그인 후 10초 대기
            await new Promise(resolve => setTimeout(resolve, 10000));

            // 로그인 성공 여부 확인
            const currentUrl = page.url();
            if (currentUrl.includes('proc/loginProcess.php')) {
                console.error('index 1: 로그인 실패, URL:', currentUrl);
                return null;
            }

            // 프레임 찾기
            const frames = page.frames();
            let targetFrame = null;
            let sidebarFrame = null;
            for (const frame of frames) {
                const hasTable = await frame.evaluate(() => !!document.querySelector('.table.table-bordered tbody tr'));
                const hasSidebar = await frame.evaluate(() => !!document.querySelector('.nav.nav-pills.nav-sidebar'));
                if (hasTable) targetFrame = frame;
                if (hasSidebar) sidebarFrame = frame;
            }

            if (!targetFrame || !sidebarFrame) {
                console.warn('index 1: 테이블 또는 사이드바 프레임 찾기 실패');
                const frameNames = frames.map(f => f.name() || f.url()).join(', ');
                console.log('index 1: 사용 가능한 프레임:', frameNames);
                return null;
            }

            // 테이블 데이터 로드 대기
            await targetFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 30000 }
            );

            const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
            let join = 0;
            let black = 0;

            // 회원 데이터 크롤링
            const cellData = await targetFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                if (!rows.length) return [];
                return Array.from(rows).map(row => {
                    const cells = row.querySelectorAll('td');
                    return {
                        regDate: cells[9]?.textContent.trim() || '',
                        status: cells[10]?.textContent.trim() || ''
                    };
                });
            });

            if (!cellData.length) {
                console.warn('index 1: /main.php 테이블 데이터 없음');
            }

            cellData.forEach(res => {
                if (!res.regDate) return;
                const regDate = res.regDate.slice(0, 10);
                if (regDate === yesterday) {
                    join++;
                    if (res.status === '탈퇴') black++;
                }
            });

            // ViewFrm 프레임에서 depositList.php 로드
            const viewFrame = frames.find(f => f.name() === 'ViewFrm');
            if (!viewFrame) {
                console.warn('index 1: ViewFrm 프레임 찾기 실패');
                return null;
            }

            await sidebarFrame.click('a[href="depositList.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15초 대기

            // 테이블 로드 대기
            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // 어제 날짜 설정
            const yesterdayDate = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 검색 후 15초 대기

            // 검색 결과 대기
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
                    console.warn(`index 1: 검색 결과 대기 재시도 (${attempt}/3):`, e.message);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (!searchSuccess) {
                console.warn('index 1: 검색 결과 로드 실패');
                return null;
            }

            const ids = new Set();

            // 페이지네이션 처리
            let pageLinks = [];
            let attempts = 3;
            while (attempts--) {
                try {
                    pageLinks = await viewFrame.evaluate(() => {
                        return Array.from(document.querySelectorAll('.pagination a')).map(a => a.href.match(/goPage\('(\d+)'\)/)?.[1]).filter(x => x);
                    });
                    break;
                } catch (e) {
                    console.warn(`index 1: 페이지네이션 읽기 재시도 (${3 - attempts}/3):`, e.message);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            const totalPages = pageLinks.length ? Math.max(...pageLinks.map(Number)) + 1 : 1;
            console.log('index 1: 총 페이지 수:', totalPages);

            for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                if (pageNum > 0) {
                    await viewFrame.evaluate(page => window.goPage(page), pageNum);
                    await new Promise(resolve => setTimeout(resolve, 15000)); // 페이지 이동 후 15초 대기
                } else {
                    await new Promise(resolve => setTimeout(resolve, 15000)); // 1페이지에서도 15초 대기
                }

                // 테이블 로드 대기
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
                        console.warn(`index 1: 페이지 ${pageNum + 1} 테이블 로드 재시도 (${attempt}/3):`, e.message);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                if (!pageLoadSuccess) {
                    console.warn(`index 1: 페이지 ${pageNum + 1} 테이블 로드 실패`);
                    return null;
                }

                const pageData = await viewFrame.evaluate(() => {
                    return Array.from(document.querySelectorAll('.table.table-bordered tbody tr')).map(row => {
                        const cells = row.querySelectorAll('td');
                        return {
                            id: cells[0]?.textContent.trim() || '',
                            status: cells[5]?.textContent.trim() || '',
                            processDate: cells[4]?.textContent.trim() || ''
                        };
                    });
                });

                pageData.forEach(res => {
                    if (!res.processDate || !res.id) return;
                    const processDate = res.processDate.slice(0, 10);
                    if (res.status === '완료' && processDate === yesterdayDate) {
                        ids.add(res.id);
                    }
                });
            }

            // /agen_cal.php로 이동
            await sidebarFrame.click('a[href="agen_cal.php"][target="ViewFrm"]');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15초 대기

            // 테이블 로드 대기
            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            // 어제 데이터 (deposit, withdraw)
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 검색 후 15초 대기

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            const yesterdayTotals = await viewFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                return {
                    deposit: rows[2]?.querySelectorAll('td')[1]?.textContent.trim() || '0',
                    withdraw: rows[3]?.querySelectorAll('td')[1]?.textContent.trim() || '0'
                };
            });

            // 한 달 데이터 (totalIn, totalOut)
            const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD');
            await viewFrame.$eval('#startDate', (el, value) => el.value = value, monthStart);
            await viewFrame.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
            await viewFrame.click('button.btn.btn-sm.btn-success');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 검색 후 15초 대기

            await viewFrame.waitForFunction(
                () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
                { timeout: 60000 }
            );

            const monthTotals = await viewFrame.evaluate(() => {
                const rows = document.querySelectorAll('.table.table-bordered tbody tr');
                return {
                    totalIn: rows[2]?.querySelectorAll('td')[1]?.textContent.trim() || '0',
                    totalOut: rows[3]?.querySelectorAll('td')[1]?.textContent.trim() || '0'
                };
            });

            // 데이터 객체
            const data = {
                site: '젠',
                date: yesterdayDate,
                join,
                black,
                charge: ids.size,
                deposit: parseInt(yesterdayTotals.deposit.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US'),
                withdraw: parseInt(yesterdayTotals.withdraw.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US'),
                totalIn: parseInt(monthTotals.totalIn.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US'),
                totalOut: parseInt(monthTotals.totalOut.replace(/[^0-9]/g, '') || '0').toLocaleString('en-US')
            };

            return data;
        }
        return null;
    } catch (err) {
        console.error(`❌ site${index} 에러:`, err);
        return null;
    } finally {
        await browser.close();
    }
}

module.exports = { crawlSite4 };