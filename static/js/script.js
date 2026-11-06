//機器情報を保存する配列
const devices = [];

//機器ごとの数
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

    //機器情報を作成
    const device = {
        id: crypto.randomUUID,
        type: type,
        name: name,
        x: 100 + devices.length * 30,
        y: 100 + devices.length * 30,
    };

    devices.push(device);

    //HTML要素を作成 
    const element = document.createElement("div");


    element.className = "device";
    element.textContent = device.name;
    element.dataset.id = device.id;

    //表示位置
    element.style.left = device.x + "px";
    element.style.top = device.y + "px";

    //canvasに追加
    document.getElementById("canvas").appendChild(element);
};

//ボタンと関数の対応付け
document.getElementById("add-pc").addEventListener("click", () =>{
    addDevice("PC");
});

document.getElementById("add-sw").addEventListener("click", () =>{
    addDevice("SW");
});

document.getElementById("add-router").addEventListener("click", () =>{
    addDevice("Router");
});

let dragging = false;
let offsetX = 0;
let offsetY = 0;

element.addEventListener("pointerdown", (e) =>{
    dragging = true;

    offsetX = e.clientX - element.offsetX;
    offsetY = e.clientY - element.offsetY;

    element.setPointerCapture(e.pointerId);
});

element.addEventListener("pointermove", (e) =>{
    if(!dragging) return;

    const canvas = document.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();

    device.x = e.clientX - rect.left - offsetX;
    device.y = e.clientY - rect.top - offsetY;

    element.style.left = device.x + "px";
    element.style.top = device.y + "px";
});

element.addEventListener("pointerup", () =>{
    dragging = false;
});

element.addEventListener("pointercancel", () =>{
    dragging = false;
})