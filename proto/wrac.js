        function wRAC(onOpenCb) {
            if (!connectedServer) return;
            if (ws && ws.readyState === 1) return onOpenCb();
            if (ws) { ws.onclose = null; ws.close(); }
            ws = new WebSocket(connectedServer);
            ws.binaryType = "arraybuffer";
            ws.onopen = function () { if (onOpenCb) onOpenCb(); };
            ws.onerror = function () { };
            ws.onclose = function () { };
            ws.onmessage = function (event) {
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