const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const dotenv = require('dotenv');
dotenv.config();

async function crawlSite3(index) {
  const URL = process.env[`settlement3_site${index}_URL`];
  const ID = process.env[`settlement3_site${index}_ID`];
  const PWD = process.env[`settlement3_site${index}_PWD`];

  if (!URL || !ID || !PWD) {
    console.warn(`⚠️ site${index} 정보가 .env에 없습니다.`);
    return null;
  }

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  // page.setViewport({ width: 1920, height: 1080 })

  try {
    await page.goto(URL, { waitUntil: 'networkidle2' });

    if (index === 1) { //꼬부기
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
      // const yesterday = '2024-11-21';

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
          if (res.state === '정지')
            black++;
        }
      });

      // /user/account로 이동
      await page.goto(`${URL}/user/account`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('#dt_accnt tbody tr');

      // 어제 날짜 검색
      const yesterdayStart = moment().tz('Asia/Seoul').subtract(1, 'days').startOf('day').format('YYYY/MM/DD HH:mm:ss');
      // const yesterdayStart = '2024/11/21 00:00:00';
      const yesterdayEnd = moment().tz('Asia/Seoul').subtract(1, 'days').endOf('day').format('YYYY/MM/DD HH:mm:ss');
      // const yesterdayEnd = '2024/11/21 23:59:59';
      const yesterdayRange = `${yesterdayStart} - ${yesterdayEnd}`;

      await page.evaluate((range) => {
        document.querySelector('#src_accnt_reg_dt').value = range;
      }, yesterdayRange);
      await page.click('button[onclick="dt_accnt();"]');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 어제 데이터 추출 (테이블에서 [승인]만)
      const { deposit, withdraw, charge } = await page.evaluate(() => {
        const parseAmount = (text) => parseInt(text.replace(/[^0-9]/g, '') || '0');
        const rows = document.querySelectorAll('#dt_accnt tbody tr');
        let deposit = 0;
        let withdraw = 0;
        const ids = new Set();

        if (rows.length === 1 && rows[0].querySelector('.dataTables_empty')) {
          return { deposit, withdraw, charge: 0 };
        }

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          const id = cells[0]?.innerText.trim();
          const type = cells[1]?.innerText.trim();
          const amount = parseAmount(cells[2]?.innerText || '0');
          const status = cells[4]?.innerText.trim();

          if (id) ids.add(id);
          if (status.includes('[승인]')) {
            if (type === '입금') deposit += amount;
            if (type === '출금') withdraw += amount;
          }
        });

        return { deposit, withdraw, charge: ids.size };
      });

      // 한 달 날짜 검색
      const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY/MM/DD HH:mm:ss');
      // const monthStart = '2024/11/01 00:00:00';
      const monthEnd = moment().tz('Asia/Seoul').subtract(1, 'days').endOf('day').format('YYYY/MM/DD HH:mm:ss');
      // const monthEnd = '2024/11/30 23:59:59';
      const monthRange = `${monthStart} - ${monthEnd}`;

      await page.evaluate((range) => {
        document.querySelector('#src_accnt_reg_dt').value = range;
      }, monthRange);
      await page.click('button[onclick="dt_accnt();"]');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 한 달 데이터 추출 (테이블에서 [승인]만)
      const { totalIn, totalOut } = await page.evaluate(() => {
        const parseAmount = (text) => parseInt(text.replace(/[^0-9]/g, '') || '0');
        const rows = document.querySelectorAll('#dt_accnt tbody tr');
        let totalIn = 0;
        let totalOut = 0;

        if (rows.length === 1 && rows[0].querySelector('.dataTables_empty')) {
          return { totalIn, totalOut };
        }

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          const type = cells[1]?.innerText.trim();
          const amount = parseAmount(cells[2]?.innerText || '0');
          const status = cells[4]?.innerText.trim();

          if (status.includes('[승인]')) {
            if (type === '입금') totalIn += amount;
            if (type === '출금') totalOut += amount;
          }
        });

        return { totalIn, totalOut };
      });

      // 데이터 객체 반환
      const data = {
        site: '꼬부기',
        date: yesterday,
        join,
        black,
        charge,
        deposit,
        withdraw,
        totalIn,
        totalOut
      };

      data.deposit = (data.deposit || 0).toLocaleString('en-US');
      data.withdraw = (data.withdraw || 0).toLocaleString('en-US');
      data.totalIn = (data.totalIn || 0).toLocaleString('en-US');
      data.totalOut = (data.totalOut || 0).toLocaleString('en-US');

      return data;
    } else if (index === 2) { //니모
      await page.type('input[placeholder="ID"]', ID);
      await page.type('input[placeholder="PASSWORD"]', PWD);
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);

      // /user로 이동
      await page.goto(`${URL}/user`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.table.table-hover.text-nowrap tbody tr');

      const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY.MM.DD');

      // /user 테이블 데이터 추출
      const cellData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.table.table-hover.text-nowrap tbody tr')).map(row => {
          const cells = row.querySelectorAll('td');
          return {
            status: cells[1]?.querySelector('.badge')?.textContent.trim(),
            regDate: cells[13]?.textContent.trim()
          };
        });
      });

      let join = 0;
      let black = 0;
      cellData.forEach(res => {
        const regDate = res.regDate.slice(0, 10); // YYYY.MM.DD
        if (regDate === yesterday) {
          join++;
        if (res.status === '탈퇴')
            black++;
        }
      });

      // /money로 이동
      await page.goto(`${URL}/money`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.table.table-hover.text-nowrap tbody tr');

      // 어제 검색
      const yesterdayStart = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD 00:00:00');
      const yesterdayEnd = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD 23:59:59');

      // 날짜 입력
      await page.evaluate((start, end) => {
        document.querySelector('#__BVID__25__value_').value = start;
        document.querySelector('#__BVID__28__value_').value = end;
      }, yesterdayStart.split(' ')[0], yesterdayEnd.split(' ')[0]);

      // 상태: 완료
      await page.select('select:nth-of-type(1)', '1');

      // 검색
      await page.click('button.btn.btn-sm.btn-success');
      await new Promise(resolve => setTimeout(resolve, 1000));

      let deposit = 0;
      let withdraw = 0;
      const ids = new Set();

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

        pageData.forEach(res => {
          const regDate = res.regDate.replace(/\./g, '-'); // YYYY.MM.DD → YYYY-MM-DD
          if (regDate >= yesterdayStart && regDate <= yesterdayEnd && res.status === '완료') {
            const amount = parseInt(res.amount.replace(/[^0-9]/g, '') || '0');
            if (res.id) ids.add(res.id);
            if (res.type === '충전') deposit += amount;
            if (res.type === '환전') withdraw += amount;
          }
        });

        // 다음 페이지 확인
        const nextPageLink = await page.$('a[aria-label="Go to next page"]');
        if (nextPageLink && !(await page.evaluate(el => el.classList.contains('disabled'), nextPageLink))) {
          await Promise.all([
            page.click('a[aria-label="Go to next page"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
          ]);
          await page.waitForSelector('.table.table-hover.text-nowrap tbody tr');
        } else {
          hasNextPage = false;
        }
      }

      // 한 달 검색
      const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD 00:00:00');
      const monthEnd = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD 23:59:59');

      // 날짜 입력
      await page.evaluate((start, end) => {
        document.querySelector('#__BVID__25__value_').value = start;
        document.querySelector('#__BVID__28__value_').value = end;
      }, monthStart.split(' ')[0], monthEnd.split(' ')[0]);

      // 상태: 완료
      await page.select('select:nth-of-type(1)', '1');

      // 검색
      await page.click('button.btn.btn-sm.btn-success');
      await new Promise(resolve => setTimeout(resolve, 1000));

      let totalIn = 0;
      let totalOut = 0;

      hasNextPage = true;
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

        pageData.forEach(res => {
          const regDate = res.regDate.replace(/\./g, '-'); // YYYY.MM.DD → YYYY-MM-DD
          if (regDate >= monthStart && regDate <= monthEnd && res.status === '완료') {
            const amount = parseInt(res.amount.replace(/[^0-9]/g, '') || '0');
            if (res.type === '충전') totalIn += amount;
            if (res.type === '환전') totalOut += amount;
          }
        });

        // 다음 페이지 확인
        const nextPageLink = await page.$('a[aria-label="Go to next page"]');
        if (nextPageLink && !(await page.evaluate(el => el.classList.contains('disabled'), nextPageLink))) {
          await Promise.all([
            page.click('a[aria-label="Go to next page"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
          ]);
          await page.waitForSelector('.table.table-hover.text-nowrap tbody tr');
        } else {
          hasNextPage = false;
        }
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
    } else if (index === 3) { //형제
      await page.goto(URL, { waitUntil: 'networkidle2' });
      await page.type('#login_id', ID);
      await page.type('#login_pw', PWD);
      await Promise.all([
        page.click('#enter'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
    
      // /level7/member_list.php로 이동 (첫 페이지)
      await page.goto(`${URL}/level7/member_list.php?page=1`, { waitUntil: 'networkidle2' });
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
        await page.goto(`${URL}/level7/member_list.php?page=${lastPage}`, { waitUntil: 'networkidle2' });
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
      await page.goto(`${URL}/level7/deposit_list.php`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.tbl_head01.tbl_wrap table tbody tr');
    
      // 어제 검색
      const yesterdayDate = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
      await page.$eval('#sdate', el => el.value = '');
      await page.type('#sdate', yesterdayDate);
      await page.$eval('#edate', el => el.value = '');
      await page.type('#edate', yesterdayDate);
      await page.click('#fsearch > input.btn_submit');
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      const ids = new Set();
      let deposit = 0;
      let withdraw = 0;
    
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
    } else if (index === 4) { //하와이
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
    
      const ids = new Set();
      let deposit = 0;
      let withdraw = 0;
    
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
    } else if (index === 5) { //삼성
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
    
      const ids = new Set();
      let deposit = 0;
      let withdraw = 0;
    
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
    } else if (index === 6) { //세븐
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
    
      const ids = new Set();
      let deposit = 0;
      let withdraw = 0;
    
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
    }
    return null;
  } catch (err) {
    console.error(`❌ site${index} 에러:`, err);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = { crawlSite3 };