const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const dotenv = require('dotenv');
dotenv.config();

async function crawlSite2(index) {
  const URL = process.env[`settlement2_site${index}_URL`];
  const ID = process.env[`settlement2_site${index}_ID`];
  const PWD = process.env[`settlement2_site${index}_PWD`];

  if (!URL || !ID || !PWD) {
    console.warn(`⚠️ site${index} 정보가 .env에 없습니다.`);
    return null;
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.setViewport({ width: 1920, height: 1080 })

  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  try {
    await page.goto(URL, { waitUntil: 'networkidle2' });

    if (index === 1) { //삼성
      await page.goto(URL, { waitUntil: 'networkidle2' });
      await page.type('#login_id', ID);
      await page.type('#login_pw', PWD);
      await Promise.all([
        page.click('#enter'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
    
      // /level6/member_list.php로 이동 (첫 페이지)
      await page.goto(`${URL}/level6/member_list.php?page=1`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
      const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YY-MM-DD');
    
      let join = 0;
      let black = 0;
    
      // 첫 페이지 크롤링
      let cellData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
          const cells = row.querySelectorAll('td');
          return {
            regDate: cells[21]?.textContent.trim(), // 가입일자 (22번째)
            status: cells[19]?.querySelector('.mb_intercept_msg')?.textContent.trim() || '' // 상태 (20번째)
          };
        });
      });
    
      cellData.forEach(res => {
        if (res.regDate === yesterday) {
          join++;
          if (res.status === '차단됨') black++;
        }
      });
    
      // 마지막 페이지 찾기
      const lastPageLink = await page.$('a.pg_page.pg_end');
      let lastPage = 1;
      if (lastPageLink) {
        lastPage = parseInt(await page.evaluate(el => el.href.match(/page=(\d+)/)?.[1], lastPageLink)) || 1;
      }
    
      // 마지막 페이지 크롤링
      if (lastPage > 1) {
        await page.goto(`${URL}/level6/member_list.php?page=${lastPage}`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
        cellData = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
            const cells = row.querySelectorAll('td');
            return {
              regDate: cells[21]?.textContent.trim(),
              status: cells[19]?.querySelector('.mb_intercept_msg')?.textContent.trim() || ''
            };
          });
        });
    
        cellData.forEach(res => {
          if (res.regDate === yesterday) {
            join++;
            if (res.status === '차단됨') black++;
          }
        });
      }
    
      // /level6/deposit_list.php로 이동
      await page.goto(`${URL}/level6/deposit_list.php`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
      // 어제 검색
      const yesterdayDate = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
      await page.$eval('#sdate', el => el.value = '');
      await page.type('#sdate', yesterdayDate);
      await page.$eval('#edate', el => el.value = '');
      await page.type('#edate', yesterdayDate);
      await page.click('#fsearch > input.btn_submit');
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      let deposit = 0;
      let withdraw = 0;
      const ids = new Set();
    
      // 테이블 데이터 (charge)
      const pageData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
          const cells = row.querySelectorAll('td');
          return {
            id: cells[1]?.textContent.trim(),
            status: cells[5]?.textContent.trim(),
            regDate: cells[6]?.textContent.trim()
          };
        });
      });

      pageData.forEach(res => {
        if (res.status === '입금완료' && res.id && res.regDate.startsWith(yesterdayDate)) {
          ids.add(res.id);
        }
      });
    
      // 총충전/총환전 (deposit, withdraw)
      const totals = await page.evaluate(() => {
        return {
          deposit: document.querySelector('#all_in')?.textContent.trim() || '0',
          withdraw: document.querySelector('#all_out')?.textContent.trim() || '0'
        };
      });
    
      deposit = parseInt(totals.deposit.replace(/[^0-9]/g, '') || '0');
      withdraw = parseInt(totals.withdraw.replace(/[^0-9]/g, '') || '0');
    
      // 한 달 검색
      const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD');
      const monthEnd = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
      await page.$eval('#sdate', el => el.value = '');
      await page.type('#sdate', monthStart);
      await page.$eval('#edate', el => el.value = '');
      await page.type('#edate', monthEnd);
      await page.click('#fsearch > input.btn_submit');
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      // 총충전/총환전 (totalIn, totalOut)
      const monthTotals = await page.evaluate(() => {
        return {
          totalIn: document.querySelector('#all_in')?.textContent.trim() || '0',
          totalOut: document.querySelector('#all_out')?.textContent.trim() || '0'
        };
      });
    
      let totalIn = parseInt(monthTotals.totalIn.replace(/[^0-9]/g, '') || '0');
      let totalOut = parseInt(monthTotals.totalOut.replace(/[^0-9]/g, '') || '0');
    
      // 데이터 객체
      const data = {
        site: '삼성',
        date: yesterdayDate,
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
    } else if (index === 2) { //세븐
      await page.goto(URL, { waitUntil: 'networkidle2' });
      await page.type('#login_id', ID);
      await page.type('#login_pw', PWD);
      await Promise.all([
        page.click('#enter'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
    
      // /level6/member_list.php로 이동 (첫 페이지)
      await page.goto(`${URL}/level6/member_list.php?page=1`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
      const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YY-MM-DD');
    
      let join = 0;
      let black = 0;
    
      // 첫 페이지 크롤링
      let cellData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
          const cells = row.querySelectorAll('td');
          return {
            regDate: cells[21]?.textContent.trim(), // 가입일자 (22번째)
            status: cells[19]?.querySelector('.mb_intercept_msg')?.textContent.trim() || '' // 상태 (20번째)
          };
        });
      });
    
      cellData.forEach(res => {
        if (res.regDate === yesterday) {
          join++;
          if (res.status === '차단됨') black++;
        }
      });
    
      // 마지막 페이지 찾기
      const lastPageLink = await page.$('a.pg_page.pg_end');
      let lastPage = 1;
      if (lastPageLink) {
        lastPage = parseInt(await page.evaluate(el => el.href.match(/page=(\d+)/)?.[1], lastPageLink)) || 1;
      }
    
      // 마지막 페이지 크롤링
      if (lastPage > 1) {
        await page.goto(`${URL}/level6/member_list.php?page=${lastPage}`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
        cellData = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
            const cells = row.querySelectorAll('td');
            return {
              regDate: cells[21]?.textContent.trim(),
              status: cells[19]?.querySelector('.mb_intercept_msg')?.textContent.trim() || ''
            };
          });
        });
    
        cellData.forEach(res => {
          if (res.regDate === yesterday) {
            join++;
            if (res.status === '차단됨') black++;
          }
        });
      }
    
      // /level6/deposit_list.php로 이동
      await page.goto(`${URL}/level6/deposit_list.php`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
      // 어제 검색
      const yesterdayDate = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
      await page.$eval('#sdate', el => el.value = '');
      await page.type('#sdate', yesterdayDate);
      await page.$eval('#edate', el => el.value = '');
      await page.type('#edate', yesterdayDate);
      await page.click('#fsearch > input.btn_submit');
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      let deposit = 0;
      let withdraw = 0;
      const ids = new Set();
    
      // 테이블 데이터 (charge)
      const pageData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
          const cells = row.querySelectorAll('td');
          return {
            id: cells[1]?.textContent.trim(),
            status: cells[5]?.textContent.trim(),
            regDate: cells[6]?.textContent.trim()
          };
        });
      });

      pageData.forEach(res => {
        if (res.status === '입금완료' && res.id && res.regDate.startsWith(yesterdayDate)) {
          ids.add(res.id);
        }
      });
    
      // 총충전/총환전 (deposit, withdraw)
      const totals = await page.evaluate(() => {
        return {
          deposit: document.querySelector('#all_in')?.textContent.trim() || '0',
          withdraw: document.querySelector('#all_out')?.textContent.trim() || '0'
        };
      });
    
      deposit = parseInt(totals.deposit.replace(/[^0-9]/g, '') || '0');
      withdraw = parseInt(totals.withdraw.replace(/[^0-9]/g, '') || '0');
    
      // 한 달 검색
      const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD');
      const monthEnd = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
      await page.$eval('#sdate', el => el.value = '');
      await page.type('#sdate', monthStart);
      await page.$eval('#edate', el => el.value = '');
      await page.type('#edate', monthEnd);
      await page.click('#fsearch > input.btn_submit');
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      // 총충전/총환전 (totalIn, totalOut)
      const monthTotals = await page.evaluate(() => {
        return {
          totalIn: document.querySelector('#all_in')?.textContent.trim() || '0',
          totalOut: document.querySelector('#all_out')?.textContent.trim() || '0'
        };
      });
    
      let totalIn = parseInt(monthTotals.totalIn.replace(/[^0-9]/g, '') || '0');
      let totalOut = parseInt(monthTotals.totalOut.replace(/[^0-9]/g, '') || '0');
    
      // 데이터 객체
      const data = {
        site: '세븐',
        date: yesterdayDate,
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
    } else if (index === 3) { //형제
      await page.goto(URL, { waitUntil: 'networkidle2' });
      await page.type('#login_id', ID);
      await page.type('#login_pw', PWD);
      await Promise.all([
        page.click('#enter'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
    
      // /level6/member_list.php로 이동 (첫 페이지)
      await page.goto(`${URL}/level6/member_list.php?page=1`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
      const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YY-MM-DD');
    
      let join = 0;
      let black = 0;
    
      // 첫 페이지 크롤링
      let cellData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
          const cells = row.querySelectorAll('td');
          return {
            regDate: cells[21]?.textContent.trim(), // 가입일자 (22번째)
            status: cells[19]?.querySelector('.mb_intercept_msg')?.textContent.trim() || '' // 상태 (20번째)
          };
        });
      });
    
      cellData.forEach(res => {
        if (res.regDate === yesterday) {
          join++;
          if (res.status === '차단됨') black++;
        }
      });
    
      // 마지막 페이지 찾기
      const lastPageLink = await page.$('a.pg_page.pg_end');
      let lastPage = 1;
      if (lastPageLink) {
        lastPage = parseInt(await page.evaluate(el => el.href.match(/page=(\d+)/)?.[1], lastPageLink)) || 1;
      }
    
      // 마지막 페이지 크롤링
      if (lastPage > 1) {
        await page.goto(`${URL}/level6/member_list.php?page=${lastPage}`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
        cellData = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
            const cells = row.querySelectorAll('td');
            return {
              regDate: cells[21]?.textContent.trim(),
              status: cells[19]?.querySelector('.mb_intercept_msg')?.textContent.trim() || ''
            };
          });
        });
    
        cellData.forEach(res => {
          if (res.regDate === yesterday) {
            join++;
            if (res.status === '차단됨') black++;
          }
        });
      }
    
      // /level7/deposit_list.php로 이동
      await page.goto(`${URL}/level6/deposit_list.php`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
      // 어제 검색
      const yesterdayDate = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
      await page.$eval('#sdate', el => el.value = '');
      await page.type('#sdate', yesterdayDate);
      await page.$eval('#edate', el => el.value = '');
      await page.type('#edate', yesterdayDate);
      await page.click('#fsearch > input.btn_submit');
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      let deposit = 0;
      let withdraw = 0;
      const ids = new Set();
    
      // 테이블 데이터 (charge)
      const pageData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
          const cells = row.querySelectorAll('td');
          return {
            id: cells[1]?.textContent.trim(),
            status: cells[5]?.textContent.trim(),
            regDate: cells[6]?.textContent.trim()
          };
        });
      });

      pageData.forEach(res => {
        if (res.status === '입금완료' && res.id && res.regDate.startsWith(yesterdayDate)) {
          ids.add(res.id);
        }
      });
    
      // 총충전/총환전 (deposit, withdraw)
      const totals = await page.evaluate(() => {
        return {
          deposit: document.querySelector('#all_in')?.textContent.trim() || '0',
          withdraw: document.querySelector('#all_out')?.textContent.trim() || '0'
        };
      });
    
      deposit = parseInt(totals.deposit.replace(/[^0-9]/g, '') || '0');
      withdraw = parseInt(totals.withdraw.replace(/[^0-9]/g, '') || '0');
    
      // 한 달 검색
      const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD');
      const monthEnd = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
      await page.$eval('#sdate', el => el.value = '');
      await page.type('#sdate', monthStart);
      await page.$eval('#edate', el => el.value = '');
      await page.type('#edate', monthEnd);
      await page.click('#fsearch > input.btn_submit');
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      // 총충전/총환전 (totalIn, totalOut)
      const monthTotals = await page.evaluate(() => {
        return {
          totalIn: document.querySelector('#all_in')?.textContent.trim() || '0',
          totalOut: document.querySelector('#all_out')?.textContent.trim() || '0'
        };
      });
    
      let totalIn = parseInt(monthTotals.totalIn.replace(/[^0-9]/g, '') || '0');
      let totalOut = parseInt(monthTotals.totalOut.replace(/[^0-9]/g, '') || '0');
    
      // 데이터 객체
      const data = {
        site: '형제',
        date: yesterdayDate,
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
    } else if (index === 4) { //니모
      await page.type('input[placeholder="ID"]', ID);
      await page.type('input[placeholder="PASSWORD"]', PWD);
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
    
      // /user로 이동
      await page.goto(`${URL}/user`, { waitUntil: 'networkidle2' });
    
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
              if (regDate.slice(0,10) >= yesterdayStart && regDate.slice(0,10) <= yesterdayEnd && res.status === '완료') {
                const amount = parseInt(res.amount.replace(/[^0-9]/g, '') || '0');
                if (res.type === '충전') {
                  if (res.id) ids.add(res.id);
                  deposit += amount;
                }
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
              if (regDate.slice(0,10) >= monthStart && regDate.slice(0,10) <= monthEnd && res.status === '완료') {
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
    } else if (index === 5) { //꼬부기
          await page.type('#hdqts_id', ID);
          await page.type('#hdqts_pwd', PWD);
          await Promise.all([
            page.click('form#login_form button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
          ]);
    
          // /user/list로 이동, 데이터 정렬
          await page.goto(`${URL}/user/list`, { waitUntil: 'networkidle2' });
          await page.waitForSelector('#dt_list tbody tr');
          await page.click('#dt_list > thead > tr > th:nth-child(11)');
          await new Promise(resolve => setTimeout(resolve, 1000));
          await page.click('#dt_list > thead > tr > th:nth-child(11)');
          await new Promise(resolve => setTimeout(resolve, 1000));
    
          const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
    
          // /user/list 테이블 데이터 추출
          const cellData = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('#dt_list tbody tr')).map(row => {
              const cells = row.querySelectorAll('td');
              return { day: cells[10]?.innerText.trim(), state: cells[1]?.innerText.trim() };
            });
          });
    
          let join = 0;
          let black = 0;
          cellData.forEach(res => {
            if (res.day.slice(0, 10) === yesterday) {
              join++;
              if (res.state === '정지') black++;
            }
          });
    
          // /user/account로 이동
          await page.goto(`${URL}/user/account`, { waitUntil: 'networkidle2' });
          await page.waitForSelector('#dt_accnt tbody tr');
    
          // 어제 날짜 검색
          const yesterdayStart = moment().tz('Asia/Seoul').subtract(1, 'days').startOf('day').format('YYYY/MM/DD HH:mm:ss');
          const yesterdayEnd = moment().tz('Asia/Seoul').subtract(1, 'days').endOf('day').format('YYYY/MM/DD HH:mm:ss');
          const yesterdayRange = `${yesterdayStart} - ${yesterdayEnd}`;
    
          await page.evaluate((range) => {
            document.querySelector('#src_accnt_reg_dt').value = range;
          }, yesterdayRange);
          await page.click('button[onclick="dt_accnt();"]');
          await new Promise(resolve => setTimeout(resolve, 3000));
    
          // 상단 입금/출금 금액 추출
          const deposit = await page.evaluate(() => {
            const amount = document.querySelector('#path_user_chrg_amt')?.innerText || '0';
            return parseInt(amount.replace(/[^0-9]/g, '') || '0');
          });
    
          const withdraw = await page.evaluate(() => {
            const amount = document.querySelector('#path_user_exchg_amt')?.innerText || '0';
            return parseInt(amount.replace(/[^0-9]/g, '') || '0');
          });
    
          // 테이블 순회 및 페이징 처리 (charge 계산)
          let hasNextPage = true;
          const ids = new Set();
    
          while (hasNextPage) {
            const pageData = await page.evaluate(() => {
              const rows = document.querySelectorAll('#dt_accnt tbody tr');
              return Array.from(rows).map(row => {
                const cells = row.querySelectorAll('td');
                return {
                  id: cells[0]?.innerText.trim(),
                  status: cells[4]?.innerText.trim(),
                };
              });
            });
    
            pageData.forEach(res => {
              if (res.status.includes('[승인]') && res.id) {
                ids.add(res.id); // 중복 제거
              }
            });
    
            const nextPageButton = await page.$('#dt_accnt_next');
            const isDisabled = await page.evaluate(el => el.classList.contains('disabled'), nextPageButton);
    
            if (nextPageButton && !isDisabled) {
              await Promise.all([
                nextPageButton.click(),
                page.waitForNavigation({ waitUntil: 'networkidle2' }),
              ]);
              await page.waitForSelector('#dt_accnt tbody tr');
            } else {
              hasNextPage = false;
            }
          }
    
          // 1일~어제 데이터 크롤링 (상단 금액 추출)
          const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY/MM/DD HH:mm:ss');
          const monthEnd = moment().tz('Asia/Seoul').subtract(1, 'days').endOf('day').format('YYYY/MM/DD HH:mm:ss');
          const monthRange = `${monthStart} - ${monthEnd}`;
    
          await page.evaluate((range) => {
            document.querySelector('#src_accnt_reg_dt').value = range;
          }, monthRange);
          await page.click('button[onclick="dt_accnt();"]');
          await new Promise(resolve => setTimeout(resolve, 3000));
    
          const totalIn = await page.evaluate(() => {
            const amount = document.querySelector('#path_user_chrg_amt')?.innerText || '0';
            return parseInt(amount.replace(/[^0-9]/g, '') || '0');
          });
    
          const totalOut = await page.evaluate(() => {
            const amount = document.querySelector('#path_user_exchg_amt')?.innerText || '0';
            return parseInt(amount.replace(/[^0-9]/g, '') || '0');
          });
    
          // 데이터 객체 반환
          const data = {
            site: '꼬부기',
            date: yesterday,
            join,          // 어제 가입자 수
            black,         // 어제 블랙리스트 수
            charge: ids.size, // 어제~어제의 고유 아이디 수
            deposit,       // 어제~어제의 총 입금
            withdraw,      // 어제~어제의 총 출금
            totalIn,       // 1일~어제의 총 입금
            totalOut,      // 1일~어제의 총 출금
          };
    
          data.deposit = (data.deposit || 0).toLocaleString('en-US');
          data.withdraw = (data.withdraw || 0).toLocaleString('en-US');
          data.totalIn = (data.totalIn || 0).toLocaleString('en-US');
          data.totalOut = (data.totalOut || 0).toLocaleString('en-US');
    
          return data;
    } else if (index === 6) { //하와이
      await page.goto(URL, { waitUntil: 'networkidle2' });
      await page.type('#login_id', ID);
      await page.type('#login_pw', PWD);
      await Promise.all([
        page.click('#enter'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
    
      // /level6/member_list.php로 이동 (첫 페이지)
      await page.goto(`${URL}/level6/member_list.php?page=1`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
      const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YY-MM-DD');
    
      let join = 0;
      let black = 0;
    
      // 첫 페이지 크롤링
      let cellData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
          const cells = row.querySelectorAll('td');
          return {
            regDate: cells[21]?.textContent.trim(), // 가입일자 (22번째)
            status: cells[19]?.querySelector('.mb_intercept_msg')?.textContent.trim() || '' // 상태 (20번째)
          };
        });
      });
    
      cellData.forEach(res => {
        if (res.regDate === yesterday) {
          join++;
          if (res.status === '차단됨') black++;
        }
      });
    
      // 마지막 페이지 찾기
      const lastPageLink = await page.$('a.pg_page.pg_end');
      let lastPage = 1;
      if (lastPageLink) {
        lastPage = parseInt(await page.evaluate(el => el.href.match(/page=(\d+)/)?.[1], lastPageLink)) || 1;
      }
    
      // 마지막 페이지 크롤링
      if (lastPage > 1) {
        await page.goto(`${URL}/level6/member_list.php?page=${lastPage}`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
        cellData = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
            const cells = row.querySelectorAll('td');
            return {
              regDate: cells[21]?.textContent.trim(),
              status: cells[19]?.querySelector('.mb_intercept_msg')?.textContent.trim() || ''
            };
          });
        });
    
        cellData.forEach(res => {
          if (res.regDate === yesterday) {
            join++;
            if (res.status === '차단됨') black++;
          }
        });
      }
    
      // /level6/deposit_list.php로 이동
      await page.goto(`${URL}/level6/deposit_list.php`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
      // 어제 검색
      const yesterdayDate = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
      await page.$eval('#sdate', el => el.value = '');
      await page.type('#sdate', yesterdayDate);
      await page.$eval('#edate', el => el.value = '');
      await page.type('#edate', yesterdayDate);
      await page.click('#fsearch > input.btn_submit');
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      let deposit = 0;
      let withdraw = 0;
      const ids = new Set();
    
      // 테이블 데이터 (charge)
      const pageData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.tbl_head01.tbl_wrap table tbody tr')).map(row => {
          const cells = row.querySelectorAll('td');
          return {
            id: cells[1]?.textContent.trim(),
            status: cells[5]?.textContent.trim(),
            regDate: cells[6]?.textContent.trim()
          };
        });
      });

      pageData.forEach(res => {
        if (res.status === '입금완료' && res.id && res.regDate.startsWith(yesterdayDate)) {
          ids.add(res.id);
        }
      });
    
      // 총충전/총환전 (deposit, withdraw)
      const totals = await page.evaluate(() => {
        return {
          deposit: document.querySelector('#all_in')?.textContent.trim() || '0',
          withdraw: document.querySelector('#all_out')?.textContent.trim() || '0'
        };
      });
    
      deposit = parseInt(totals.deposit.replace(/[^0-9]/g, '') || '0');
      withdraw = parseInt(totals.withdraw.replace(/[^0-9]/g, '') || '0');
    
      // 한 달 검색
      const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD');
      const monthEnd = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
      await page.$eval('#sdate', el => el.value = '');
      await page.type('#sdate', monthStart);
      await page.$eval('#edate', el => el.value = '');
      await page.type('#edate', monthEnd);
      await page.click('#fsearch > input.btn_submit');
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      // 총충전/총환전 (totalIn, totalOut)
      const monthTotals = await page.evaluate(() => {
        return {
          totalIn: document.querySelector('#all_in')?.textContent.trim() || '0',
          totalOut: document.querySelector('#all_out')?.textContent.trim() || '0'
        };
      });
    
      let totalIn = parseInt(monthTotals.totalIn.replace(/[^0-9]/g, '') || '0');
      let totalOut = parseInt(monthTotals.totalOut.replace(/[^0-9]/g, '') || '0');
    
      // 데이터 객체
      const data = {
        site: '하와이',
        date: yesterdayDate,
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
    } 
    return null;
  } catch (err) {
    console.error(`❌ site${index} 에러:`, err);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = { crawlSite2 };