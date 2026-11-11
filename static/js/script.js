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

//削除対象の接続線
let selectedConnection = null;

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

    //削除対象の選択状態を解除
    if(deleteTarget){
        deleteTarget.element.classList.remove("delete-selected");
        deleteTarget = null;
    }
});

//ポート選択画面を表示
function selectPort(device){

    return new Promise(resolve => {

        const modal = document.getElementById("port-modal");
        const title = document.getElementById("port-title");
        const list = document.getElementById("port-list");
        const cancel = document.getElementById("port-cancel");

        title.textContent = `${device.name}のポートを選択`;
        list.innerHTML = "";

        //未使用ポートを取得
        const availablePorts = device.ports.filter(
            port => !port.connected
        );

        if(availablePorts.length === 0){
            alert(`${device.name}に使用可能なポートがありません`);
            resolve(null);
            return;
        }

        //選択画面を閉じる
        function close(port){
            modal.classList.add("hidden");
            cancel.onclick = null;
            resolve(port);
        }

        //ポートごとにボタンを作成
        availablePorts.forEach(port => {

            const button = document.createElement("button");

            button.textContent = port.name;
            button.className = "port-button";

            button.addEventListener("click", () => {
                close(port);
            });

            list.appendChild(button);
        });

        //キャンセル
        cancel.onclick = () => {
            close(null);
        };

        modal.classList.remove("hidden");
    });
}

//接続線を作成する関数
function createConnection(fromDevice, toDevice, fromPort, toPort){

    //同じ接続の重複を防ぐ
    const exists = connections.some(conn =>
        (conn.from === fromDevice.id && conn.to === toDevice.id) ||
        (conn.from === toDevice.id && conn.to === fromDevice.id)
    );

    //使用済みポートへの接続を防ぐ
    if(fromPort.connected || toPort.connected) return;  

    //SVGの線を作成
    const line = document.createElementNS(SVG_NS, "line");

    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", "3");

    //機器の中心座標を設定
    line.setAttribute("x1", fromDevice.x + 52);
    line.setAttribute("y1", fromDevice.y + 32);
    line.setAttribute("x2", toDevice.x + 52);
    line.setAttribute("y2", toDevice.y + 32);


    //接続線をクリックしたとき
    line.addEventListener("click", () => {

        if(connectMode) return;

        //前の選択を解除
        if(selectedConnection){
            selectedConnection.classList.remove("line-selected");
        }

        //機器の削除対象を解除
        if(deleteTarget){
            deleteTarget.element.classList.remove("delete-selected");
            deleteTarget = null;
        }

        selectedConnection = line;
        line.classList.add("line-selected");
    });

    svg.appendChild(line);

    //接続情報を保存
    connections.push({
        from: fromDevice.id,
        to: toDevice.id,
        fromPort: fromPort.name,
        toPort: toPort.name,
        line: line
    });

    //ポートを使用済みにする
    fromPort.connected = true;
    toPort.connected = true;

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


function resetConnectMode(){
    connectMode = true;

    document.getElementById("connect-mode").textContent =
        "接続モード：ON";
}


//接続する機器を選択する関数
async function selectForConnection(device, element){

    //１台目を選択
    if(selectedDevice === null){
        selectedDevice = {device, element};
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
    const fromDevice = selectedDevice.device;
    const toDevice = device;

    //選択状態を解除
    selectedDevice.element.classList.remove("selected");
    selectedDevice = null;

    //ポート選択中の操作を防ぐ
    connectMode = false;

    const fromPort = await selectPort(fromDevice);

    if(fromPort === null){
        resetConnectMode();
        return;
    }

    const toPort = await selectPort(toDevice);

    if(toPort !== null){
        createConnection(fromDevice, toDevice, fromPort, toPort);
    }

    resetConnectMode();
}

//選択した接続線を削除する関数
function deleteConnection(){

    if(selectedConnection === null) return;

    const index = connections.findIndex(
        conn => conn.line === selectedConnection
    );

    if(index !== -1){

        const conn = connections[index];

        const from = devices.find(d => d.id === conn.from);
        const to = devices.find(d => d.id === conn.to);

        if(from){
            const port = from.ports.find(p => p.name === conn.fromPort);
            if(port) port.connected = false;
        }

        if(to){
            const port = to.ports.find(p => p.name === conn.toPort);
            if(port) port.connected = false;
        }

        connections.splice(index, 1);
    }

    selectedConnection.remove();
    selectedConnection = null;
}

//機器と接続線を削除する関数
function deleteDevice(){

    if(deleteTarget === null) return;

    const id = deleteTarget.device.id;

    //接続線を削除
    for(let i = connections.length - 1; i >= 0; i--){

        if(connections[i].from === id || connections[i].to === id){

            const conn = connections[i];

            if(selectedConnection === conn.line){
                selectedConnection = null;
            }

            //接続相手のポートを未使用に戻す
            const otherId = conn.from === id ? conn.to : conn.from;
            const otherPort = conn.from === id ? conn.toPort : conn.fromPort;

            const otherDevice = devices.find(d => d.id === otherId);

            if(otherDevice){
                const port = otherDevice.ports.find(
                    p => p.name === otherPort
                );

                if(port) port.connected = false;
            }

            conn.line.remove();
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


//機器の種類に応じたポート情報を作成
function createPorts(type){

    if(type === "PC"){
        return [
            { name: "Fa0", connected: false }
        ];
    }

    if(type === "SW"){
        return [
            ...Array.from({length: 24}, (_, i) => ({
                name: `Fa0/${i + 1}`,
                connected: false
            })),

            ...Array.from({length: 2}, (_, i) => ({
                name: `Gi0/${i + 1}`,
                connected: false
            }))
        ];
    }

    if(type === "Router"){
        return [
            { name: "Gi0/0", connected: false },
            { name: "Gi0/1", connected: false }
        ];
    }

    return [];
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
        ports: createPorts(type)
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

document.getElementById("delete-connection").addEventListener("click", () => {
    deleteConnection();
});