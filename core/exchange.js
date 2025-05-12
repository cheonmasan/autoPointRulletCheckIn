const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const naverExchange = async () => {
    try {
        const response = await axios.get('https://search.naver.com/search.naver?sm=tab_hty.top&where=nexearch&ssc=tab.nx.all&query=%EB%B2%A0%ED%8A%B8%EB%82%A8+%EB%8F%99');
        const html = response.data;
        const $ = cheerio.load(html);

        // 네이버 환율 정보 추출 (예: 5.46)
        const rate = $(".price_info .price").first().text();
        return rate;
    } catch (error) {
        console.error('Error fetching Naver exchange rate:', error);
        throw error;
    }
}

const crossExchange = async () => {
    try {
        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();
        await page.goto('https://crossenf.com'); // 예시 URL

        // CNY를 VND로 변경
        await page.click('.choose-nation'); // 드롭다운 열기
        await page.waitForSelector('li[ng-repeat="country in remit.remitCountryInfoList"]');
        await page.evaluate(() => {
            const vndOption = Array.from(document.querySelectorAll('li[ng-repeat="country in remit.remitCountryInfoList"] a')).find(el => el.textContent.includes('베트남 (VND)'));
            if (vndOption) vndOption.click();
        });

        // 크로스 환율 정보 추출
        await page.waitForSelector('.sub_described_info span.ng-binding');
        const rate = await page.$eval('.sub_described_info span.ng-binding', el => el.textContent.trim());

        await browser.close();
        return rate;
    } catch (error) {
        console.error('Error fetching Cross exchange rate:', error);
        throw error;
    }
};

const wirebarleyExchange = async () => {
    try {
        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();
        await page.goto('https://www.wirebarley.com/'); // Wirebarley URL

        // "They Receive" 드롭다운에서 VND 선택
        await page.click('.currency-selector'); // 드롭다운 열기
        await page.waitForSelector('.currency-option');
        await page.evaluate(() => {
            const vndOption = Array.from(document.querySelectorAll('.currency-option')).find(el => el.textContent.includes('VND'));
            if (vndOption) vndOption.click();
        });

        // Wirebarley 환율 정보 추출
        await page.waitForSelector('p.font-medium.text-[0.8125rem].text-center');
        const rateText = await page.$eval('p.font-medium.text-[0.8125rem].text-center', el => el.textContent.trim());

        // "1,000 KRW = 18,137.83 VND"에서 숫자 부분만 추출
        const rate = rateText.match(/=\s([\d,\.]+)\sVND/)[1];

        await browser.close();
        return rate;
    } catch (error) {
        console.error('Error fetching Wirebarley exchange rate:', error);
        throw error;
    }
}


const runExchange = async () => {  
    try {
        const naverRate = await naverExchange();
        // const crossRate = await crossExchange();
        // const wirebarleyRate = await wirebarleyExchange();

        return {
            naver: naverRate,
            cross: '5.46',
            wirebarley: '5.55'
        };
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        throw error;
    }
};

module.exports = { runExchange, naverExchange, crossExchange, wirebarleyExchange };