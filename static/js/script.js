//機器情報を保存する配列
const devices = [];
const connections = []

//svg要素
const svg = document.getElementById("connections");
const SVG_NS = "http://www.w3.org/2000/svg";

//機器ごとの数
const deviceCount = {
    PC: 0,
    SW: 0,
    Router: 0,
};

//接続モード
let connectMode = false;
let selectedDevice = null;

//削除対象の機器
let deleteTarget = null;

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

//接続線を作成する関数
function createConnection(fromDevice, toDevice){

    //同じ接続の重複を防ぐ
    const exists = connections.some(conn =>
        (conn.from === fromDevice.id && conn.to === toDevice.id) ||
        (conn.from === toDevice.id && conn.to === fromDevice.id)
    );

    if(exists) return;

    //SVGの線を作成
    const line = document.createElementNS(SVG_NS, "line");

    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", "3");

    //機器の中心座標を設定
    line.setAttribute("x1", fromDevice.x + 52);
    line.setAttribute("y1", fromDevice.y + 32);
    line.setAttribute("x2", toDevice.x + 52);
    line.setAttribute("y2", toDevice.y + 32);

    svg.appendChild(line);

    //接続情報を保存
    connections.push({
        from: fromDevice.id,
        to: toDevice.id,
        line: line
    });

}

//機器の移動に合わせて接続線を更新する関数
function updateConnections(){
    
    connections.forEach(conn =>{

        //接続元と接続先の機器を取得
        const from = devices.find(d => d.id === conn.from);
        const to = devices.find(d => d.id === conn.to);

        if(!from || !to) return;

        //機器の中心座標に合わせる
        conn.line.setAttribute("x1", from.x + 52);
        conn.line.setAttribute("y1", from.y + 32);
        conn.line.setAttribute("x2", to.x + 52);
        conn.line.setAttribute("y2", to.y + 32);
    });
}

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

    //２台目を選択して接続線を作成 
    createConnection(selectedDevice.device, device);

    selectedDevice.element.classList.remove("selected");
    selectedDevice = null;
}

//機器と接続線を削除する関数
function deleteDevice(){

    if(deleteTarget === null) return;

    const id = deleteTarget.device.id;

    //接続線を削除
    for(let i = connections.length - 1; i >= 0; i--){

        if(connections[i].from === id || connections[i].to === id){
            connections[i].line.remove();
            connections.splice(i, 1);
        }
    }

    //機器情報を削除
    const index = devices.findIndex(d => d.id === id);

    if(index !== -1){
        devices.splice(index, 1);
    }

    //HTML要素を削除
    deleteTarget.element.remove();
    deleteTarget = null;
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

        // 機器の移動に合わせて接続線を更新
        updateConnections();
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

    //機器をクリックしたとき
    element.addEventListener("click", () => {

        if(connectMode){
            selectForConnection(device, element);
            return;
        }

        //前の選択を解除
        if(deleteTarget){
            deleteTarget.element.classList.remove("delete-selected");
        }

        //削除対象として選択
        deleteTarget = {device, element};
        element.classList.add("delete-selected");
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

document.getElementById("delete-device").addEventListener("click", () => {
    deleteDevice();
});