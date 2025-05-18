window.addEventListener('DOMContentLoaded', () => {
    const checkinBtn = document.getElementById('checkin-btn');
    const pointmartBtn = document.getElementById('pointmart-btn');
    const rouletteBtn = document.getElementById('roulette-btn');
    const eventBtn = document.getElementById('event-btn');
    const detectionBtn = document.getElementById('detection-btn');
    const createPostBtn = document.getElementById('createpost-btn');

    const checkinStatus = document.getElementById('checkin-status');
    const pointmartStatus = document.getElementById('pointmart-status');
    const rouletteStatus = document.getElementById('roulette-status');
    const eventStatus = document.getElementById('event-status');
    const detectionStatus = document.getElementById('detection-status');
    const createpostStatus = document.getElementById('createpost-status');

    const checkinLog = document.getElementById('checkin-log');
    const pointmartLog = document.getElementById('pointmart-log');
    const rouletteLog = document.getElementById('roulette-log');
    const eventLog = document.getElementById('event-log');
    const detectionLog = document.getElementById('detection-log');
    const createpostLog = document.getElementById('createpost-log');

    checkinBtn.addEventListener('click', async () => {
        await window.electronAPI.runCheckIn();
    });

    pointmartBtn.addEventListener('click', async () => {
        await window.electronAPI.runPointMart();
    });

    rouletteBtn.addEventListener('click', async () => {
        await window.electronAPI.runRoulette();
    });

    eventBtn.addEventListener('click', async () => {
        await window.electronAPI.runEvent();
    });

    detectionBtn.addEventListener('click', async () => {
        await window.electronAPI.runDetection();
    });

    createPostBtn.addEventListener('click', async () => {
        await window.electronAPI.runCreatePost();
    });

    window.electronAPI.onLog((type, message) => {
        const logLine = `[${new Date().toLocaleTimeString()}] ${message}\n`;
        switch (type) {
            case 'checkin':
                checkinLog.value += logLine;
                checkinLog.scrollTop = checkinLog.scrollHeight;
                break;
            case 'pointmart':
                pointmartLog.value += logLine;
                pointmartLog.scrollTop = pointmartLog.scrollHeight;
                break;
            case 'roulette':
                rouletteLog.value += logLine;
                rouletteLog.scrollTop = rouletteLog.scrollHeight;
                break;
            case 'event':
                eventLog.value += logLine;
                eventLog.scrollTop = eventLog.scrollHeight;
                break;
            case 'detection':
                detectionLog.value += logLine;
                detectionLog.scrollTop = detectionLog.scrollHeight;
                break;
            case 'createpost':
                createpostLog.value += logLine;
                createpostLog.scrollTop = createpostLog.scrollHeight;
                break;
            default:
                break;
        }
    });

    window.electronAPI.onStatusUpdate((type, status) => {
        switch (type) {
            case 'checkin':
                checkinStatus.textContent = status;
                break;
            case 'pointmart':
                pointmartStatus.textContent = status;
                break;
            case 'roulette':
                rouletteStatus.textContent = status;
                break;
            case 'event':
                eventStatus.textContent = status;
                break;
            case 'detection':
                detectionStatus.textContent = status;
                break;
            case 'createpost':
                createpostStatus.textContent = status;
                break;
            default:
                break;
        }
    });

    document.getElementById('settlementBtn0')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus0').textContent = '진행중...';
        document.getElementById('settlementStatus0').className = 'progress';
        const results = await window.electronAPI.runSettlement0();
        document.getElementById('settlementBody0').innerHTML = '';
        results.forEach(data => addSettlementRow('settlementBody0', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus0').textContent = '완료!';
        document.getElementById('settlementStatus0').className = 'complete';
    });

    document.getElementById('settlementBtn0_LAVA')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus0').textContent = '진행중...';
        document.getElementById('settlementStatus0').className = 'progress';
        const results = await window.electronAPI.runSettlement0Lava();
        results.forEach(data => addSettlementRow('settlementBody0', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus0').textContent = '완료!';
        document.getElementById('settlementStatus0').className = 'complete';
    });

    document.getElementById('settlementBtn0_NANED')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus0').textContent = '진행중...';
        document.getElementById('settlementStatus0').className = 'progress';
        const results = await window.electronAPI.runSettlement0Naned();
        results.forEach(data => addSettlementRow('settlementBody0', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus0').textContent = '완료!';
        document.getElementById('settlementStatus0').className = 'complete';
    });

    document.getElementById('settlementBtn0_PANDORA')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus0').textContent = '진행중...';
        document.getElementById('settlementStatus0').className = 'progress';
        const results = await window.electronAPI.runSettlement0Pandora();
        results.forEach(data => addSettlementRow('settlementBody0', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus0').textContent = '완료!';
        document.getElementById('settlementStatus0').className = 'complete';
    });

    document.getElementById('settlementBtn1')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus1').textContent = '진행중...';
        document.getElementById('settlementStatus1').className = 'progress';
        const results = await window.electronAPI.runSettlement1();
        document.getElementById('settlementBody1').innerHTML = '';
        results.forEach(data => addSettlementRow('settlementBody1', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus1').textContent = '완료!';
        document.getElementById('settlementStatus1').className = 'complete';
    });

    document.getElementById('settlementBtn1_NIMO')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus1').textContent = '진행중...';
        document.getElementById('settlementStatus1').className = 'progress';
        const results = await window.electronAPI.runSettlement1Nimo();
        results.forEach(data => addSettlementRow('settlementBody1', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus1').textContent = '완료!';
        document.getElementById('settlementStatus1').className = 'complete';
    });

    document.getElementById('settlementBtn1_BANKCS')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus1').textContent = '진행중...';
        document.getElementById('settlementStatus1').className = 'progress';
        const results = await window.electronAPI.runSettlement1Bankcs();
        results.forEach(data => addSettlementRow('settlementBody1', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus1').textContent = '완료!';
        document.getElementById('settlementStatus1').className = 'complete';
    });

    document.getElementById('settlementBtn1_BANKKING')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus1').textContent = '진행중...';
        document.getElementById('settlementStatus1').className = 'progress';
        const results = await window.electronAPI.runSettlement1Bankking();
        results.forEach(data => addSettlementRow('settlementBody1', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus1').textContent = '완료!';
        document.getElementById('settlementStatus1').className = 'complete';
    });

    document.getElementById('settlementBtn1_HEAVENCS')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus1').textContent = '진행중...';
        document.getElementById('settlementStatus1').className = 'progress';
        const results = await window.electronAPI.runSettlement1Heavencs();
        results.forEach(data => addSettlementRow('settlementBody1', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus1').textContent = '완료!';
        document.getElementById('settlementStatus1').className = 'complete';
    });

    document.getElementById('settlementBtn1_HEAVENKING')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus1').textContent = '진행중...';
        document.getElementById('settlementStatus1').className = 'progress';
        const results = await window.electronAPI.runSettlement1Heavenking();
        results.forEach(data => addSettlementRow('settlementBody1', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus1').textContent = '완료!';
        document.getElementById('settlementStatus1').className = 'complete';
    });

    document.getElementById('settlementBtn2')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus2').textContent = '진행중...';
        document.getElementById('settlementStatus2').className = 'progress';
        const results = await window.electronAPI.runSettlement2();
        document.getElementById('settlementBody2').innerHTML = '';
        results.forEach(data => addSettlementRow('settlementBody2', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus2').textContent = '완료!';
        document.getElementById('settlementStatus2').className = 'complete';
    });

    document.getElementById('settlementBtn2_SAMSUNG')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus2').textContent = '진행중...';
        document.getElementById('settlementStatus2').className = 'progress';
        const results = await window.electronAPI.runSettlement2Samsung();
        results.forEach(data => addSettlementRow('settlementBody2', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus2').textContent = '완료!';
        document.getElementById('settlementStatus2').className = 'complete';
    });

    document.getElementById('settlementBtn2_SEVEN')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus2').textContent = '진행중...';
        document.getElementById('settlementStatus2').className = 'progress';
        const results = await window.electronAPI.runSettlement2Seven();
        results.forEach(data => addSettlementRow('settlementBody2', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus2').textContent = '완료!';
        document.getElementById('settlementStatus2').className = 'complete';
    });

    document.getElementById('settlementBtn2_HYUNGJAE')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus2').textContent = '진행중...';
        document.getElementById('settlementStatus2').className = 'progress';
        const results = await window.electronAPI.runSettlement2Hyungjae();
        results.forEach(data => addSettlementRow('settlementBody2', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus2').textContent = '완료!';
        document.getElementById('settlementStatus2').className = 'complete';
    });

    document.getElementById('settlementBtn2_NIMO')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus2').textContent = '진행중...';
        document.getElementById('settlementStatus2').className = 'progress';
        const results = await window.electronAPI.runSettlement2Nimo();
        results.forEach(data => addSettlementRow('settlementBody2', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus2').textContent = '완료!';
        document.getElementById('settlementStatus2').className = 'complete';
    });

    document.getElementById('settlementBtn2_KKOBUKI')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus2').textContent = '진행중...';
        document.getElementById('settlementStatus2').className = 'progress';
        const results = await window.electronAPI.runSettlement2Kkobuki();
        results.forEach(data => addSettlementRow('settlementBody2', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus2').textContent = '완료!';
        document.getElementById('settlementStatus2').className = 'complete';
    });
    
    document.getElementById('settlementBtn2_HAWAII')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus2').textContent = '진행중...';
        document.getElementById('settlementStatus2').className = 'progress';
        const results = await window.electronAPI.runSettlement2Hawaii();
        results.forEach(data => addSettlementRow('settlementBody2', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus2').textContent = '완료!';
        document.getElementById('settlementStatus2').className = 'complete';
    });

    document.getElementById('settlementBtn3')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus3').textContent = '진행중...';
        document.getElementById('settlementStatus3').className = 'progress';
        const results = await window.electronAPI.runSettlement3();
        document.getElementById('settlementBody3').innerHTML = '';
        results.forEach(data => addSettlementRow('settlementBody3', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus3').textContent = '완료!';
        document.getElementById('settlementStatus3').className = 'complete';
    });

    document.getElementById('settlementBtn3_KKOBUKI')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus3').textContent = '진행중...';
        document.getElementById('settlementStatus3').className = 'progress';
        const results = await window.electronAPI.runSettlement3Kkobuki();
        results.forEach(data => addSettlementRow('settlementBody3', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus3').textContent = '완료!';
        document.getElementById('settlementStatus3').className = 'complete';
    });

    document.getElementById('settlementBtn3_NIMO')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus3').textContent = '진행중...';
        document.getElementById('settlementStatus3').className = 'progress';
        const results = await window.electronAPI.runSettlement3Nimo();
        results.forEach(data => addSettlementRow('settlementBody3', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus3').textContent = '완료!';
        document.getElementById('settlementStatus3').className = 'complete';
    });

    document.getElementById('settlementBtn3_HYUNGJAE')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus3').textContent = '진행중...';
        document.getElementById('settlementStatus3').className = 'progress';
        const results = await window.electronAPI.runSettlement3Hyungjae();
        results.forEach(data => addSettlementRow('settlementBody3', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus3').textContent = '완료!';
        document.getElementById('settlementStatus3').className = 'complete';
    });

    document.getElementById('settlementBtn3_HAWAII')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus3').textContent = '진행중...';
        document.getElementById('settlementStatus3').className = 'progress';
        const results = await window.electronAPI.runSettlement3Hawaii();
        results.forEach(data => addSettlementRow('settlementBody3', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus3').textContent = '완료!';
        document.getElementById('settlementStatus3').className = 'complete';
    });
    
    document.getElementById('settlementBtn3_SAMSUNG')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus3').textContent = '진행중...';
        document.getElementById('settlementStatus3').className = 'progress';
        const results = await window.electronAPI.runSettlement3Samsung();
        results.forEach(data => addSettlementRow('settlementBody3', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus3').textContent = '완료!';
        document.getElementById('settlementStatus3').className = 'complete';
    });

    document.getElementById('settlementBtn3_SEVEN')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus3').textContent = '진행중...';
        document.getElementById('settlementStatus3').className = 'progress';
        const results = await window.electronAPI.runSettlement3Seven();
        results.forEach(data => addSettlementRow('settlementBody3', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus3').textContent = '완료!';
        document.getElementById('settlementStatus3').className = 'complete';
    });

    document.getElementById('settlementBtn4')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus4').textContent = '진행중...';
        document.getElementById('settlementStatus4').className = 'progress';
        const results = await window.electronAPI.runSettlement4();
        document.getElementById('settlementBody4').innerHTML = '';
        results.forEach(data => addSettlementRow('settlementBody4', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus4').textContent = '완료!';
        document.getElementById('settlementStatus4').className = 'complete';
    });

    document.getElementById('settlementBtn4_BUILD')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus4').textContent = '진행중...';
        document.getElementById('settlementStatus4').className = 'progress';
        const results = await window.electronAPI.runSettlement4Build();
        results.forEach(data => addSettlementRow('settlementBody4', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus4').textContent = '완료!';
        document.getElementById('settlementStatus4').className = 'complete';
    });

    document.getElementById('settlementBtn4_PLAY')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus4').textContent = '진행중...';
        document.getElementById('settlementStatus4').className = 'progress';
        const results = await window.electronAPI.runSettlement4Play();
        results.forEach(data => addSettlementRow('settlementBody4', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus4').textContent = '완료!';
        document.getElementById('settlementStatus4').className = 'complete';
    });
    
    document.getElementById('settlementBtn4_ZEN')?.addEventListener('click', async () => {
        document.getElementById('settlementStatus4').textContent = '진행중...';
        document.getElementById('settlementStatus4').className = 'progress';
        const results = await window.electronAPI.runSettlement4Zen();
        results.forEach(data => addSettlementRow('settlementBody4', data.site, data.date, data.join, data.black, data.charge, data.deposit, data.withdraw, data.totalIn, data.totalOut));
        document.getElementById('settlementStatus4').textContent = '완료!';
        document.getElementById('settlementStatus4').className = 'complete';
    });

    window.electronAPI.onSettlementProgress0((progress) => {
        console.log('Settlement0 Progress:', progress);
        document.getElementById('settlementStatus0').textContent = `진행중... (${progress.current}/${progress.total})`;
        document.getElementById('settlementStatus0').className = 'progress';
    });

    window.electronAPI.onSettlementProgress1((progress) => {
        console.log('Settlement1 Progress:', progress);
        document.getElementById('settlementStatus1').textContent = `진행중... (${progress.current}/${progress.total})`;
        document.getElementById('settlementStatus1').className = 'progress';
    });

    window.electronAPI.onSettlementProgress2((progress) => {
        console.log('Settlement2 Progress:', progress);
        document.getElementById('settlementStatus2').textContent = `진행중... (${progress.current}/${progress.total})`;
        document.getElementById('settlementStatus2').className = 'progress';
    });

    window.electronAPI.onSettlementProgress3((progress) => {
        console.log('Settlement3 Progress:', progress);
        document.getElementById('settlementStatus3').textContent = `진행중... (${progress.current}/${progress.total})`;
        document.getElementById('settlementStatus3').className = 'progress';
    });

    window.electronAPI.onSettlementProgress4((progress) => {
        console.log('Settlement4 Progress:', progress);
        document.getElementById('settlementStatus4').textContent = `진행중... (${progress.current}/${progress.total})`;
        document.getElementById('settlementStatus4').className = 'progress';
    });

    window.electronAPI.onSettlementProgress5((progress) => {
        console.log('Settlement5 Progress:', progress);
        document.getElementById('settlementStatus5').textContent = `진행중... (${progress.current}/${progress.total})`;
        document.getElementById('settlementStatus5').className = 'progress';
    });

    window.electronAPI.onSettlementProgress6Zen((progress) => {
        console.log('Settlement6-Zen Progress:', progress);
        document.getElementById('settlementStatus6-zen').textContent = `진행중... (${progress.current}/${progress.total})`;
        document.getElementById('settlementStatus6-zen').className = 'progress';
    });

    window.electronAPI.onSettlementProgress6Build((progress) => {
        console.log('Settlement6-Build Progress:', progress);
        document.getElementById('settlementStatus6-build').textContent = `진행중... (${progress.current}/${progress.total})`;
        document.getElementById('settlementStatus6-build').className = 'progress';
    });

    setDefaultDates();
    document.getElementById('startDate').addEventListener('change', updateDateDisplay);
    document.getElementById('endDate').addEventListener('change', updateDateDisplay);

    const scrapeBtn = document.querySelector('.date-container button');
    if (scrapeBtn) {
        scrapeBtn.addEventListener('click', startScrape);
    }

    window.electronAPI.onScrapeProgress((data) => {
        document.getElementById('progress').textContent = data.message;
        if (data.log && data.url) {
            logLinks.push({ log: data.log, url: data.url });
            updateLogLinks();
        }
        if (data.message.includes('게시물 스크래핑 완료')) {
            updateScrapeStatus('post', true);
        } else if (data.message.includes('댓글 스크래핑 완료')) {
            updateScrapeStatus('comment', true);
        } else if (data.message.includes('영상 스크래핑 완료')) {
            updateScrapeStatus('video', true);
        }
    });

    window.electronAPI.onScrapeResults((results) => {
        currentResults = results;
        sortColumn = -1;
        sortDirection = 1;
        renderTable();
        addSortListeners();
    });

    window.electronAPI.onScrapeError((error) => {
        document.getElementById('progress').textContent = `오류: ${error}`;
        alert(`스크래핑 오류: ${error}`);
        resetScrapeStatus();
    });

    const exchangeBtn = document.getElementById('exchange-btn');
    if (exchangeBtn) {
        exchangeBtn.addEventListener('click', async () => {
            const status = document.getElementById('exchange-status');
            status.textContent = '⏳';
            try {
                const rates = await window.electronAPI.runExchange(); // exchange.js 실행
                console.log('환율 데이터:', rates);

                // UI 업데이트 (100VND → KRW)
                document.getElementById('naver-rate').textContent = rates.naver || '-';
                document.getElementById('cross-rate').textContent = rates.cross || '-';

                // // 환율(1KRW → VND) 계산 및 UI 업데이트
                const naverVnd = rates.naver ? (1 / rates.naver * 100).toFixed(2) : '-';
                const crossVnd = rates.cross ? (1 / rates.cross * 100).toFixed(2) : '-';

                document.getElementById('naver-vnd-rate').textContent = naverVnd !== '-' ? `${naverVnd}` : '-';
                document.getElementById('cross-vnd-rate').textContent = crossVnd !== '-' ? `${crossVnd}` : '-';

                status.textContent = '✅';
            } catch (error) {
                console.error('환율 크롤링 실패:', error);
                status.textContent = '❌';
            }
        });
    }
});

let currentResults = [];
let sortColumn = -1;
let sortDirection = 1;
let logLinks = [];

function getDayOfWeek(dateStr) {
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const date = new Date(dateStr);
    return days[date.getDay()];
}

function updateDateDisplay() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const display = document.getElementById('dateDisplay');
    if (startDate && endDate) {
        const startDay = getDayOfWeek(startDate);
        const endDay = getDayOfWeek(endDate);
        display.textContent = `시작 ${startDate} (${startDay}) ~ 종료 ${endDate} (${endDay})`;
    } else {
        display.textContent = '';
    }
}

function updateScrapeStatus(section, isComplete) {
    const checkbox = document.getElementById(`${section}Status`);
    checkbox.checked = isComplete;
}

function resetScrapeStatus() {
    updateScrapeStatus('post', false);
    updateScrapeStatus('comment', false);
    updateScrapeStatus('video', false);
}

function updateLogLinks() {
    const logLinksDiv = document.getElementById('logLinks');
    logLinksDiv.innerHTML = '';
    const postLogs = logLinks.filter(log => log.log.includes('게시물 url')).slice(-3);
    const commentLogs = logLinks.filter(log => log.log.includes('댓글 url')).slice(-3);
    const videoLogs = logLinks.filter(log => log.log.includes('영상 url')).slice(-3);
    const recentLogs = [...postLogs, ...commentLogs, ...videoLogs];

    recentLogs.forEach(({ log, url }) => {
        const linkElement = document.createElement('div');
        const urlMatch = log.match(/url: (https:\/\/[^\s,]+)/);
        if (urlMatch && url) {
            const linkText = log.replace(urlMatch[1], `<a href="${url}" target="_blank">${urlMatch[1]}</a>`);
            linkElement.innerHTML = linkText;
        } else {
            linkElement.textContent = log;
        }
        linkElement.style.padding = '5px 0';
        logLinksDiv.appendChild(linkElement);
    });
}

function setDefaultDates() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysSinceTuesday = (dayOfWeek + 7 - 2) % 7 || 7;
    const lastTuesday = new Date(today);
    lastTuesday.setDate(today.getDate() - daysSinceTuesday);
    const lastWednesday = new Date(lastTuesday);
    lastWednesday.setDate(lastTuesday.getDate() - 6);

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    document.getElementById('startDate').value = formatDate(lastWednesday);
    document.getElementById('endDate').value = formatDate(lastTuesday);
    updateDateDisplay();
    resetScrapeStatus();
}

function startScrape() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    if (startDate && endDate) {
        document.getElementById('progress').textContent = '스크래핑 시작...';
        logLinks = [];
        updateLogLinks();
        resetScrapeStatus();
        window.electronAPI.send('start-scrape', { startDate, endDate });
    } else {
        alert('날짜를 선택하세요.');
    }
}

function renderTable() {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';
    const headers = document.querySelectorAll('#resultsTable th');
    headers.forEach((header, index) => {
        header.classList.remove('asc', 'desc');
        if (index === sortColumn) {
            header.classList.add(sortDirection === 1 ? 'asc' : 'desc');
        }
    });

    currentResults.forEach(result => {
        const row = document.createElement('tr');
        row.innerHTML = `
      <td>${result.rank || ''}</td>
      <td>${result.name}</td>
      <td>${result.freePosts}</td>
      <td>${result.slotPosts}</td>
      <td>${result.comments}</td>
      <td>${result.videoUploads}</td>
      <td>${result.totalScore}</td>
    `;
        tbody.appendChild(row);
    });
}

function addSortListeners() {
    const headers = document.querySelectorAll('#resultsTable th');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = parseInt(header.getAttribute('data-column'));
            sortTable(column);
        });
    });
}

function sortTable(column) {
    if (sortColumn === column) {
        sortDirection *= -1;
    } else {
        sortColumn = column;
        sortDirection = 1;
    }

    currentResults.sort((a, b) => {
        let valueA, valueB;
        switch (column) {
            case 0:
                valueA = a.rank || Infinity;
                valueB = b.rank || Infinity;
                break;
            case 1:
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
                break;
            case 2:
                valueA = a.freePosts;
                valueB = b.freePosts;
                break;
            case 3:
                valueA = a.slotPosts;
                valueB = b.slotPosts;
                break;
            case 4:
                valueA = a.comments;
                valueB = b.comments;
                break;
            case 5:
                valueA = a.videoUploads;
                valueB = b.videoUploads;
                break;
            case 6:
                valueA = a.totalScore;
                valueB = b.totalScore;
                break;
        }
        if (valueA < valueB) return -1 * sortDirection;
        if (valueA > valueB) return 1 * sortDirection;
        return 0;
    });

    renderTable();
}