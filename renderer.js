window.addEventListener('DOMContentLoaded', () => {
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
      }
    });
  });
  