        async function wRAC(onOpenCb) {
    if (!connectedServer) return;
    if (ws && ws.readyState === 1) return onOpenCb();
    
    if (ws) {
        ws.onopen = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.onmessage = null;
        ws.close();
    }
    
    ws = new WebSocket(connectedServer);
    ws.binaryType = "arraybuffer";
    
    ws.onopen = function() { 
        if (onOpenCb) onOpenCb(); 
    };
    ws.onerror = function() {};
    ws.onclose = function() {};
    ws.onmessage = function(event) {
                if (typeof event.data === "string") return;
                let buf = new Uint8Array(event.data);
                if (buf.length === 1 && (buf[0] === 0x01 || buf[0] === 0x02)) return;
                let str = new TextDecoder().decode(buf).trim();
                if (/^\d+$/.test(str)) {
                    ws.send(new Uint8Array([0x00, 0x01]));
                } else {
                    let lines = str.split('\n').filter(Boolean);
                    messages = lines;
                    showMessages();
                }
            };
        }

        async function checkServerInfo({ proto, address, port }) {
    protocolCheck.state = "loading";
    protocolCheck.protoVersion = null;
    protocolCheck.serverSoftware = null;
    updateServerInfoLabels();
    let url;
    try {
        url = buildServerUrl({ proto, address, port });
        let wsTest;
        if (proto === "wRACs" || proto === "wRAC") {
            wsTest = new WebSocket(url);
        } else {
            protocolCheck.state = "error";
            updateServerInfoLabels();
            return;
        }
        wsTest.binaryType = "arraybuffer";
        let resolved = false;
        wsTest.onopen = () => {
            wsTest.send(new Uint8Array([0x69]));
        };
        wsTest.onmessage = (e) => {
            if (resolved) return;
            resolved = true;
            let arr = new Uint8Array(e.data);
            if (arr.length < 2) {
                protocolCheck.state = "error";
                updateServerInfoLabels();
                wsTest.close();
                return;
            }
            let versionByte = arr[0];
            let ver = "";
            if (versionByte === 0x01) ver = "v1";
            else if (versionByte === 0x02) ver = "x1.99";
            else if (versionByte === 0x03) ver = "v2";
            else ver = "Unknown";
            protocolCheck.protoVersion = ver;
            protocolCheck.serverSoftware = new TextDecoder().decode(arr.slice(1));
            protocolCheck.state = "done";
            updateServerInfoLabels();
            wsTest.close();
        };
        wsTest.onerror = () => {
            protocolCheck.state = "error";
            updateServerInfoLabels();
        };
    } catch (e) {
        protocolCheck.state = "error";
        updateServerInfoLabels();
    }
}

async function registerUser({ proto, address, port, username, password }) {
    return new Promise((resolve, reject) => {
        const url = buildServerUrl({ proto, address, port });
        const wsReg = new WebSocket(url);
        wsReg.binaryType = "arraybuffer";
        
        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                wsReg.close();
                reject(t('connectionTimeout'));
            }
        }, 5000);
        
        wsReg.onopen = () => {
            const encoder = new TextEncoder();
            const data = new Uint8Array([
                0x03,
                ...encoder.encode(username + '\n' + password)
            ]);
            wsReg.send(data);
        };
        
        wsReg.onmessage = (e) => {
            clearTimeout(timeout);
            resolved = true;
            wsReg.close();
            
            const data = new Uint8Array(e.data);

            if (data.length > 0 && data[0] === 0x01) {
                reject(t('usernameTaken'));
            } else if (data.length === 0) {
                resolve(); 
            } else {
                reject(t('unexpectedResponse'));
            }
        };
        
        wsReg.onerror = (error) => {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                reject(t('connectionFailed') + ': ' + error.message);
            }
        };
        
        wsReg.onclose = (event) => {
            if (!resolved) {
                clearTimeout(timeout);
                resolved = true;
                if (event.code !== 1000) {
                    reject(t('connectionClosed') + ` (code ${event.code})`);
                }
            }
        };
    });
}