//機器情報を保存する配列
const devices = [];

//機器ごとの数
const deviceCount = {
    PC: 0,
    SW: 0,
    Router: 0,
};

//接続モード
let connectMode = false;
let selectedDevice = null;

//接続モードの切り替え
document.getElementById("connect-mode").addEventListener("click", () =>{
    connectMode = !connectMode;

    document.getElementById("connect-mode").textContent =
    `接続モード：${connectMode ? "ON" : "OFF"}`;

    //選択状態を解除
    if(selectedDevice){
        selectedDevice.element.classList.remove("selected");
        selectedDevice = null;
    }
});

//接続する機器を選択する関数
function selectForConnection(device, element){

    //１台目を選択
    if(selectedDevice === null){
        selectedDevice = {device, element}
        element.classList.add("selected");
        return;
    }

    //同じ機器を選択した場合は解除
    if(selectedDevice.device.id === device.id){
        selectedDevice.element.classList.remove("selected");
        selectedDevice = null;
        return;
    }

    //２台目を選択
    console.log(
        "接続元:", selectedDevice.device.name,
        "接続先:", device.name
    );

    selectedDevice.element.classList.remove("selected");
    selectedDevice = null;
}

//機器を追加する関数
function addDevice(type){

    //機器名を作成
    const name = type + deviceCount[type];

    deviceCount[type]++;

    //機器情報を作成
    const device = {
        id: crypto.randomUUID(),
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

    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;
    let dragging = false;

    element.addEventListener("pointerdown", (e) =>{
        if(connectMode) return;
        dragging = true;

        startX = e.clientX;
        startY = e.clientY;

        initialX = device.x;
        initialY = device.y;

        element.setPointerCapture(e.pointerId);
    });

    element.addEventListener("pointermove", (e) =>{
        if(connectMode || !dragging) return;

        device.x = initialX + (e.clientX - startX);
        device.y = initialY + (e.clientY - startY);

        element.style.left = device.x + "px";
        element.style.top = device.y + "px";
    });

    element.addEventListener("pointerup", () =>{
        dragging = false;
    });

    element.addEventListener("pointercancel", () =>{
        dragging = false;
    });

    //接続モードで機器を選択
    element.addEventListener("click", () =>{
        if(connectMode){
            selectForConnection(device, element);
        }
    });
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