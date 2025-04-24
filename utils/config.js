require('dotenv').config();

let cachedConfig = null;

const initConfig = () => {
    cachedConfig = {
        TIME: 10000,
        ID_DATA1: JSON.parse(process.env.ID_DATA1),
        ID_DATA2: JSON.parse(process.env.ID_DATA2),
        ID_DATA3: JSON.parse(process.env.ID_DATA3),
        PASSWORD: process.env.PASSWORD,
        POINT_SITES: {
            brother: {
                name: '형제카지노',
                urls: {
                    10000: 'https://onairslot.com//bbs/board.php?bo_table=point_brother&wr_id=1',
                    50000: 'https://onairslot.com//bbs/board.php?bo_table=point_brother&wr_id=2',
                    100000: 'https://onairslot.com//bbs/board.php?bo_table=point_brother&wr_id=3'
                }
            },
            nimo: {
                name: '니모슬롯',
                urls: {
                    10000: 'https://onairslot.com//bbs/board.php?bo_table=point_nimo&wr_id=1',
                    50000: 'https://onairslot.com//bbs/board.php?bo_table=point_nimo&wr_id=2',
                    100000: 'https://onairslot.com//bbs/board.php?bo_table=point_nimo&wr_id=3'
                }
            },
            buy: {
                name: '꼬부기슬롯',
                urls: {
                    10000: 'https://onairslot.com//bbs/board.php?bo_table=point_buy&wr_id=1',
                    50000: 'https://onairslot.com//bbs/board.php?bo_table=point_buy&wr_id=2',
                    100000: 'https://onairslot.com//bbs/board.php?bo_table=point_buy&wr_id=3'
                }
            }
        }
    };
};

const getConfig = () => {
    if (!cachedConfig) {
        initConfig();
    }
    return cachedConfig;
};

module.exports = { getConfig, initConfig };