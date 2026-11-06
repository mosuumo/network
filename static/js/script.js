//機器情報を保存する配列
const devices = [];

//機器ごとの番号
const deviceCount = {
    PC: 0,
    SW: 0,
    Router: 0,
};

//機器を追加する関数
function addDevice(type){

    //機器名を作成
    const name = type + deviceCount[type];

    deviceCount[type]++;
}