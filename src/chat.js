function extractNickColor(str) {
    let m = str.match(/<([^>]+)>/);
    if (!m) return { nick: "unauth", colorClass: "nick-unauth" };
    let beforeNick = str.substring(0, m.index);
    let nick = m[1];
    let colorClass = "nick-cyan";
    for (const { marker, color } of nickMarkers) {
        if (beforeNick.includes(marker)) {
            colorClass = color;
            break;
        }
    }
    return { nick, colorClass };
}

function parseMsg(msg) {
    let date = "";
    let text = msg.trim();
    let colorClass = "";
    let nick = "";

    let m = text.match(/^\[(\d{2}\.\d{2}\.\d{4} \d{2}:\d{2})\]\s*(.*)$/);
    if (m) {
        date = m[1];
        text = m[2];
    }

    let start = text.indexOf('<');
    let end = text.indexOf('>');
    if (start !== -1 && end !== -1 && end > start) {
        text = text.slice(0, start) + text.slice(end + 1);
    }

    let nickMatch = text.match(/^(.*?<[^>]+>)(\s?)(.*)$/);
    if (nickMatch) {
        let prefix = nickMatch[1];
        let afterNick = nickMatch[3];
        let ext = extractNickColor(prefix);
        nick = ext.nick;
        colorClass = ext.colorClass;
        text = afterNick;
        return { nick, text, date, colorClass };
    }

    if (date && !nick) {
        return { nick: "unauth", text, date, colorClass: "nick-unauth" };
    }
    return { nick: "unauth", text, date: "", colorClass: "nick-unauth" };
}

function getVisibleMessages(messages) {
    if (connectedServer && connectedServer.startsWith("wss://meex.lol:52667") && messages.length > 3) {
        return messages.slice(3);
    }
    return messages;
}

function showMessages() {
    let chat = document.getElementById('chat-area');
    chat.innerHTML = '';
    let displayMessages = getVisibleMessages([...messages].reverse());
    for (let msg of displayMessages) {
        let { nick, text, date, colorClass } = parseMsg(msg);
        chat.innerHTML += `
            <div class="message">
                <span class="nick ${colorClass}">${nick ? nick : ""}</span>
                <span class="msg">${(text ?? "").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</span>
                <span class="time">${date ? "[" + date + "]" : ""}</span>
            </div>`;
    }
}

function sendMsg() {
    const msg = document.getElementById('chat-input').value.trim();
    if (!msg || !connectedServer) return;
    const { username, password } = getActiveServerCreds();
    wRAC(() => {
        let arr;
        let format = (settings && settings.messageFormat) ? settings.messageFormat : DEFAULT_SETTINGS.messageFormat;
        let formatted = format;
        if (formatted.includes("{name}")) formatted = formatted.replace("{name}", username ?? "");
        if (formatted.includes("{text}")) formatted = formatted.replace("{text}", msg ?? "");
        if (username && password) {
            let enc = new TextEncoder();
            let uname = enc.encode(username);
            let pass = enc.encode(password);
            let text = enc.encode(formatted);
            let total = new Uint8Array(1 + uname.length + 1 + pass.length + 1 + text.length);
            total[0] = 0x02;
            total.set(uname, 1);
            total[1 + uname.length] = 10;
            total.set(pass, 1 + uname.length + 1);
            total[1 + uname.length + 1 + pass.length] = 10;
            total.set(text, 1 + uname.length + 1 + pass.length + 1);
            arr = total;
        } else {
            arr = [0x01, ...new TextEncoder().encode(formatted)];
            arr = new Uint8Array(arr);
        }
        ws.send(arr);
        document.getElementById('chat-input').value = "";
        setTimeout(fetchMessages, 200);
    });
}

function fetchMessages() {
    wRAC(() => {
        ws.send(new Uint8Array([0x00]));
    });
}

document.getElementById('send-btn').onclick = sendMsg;
document.getElementById('chat-input').addEventListener('keydown', function (e) {
    if (e.key === "Enter") sendMsg();
});

setInterval(fetchMessages, 6000);