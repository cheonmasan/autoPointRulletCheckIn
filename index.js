const { shuffle } = require('./utils/helpers');
const { getConfig } = require('./utils/config');
const { scheduleTasks } = require('./schedules/cron');

const initialize = () => {
    const { ID_DATA1, ID_DATA2, ID_DATA3 } = getConfig();
    shuffle(ID_DATA1, 1);
    shuffle(ID_DATA2, 2);
    shuffle(ID_DATA3, 3);
    scheduleTasks();
};

initialize();