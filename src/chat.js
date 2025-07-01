const nickMarkers = [
    { marker: "\uB9AC\u3E70", color: "nick-green" },
    { marker: "\u2550\u2550\u2550", color: "nick-lightred" },
    { marker: "\u00B0\u0298", color: "nick-lightmagenta" },
    { marker: "\u2042", color: "nick-gold" },
    { marker: "\u0D9E", color: "nick-amogus" },
];
function extractAvatar(text) {
    let idx = text.indexOf('\x06');
    if (idx === -1) return { cleanText: text, avatarUrl: null };
    let before = text.substring(0, idx);
    let after = text.substring(idx + 1);
    const arIdx = after.indexOf('!!AR!!');
    if (arIdx === -1) return { cleanText: text, avatarUrl: null };
    let rest = after.substring(arIdx + 6).trim();
    let link = rest.split(/[\s\n]/)[0];
    return { cleanText: (before + after.slice(0, arIdx)).trim(), avatarUrl: link };
}

function extractNickColor(str) {
    let m = str.match(/<([^>]+)>/);
    if (!m) return { nick: "unauth", colorClass: "nick-unauth", isSnowdrop: false };
    let beforeNick = str.substring(0, m.index);
    let nick = m[1];
    let colorClass = "nick-cyan";
    let isSnowdrop = false;
    for (const { marker, color } of nickMarkers) {
        if (beforeNick.includes(marker)) {
            colorClass = color;
            if (color === "nick-amogus") isSnowdrop = true;
            break;
        }
    }
    return { nick, colorClass, isSnowdrop };
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    return dateStr.replace(/^\[|\]$/g, "");
}

function parseMsg(msg) {
    let date = "";
    let text = msg.trim();
    let colorClass = "";
    let nick = "";
    let avatarUrl = null;

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

        let avatarRes = extractAvatar(afterNick);
        avatarUrl = avatarRes.avatarUrl;
        text = avatarRes.cleanText;

        return { nick, text, date, colorClass, avatarUrl };
    }

    if (date && !nick) {
        let avatarRes = extractAvatar(text);
        avatarUrl = avatarRes.avatarUrl;
        text = avatarRes.cleanText;
        return { nick: "unauth", text, date, colorClass: "nick-unauth", avatarUrl };
    }
    let avatarRes = extractAvatar(text);
    avatarUrl = avatarRes.avatarUrl;
    text = avatarRes.cleanText;
    return { nick: "unauth", text, date: "", colorClass: "nick-unauth", avatarUrl };
}

function getVisibleMessages(messages) {
    if (connectedServer && connectedServer.startsWith("wss://meex.lol:52667") && messages.length > 3) {
        return messages.slice(3);
    }
    return messages;
}

if (window.marked) {
    marked.setOptions({
        breaks: true,
        gfm: true,
        smartypants: true
    });

    const renderer = new marked.Renderer();
    renderer.link = function(href, title, text) {
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    };
    marked.setOptions({ renderer });
}

function showMessages() {
    let chat = document.getElementById('chat-area');
    chat.innerHTML = '';
    let displayMessages = getVisibleMessages([...messages].reverse());

    for (let msg of displayMessages) {
        let { nick, text, date, colorClass, avatarUrl } = parseMsg(msg);

        let msgHtml = "";
        if (text) {
            if (window.marked) {
                try {
                    msgHtml = marked.parse(text);
                } catch (e) {
                    console.error("Markdown processing error:", e);
                    msgHtml = text.replace(/</g, "&lt;").replace(/\n/g, "<br>");
                }
            } else {
                msgHtml = text.replace(/</g, "&lt;").replace(/\n/g, "<br>");
            }
        }
        let avatarBlock = avatarUrl
            ? `<img class="avatar" src="${avatarUrl}" alt="avatar" loading="lazy">`
            : `<div class="avatar-fallback ${colorClass}">${nick ? nick[0].toUpperCase() : ''}</div>`;

        let timeHtml = date ? `<span class="time">${formatDate(date)}</span>` : "";

        chat.innerHTML += `
            <div class="message">
                <div class="avatar-wrap">
                    ${avatarBlock}
                </div>
                <div class="msg-main">
                    <span class="nick ${colorClass}">${nick ? nick : ""}</span>
                    <span class="msg">${msgHtml}</span>
                    ${timeHtml}
                </div>
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
        if (
            settings.messageFormatPreset === "snowdrop" &&
            settings.snowdropAvatarUrl &&
            settings.snowdropAvatarUrl.match(/\.(png|jpg|gif)$/i)
        ) {
            formatted += "\x06!!AR!! " + settings.snowdropAvatarUrl;
        }
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
window.onload = () => { fetchMessages(); };