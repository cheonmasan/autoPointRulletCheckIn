const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
const dotenv = require('dotenv');
dotenv.config();

async function crawlSite0(index) {
  const URL = process.env[`settlement0_site${index}_URL`];
  const ID = process.env[`settlement0_site${index}_ID`];
  const PWD = process.env[`settlement0_site${index}_PWD`];

  if (!URL || !ID || !PWD) {
    console.warn(`⚠️ site${index} 정보가 .env에 없습니다.`);
    return null;
  }

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  page.setViewport({ width: 1920, height: 1080 })

  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  try {
    await page.goto(URL, { waitUntil: 'networkidle2' });

    if (index === 1) { //라바
    } else if (index === 2) { //네임드
    } else if (index === 3) { //판도라
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