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


// 現在編集中のトポロジーID
// SQLiteで管理されている整数IDを使用する
let currentTopologyId = null;


// FlaskのAPIと通信する共通関数
async function apiRequest(url, method = "GET", data = null) {

    const options = {
        method: method,
        headers: {}
    };

    // 送信するデータがある場合はJSON形式にする
    if (data !== null) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    // Flaskからエラーが返された場合は内容を表示する
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "通信に失敗しました");
    }

    return result;
}


// 機器の詳細情報をデータベース保存用にまとめる
function getDeviceDetails(device) {

    return {
        network: device.network || {
            ip: "",
            mask: "",
            gateway: ""
        },
        ports: device.ports || [],
        command: device.command || "",
        records: device.records || []
    };
}

// 機器の詳細情報をデータベースに保存する
async function saveDeviceDetails(device) {

    // トポロジーが選択されていない場合は保存しない
    if (currentTopologyId === null || !device) {
        return;
    }

    try {
        await apiRequest(
            `/api/devices/${device.id}`,
            "PUT",
            {
                details: getDeviceDetails(device)
            }
        );

    } catch (error) {
        alert("機器情報の保存に失敗しました：" + error.message);
    }
}


// データベースから取得した機器情報を画面用に変換する
function convertDevice(savedDevice) {

    const details = savedDevice.details || {};

    return {
        id: savedDevice.id,
        type: savedDevice.type,
        name: savedDevice.name,
        x: savedDevice.x,
        y: savedDevice.y,

        // 保存済みポートにVLAN情報がなければ初期値を追加する
        ports: details.ports && details.ports.length > 0
            ? details.ports.map(port => ({
                ...port,
                vlanId: port.vlanId ?? "",
                vlanName: port.vlanName ?? ""
            }))
            : createPorts(savedDevice.type),

        // 機器ごとのメモや実行記録を復元する
        command: details.command || "",
        records: details.records || [],

        // PCのネットワーク設定を復元する
        network: details.network || {
            ip: "",
            mask: "",
            gateway: ""
        }
    };
}


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
function createConnection(fromDevice, toDevice, fromPort, toPort, saveToDatabase = true){

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
    const connection = {
        from: fromDevice.id,
        to: toDevice.id,
        fromPort: fromPort.name,
        toPort: toPort.name,
        line: line,
        fromLabel: fromLabel,
        toLabel: toLabel
    };

    connections.push(connection);

    // 接続情報をデータベースに保存
    if (saveToDatabase && currentTopologyId !== null) {
        apiRequest(
            `/api/topologies/${currentTopologyId}/connections`,
            "POST",
            {
                source_device_id: connection.from,
                target_device_id: connection.to,
                source_port: connection.fromPort,
                target_port: connection.toPort
            }
        )
        .then(result => {

            // 削除時に使用するデータベース上の接続IDを保持
            connection.databaseId = result.connection_id;

        })
        .catch(error => {
            alert("接続情報の保存に失敗しました：" + error.message);
        });
    }

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

// 選択した接続線を削除する関数
function deleteConnection(){

    if(selectedConnection === null) return;

    const index = connections.findIndex(
        conn => conn.line === selectedConnection
    );

    if(index !== -1){

        const conn = connections[index];

        const from = devices.find(d => d.id === conn.from);
        const to = devices.find(d => d.id === conn.to);

        // 接続元のポートを未使用に戻す
        if(from){
            const port = from.ports.find(p => p.name === conn.fromPort);
            if(port) port.connected = false;
        }

        // 接続先のポートを未使用に戻す
        if(to){
            const port = to.ports.find(p => p.name === conn.toPort);
            if(port) port.connected = false;
        }

        // 接続線とポート番号を削除
        conn.line.remove();
        conn.fromLabel.remove();
        conn.toLabel.remove();

        // データベースから接続情報を削除
        if(conn.databaseId){
            apiRequest(
                `/api/connections/${conn.databaseId}`,
                "DELETE"
            ).catch(error => {
                alert("接続情報の削除に失敗しました：" + error.message);
            });
        }

        // 接続情報を配列から削除
        connections.splice(index, 1);
    }

    selectedConnection = null;
}


// 機器と接続線を削除する関数
async function deleteDevice(){

    if(deleteTarget === null) return;

    const id = deleteTarget.device.id;

    // 接続線を削除
    for(let i = connections.length - 1; i >= 0; i--){

        if(connections[i].from === id || connections[i].to === id){

            const conn = connections[i];

            if(selectedConnection === conn.line){
                selectedConnection = null;
            }

            // 接続相手のポートを未使用に戻す
            const otherId = conn.from === id ? conn.to : conn.from;
            const otherPort = conn.from === id ? conn.toPort : conn.fromPort;

            const otherDevice = devices.find(d => d.id === otherId);

            if(otherDevice){
                const port = otherDevice.ports.find(
                    p => p.name === otherPort
                );

                if(port) port.connected = false;
            }

            // データベースから接続情報を削除
            if(conn.databaseId){
                try {
                    await apiRequest(
                        `/api/connections/${conn.databaseId}`,
                        "DELETE"
                    );
                } catch (error) {
                    alert("接続情報の削除に失敗しました：" + error.message);
                    return;
                }
            }

            // 接続線とポート番号を削除
            conn.line.remove();
            conn.fromLabel.remove();
            conn.toLabel.remove();

            connections.splice(i, 1);
        }
    }

    // データベースから機器情報を削除
    try {
        await apiRequest(
            `/api/devices/${id}`,
            "DELETE"
        );
    } catch (error) {
        alert("機器情報の削除に失敗しました：" + error.message);
        return;
    }

    // 機器情報を配列から削除
    const index = devices.findIndex(d => d.id === id);

    if(index !== -1){
        devices.splice(index, 1);
    }

    // HTML要素を削除
    deleteTarget.element.remove();
    deleteTarget = null;

    // 機器情報パネルを閉じる
    document.getElementById("device-panel").classList.add("hidden");
}


// 機器の種類に応じたポート情報を作成
function createPorts(type){

    // 各ポートに共通する初期情報
    const createPort = (name) => ({
        name: name,
        connected: false,
        vlanId: "",
        vlanName: ""
    });

    if(type === "PC"){
        return [
            createPort("Fa0")
        ];
    }

    if(type === "SW"){
        return [
            // FastEthernetポートを24個作成
            ...Array.from({length: 24}, (_, i) =>
                createPort(`Fa0/${i + 1}`)
            ),

            // GigabitEthernetポートを2個作成
            ...Array.from({length: 2}, (_, i) =>
                createPort(`Gi0/${i + 1}`)
            )
        ];
    }

    if(type === "Router"){
        return [
            createPort("Gi0/0"),
            createPort("Gi0/1")
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

    // 各ポートの情報とVLAN設定欄を表示
    device.ports.forEach(port => {

        const box = document.createElement("div");

        // ポート番号と接続状態
        const p = document.createElement("p");
        p.textContent =
            `${port.name}：${port.connected ? "接続中" : "未使用"}`;

        box.appendChild(p);

        // VLAN設定欄はスイッチの場合だけ表示
        if (device.type === "SW") {

            // VLAN ID入力欄
            const vlanId = document.createElement("input");
            vlanId.type = "number";
            vlanId.min = "1";
            vlanId.max = "4094";
            vlanId.placeholder = "VLAN ID";
            vlanId.value = port.vlanId || "";

            // VLAN名入力欄
            const vlanName = document.createElement("input");
            vlanName.type = "text";
            vlanName.placeholder = "VLAN名";
            vlanName.value = port.vlanName || "";

            // VLAN IDを更新して保存
            vlanId.addEventListener("change", () => {
                port.vlanId = vlanId.value;
                saveDeviceDetails(device);
            });

            // VLAN名を更新して保存
            vlanName.addEventListener("change", () => {
                port.vlanName = vlanName.value;
                saveDeviceDetails(device);
            });

            box.appendChild(vlanId);
            box.appendChild(vlanName);
        }

        portList.appendChild(box);
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

// PCのネットワーク設定を更新してデータベースに保存する
function savePCNetwork(){

    const panel = document.getElementById("device-panel");
    const id = panel.dataset.deviceId;
    const device = devices.find(d => String(d.id) === id);

    // PC以外の場合は処理しない
    if(!device || device.type !== "PC") return;

    // 入力されたネットワーク設定を反映
    device.network = {
        ip: document.getElementById("pc-ip").value,
        mask: document.getElementById("pc-mask").value,
        gateway: document.getElementById("pc-gateway").value
    };

    // 更新した詳細情報をデータベースに保存
    saveDeviceDetails(device);
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

    const device = devices.find(d => String(d.id) === id);

    if(!device) return;

    device.command = document.getElementById("device-command").value;

    // データベースに保存
    saveDeviceDetails(device);
});

// コマンドと実行結果の記録を表示
function showRecords(device){

    const list = document.getElementById("device-records");
    list.innerHTML = "";

    device.records.forEach((record, index) => {

        const box = document.createElement("div");
        box.className = "record-box";

        const title = document.createElement("h4");
        title.textContent = `記録 ${index + 1}`;

        // コマンド入力欄
        const command = document.createElement("textarea");
        command.value = record.command;
        command.placeholder = "入力コマンド";

        // 入力内容を反映してデータベースに保存
        command.addEventListener("input", () => {
            record.command = command.value;
            saveDeviceDetails(device);
        });

        // 実行結果入力欄
        const result = document.createElement("textarea");
        result.value = record.result;
        result.placeholder = "実行結果";

        // 入力内容を反映してデータベースに保存
        result.addEventListener("input", () => {
            record.result = result.value;
            saveDeviceDetails(device);
        });

        // 削除ボタン
        const del = document.createElement("button");
        del.textContent = "削除";

        del.addEventListener("click", () => {

            // 指定した記録を削除
            device.records.splice(index, 1);

            // 表示を更新
            showRecords(device);

            // 削除後の情報をデータベースに保存
            saveDeviceDetails(device);
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

    const device = devices.find(d => String(d.id) === id);

    if(!device) return;

    device.records.push({
        command: "",
        result: ""
    });

    // 記録一覧を更新
    showRecords(device);

    // データベースに保存
    saveDeviceDetails(device);
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

    // 機器の移動が終了したときに座標を保存
    element.addEventListener("pointerup", async () => {

        dragging = false;

        // トポロジーが選択されている場合はDBを更新
        if (currentTopologyId !== null) {

            try {
                await apiRequest(
                    `/api/devices/${device.id}`,
                    "PUT",
                    {
                        x: device.x,
                        y: device.y
                    }
                );

            } catch (error) {
                alert("機器の座標保存に失敗しました：" + error.message);
            }
        }
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


// データベースに機器を追加する
async function addDeviceToDatabase(type) {

    // トポロジーが選択されているか確認
    if (currentTopologyId === null) {
        alert("トポロジーを選択してください");
        return;
    }

    // 機器の名前と初期座標を決定
    const name = type + deviceCount[type];
    const x = 100 + devices.length * 30;
    const y = 100 + devices.length * 30;

    try {
        // FlaskのAPIを通じて機器情報を保存
        const result = await apiRequest(
            `/api/topologies/${currentTopologyId}/devices`,
            "POST",
            {
                type: type,
                name: name,
                x: x,
                y: y,
                details: {
                    network: {
                        ip: "",
                        mask: "",
                        gateway: ""
                    },
                    ports: [],
                    command: "",
                    records: []
                }
            }
        );

        // データベースから返されたIDを使って画面に追加
        addDevice(type, {
            id: result.device_id,
            type: type,
            name: name,
            x: x,
            y: y,
            ports: createPorts(type),
            command: "",
            records: [],
            network: {
                ip: "",
                mask: "",
                gateway: ""
            }
        });

    } catch (error) {
        alert("機器の保存に失敗しました：" + error.message);
    }
}


// 各機器の追加ボタン
document.getElementById("add-pc").addEventListener("click", () => {
    addDeviceToDatabase("PC");
});

document.getElementById("add-sw").addEventListener("click", () => {
    addDeviceToDatabase("SW");
});

document.getElementById("add-router").addEventListener("click", () => {
    addDeviceToDatabase("Router");
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

        // 保存済みの接続を復元するため、データベースへの再保存は行わない
        createConnection(from, to, fromPort, toPort, false);

        // 復元した接続にデータベース上のIDを引き継ぐ
        const restoredConnection = connections[connections.length - 1];
        restoredConnection.databaseId = conn.databaseId;
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

// データベースに保存されているトポロジー一覧を表示する
async function loadTopologyList() {

    const list = document.getElementById("topology-list");

    try {
        const topologies = await apiRequest("/api/topologies");

        // 一覧を初期化する
        list.innerHTML = "";

        topologies.forEach(topology => {

            const item = document.createElement("li");

            // トポロジーを選択するボタン 
            const button = document.createElement("button");
            button.textContent = topology.name;

            // 選択したトポロジーを読み込む
            button.addEventListener("click", () => {
                openTopology(topology.id);
            });

            // トポロジーを削除するボタン
            const deleteButton = document.createElement("button");
            deleteButton.textContent = "削除";

            deleteButton.addEventListener("click", async () => {

                // 誤操作を防ぐため確認する
                if (!confirm(`「${topology.name}」を削除しますか？`)) {
                    return;
                }

                try {
                    // データベースからトポロジーを削除
                    await apiRequest(
                        `/api/topologies/${topology.id}`,
                        "DELETE"
                    );

                    // 削除後に一覧を更新
                    loadTopologyList();

                } catch (error) {
                    alert("トポロジーの削除に失敗しました：" + error.message);
                }
            });

            item.appendChild(button);
            item.appendChild(deleteButton);
            list.appendChild(item);
        });

    } catch (error) {
        alert("トポロジー一覧の取得に失敗しました：" + error.message);
    }
}


// 新しいトポロジーを作成する
async function createTopology() {

    const nameInput = document.getElementById("topology-name");
    const name = nameInput.value.trim();

    if (!name) {
        alert("トポロジー名を入力してください");
        return;
    }

    try {
        const result = await apiRequest(
            "/api/topologies",
            "POST",
            { name: name }
        );

        // 作成したトポロジーを開く
        nameInput.value = "";
        await loadTopologyList();
        await openTopology(result.topology_id);

    } catch (error) {
        alert("トポロジーの作成に失敗しました：" + error.message);
    }
}


// 選択したトポロジーを読み込む
async function openTopology(topologyId) {

            // 前回開いていたテーブルや診断結果を閉じる
        document.getElementById("vlan-table-area").classList.add("hidden");
        document.getElementById("ip-table-area").classList.add("hidden");
        document.getElementById("port-table-area").classList.add("hidden");
        document.getElementById("troubleshoot-area").classList.add("hidden");

        // 前回の診断結果を初期化
        document.getElementById("troubleshoot-summary").innerHTML = "";
        document.getElementById("troubleshoot-results").innerHTML = "";

        // 前回の機器の強調表示を解除
        document.querySelectorAll(".device").forEach(element => {
            element.style.outline = "";
            element.style.boxShadow = "";
        });

    try {
        const data = await apiRequest(`/api/topologies/${topologyId}`);

        // 現在編集中のトポロジーIDを更新する
        currentTopologyId = data.id;

        // 画面上のトポロジー名を更新する
        document.getElementById("current-topology-name").textContent =
            data.name;

        // データベースの情報を既存の画面用データに変換する
        const topologyData = {
            devices: data.devices.map(convertDevice),

            connections: data.connections.map(connection => ({
                
                // 接続元・接続先の機器ID
                from: connection.source_device_id,
                to: connection.target_device_id,
                
                // 接続に使用しているポート番号
                fromPort: connection.source_port,
                toPort: connection.target_port,

                // データベース上の接続IDを保持
                databaseId: connection.id
            }))
        };

        // 既存の読み込み処理を利用して画面に反映する
        loadTopology(topologyData);

        // 一覧画面から編集画面に切り替える
        document.getElementById("topology-manager").classList.add("hidden");
        document.getElementById("editor").classList.remove("hidden");

    } catch (error) {
        alert("トポロジーの読み込みに失敗しました：" + error.message);
    }
}

// 新規作成ボタンの処理
document.getElementById("create-topology").addEventListener(
    "click",
    createTopology
);

// ページ起動時にトポロジー一覧を取得する
loadTopologyList();

// トポロジー編集画面から一覧画面に戻る
document.getElementById("back-to-list").addEventListener("click", () => {

    // 編集画面を非表示にする
    document.getElementById("editor").classList.add("hidden");

    // トポロジー管理画面を表示する
    document.getElementById("topology-manager").classList.remove("hidden");

    // 選択中の機器情報パネルを閉じる
    document.getElementById("device-panel").classList.add("hidden");

    // トポロジー一覧を最新の状態に更新する
    loadTopologyList();

    // 現在のトポロジーIDを解除する
    currentTopologyId = null;
});

// VLANテーブルを生成して表示する
function showVlanTable() {

    const area = document.getElementById("vlan-table-area");
    const tableBody = document.getElementById("vlan-table-body");

    // テーブルの内容を初期化
    tableBody.innerHTML = "";

    // すべてのスイッチからVLAN情報を取得
    devices.forEach(device => {

        // スイッチ以外は対象外
        if (device.type !== "SW") return;

        device.ports.forEach(port => {

            // VLAN IDが設定されていないポートは表示しない
            if (!port.vlanId) return;

            const row = document.createElement("tr");

            // 各項目をテーブルに追加
            const values = [
                device.name,
                port.name,
                port.vlanId,
                port.vlanName || ""
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });
    });

    // テーブルを表示
    area.classList.remove("hidden");
}

// VLANテーブルボタンのクリック処理
document.getElementById("show-vlan-table").addEventListener("click", () => {
    showVlanTable();
});

// VLANテーブルを閉じる
document.getElementById("close-vlan-table").addEventListener("click", () => {
    document.getElementById("vlan-table-area").classList.add("hidden");
});


// IPアドレステーブルを生成して表示する
function showIpTable() {

    const area = document.getElementById("ip-table-area");
    const tableBody = document.getElementById("ip-table-body");

    // テーブルの内容を初期化
    tableBody.innerHTML = "";

    // すべてのPCからネットワーク情報を取得
    devices.forEach(device => {

        // PC以外は対象外
        if (device.type !== "PC") return;

        // ネットワーク情報がない場合は対象外
        if (!device.network) return;

        // IPアドレスが未設定の場合は表示しない
        if (!device.network.ip) return;

        // テーブルの行を作成
        const row = document.createElement("tr");

        const values = [
            device.name,
            device.network.ip,
            device.network.mask || "",
            device.network.gateway || ""
        ];

        // 各項目をテーブルに追加
        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    });

    // テーブルを表示
    area.classList.remove("hidden");
}

// IPアドレステーブルボタンのクリック処理
document.getElementById("show-ip-table").addEventListener("click", () => {
    showIpTable();
});

// IPアドレステーブルを閉じる
document.getElementById("close-ip-table").addEventListener("click", () => {
    document.getElementById("ip-table-area").classList.add("hidden");
});


// ポート割り当てテーブルを生成して表示する
function showPortTable() {

    const area = document.getElementById("port-table-area");
    const tableBody = document.getElementById("port-table-body");

    // テーブルの内容を初期化
    tableBody.innerHTML = "";

    // すべての接続情報を確認
    connections.forEach(connection => {

        // 接続元と接続先の機器を取得
        const fromDevice = devices.find(d =>
            String(d.id) === String(connection.from)
        );

        const toDevice = devices.find(d =>
            String(d.id) === String(connection.to)
        );

        // 機器が見つからない場合は処理しない
        if (!fromDevice || !toDevice) return;

        // 接続元・接続先の情報をそれぞれ追加
        const rows = [
            [
                fromDevice.name,
                connection.fromPort,
                toDevice.name,
                connection.toPort
            ],
            [
                toDevice.name,
                connection.toPort,
                fromDevice.name,
                connection.fromPort
            ]
        ];

        // テーブルに2方向の接続情報を追加
        rows.forEach(values => {

            const row = document.createElement("tr");

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value || "";
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });
    });

    // テーブルを表示
    area.classList.remove("hidden");
}

// ポート割り当てテーブルボタンのクリック処理
document.getElementById("show-port-table").addEventListener("click", () => {
    showPortTable();
});

// ポート割り当てテーブルを閉じる
document.getElementById("close-port-table").addEventListener("click", () => {
    document.getElementById("port-table-area").classList.add("hidden");
});


// ネットワークの基本的な問題を診断する
function troubleshootNetwork() {

    const area = document.getElementById("troubleshoot-area");
    const summary = document.getElementById("troubleshoot-summary");
    const results = document.getElementById("troubleshoot-results");

    // 前回の診断結果を初期化
    summary.innerHTML = "";
    results.innerHTML = "";

    // 前回の機器の強調表示を解除
    document.querySelectorAll(".device").forEach(element => {
        element.style.outline = "";
        element.style.boxShadow = "";
    });

    // 診断結果を保存する配列
    const issues = [];

    // IPアドレスの重複を確認するための配列
    const ipAddresses = [];

    // PCのIPアドレスを収集
    devices.forEach(device => {

        if (device.type !== "PC") return;
        if (!device.network || !device.network.ip) return;

        ipAddresses.push({
            ip: device.network.ip,
            name: device.name
        });
    });

    // 同じIPアドレスが複数存在するか確認
    ipAddresses.forEach(item => {

        // 同じIPアドレスを持つ機器を検索
        const duplicateDevices = ipAddresses.filter(other =>
            other.ip === item.ip
        );

        // 2台以上で同じIPアドレスを使用している場合
        if (duplicateDevices.length > 1) {

            issues.push({
                device: item.name,
                message: `IPアドレス ${item.ip} が重複しています。`,
                level: "error"
            });
        }
    });


    // スイッチ間のVLAN設定を確認
    connections.forEach(connection => {

        // 接続元と接続先の機器を取得
        const fromDevice = devices.find(d =>
            String(d.id) === String(connection.from)
        );

        const toDevice = devices.find(d =>
            String(d.id) === String(connection.to)
        );

        // 両方がスイッチの場合だけ確認
        if (!fromDevice || !toDevice) return;
        if (fromDevice.type !== "SW" || toDevice.type !== "SW") return;

        // 接続元と接続先のポートを取得
        const fromPort = fromDevice.ports.find(p =>
            p.name === connection.fromPort
        );

        const toPort = toDevice.ports.find(p =>
            p.name === connection.toPort
        );

        // ポート情報がない場合は処理しない
        if (!fromPort || !toPort) return;

        // 両方のVLAN IDが設定されていて異なる場合
        if (
            fromPort.vlanId &&
            toPort.vlanId &&
            String(fromPort.vlanId) !== String(toPort.vlanId)
        ) {
            issues.push({
                device: `${fromDevice.name} / ${toDevice.name}`,
                message: `接続ポートのVLAN IDが一致していません（${fromPort.vlanId} / ${toPort.vlanId}）。`,
                level: "warning"
            });
        }
    });


    // すべての機器を確認
    devices.forEach(device => {

        // PCのIPアドレスを確認
        if (device.type === "PC") {

            if (!device.network || !device.network.ip) {
                issues.push({
                    device: device.name,
                    message: "IPアドレスが設定されていません。",
                    level: "error"
                });
            }
        }

        // サブネットマスクとゲートウェイの設定を確認
        if (device.type === "PC" && device.network?.ip) {

            // サブネットマスクの設定を確認
            if (!device.network.mask) {
                issues.push({
                    device: device.name,
                    message: "サブネットマスクが設定されていません。",
                    level: "warning"
                });
            }

            // デフォルトゲートウェイの設定を確認
            if (!device.network.gateway) {
                issues.push({
                    device: device.name,
                    message: "デフォルトゲートウェイが設定されていません。",
                    level: "warning"
                });
            }
        }


        // 機器の接続状態を確認
        const connected = connections.some(connection =>
            String(connection.from) === String(device.id) ||
            String(connection.to) === String(device.id)
        );

        // どの機器とも接続されていない場合は警告
        if (!connected) {
            issues.push({
                device: device.name,
                message: "ほかの機器と接続されていません。",
                level: "warning"
            });
        }
    });

    // 診断結果の件数を表示
    summary.textContent =
        `検出された問題：${issues.length}件`;

    // 問題がない場合
    if (issues.length === 0) {
        results.textContent = "問題は検出されませんでした。";
    }

    // 問題がある場合は一覧表示
    
    // エラーと警告の件数を集計
    const errorCount = issues.filter(issue =>
        issue.level === "error"
    ).length;

    const warningCount = issues.filter(issue =>
        issue.level === "warning"
    ).length;

    // 診断結果の概要を表示
    summary.textContent =
        `検出された問題：${issues.length}件（エラー：${errorCount}件 / 警告：${warningCount}件）`;

    // 問題がない場合
    if (issues.length === 0) {
        results.textContent = "問題は検出されませんでした。";
    }

    // エラーと警告を分けて表示する
    function displayIssues(title, level) {

        // 指定した種類の問題だけを抽出
        const filteredIssues = issues.filter(issue =>
            issue.level === level
        );

        // 該当する問題がなければ表示しない
        if (filteredIssues.length === 0) return;

        // 分類ごとの見出しを作成
        const heading = document.createElement("h4");
        heading.textContent = `${title}（${filteredIssues.length}件）`;
        results.appendChild(heading);

        // 個別の診断結果を表示
        filteredIssues.forEach(issue => {

            const item = document.createElement("div");

            // 該当機器を選択するボタンを作成
            const deviceName = document.createElement("button");
            deviceName.type = "button";
            deviceName.textContent = issue.device;

            // ボタンの見た目を調整
            deviceName.style.display = "block";
            deviceName.style.marginBottom = "5px";
            deviceName.style.fontWeight = "bold";
            deviceName.style.cursor = "pointer";

            // 機器名をクリックしたときの処理
            deviceName.addEventListener("click", () => {

                // 前回の強調表示を解除
                document.querySelectorAll(".device").forEach(element => {
                    element.style.outline = "";
                    element.style.boxShadow = "";
                });

                // 診断結果に含まれる機器名を取得
                // VLAN不一致の場合は2台分の名前を取得する
                const targetNames = issue.device.split(" / ");

                // 該当する機器のHTML要素を取得
                const targetElements = Array.from(
                    document.querySelectorAll(".device")
                ).filter(element => {

                    const device = devices.find(d =>
                        String(d.id) === String(element.dataset.id)
                    );

                    return device && targetNames.includes(device.name);
                });

                // 該当機器がない場合は終了
                if (targetElements.length === 0) return;

                // 該当機器を強調表示
                targetElements.forEach(element => {
                    element.style.outline = "4px solid #e74c3c";
                    element.style.boxShadow = "0 0 12px #e74c3c";
                });

                // 該当機器が画面内に見えるように移動
                targetElements[0].scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "center"
                });
            });


            const message = document.createElement("p");
            message.textContent = issue.message;

            // 診断結果を見やすくする
            // エラーと警告で枠線の色を変更
            item.style.border = level === "error"
                ? "1px solid #e74c3c"
                : "1px solid #f39c12";

            // 背景色も種類ごとに変更
            item.style.backgroundColor = level === "error"
                ? "#fff0f0"
                : "#fff8e8";

            // 表示の余白を設定
            item.style.padding = "10px";
            item.style.margin = "5px 0";
            item.style.borderRadius = "5px";

            item.appendChild(deviceName);
            item.appendChild(message);

            results.appendChild(item);
        });
    }

    // エラーと警告をそれぞれ表示
    displayIssues("エラー", "error");
    displayIssues("警告", "warning");


    // 診断結果を表示
    area.classList.remove("hidden");
}


// 診断ボタンのクリック処理
document.getElementById("troubleshoot-button")
    .addEventListener("click", () => {
        troubleshootNetwork();
    });


// 診断結果を閉じる
document.getElementById("close-troubleshoot")
    .addEventListener("click", () => {

        // 診断結果の表示を閉じる
        document.getElementById("troubleshoot-area")
            .classList.add("hidden");

        // すべての機器の強調表示を解除する
        document.querySelectorAll(".device").forEach(element => {
            element.style.outline = "";
            element.style.boxShadow = "";
        });
    });