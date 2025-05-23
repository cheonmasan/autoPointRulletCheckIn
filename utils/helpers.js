const shuffle = (array, count) => {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    if(count===0){
        console.log(`게시글 작성자 ID 셔플 완료`);
    }else{
        console.log(`셔플완료 ${count}번째`);
    }
};

const rand = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

module.exports = { shuffle, rand };