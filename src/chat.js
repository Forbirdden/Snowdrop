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

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function sanitizeAvatarUrl(url) {
    if (!url) return null;
    const trimmed = url.trim();
    if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return null;
    return trimmed;
}

const SANITIZE_ALLOWED_TAGS = new Set([
    'A', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'STRIKE', 'CODE', 'PRE',
    'BLOCKQUOTE', 'P', 'BR', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5',
    'H6', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'IMG', 'SPAN',
    'SUB', 'SUP', 'VIDEO'
]);
const SANITIZE_ALLOWED_ATTR = {
    A: ['href', 'title', 'target', 'rel'],
    IMG: ['src', 'alt', 'title'],
    VIDEO: ['src', 'controls', 'preload']
};

function getMediaType(url) {
    if (!url) return null;
    const clean = url.split(/[?#]/)[0].toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(clean)) return 'image';
    if (/\.(mp4|webm|ogg|mov)$/.test(clean)) return 'video';
    return null;
}
window.getMediaType = getMediaType;

function sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;

    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
    const elements = [];
    let node;
    while ((node = walker.nextNode())) elements.push(node);

    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        const tag = el.tagName;

        if (!SANITIZE_ALLOWED_TAGS.has(tag)) {
            const parent = el.parentNode;
            if (!parent) continue;
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            parent.removeChild(el);
            continue;
        }

        const allowedAttrs = SANITIZE_ALLOWED_ATTR[tag] || [];

        if (tag === 'A') {
            const rawHref = el.getAttribute('href');
            const safeHref = rawHref ? sanitizeAvatarUrl(rawHref) : null;
            const mediaType = safeHref ? getMediaType(safeHref) : null;
            if (mediaType) {
                const wrap = document.createElement('span');
                wrap.className = 'media-wrap';

                if (mediaType === 'image') {
                    const link = document.createElement('a');
                    link.href = safeHref;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    const img = document.createElement('img');
                    img.className = 'chat-media';
                    img.src = safeHref;
                    img.alt = 'image';
                    img.loading = 'lazy';
                    link.appendChild(img);
                    wrap.appendChild(link);
                } else {
                    const video = document.createElement('video');
                    video.className = 'chat-media';
                    video.src = safeHref;
                    video.controls = true;
                    video.preload = 'metadata';
                    wrap.appendChild(video);
                }

                const star = document.createElement('button');
                star.type = 'button';
                star.className = 'fav-star' + (window.isFavoriteUrl && window.isFavoriteUrl(safeHref) ? ' active' : '');
                star.dataset.url = safeHref;
                star.dataset.type = mediaType;
                star.title = 'В избранное';
                star.textContent = '★';
                wrap.appendChild(star);

                el.replaceWith(wrap);
                continue;
            }
        }

        [...el.attributes].forEach(attr => {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on') || !allowedAttrs.includes(name)) {
                el.removeAttribute(attr.name);
                return;
            }
            if (name === 'href' || name === 'src') {
                const safe = sanitizeAvatarUrl(attr.value);
                if (!safe) el.removeAttribute(attr.name);
                else el.setAttribute(attr.name, safe);
            }
        });
        if (tag === 'A') {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
        }
    }

    return template.innerHTML;
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
    return messages;
}

if (window.marked) {
    marked.setOptions({
        breaks: true,
        gfm: true,
        smartypants: true
    });
}

function renderMessageHtml(text) {
    if (!text) return "";
    let raw;
    if (window.marked) {
        try {
            raw = marked.parse(text);
        } catch (e) {
            console.error("Markdown processing error:", e);
            raw = escapeHtml(text).replace(/\n/g, "<br>");
        }
    } else {
        raw = escapeHtml(text).replace(/\n/g, "<br>");
    }
    return sanitizeHtml(raw);
}

const SERVER_LINK_PROTO_MAP = {
    wracs: "wRACs",
    wrac: "wRAC",
    racs: "RACs",
    rac: "RAC"
};

function detectServerLinks(text) {
    if (!text) return [];
    const re = /\b(wracs|wrac|racs|rac):\/\/([a-zA-Z0-9.\-]+):(\d{1,5})\b/gi;
    const found = [];
    const seen = new Set();
    let m;
    while ((m = re.exec(text))) {
        const proto = SERVER_LINK_PROTO_MAP[m[1].toLowerCase()];
        if (!proto) continue;
        const address = m[2];
        const port = m[3];
        const key = proto + "|" + address + "|" + port;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ proto, address, port });
    }
    return found;
}

let serverLinkCardCounter = 0;

function renderServerLinkCard(link) {
    const id = "server-link-card-" + (serverLinkCardCounter++);
    const label = getProtoLabel(link.proto);
    return `
<div class="server-link-card" id="${id}" data-proto="${escapeHtml(link.proto)}" data-address="${escapeHtml(link.address)}" data-port="${escapeHtml(link.port)}">
    <div class="server-link-card-row">
        <span class="proto-label ${label.className}">${escapeHtml(t(label.proto))}</span>
        <span class="server-link-card-address">${escapeHtml(link.address)}:${escapeHtml(link.port)}</span>
    </div>
    <div class="server-link-card-info" data-role="info">${escapeHtml(t('protocolChecking'))}</div>
    <button type="button" class="server-link-card-add-btn" data-role="add-btn">${escapeHtml(t('addServer'))}</button>
</div>`;
}

function checkServerLinkCardInfo({ proto, address, port }, infoEl) {
    if (proto !== "wRACs" && proto !== "wRAC") {
        infoEl.textContent = t('unexpectedResponse');
        return;
    }
    let url, wsTest;
    try {
        url = buildServerUrl({ proto, address, port });
        wsTest = new WebSocket(url);
    } catch (e) {
        infoEl.textContent = t('connectionFailed');
        return;
    }
    wsTest.binaryType = "arraybuffer";
    let resolved = false;
    const timeout = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        infoEl.textContent = t('connectionFailed');
        try { wsTest.close(); } catch (e) {}
    }, 5000);
    wsTest.onopen = () => wsTest.send(new Uint8Array([0x69]));
    wsTest.onmessage = (e) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        let arr = new Uint8Array(e.data);
        if (arr.length < 2) {
            infoEl.textContent = t('unexpectedResponse');
            wsTest.close();
            return;
        }
        let versionByte = arr[0];
        let ver = versionByte === 0x01 ? "1.0" : versionByte === 0x02 ? "1.99" : versionByte === 0x03 ? "2.0" : "Unknown";
        let software = new TextDecoder().decode(arr.slice(1));
        infoEl.textContent =  t('serverSoftware', { software }) + " \u2022 " + t('protocolVersion', { version: ver });
        wsTest.close();
    };
    wsTest.onerror = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        infoEl.textContent = t('connectionFailed');
    };
}

function hydrateServerLinkCards(container) {
    container.querySelectorAll('.server-link-card').forEach(card => {
        if (card.dataset.hydrated) return;
        card.dataset.hydrated = "1";
        const proto = card.dataset.proto;
        const address = card.dataset.address;
        const port = card.dataset.port;
        const infoEl = card.querySelector('[data-role="info"]');
        const addBtn = card.querySelector('[data-role="add-btn"]');
        addBtn.onclick = () => openServerModal(null, { proto, address, port });
        checkServerLinkCardInfo({ proto, address, port }, infoEl);
    });
}

const notifyBaseline = new Map();

function getEffectiveNotifyMode(srv) {
    if (srv && srv.notify && srv.notify !== "global") return srv.notify;
    return (settings && settings.notifyMode) || "none";
}

function isPingMatch(line, username) {
    if (!username) return false;
    const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("(^|[^\\w@])@" + escaped + "\\b", "i");
    return re.test(line);
}

function showServerNotification(srv, serverUrl, lines) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    let title;
    let body;
    let icon = "assets/lmtl.png";
    if (lines.length === 1) {
        const { nick, text, avatarUrl } = parseMsg(lines[0]);
        title = nick + " \u2014 " + srv.title;
        const safeAvatar = sanitizeAvatarUrl(avatarUrl);
        if (safeAvatar) icon = safeAvatar;
        body = text.replace(/\s+/g, " ").trim().slice(0, 200);
    } else {
        title = srv.title;
        body = t("notifyNewMessages", { count: lines.length });
    }
    let notif;
    try {
        notif = new Notification(title, { body, icon });
    } catch (e) {
        return;
    }
    notif.onclick = () => {
        window.focus();
        connectedServer = serverUrl;
        renderChannels();
        fetchMessages();
        notif.close();
    };
}

function maybeNotifyForServer(srv, allLines) {
    const serverUrl = buildServerUrl(srv);
    const prevCount = notifyBaseline.has(serverUrl) ? notifyBaseline.get(serverUrl) : null;
    notifyBaseline.set(serverUrl, allLines.length);

    if (prevCount === null || allLines.length <= prevCount) return;

    const mode = getEffectiveNotifyMode(srv);
    if (mode === "none") return;

    let newLines = allLines.slice(prevCount);
    if (mode === "ping") {
        if (!srv.username) return;
        newLines = newLines.filter(l => isPingMatch(l, srv.username));
        if (!newLines.length) return;
    }

    if (document.hasFocus() && connectedServer === serverUrl) return;

    showServerNotification(srv, serverUrl, newLines);
}

function pollServerOnce(srv) {
    return new Promise(resolve => {
        let url, sock;
        try {
            url = buildServerUrl(srv);
            sock = new WebSocket(url);
        } catch (e) {
            resolve(null);
            return;
        }
        sock.binaryType = "arraybuffer";
        let done = false;
        const finish = lines => {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            try { sock.close(); } catch (e) {}
            resolve(lines);
        };
        const timeout = setTimeout(() => finish(null), 7000);
        sock.onopen = () => sock.send(new Uint8Array([0x00]));
        sock.onmessage = e => {
            if (typeof e.data === "string") return;
            let buf = new Uint8Array(e.data);
            if (buf.length === 1 && (buf[0] === 0x01 || buf[0] === 0x02)) return;
            let str = new TextDecoder().decode(buf).trim();
            if (/^\d+$/.test(str)) {
                sock.send(new Uint8Array([0x00, 0x01]));
                return;
            }
            finish(str.split('\n').filter(Boolean));
        };
        sock.onerror = () => finish(null);
        sock.onclose = () => finish(null);
    });
}

async function pollAllServersForNotifications() {
    if (((settings && settings.notifyScope) || "current") !== "all") return;
    for (const srv of servers) {
        const url = buildServerUrl(srv);
        if (url === connectedServer) continue;
        if (getEffectiveNotifyMode(srv) === "none") continue;
        const lines = await pollServerOnce(srv);
        if (lines) maybeNotifyForServer(srv, lines);
    }
}

setInterval(pollAllServersForNotifications, 8000);

let firstChatRender = true;

function isAtBottom(chat) {
    return chat.scrollHeight - chat.scrollTop - chat.clientHeight < 10;
}

function scrollToBottom(chat) {
    chat.scrollTop = chat.scrollHeight;
}

function showMessages() {
    let chat = document.getElementById("chat-area");

    if (connectedServer) {
        const currentSrv = servers.find(s => buildServerUrl(s) === connectedServer);
        if (currentSrv) maybeNotifyForServer(currentSrv, messages);
    }

const wasAtBottom = firstChatRender || isAtBottom(chat);
    let displayMessages = getVisibleMessages(messages);
    let parts = [];

    for (let msg of displayMessages) {
        let { nick, text, date, colorClass, avatarUrl } = parseMsg(msg);

        let msgHtml = renderMessageHtml(text);
        let serverLinks = detectServerLinks(text);
        let serverLinkCardsHtml = serverLinks.map(renderServerLinkCard).join('');
        let safeAvatarUrl = sanitizeAvatarUrl(avatarUrl);
        let avatarBlock = safeAvatarUrl
            ? `<img class="avatar" src="${escapeHtml(safeAvatarUrl)}" alt="avatar" loading="lazy">`
            : `<div class="avatar-fallback ${colorClass}">${nick ? escapeHtml(nick[0].toUpperCase()) : ''}</div>`;

        let timeHtml = date ? `<span class="time">${escapeHtml(formatDate(date))}</span>` : "";

parts.push(`
<div class="message-wrapper">
    <div class="message">
        <div class="avatar-wrap">
            ${avatarBlock}
        </div>

        <div class="msg-main">
            <div class="nick-time-row">
                <span class="nick ${colorClass}">
                    ${nick ? escapeHtml(nick) : ""}
                </span>
                ${timeHtml}
            </div>

            <div class="msg">
                ${msgHtml}
            </div>
            ${serverLinkCardsHtml}
        </div>
    </div>
</div>`);
    }

    chat.innerHTML = parts.join('');
    hydrateServerLinkCards(chat);

    if (wasAtBottom) {
        const pinToBottom = () => scrollToBottom(chat);
        requestAnimationFrame(pinToBottom);
        chat.querySelectorAll('img, video').forEach(el => {
            el.addEventListener('load', pinToBottom, { once: true });
            el.addEventListener('loadedmetadata', pinToBottom, { once: true });
            el.addEventListener('error', pinToBottom, { once: true });
        });
        firstChatRender = false;
    }
}

const chatInputEl = document.getElementById('chat-input');

function sendMsg() {
    const msg = chatInputEl.value.trim();
    if (!msg || !connectedServer) return;
    const { username, password } = getActiveServerCreds();
    wRAC(() => {
        let arr;
        let format = (settings && settings.messageFormat) ? settings.messageFormat : DEFAULT_SETTINGS.messageFormat;
        let formatted = format;
        if (formatted.includes("{name}")) formatted = formatted.replace("{name}", username ?? "");
        if (formatted.includes("{text}")) formatted = formatted.replace("{text}", msg ?? "");
        if (
            settings.snowdropAvatarUrl &&
            settings.snowdropAvatarUrl.match(/\.(png|jpg|gif)$/i)
        ) {
            formatted += "\x06!!AR!!" + settings.snowdropAvatarUrl;
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
        chatInputEl.value = "";
        setTimeout(fetchMessages, 200);
    });
}

function fetchMessages() {
    wRAC(() => {
        ws.send(new Uint8Array([0x00]));
    });
}

document.getElementById('send-btn').onclick = sendMsg;
chatInputEl.addEventListener('keydown', function (e) {
    if (e.key === "Enter") sendMsg();
});

document.getElementById('chat-area').addEventListener('click', function (e) {
    const btn = e.target.closest('.fav-star');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (!window.toggleFavorite) return;
    const nowActive = window.toggleFavorite(btn.dataset.url, btn.dataset.type);
    btn.classList.toggle('active', nowActive);
});

setInterval(fetchMessages, 3000);
window.onload = () => { fetchMessages(); };