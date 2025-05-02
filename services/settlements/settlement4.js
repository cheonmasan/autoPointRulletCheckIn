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

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto(URL, { waitUntil: 'networkidle2' });

    if (index === 1) { // 빌드
      // 로그인 입력
      await page.type('input[name="uid"]', ID);
      await page.type('input[name="pwd"]', PWD);

      // CAPTCHA 수동 입력 대기
      console.log('index 1: CAPTCHA를 브라우저에서 입력하고 "Sign In" 버튼을 클릭하세요.');
      await page.waitForFunction(
        () => {
          const captchaInput = document.querySelector('input[name="captcha"]');
          return captchaInput && captchaInput.value.trim() !== '';
        },
        { timeout: 60000 } // 60초 타임아웃
      );

      // 로그인 버튼 클릭 대기
      await page.click('button[onclick="login()"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      // 로그인 성공 여부 확인
      const currentUrl = page.url();
      if (currentUrl.includes('proc/loginProcess.php')) {
        console.error('index 1: 로그인 실패, URL:', currentUrl);
        return null;
      }

      // /main.php로 이동 (회원 데이터)
      await page.goto(`${URL}/main.php`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.table.table-bordered tbody tr');

      const yesterday = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');

      let join = 0;
      let black = 0;

      // 회원 데이터 크롤링
      const cellData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.table.table-bordered tbody tr')).map(row => {
          const cells = row.querySelectorAll('td');
          return {
            regDate: cells[10]?.textContent.trim() || '',
            status: cells[12]?.textContent.trim() || ''
          };
        });
      });

      cellData.forEach(res => {
        const regDate = res.regDate.slice(0, 10); // YYYY-MM-DD
        if (regDate === yesterday) {
          join++;
          if (res.status === '탈퇴') black++;
        }
      });

      // /depositList_new.php로 이동 (charge 데이터)
      await page.goto(`${URL}/depositList_new.php`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.table.table-bordered tbody tr');

      // 어제 날짜 설정
      const yesterdayDate = moment().tz('Asia/Seoul').subtract(1, 'days').format('YYYY-MM-DD');
      await page.$eval('#startDate', (el, value) => el.value = value, yesterdayDate);
      await page.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
      await page.click('button.btn.btn-sm.btn-success');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const ids = new Set();

      // 페이지네이션 처리
      const pageLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.pagination a')).map(a => a.href.match(/goPage\('(\d+)'\)/)?.[1]).filter(x => x);
      });
      const totalPages = pageLinks.length ? Math.max(...pageLinks.map(Number)) + 1 : 1;

      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        if (pageNum > 0) {
          await page.evaluate(page => window.goPage(page), pageNum);
          await page.waitForSelector('.table.table-bordered tbody tr', { timeout: 10000 });
        }

        const pageData = await page.evaluate(() => {
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
          const processDate = res.processDate.slice(0, 10);
          if (res.status === '완료' && res.id && processDate === yesterdayDate) {
            ids.add(res.id);
          }
        });
      }

      // /agen_cal.php로 이동 (deposit, withdraw, totalIn, totalOut)
      await page.goto(`${URL}/agen_cal.php`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.table.table-bordered tbody tr');

      // 어제 데이터 (deposit, withdraw)
      await page.$eval('#startDate', (el, value) => el.value = value, yesterdayDate);
      await page.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
      await page.click('button.btn.btn-sm.btn-success');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const yesterdayTotals = await page.evaluate(() => {
        const rows = document.querySelectorAll('.table.table-bordered tbody tr');
        return {
          deposit: rows[2]?.querySelectorAll('td')[1]?.textContent.trim() || '0',
          withdraw: rows[3]?.querySelectorAll('td')[1]?.textContent.trim() || '0'
        };
      });

      // 한 달 데이터 (totalIn, totalOut)
      const monthStart = moment().tz('Asia/Seoul').startOf('month').format('YYYY-MM-DD');
      await page.$eval('#startDate', (el, value) => el.value = value, monthStart);
      await page.$eval('#endDate', (el, value) => el.value = value, yesterdayDate);
      await page.click('button.btn.btn-sm.btn-success');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const monthTotals = await page.evaluate(() => {
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
    } else if (index === 2) { // 플레이
      return null;
    } else if (index === 3) { // 젠
      return null;
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