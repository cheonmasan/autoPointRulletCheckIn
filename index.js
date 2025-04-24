const { shuffle } = require('./utils/helpers');
const { getConfig, initConfig } = require('./utils/config');
const { scheduleTasks } = require('./schedules/cron');
const { runCheckIn } = require('./core/checkin');
const { runPointMart } = require('./core/pointMart');
const { runRullet } = require('./core/roulette');

const initialize = () => {
    initConfig(); // 전역 캐싱 초기화
    const { ID_DATA1, ID_DATA2, ID_DATA3 } = getConfig();
    shuffle(ID_DATA1, 1);
    shuffle(ID_DATA2, 2);
    shuffle(ID_DATA3, 3);
    scheduleTasks();
    // runCheckIn(100,102);
    // runPointMart();
    // runRullet();
};

initialize();