const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const dotenv = require('dotenv');
dotenv.config();

async function crawlSite1(index) {
  const URL = process.env[`settlement1_site${index}_URL`];
  const ID = process.env[`settlement1_site${index}_ID`];
  const PWD = process.env[`settlement1_site${index}_PWD`];

  if (!URL || !ID || !PWD) {
    console.warn(`⚠️ site${index} 정보가 .env에 없습니다.`);
    return null;
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.setViewport({ width: 1920, height: 1080 })

  try {
    await page.goto(URL, { waitUntil: 'networkidle2' });

    if (index === 1) {
    } else if (index === 2) { 
    } else if (index === 3) { 
    } else if (index === 4) { //니모
      await page.type('input[placeholder="ID"]', ID);
      await page.type('input[placeholder="PASSWORD"]', PWD);
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
    
      // /user로 이동
      await page.goto(`${URL}/user`, { waitUntil: 'networkidle2' });
    
      // 페이지 HTML 디버깅
      const userPageContent = await page.evaluate(() => document.documentElement.outerHTML);
      console.log(`index ${index}: /user 페이지 HTML:`, userPageContent.slice(0, 500));
    
      // /user 테이블 데이터 추출 (네 제안 로직)
      let cellData = [];
      try {
        await page.waitForSelector('.table.table-hover.text-nowrap tbody', { timeout: 60000 });
        cellData = await page.evaluate(() => {
          const rows = document.querySelectorAll('.table.table-hover.text-nowrap tbody tr');
          if (!rows.length) return [{ status: 'N/A', regDate: 'N/A' }];
          return Array.from(rows).map(row => {
            const cells = row.querySelectorAll('td');
            return {
              status: cells[1]?.querySelector('.badge')?.textContent.trim() || 'N/A',
              regDate: cells[13]?.textContent.trim() || 'N/A'
            };
          });
        });
      } catch (e) {
        console.warn(`index ${index}: /user 테이블 로드 실패`, e);
        cellData = [{ status: 'N/A', regDate: 'N/A' }];
      }
    
      const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY.MM.DD');
    
      let join = 0;
      let black = 0;
      if (cellData.length === 1 && cellData[0].status === 'N/A' && cellData[0].regDate === 'N/A') {
        console.log(`index ${index}: /user 테이블 데이터 없음`);
      } else {
        cellData.forEach(res => {
          const regDate = res.regDate.slice(0, 10); // YYYY.MM.DD
          if (regDate === yesterday) {
            join++;
            if (res.status === '탈퇴') black++;
          }
        });
      }
    
      // /money로 이동
      await page.goto(`${URL}/money`, { waitUntil: 'networkidle2' });
    
      // 페이지 HTML 디버깅
      const moneyPageContent = await page.evaluate(() => document.documentElement.outerHTML);
      console.log(`index ${index}: /money 페이지 HTML:`, moneyPageContent.slice(0, 500));
    
      // 어제 검색
      const yesterdayStart = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
      const yesterdayEnd = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
    
      // 달력 입력
      let dateInputSuccess = true;
      try {
        // 시작 날짜 달력 버튼 클릭
        await page.waitForSelector('.b-form-datepicker button', { timeout: 60000 });
        await page.click('.form-inline .b-form-datepicker:nth-of-type(1) button');
        await page.waitForSelector(`div[id*="__BVID__"][role="dialog"].show`, { timeout: 15000 });
        await page.click(`div[data-date="${yesterdayStart}"]`);
        await page.waitForFunction(
          () => !document.querySelector(`div[id*="__BVID__"][role="dialog"].show`),
          { timeout: 5000 }
        );
    
        // 종료 날짜 달력 버튼 클릭
        await page.click('.form-inline .b-form-datepicker:nth-of-type(2) button');
        await page.waitForSelector(`div[id*="__BVID__"][role="dialog"].show`, { timeout: 15000 });
        await page.click(`div[data-date="${yesterdayEnd}"]`);
        await page.waitForFunction(
          () => !document.querySelector(`div[id*="__BVID__"][role="dialog"].show`),
          { timeout: 5000 }
        );
    
        // 상태: 완료
        await page.select('select:nth-of-type(1)', '1');
    
        // 검색
        await page.click('button.btn.btn-sm.btn-success');
        await new Promise(resolve => setTimeout(resolve, 15000)); // 검색 결과 대기
      } catch (e) {
        console.warn(`index ${index}: 어제 검색 실패`, e);
        dateInputSuccess = false;
      }
    
      let deposit = 0;
      let withdraw = 0;
      const ids = new Set();
    
      if (dateInputSuccess) {
        // 페이지 순회
        let hasNextPage = true;
        while (hasNextPage) {
          const pageData = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.table.table-hover.text-nowrap tbody tr')).map(row => {
              const cells = row.querySelectorAll('td');
              return {
                type: cells[0]?.textContent.trim(),
                status: cells[1]?.textContent.trim(),
                id: cells[6]?.textContent.trim(),
                amount: cells[9]?.textContent.trim(),
                regDate: cells[10]?.textContent.trim()
              };
            });
          });
    
          if (!pageData.length) {
            console.log(`index ${index}: /money 어제 테이블 데이터 없음`);
          } else {
            pageData.forEach(res => {
              const regDate = res.regDate.replace(/\./g, '-'); // YYYY.MM.DD → YYYY-MM-DD
              if (regDate >= yesterdayStart && regDate <= yesterdayEnd && res.status === '완료') {
                const amount = parseInt(res.amount.replace(/[^0-9]/g, '') || '0');
                if (res.id) ids.add(res.id);
                if (res.type === '충전') deposit += amount;
                if (res.type === '환전') withdraw += amount;
              }
            });
          }
    
          // 다음 페이지 확인
          const nextPageLink = await page.$('a[aria-label="Go to next page"]');
          if (nextPageLink && !(await page.evaluate(el => el.classList.contains('disabled'), nextPageLink))) {
            await Promise.all([
              page.click('a[aria-label="Go to next page"]'),
              page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);
            await page.waitForSelector('.table.table-hover.text-nowrap tbody');
          } else {
            hasNextPage = false;
          }
        }
      } else {
        console.log(`index ${index}: /money 어제 데이터 스킵, 기본값 사용`);
      }
    
      // 한 달 검색
      let totalIn = 0;
      let totalOut = 0;
      dateInputSuccess = true;
    
      const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD');
      const monthEnd = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
    
      // 달력 입력
      try {
        // 시작 날짜 달력 버튼 클릭
        await page.click('.form-inline .b-form-datepicker:nth-of-type(1) button');
        await page.waitForSelector(`div[id*="__BVID__"][role="dialog"].show`, { timeout: 15000 });
        await page.click(`div[data-date="${monthStart}"]`);
        await page.waitForFunction(
          () => !document.querySelector(`div[id*="__BVID__"][role="dialog"].show`),
          { timeout: 5000 }
        );
    
        // 종료 날짜 달력 버튼 클릭
        await page.click('.form-inline .b-form-datepicker:nth-of-type(2) button');
        await page.waitForSelector(`div[id*="__BVID__"][role="dialog"].show`, { timeout: 15000 });
        await page.click(`div[data-date="${monthEnd}"]`);
        await page.waitForFunction(
          () => !document.querySelector(`div[id*="__BVID__"][role="dialog"].show`),
          { timeout: 5000 }
        );
    
        // 상태: 완료
        await page.select('select:nth-of-type(1)', '1');
    
        // 검색
        await page.click('button.btn.btn-sm.btn-success');
        await new Promise(resolve => setTimeout(resolve, 15000));
      } catch (e) {
        console.warn(`index ${index}: 한 달 검색 실패`, e);
        dateInputSuccess = false;
      }
    
      if (dateInputSuccess) {
        // 페이지 순회
        let hasNextPage = true;
        while (hasNextPage) {
          const pageData = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.table.table-hover.text-nowrap tbody tr')).map(row => {
              const cells = row.querySelectorAll('td');
              return {
                type: cells[0]?.textContent.trim(),
                status: cells[1]?.textContent.trim(),
                amount: cells[9]?.textContent.trim(),
                regDate: cells[10]?.textContent.trim()
              };
            });
          });
    
          if (!pageData.length) {
            console.log(`index ${index}: /money 한 달 테이블 데이터 없음`);
          } else {
            pageData.forEach(res => {
              const regDate = res.regDate.replace(/\./g, '-'); // YYYY.MM.DD → YYYY-MM-DD
              if (regDate >= monthStart && regDate <= monthEnd && res.status === '완료') {
                const amount = parseInt(res.amount.replace(/[^0-9]/g, '') || '0');
                if (res.type === '충전') totalIn += amount;
                if (res.type === '환전') totalOut += amount;
              }
            });
          }
    
          // 다음 페이지 확인
          const nextPageLink = await page.$('a[aria-label="Go to next page"]');
          if (nextPageLink && !(await page.evaluate(el => el.classList.contains('disabled'), nextPageLink))) {
            await Promise.all([
              page.click('a[aria-label="Go to next page"]'),
              page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);
            await page.waitForSelector('.table.table-hover.text-nowrap tbody');
          } else {
            hasNextPage = false;
          }
        }
      } else {
        console.log(`index ${index}: /money 한 달 데이터 스킵, 기본값 사용`);
      }
    
      // 데이터 객체
      const data = {
        site: '니모',
        date: yesterday,
        join,
        black,
        charge: ids.size,
        deposit,
        withdraw,
        totalIn,
        totalOut
      };
    
      // 금액 포맷팅
      data.deposit = (data.deposit || 0).toLocaleString('en-US');
      data.withdraw = (data.withdraw || 0).toLocaleString('en-US');
      data.totalIn = (data.totalIn || 0).toLocaleString('en-US');
      data.totalOut = (data.totalOut || 0).toLocaleString('en-US');
    
      return data;
    } else if (index === 5) { 
    } else if (index === 6) { 
    } else if (index === 7) { 
    } else if (index === 8) { 
    } else if (index === 9) { // 젠
      // 로그인 입력
      await page.type('input[name="uid"]', ID);
      await page.type('input[name="pwd"]', PWD);

      // 자동 제출 이벤트 비활성화
      await page.evaluate(() => {
        const captchaInput = document.querySelector('input[name="captcha"]');
        const form = document.querySelector('form#frm');
        if (captchaInput) {
          captchaInput.removeAttribute('oninput');
          captchaInput.removeAttribute('onchange');
        }
        if (form) {
          form.onsubmit = (e) => e.preventDefault();
        }
      });

      // CAPTCHA 수동 입력 대기
      console.log('index 1: CAPTCHA를 브라우저에서 입력하고 "Sign In" 버튼을 클릭하세요.');
      await page.waitForFunction(
        () => {
          const captchaInput = document.querySelector('input[name="captcha"]');
          return captchaInput && captchaInput.value.trim().length >= 4;
        },
        { timeout: 60000 }
      );

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
        await page.screenshot({ path: `main_php_screenshot_${index}_${Date.now()}.png` });
        return null;
      }

      // 테이블 데이터 로드 대기
      await targetFrame.waitForFunction(
        () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
        { timeout: 30000 }
      );

      // 디버깅: 프레임 HTML 출력
      const frameContent = await targetFrame.evaluate(() => document.documentElement.outerHTML);
      console.log('index 1: /main.php 프레임 HTML:', frameContent.slice(0, 500));

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
        await page.screenshot({ path: `depositList_screenshot_${index}_${Date.now()}.png` });
        return null;
      }

      await sidebarFrame.click('a[href="depositList.php"][target="ViewFrm"]');
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15초 대기

      // 테이블 로드 대기
      await viewFrame.waitForFunction(
        () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
        { timeout: 60000 }
      );

      // 디버깅: 프레임 HTML 출력
      const depositContent = await viewFrame.evaluate(() => document.documentElement.outerHTML);
      console.log('index 1: /depositList.php HTML:', depositContent.slice(0, 500));

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
        await page.screenshot({ path: `depositList_search_screenshot_${index}_${Date.now()}.png` });
        return null;
      }

      // 디버깅: 검색 후 행 개수 및 HTML
      const rowCount = await viewFrame.evaluate(() => document.querySelectorAll('.table.table-bordered tbody tr').length);
      console.log('index 1: 검색 후 테이블 행 개수:', rowCount);
      const searchContent = await viewFrame.evaluate(() => document.documentElement.outerHTML);
      console.log('index 1: 검색 후 /depositList.php HTML:', searchContent.slice(0, 500));

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
          await page.screenshot({ path: `depositList_page${pageNum + 1}_screenshot_${index}_${Date.now()}.png` });
          return null;
        }

        // 디버깅: 페이지 HTML 및 행 개수
        const pageContent = await viewFrame.evaluate(() => document.documentElement.outerHTML);
        console.log(`index 1: 페이지 ${pageNum + 1} HTML:`, pageContent.slice(0, 500));
        const pageRowCount = await viewFrame.evaluate(() => document.querySelectorAll('.table.table-bordered tbody tr').length);
        console.log(`index 1: 페이지 ${pageNum + 1} 테이블 행 개수:`, pageRowCount);

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

      // 디버깅: ids.size 출력
      console.log('index 1: 입금완료 ID 수 (charge):', ids.size);

      // /agen_cal.php로 이동
      await sidebarFrame.click('a[href="agen_cal.php"][target="ViewFrm"]');
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15초 대기

      // 테이블 로드 대기
      await viewFrame.waitForFunction(
        () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
        { timeout: 60000 }
      );

      // 디버깅: 프레임 HTML 출력
      const agenContent = await viewFrame.evaluate(() => document.documentElement.outerHTML);
      console.log('index 1: /agen_cal.php HTML:', agenContent.slice(0, 500));

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
    } else if(index === 10) { // 빌드
      // 로그인 입력
      await page.type('input[name="uid"]', ID);
      await page.type('input[name="pwd"]', PWD);

      // 자동 제출 이벤트 비활성화
      await page.evaluate(() => {
        const captchaInput = document.querySelector('input[name="captcha"]');
        const form = document.querySelector('form#frm');
        if (captchaInput) {
          captchaInput.removeAttribute('oninput');
          captchaInput.removeAttribute('onchange');
        }
        if (form) {
          form.onsubmit = (e) => e.preventDefault();
        }
      });

      // CAPTCHA 수동 입력 대기
      console.log('index 1: CAPTCHA를 브라우저에서 입력하고 "Sign In" 버튼을 클릭하세요.');
      await page.waitForFunction(
        () => {
          const captchaInput = document.querySelector('input[name="captcha"]');
          return captchaInput && captchaInput.value.trim().length >= 4;
        },
        { timeout: 60000 }
      );

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
        await page.screenshot({ path: `main_php_screenshot_${index}_${Date.now()}.png` });
        return null;
      }

      // 테이블 데이터 로드 대기
      await targetFrame.waitForFunction(
        () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
        { timeout: 30000 }
      );

      // 디버깅: 프레임 HTML 출력
      const frameContent = await targetFrame.evaluate(() => document.documentElement.outerHTML);
      console.log('index 1: /main.php 프레임 HTML:', frameContent.slice(0, 500));

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
        await page.screenshot({ path: `depositList_new_screenshot_${index}_${Date.now()}.png` });
        return null;
      }

      await sidebarFrame.click('a[href="depositList_new.php"][target="ViewFrm"]');
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15초 대기

      // 테이블 로드 대기
      await viewFrame.waitForFunction(
        () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
        { timeout: 60000 }
      );

      // 디버깅: 프레임 HTML 출력
      const depositContent = await viewFrame.evaluate(() => document.documentElement.outerHTML);
      console.log('index 1: /depositList_new.php HTML:', depositContent.slice(0, 500));

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
        await page.screenshot({ path: `depositList_new_search_screenshot_${index}_${Date.now()}.png` });
        return null;
      }

      // 디버깅: 검색 후 행 개수 및 HTML
      const rowCount = await viewFrame.evaluate(() => document.querySelectorAll('.table.table-bordered tbody tr').length);
      console.log('index 1: 검색 후 테이블 행 개수:', rowCount);
      const searchContent = await viewFrame.evaluate(() => document.documentElement.outerHTML);
      console.log('index 1: 검색 후 /depositList_new.php HTML:', searchContent.slice(0, 500));

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
          await page.screenshot({ path: `depositList_new_page${pageNum + 1}_screenshot_${index}_${Date.now()}.png` });
          return null;
        }

        // 디버깅: 페이지 HTML 및 행 개수
        const pageContent = await viewFrame.evaluate(() => document.documentElement.outerHTML);
        console.log(`index 1: 페이지 ${pageNum + 1} HTML:`, pageContent.slice(0, 500));
        const pageRowCount = await viewFrame.evaluate(() => document.querySelectorAll('.table.table-bordered tbody tr').length);
        console.log(`index 1: 페이지 ${pageNum + 1} 테이블 행 개수:`, pageRowCount);

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

      // 디버깅: ids.size 출력
      console.log('index 1: 입금완료 ID 수 (charge):', ids.size);

      // /agen_cal.php로 이동
      await sidebarFrame.click('a[href="agen_cal.php"][target="ViewFrm"]');
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15초 대기

      // 테이블 로드 대기
      await viewFrame.waitForFunction(
        () => document.querySelectorAll('.table.table-bordered tbody tr').length > 0,
        { timeout: 60000 }
      );

      // 디버깅: 프레임 HTML 출력
      const agenContent = await viewFrame.evaluate(() => document.documentElement.outerHTML);
      console.log('index 1: /agen_cal.php HTML:', agenContent.slice(0, 500));

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
    } 
    return null;
  } catch (err) {
    console.error(`❌ site${index} 에러:`, err);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = { crawlSite1 };