// renderer.js

window.addEventListener('DOMContentLoaded', () => {
    // 출석/포인트마트/룰렛 버튼 + 로그 관리
    const checkinBtn = document.getElementById('checkin-btn');
    const pointmartBtn = document.getElementById('pointmart-btn');
    const rouletteBtn = document.getElementById('roulette-btn');
  
    const checkinStatus = document.getElementById('checkin-status');
    const pointmartStatus = document.getElementById('pointmart-status');
    const rouletteStatus = document.getElementById('roulette-status');
  
    const checkinLog = document.getElementById('checkin-log');
    const pointmartLog = document.getElementById('pointmart-log');
    const rouletteLog = document.getElementById('roulette-log');
  
    checkinBtn.addEventListener('click', async () => {
      await window.electronAPI.runCheckIn();
    });
  
    pointmartBtn.addEventListener('click', async () => {
      await window.electronAPI.runPointMart();
    });
  
    rouletteBtn.addEventListener('click', async () => {
      await window.electronAPI.runRoulette();
    });
  
    // 출석/포인트/룰렛 전용 로그
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
        default:
          break;
      }
    });
  
    window.electronAPI.on('status-update', (data) => {
      const { type, status } = data;
      console.log(`data`, data)
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
            default :
            break;
      }
    });
  
    // 활동왕 찾기 초기화
    setDefaultDates();
    document.getElementById('startDate').addEventListener('change', updateDateDisplay);
    document.getElementById('endDate').addEventListener('change', updateDateDisplay);
  
    const scrapeBtn = document.querySelector('.date-container button');
    if (scrapeBtn) {
      scrapeBtn.addEventListener('click', startScrape);
    }
  
    // 활동왕 찾기 진행 로그
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
  });
  
  // 활동왕 찾기 전역 변수
  let currentResults = [];
  let sortColumn = -1;
  let sortDirection = 1;
  let logLinks = [];
  
  // 기본 유틸 함수
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
  