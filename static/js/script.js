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

    //接続元のポート番号
    const fromLabel = document.createElementNS(SVG_NS, "text");
    fromLabel.textContent = fromPort.name;
    fromLabel.setAttribute("font-size", "12");
    fromLabel.setAttribute("fill", "black");
    fromLabel.setAttribute("pointer-events", "none");

    //接続先のポート番号
    const toLabel = document.createElementNS(SVG_NS, "text");
    toLabel.textContent = toPort.name;
    toLabel.setAttribute("font-size", "12");
    toLabel.setAttribute("fill", "black");
    toLabel.setAttribute("pointer-events", "none");

    svg.appendChild(fromLabel);
    svg.appendChild(toLabel);

    //接続情報を保存
    connections.push({
        from: fromDevice.id,
        to: toDevice.id,
        fromPort: fromPort.name,
        toPort: toPort.name,
        line: line,
        fromLabel: fromLabel,
        toLabel: toLabel
    });

    updateConnections();

    //ポートを使用済みにする
    fromPort.connected = true;
    toPort.connected = true;

}

//機器の移動に合わせて接続線を更新する関数
//機器の移動に合わせて接続線とポート番号を更新
function updateConnections(){

    connections.forEach(conn => {

        const from = devices.find(d => d.id === conn.from);
        const to = devices.find(d => d.id === conn.to);

        if(!from || !to) return;

        const x1 = from.x + 52;
        const y1 = from.y + 32;
        const x2 = to.x + 52;
        const y2 = to.y + 32;

        //接続線を更新
        conn.line.setAttribute("x1", x1);
        conn.line.setAttribute("y1", y1);
        conn.line.setAttribute("x2", x2);
        conn.line.setAttribute("y2", y2);

        //線の方向を計算
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy) || 1;

        const ux = dx / length;
        const uy = dy / length;

        //接続元のポート番号
        conn.fromLabel.setAttribute("x", x1 + ux * 65);
        conn.fromLabel.setAttribute("y", y1 + uy * 65 - 10);
        conn.fromLabel.setAttribute("text-anchor", "middle");

        //接続先のポート番号
        conn.toLabel.setAttribute("x", x2 - ux * 65);
        conn.toLabel.setAttribute("y", y2 - uy * 65 - 10);
        conn.toLabel.setAttribute("text-anchor", "middle");
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

        //接続元のポートを未使用に戻す
        if(from){
            const port = from.ports.find(p => p.name === conn.fromPort);
            if(port) port.connected = false;
        }

        //接続先のポートを未使用に戻す
        if(to){
            const port = to.ports.find(p => p.name === conn.toPort);
            if(port) port.connected = false;
        }

        //接続線とポート番号を削除
        conn.line.remove();
        conn.fromLabel.remove();
        conn.toLabel.remove();

        //接続情報を削除
        connections.splice(index, 1);
    }

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
            conn.fromLabel.remove();
            conn.toLabel.remove();

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

    //機器情報パネルを閉じる
    document.getElementById("device-panel").classList.add("hidden");    
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


//機器情報を表示する関数
function showDeviceInfo(device){

    const panel = document.getElementById("device-panel");

    document.getElementById("device-title").textContent =
        `${device.name}の情報`;

    document.getElementById("device-name").textContent = device.name;
    document.getElementById("device-type").textContent = device.type;

    const portList = document.getElementById("device-ports");
    portList.innerHTML = "";

    device.ports.forEach(port => {

        const p = document.createElement("p");

        p.textContent =
            `${port.name}：${port.connected ? "接続中" : "未使用"}`;

        portList.appendChild(p);
    });
    
    //機器に保存されたメモを表示
    document.getElementById("device-command").value = device.command;

    showRecords(device);

    //現在表示している機器を記録
    panel.dataset.deviceId = device.id;    

    //PCのネットワーク設定
    const pcNetwork = document.getElementById("pc-network");

    if(device.type === "PC"){

        pcNetwork.classList.remove("hidden");

        if(!device.network){
            device.network = {
                ip: "",
                mask: "",
                gateway: ""
            };
        }

        document.getElementById("pc-ip").value = device.network.ip;
        document.getElementById("pc-mask").value = device.network.mask;
        document.getElementById("pc-gateway").value = device.network.gateway;

    }else{
        pcNetwork.classList.add("hidden");
    }

    //機器を選択したときは基本情報タブを表示
    switchDeviceTab("basic");

    panel.classList.remove("hidden");
}

//PCのネットワーク設定を自動保存
function savePCNetwork(){

    const panel = document.getElementById("device-panel");
    const id = panel.dataset.deviceId;

    const device = devices.find(d => d.id === id);

    if(!device || device.type !== "PC") return;

    device.network = {
        ip: document.getElementById("pc-ip").value,
        mask: document.getElementById("pc-mask").value,
        gateway: document.getElementById("pc-gateway").value
    };
}

//入力時に自動保存
document.getElementById("pc-ip").addEventListener("input", savePCNetwork);
document.getElementById("pc-mask").addEventListener("input", savePCNetwork);
document.getElementById("pc-gateway").addEventListener("input", savePCNetwork);

//機器情報パネルのタブ切り替え
function switchDeviceTab(tabName){

    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.add("hidden");
    });

    document.querySelectorAll(".tab-button").forEach(button => {
        button.classList.remove("active");
    });

    document.getElementById(`tab-${tabName}`).classList.remove("hidden");

    document.querySelector(`.tab-button[data-tab="${tabName}"]`)
        .classList.add("active");
}

//タブボタンのクリック処理
document.querySelectorAll(".tab-button").forEach(button => {

    button.addEventListener("click", () => {
        switchDeviceTab(button.dataset.tab);
    });

});

//全体のコマンド入力欄を自動保存
document.getElementById("device-command").addEventListener("input", () => {

    const panel = document.getElementById("device-panel");
    const id = panel.dataset.deviceId;

    const device = devices.find(d => d.id === id);

    if(!device) return;

    device.command = document.getElementById("device-command").value;
});

//コマンドと実行結果の記録を表示
function showRecords(device){

    const list = document.getElementById("device-records");
    list.innerHTML = "";

    device.records.forEach((record, index) => {

        const box = document.createElement("div");
        box.className = "record-box";

        const title = document.createElement("h4");
        title.textContent = `記録 ${index + 1}`;

        //コマンド入力欄
        const command = document.createElement("textarea");
        command.value = record.command;
        command.placeholder = "入力コマンド";

        //入力時に自動保存
        command.addEventListener("input", () => {
            record.command = command.value;
        });

        //実行結果入力欄
        const result = document.createElement("textarea");
        result.value = record.result;
        result.placeholder = "実行結果";

        //入力時に自動保存
        result.addEventListener("input", () => {
            record.result = result.value;
        });

        //削除ボタン
        const del = document.createElement("button");
        del.textContent = "削除";

        del.addEventListener("click", () => {
            device.records.splice(index, 1);
            showRecords(device);
        });

        box.appendChild(title);
        box.appendChild(command);
        box.appendChild(result);
        box.appendChild(del);

        list.appendChild(box);
    });
}

//新しい記録を追加
document.getElementById("record-add").addEventListener("click", () => {

    const panel = document.getElementById("device-panel");
    const id = panel.dataset.deviceId;

    const device = devices.find(d => d.id === id);

    if(!device) return;

    device.records.push({
        command: "",
        result: ""
    });

    showRecords(device);
});


//機器情報パネルを閉じる
document.getElementById("device-close").addEventListener("click", () => {
    document.getElementById("device-panel").classList.add("hidden");
});

//機器を追加する関数
function addDevice(type, savedDevice = null){

    let name;

    if(savedDevice){
        name = savedDevice.name;

        const number = Number(name.slice(type.length));

        if(Number.isInteger(number) && number >= deviceCount[type]){
            deviceCount[type] = number + 1;
        }

    }else{
        name = type + deviceCount[type];
        deviceCount[type]++;
    }

    //機器情報を作成
    const device = savedDevice || {
        id: crypto.randomUUID(),
        type: type,
        name: name,
        x: 100 + devices.length * 30,
        y: 100 + devices.length * 30,
        ports: createPorts(type),
        command: "",
        records: [],
        network: {
            ip: "",
            mask: "",
            gateway: ""
        }
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
        
        //機器情報を表示
        showDeviceInfo(device);
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

//トポロジ全体をJSONファイルに保存
function saveTopology(){

    const data = {
        devices: devices,
        connections: connections.map(conn => ({
            from: conn.from,
            to: conn.to,
            fromPort: conn.fromPort,
            toPort: conn.toPort
        }))
    };

    const json = JSON.stringify(data, null, 2);

    const blob = new Blob([json], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "topology.json";
    a.click();

    URL.revokeObjectURL(url);
}

//JSONファイルからトポロジを読み込む
function loadTopology(data){

    //既存の機器を削除
    document.querySelectorAll(".device").forEach(element => {
        element.remove();
    });

    //既存の接続線を削除
    svg.innerHTML = "";

    devices.length = 0;
    connections.length = 0;

    selectedDevice = null;
    selectedConnection = null;
    deleteTarget = null;

    document.getElementById("device-panel").classList.add("hidden");

    //機器数を初期化
    deviceCount.PC = 0;
    deviceCount.SW = 0;
    deviceCount.Router = 0;

    //機器を復元
    data.devices.forEach(device => {
        addDevice(device.type, device);
    });

    //接続線を復元
    data.connections.forEach(conn => {

        const from = devices.find(d => d.id === conn.from);
        const to = devices.find(d => d.id === conn.to);

        if(!from || !to) return;

        const fromPort = from.ports.find(p => p.name === conn.fromPort);
        const toPort = to.ports.find(p => p.name === conn.toPort);

        if(!fromPort || !toPort) return;

        //接続を再作成するため、一度未使用に戻す
        fromPort.connected = false;
        toPort.connected = false;

        createConnection(from, to, fromPort, toPort);
    });
}

//保存ボタン
document.getElementById("save-topology").addEventListener("click", () => {
    saveTopology();
});

//読み込みボタン
document.getElementById("load-topology").addEventListener("click", () => {
    document.getElementById("load-file").click();
});

//JSONファイル選択時
document.getElementById("load-file").addEventListener("change", async (e) => {

    const file = e.target.files[0];

    if(!file) return;

    try{
        const text = await file.text();
        const data = JSON.parse(text);

        if(!Array.isArray(data.devices) || !Array.isArray(data.connections)){
            throw new Error("JSON形式が正しくありません");
        }

        loadTopology(data);

        alert("トポロジを読み込みました");

    }catch(error){
        alert("読み込みに失敗しました：" + error.message);
    }

    e.target.value = "";
});