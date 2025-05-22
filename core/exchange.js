const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { logger } = require('../utils/loggerHelper')

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
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.goto('https://crossenf.com', { waitUntil: 'networkidle2' }); // Wait for the page to fully load

        // CNY를 VND로 변경
        await page.waitForSelector('.choose-nation'); // Ensure the dropdown is available
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.click('.choose-nation'); // 드롭다운 열기
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.waitForSelector('ul.dropdown-menu'); // 드롭다운 메뉴가 로드될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.evaluate(() => {
            const vndOption = Array.from(document.querySelectorAll('ul.dropdown-menu li a')).find(el => el.textContent.includes('베트남 (VND)'));
            if (vndOption) vndOption.click();
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        // 크로스 환율 정보 추출
        await page.waitForSelector('.sub_described_info span.ng-binding');
        await new Promise(resolve => setTimeout(resolve, 1000));
        const rateText = await page.$eval('.sub_described_info span.ng-binding', el => el.textContent.trim());
        const rate = rateText.split('KRW')[0]; // Extract only the numeric part
        let data = rate.trim()

        await browser.close();
        return data;
    } catch (error) {
        console.error('Error fetching Cross exchange rate:', error);
        throw error;
    }
};


const runExchange = async () => {  
    try {
        const naverRate = await naverExchange();        
        const crossRate = await crossExchange();
        const naverVnd = naverRate ? (1 / naverRate * 100).toFixed(2) : '-';
        const crossVnd = crossRate ? (1 / crossRate * 100).toFixed(2) : '-';

        logger('exchange', `네이버 환율: ${naverRate} 크로스 환율: ${crossRate} 네이버 VND: ${naverVnd} 크로스 VND: ${crossVnd}`);
        return {
            naver: naverRate,
            cross: crossRate
        };
    } catch (error) { 
        console.error('Error fetching exchange rates:', error);    
        throw error;
    }
}

module.exports = { runExchange };