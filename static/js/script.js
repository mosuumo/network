//機器情報を保存する配列
const devices = [];

//機器ごとの数
const deviceCount = {
    PC: 0,
    SW: 0,
    Router: 0,
};

//接続モード OFF
const connections = [];

let connectMode = false;
let selectedDevice = null;

const svg = document.getElementById("connections");
const SVG_NS = "http://www.w3.org/2000/svg";

//接続モードの切り替え
document.getElementById("connect-mode").addEventListener("click", () =>{
    connectMode = !connectMode;

    document.getElementById("connect-mode").textContent =
        `接続モード：${connectMode ? "ON" : "OFF"}`;

        if(selectedDevice){
            selectedDevice.element.classList.remove("selected");
            selectedDevice = null;
        }
});

function selectedDevice(device, element){
    
    if(!selectedDevice){
        selectedDevice = { device, element};
        element.classList.add("selected");
        return;
    }

    //同じ機器を選択した場合は介助
    if (selectedDevice.device.id === device.id) {
        element.classList.remove("selected");
        selectedDevice = null;
        return;
    }

    //接続を作成
    createConnection(selectedDevice.device, device);

    selectedDevice.element.classList.remove("selected");
    selectedDevice = null;
}


function createConnection(fromDevice, toDevice){

    //同じ接続の重複を防ぐ
    const exists = connections.some(conn =>
    (conn.from === fromDevice.id && conn.to === toDevice.id) ||
    (conn.from === toDevice.id && conn.to === fromDevice.id)
    );

    if(exists) return;

    const line = document.createElement(SVG_NS, "line");

    line.setAttribute("stroke", "black");
    line.setAttribute("sroke-witdth", "3");

    svg.append(line);

    connections.push({
        from: fromDevice.id,
        to: toDevice.id,
        line: line
    });

    updateConnections();
}

function updateConnections(){
    
    connections.forEach(conn =>{
        
        const from = devices.find(d => d.id === conn.from);
        const to = devices.fing(d => d.id === conn.to);

        if(!from || !to) return;

        //機器の中心座標
        const fromX = from.x + 50;
        const fromY = from.y + 30;


        const toX = to.x + 50;
        const toY = to.y + 30;

        conn.line.setAttribute("x1", fromX);
        conn.line.setAttribute("y1", fromY);
        conn.line.setAttribute("x2", toX);
        conn.line.setAttribute("y2", toY);
    });
}

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

        updateConnections();
    });

    element.addEventListener("pointerup", () =>{
        dragging = false;
    });

    element.addEventListener("pointercancel", () =>{
        dragging = false;
    });

    //接続モード
    element.addEventListener("click", ()=>{
        if(connectMode) {
            selectedDevice(device, element);
        }
    });
}

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

