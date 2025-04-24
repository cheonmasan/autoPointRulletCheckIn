require('dotenv').config();

const getConfig = () => ({
    TIME: 10000,
    ID_DATA1: JSON.parse(process.env.ID_DATA1),
    ID_DATA2: JSON.parse(process.env.ID_DATA2),
    ID_DATA3: JSON.parse(process.env.ID_DATA3),
});

module.exports = { getConfig };