const MESSAGE_FORMAT_PRESETS = [
    { id: "snowdrop", label: "Snowdrop", format: "ඞ<{name}> {text}", class: "preset-snowdrop" },
    { id: "brac", label: "bRAC", format: "리㹰<{name}> {text}", class: "preset-brac" },
    { id: "crab", label: "CRAB", format: "═══<{name}> {text}", class: "preset-crab" },
    { id: "mefidroniy", label: "Mefidroniy", format: "°ʘ<{name}> {text}", class: "preset-mefidroniy" },
    { id: "crack", label: "cRACk", format: "⁂<{name}> {text}", class: "preset-crack" },
    { id: "default", label: "Default (clRAC)", format: "<{name}> {text}", class: "preset-default" }
];
const DEFAULT_SETTINGS = {
    lang: "en",
    messageFormat: "ඞ<{name}> {text}",
    messageFormatPreset: "snowdrop",
    theme: "dark"
};
function getSettings() {
    try {
        let s = JSON.parse(localStorage.getItem("snowdrop_settings") || "{}");
        return { ...DEFAULT_SETTINGS, ...s };
    } catch (e) {
        return { ...DEFAULT_SETTINGS };
    }
}
function saveSettings(s) {
    localStorage.setItem("snowdrop_settings", JSON.stringify(s));
}
let settings = getSettings();

function getProtoLabel(proto) {
    let label = { proto, className: proto };
    if (proto === "wRACs") label.className = "wRACs";
    else if (proto === "wRAC") label.className = "wRAC";
    else if (proto === "RACs") label.className = "RACs";
    else if (proto === "RAC") label.className = "RAC";
    else label.className = "";
    return label;
}
function buildServerUrl({ proto, address, port }) {
    if (proto === "wRACs") return `wss://${address}:${port}`;
    if (proto === "wRAC") return `ws://${address}:${port}`;
    if (proto === "RACs") return `rac+tls://${address}:${port}`;
    if (proto === "RAC") return `rac://${address}:${port}`;
    return `${address}:${port}`;
}
function parseServerUrl(url) {
    let m;
    if (m = url.match(/^wss:\/\/([^:\/]+):(\d+)$/)) return { proto: "wRACs", address: m[1], port: m[2] };
    if (m = url.match(/^ws:\/\/([^:\/]+):(\d+)$/)) return { proto: "wRAC", address: m[1], port: m[2] };
    if (m = url.match(/^rac\+tls:\/\/([^:\/]+):(\d+)$/)) return { proto: "RACs", address: m[1], port: m[2] };
    if (m = url.match(/^rac:\/\/([^:\/]+):(\d+)$/)) return { proto: "RAC", address: m[1], port: m[2] };
    return { proto: "wRACs", address: url, port: "" };
}
function getSavedServers() {
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem('snowdrop_servers') || "[]") } catch (e) { }
    if (arr.length && typeof arr[0] === "string") {
        arr = arr.map(url => {
            const { proto, address, port } = parseServerUrl(url);
            return { title: address, proto, address, port };
        });
    }
    return arr;
}
function saveServers(arr) {
    localStorage.setItem('snowdrop_servers', JSON.stringify(arr));
}
let servers = getSavedServers();
let ws = null;
let messages = [];
let connectedServer = servers[0] ? buildServerUrl(servers[0]) : null;

// THEME HANDLING

function applyTheme(theme) {
    // Удаляем все другие темы
    let dark = document.getElementById('theme-dark-css');
    let light = document.getElementById('theme-light-css');
    if (dark) dark.remove();
    if (light) light.remove();

    if (theme === "light") {
        let link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'themes/light.css';
        link.id = 'theme-light-css';
        document.head.appendChild(link);
    } else {
        let link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'themes/dark.css';
        link.id = 'theme-dark-css';
        document.head.appendChild(link);
    }
}
applyTheme(settings.theme);

//--- SERVER MODAL PROTOCOL DETECTION
let protocolCheck = {
    state: "idle", // idle | loading | done | error
    protoVersion: null,
    serverSoftware: null,
    lastFields: {}
};

function updateServerInfoLabels() {
    const protoInfo = document.getElementById('proto-version-info');
    const swInfo = document.getElementById('server-software-info');
    if (!protoInfo || !swInfo) return;
    if (protocolCheck.state === "idle" || protocolCheck.state === "error") {
        protoInfo.style.display = "none";
        swInfo.style.display = "none";
    } else if (protocolCheck.state === "loading") {
        protoInfo.style.display = "";
        protoInfo.textContent = t('protocolChecking');
        swInfo.style.display = "";
        swInfo.textContent = t('serverChecking');
    } else if (protocolCheck.state === "done") {
        protoInfo.style.display = "";
        protoInfo.textContent = t('protocolVersion', { version: protocolCheck.protoVersion });
        swInfo.style.display = "";
        swInfo.textContent = t('serverSoftware', { software: protocolCheck.serverSoftware });
    }
}

//--- RENDER CHANNELS
function renderChannels() {
    const channels = document.getElementById('channels');
    channels.innerHTML = '';
    servers.forEach((srv, idx) => {
        const label = getProtoLabel(srv.proto);
        const url = buildServerUrl(srv);
        const isSelected = connectedServer === url || (!connectedServer && idx === 0);
        const div = document.createElement('div');
        div.className = 'channel' + (isSelected ? ' selected' : '');
        div.setAttribute('data-server-idx', idx);
        div.innerHTML = `
                        <div class="channel-header-row">
                            <div class="channel-header-main">
                                <span class="proto-label ${label.className}">${t(label.proto)}</span>
                                <span class="channel-title">${srv.title}</span>
                            </div>
                            <button class="edit-server-btn" title="${t('editServer')}" tabindex="-1">
                                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M8.29289 3.70711L1 11V15H5L12.2929 7.70711L8.29289 3.70711Z" fill="#8c8c8c"></path> <path d="M9.70711 2.29289L13.7071 6.29289L15.1716 4.82843C15.702 4.29799 16 3.57857 16 2.82843C16 1.26633 14.7337 0 13.1716 0C12.4214 0 11.702 0.297995 11.1716 0.828428L9.70711 2.29289Z" fill="#8c8c8c"></path> </g></svg>
                            </button>
                            <button class="delete-server-btn" title="${t('deleteServer')}" tabindex="-1">
                                <svg height="200px" width="200px" version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve" fill="#c77d7d" stroke="#c77d7d"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <style type="text/css"> .st0{fill:#c77d7d;} </style> <g> <path class="st0" d="M439.114,69.747c0,0,2.977,2.1-43.339-11.966c-41.52-12.604-80.795-15.309-80.795-15.309l-2.722-19.297 C310.387,9.857,299.484,0,286.642,0h-30.651h-30.651c-12.825,0-23.729,9.857-25.616,23.175l-2.722,19.297 c0,0-39.258,2.705-80.778,15.309C69.891,71.848,72.868,69.747,72.868,69.747c-10.324,2.849-17.536,12.655-17.536,23.864v16.695 h200.66h200.677V93.611C456.669,82.402,449.456,72.596,439.114,69.747z"></path> <path class="st0" d="M88.593,464.731C90.957,491.486,113.367,512,140.234,512h231.524c26.857,0,49.276-20.514,51.64-47.269 l25.642-327.21H62.952L88.593,464.731z M342.016,209.904c0.51-8.402,7.731-14.807,16.134-14.296 c8.402,0.51,14.798,7.731,14.296,16.134l-14.492,239.493c-0.51,8.402-7.731,14.798-16.133,14.288 c-8.403-0.51-14.806-7.722-14.296-16.125L342.016,209.904z M240.751,210.823c0-8.42,6.821-15.241,15.24-15.241 c8.42,0,15.24,6.821,15.24,15.241v239.492c0,8.42-6.821,15.24-15.24,15.24c-8.42,0-15.24-6.821-15.24-15.24V210.823z M153.833,195.608c8.403-0.51,15.624,5.894,16.134,14.296l14.509,239.492c0.51,8.403-5.894,15.615-14.296,16.125 c-8.403,0.51-15.624-5.886-16.134-14.288l-14.509-239.493C139.026,203.339,145.43,196.118,153.833,195.608z"></path> </g> </g></svg>
                            </button>
                        </div>
                        <span class="channel-address">${srv.address}:${srv.port}</span>
                    `;
        div.querySelector('.channel-header-main').onclick = function (e) {
            document.querySelectorAll('#channels .channel').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');
            connectedServer = url;
            fetchMessages();
        };
        div.querySelector('.delete-server-btn').onclick = function (e) {
            e.stopPropagation();
            if (confirm(t('confirmDelete', { title: srv.title }))) {
                servers.splice(idx, 1);
                saveServers(servers);
                if (servers.length) {
                    connectedServer = buildServerUrl(servers[Math.min(idx, servers.length - 1)]);
                } else {
                    connectedServer = null;
                    messages = [];
                    showMessages();
                }
                renderChannels();
                fetchMessages();
            }
        };
        div.querySelector('.edit-server-btn').onclick = function (e) {
            e.stopPropagation();
            openEditModal(idx);
        };
        channels.appendChild(div);
    });
}

function openEditModal(idx) {
    const srv = servers[idx];
    modalTitle.value = srv.title || "";
    modalAddress.value = srv.address || "";
    modalPort.value = srv.port || "";
    modalProto.value = srv.proto || "wRACs";
    modalUsername.value = srv.username || "";
    modalPassword.value = srv.password || "";
    modalError.textContent = "";
    modalBg.style.display = "flex";
    setTimeout(() => modalTitle.focus(), 50);

    // Protocol info
    protocolCheck.state = "idle";
    updateServerInfoLabels();

    function triggerCheck() {
        if (modalAddress.value && modalPort.value && modalProto.value) {
            checkServerInfo({
                proto: modalProto.value,
                address: modalAddress.value,
                port: modalPort.value
            });
        } else {
            protocolCheck.state = "idle";
            updateServerInfoLabels();
        }
    }
    modalAddress.oninput = triggerCheck;
    modalPort.oninput = triggerCheck;
    modalProto.onchange = triggerCheck;
    triggerCheck();

    saveBtn.onclick = function () {
        const title = modalTitle.value.trim();
        const address = modalAddress.value.trim();
        const port = modalPort.value.trim();
        const proto = modalProto.value;
        const username = modalUsername.value.trim();
        const password = modalPassword.value;
        if (!title || !address || !port || !proto) {
            modalError.textContent = t('fillAllFields');
            return;
        }
        if (!/^[a-zA-Z0-9а-яА-Я\-\.\s_]+$/.test(title)) {
            modalError.textContent = t('invalidTitle');
            return;
        }
        if (!/^[a-zA-Z0-9\-\.]+$/.test(address)) {
            modalError.textContent = t('invalidAddress');
            return;
        }
        if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) {
            modalError.textContent = t('invalidPort');
            return;
        }
        if (servers.some((srv2, i) => i !== idx && srv2.proto === proto && srv2.address === address && srv2.port === port)) {
            modalError.textContent = t('duplicateServer');
            return;
        }
        servers[idx] = { title, proto, address, port, username, password };
        saveServers(servers);
        connectedServer = buildServerUrl(servers[idx]);
        closeModal();
        renderChannels();
        fetchMessages();
    };
}

function getActiveServerCreds() {
    if (!connectedServer) return {};
    let idx = servers.findIndex(
        s => buildServerUrl(s) === connectedServer
    );
    if (idx === -1) return {};
    let { username, password } = servers[idx];
    return { username: username || "", password: password || "" };
}

function getCurrentFormatPresetId(fmt) {
    for (const preset of MESSAGE_FORMAT_PRESETS) {
        if (preset.format === fmt) return preset.id;
    }
    return null;
}

const modalBg = document.getElementById('server-modal-bg');
const modalForm = document.getElementById('server-modal');
const modalTitle = document.getElementById('modal-server-title');
const modalAddress = document.getElementById('modal-server-address');
const modalPort = document.getElementById('modal-server-port');
const modalProto = document.getElementById('modal-server-proto');
const modalUsername = document.getElementById('modal-server-username');
const modalPassword = document.getElementById('modal-server-password');
const modalError = document.getElementById('server-modal-error');
const saveBtn = document.getElementById('save-server-btn');
const cancelBtn = document.getElementById('cancel-server-btn');

// Add info labels for server modal if not exist
if (!document.getElementById("server-software-info")) {
    const swInfo = document.createElement("div");
    swInfo.id = "server-software-info";
    swInfo.style.fontSize = "0.95em";
    swInfo.style.color = "#aaa";
    swInfo.style.marginTop = "-8px";
    swInfo.style.marginBottom = "3px";
    swInfo.style.display = "none";
    modalAddress.parentElement.appendChild(swInfo);
}
if (!document.getElementById("proto-version-info")) {
    const protoInfo = document.createElement("div");
    protoInfo.id = "proto-version-info";
    protoInfo.style.fontSize = "0.95em";
    protoInfo.style.color = "#aaa";
    protoInfo.style.marginTop = "1px";
    protoInfo.style.marginBottom = "3px";
    protoInfo.style.display = "none";
    modalProto.parentElement.appendChild(protoInfo);
}

function openModal() {
    modalTitle.value = "";
    modalAddress.value = "";
    modalPort.value = "";
    modalProto.value = "wRACs";
    modalUsername.value = "";
    modalPassword.value = "";
    modalError.textContent = "";
    modalBg.style.display = "flex";
    setTimeout(() => modalTitle.focus(), 50);

    protocolCheck.state = "idle";
    updateServerInfoLabels();

    function triggerCheck() {
        if (modalAddress.value && modalPort.value && modalProto.value) {
            checkServerInfo({
                proto: modalProto.value,
                address: modalAddress.value,
                port: modalPort.value
            });
        } else {
            protocolCheck.state = "idle";
            updateServerInfoLabels();
        }
    }
    modalAddress.oninput = triggerCheck;
    modalPort.oninput = triggerCheck;
    modalProto.onchange = triggerCheck;
    triggerCheck();

    saveBtn.onclick = function () {
        const title = modalTitle.value.trim();
        const address = modalAddress.value.trim();
        const port = modalPort.value.trim();
        const proto = modalProto.value;
        const username = modalUsername.value.trim();
        const password = modalPassword.value;
        if (!title || !address || !port || !proto) {
            modalError.textContent = t('fillAllFields');
            return;
        }
        if (!/^[a-zA-Z0-9а-яА-Я\-\.\s_]+$/.test(title)) {
            modalError.textContent = t('invalidTitle');
            return;
        }
        if (!/^[a-zA-Z0-9\-\.]+$/.test(address)) {
            modalError.textContent = t('invalidAddress');
            return;
        }
        if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) {
            modalError.textContent = t('invalidPort');
            return;
        }
        if (servers.some(srv => srv.proto === proto && srv.address === address && srv.port === port)) {
            modalError.textContent = t('duplicateServer');
            return;
        }
        servers.push({ title, proto, address, port, username, password });
        saveServers(servers);
        connectedServer = buildServerUrl(servers[servers.length - 1]);
        closeModal();
        renderChannels();
        fetchMessages();
    };
}
function closeModal() {
    modalBg.style.display = "none";
    protocolCheck.state = "idle";
    updateServerInfoLabels();
}
document.getElementById('add-server-btn').onclick = openModal;
cancelBtn.onclick = closeModal;

// Настройки
const settingsBtn = document.getElementById('header-settings-btn');
const settingsModalBg = document.getElementById('settings-modal-bg');
const settingsModal = document.getElementById('settings-modal');
const settingsLangSelect = document.getElementById('settings-lang-select');
const settingsFormatInput = document.getElementById('settings-format-input');
const settingsModalError = document.getElementById('settings-modal-error');
const settingsModalPresets = document.querySelectorAll('.settings-format-preset-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const cancelSettingsBtn = document.getElementById('cancel-settings-btn');

const settingsThemeSelect = document.getElementById('settings-theme-select');

function updateSettingsModalFields() {
    settingsLangSelect.value = settings.lang || "ru";
    settingsFormatInput.value = settings.messageFormat || DEFAULT_SETTINGS.messageFormat;
    settingsThemeSelect.value = settings.theme || "dark";
    let id = getCurrentFormatPresetId(settingsFormatInput.value);
    settingsModalPresets.forEach(btn => {
        btn.classList.toggle("selected", btn.dataset.id === id);
    });
}

function openSettingsModal() {
    updateSettingsModalFields();
    settingsModalError.textContent = "";
    settingsModalBg.style.display = "flex";
    setTimeout(() => settingsLangSelect.focus(), 50);
}
function closeSettingsModal() { settingsModalBg.style.display = "none"; }

settingsBtn.onclick = openSettingsModal;
cancelSettingsBtn.onclick = closeSettingsModal;

settingsModalPresets.forEach(btn => {
    btn.onclick = function () {
        settingsFormatInput.value = btn.getAttribute("data-format")
            .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        settingsModalPresets.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
    };
});

saveSettingsBtn.onclick = function () {
    const lang = settingsLangSelect.value;
    const format = settingsFormatInput.value.trim();
    const theme = settingsThemeSelect.value;
    settings = {
        ...settings,
        lang,
        messageFormat: format,
        messageFormatPreset: getCurrentFormatPresetId(format) || null,
        theme
    };
    saveSettings(settings);
    applyTheme(theme);
    closeSettingsModal();
    updateUIStrings();
};

settingsThemeSelect.onchange = function () {
    settings.theme = settingsThemeSelect.value;
    saveSettings(settings);
    applyTheme(settings.theme);
};

settingsModalBg.addEventListener("click", function (e) {
    if (e.target === settingsModalBg) closeSettingsModal();
});

function updateUIStrings() {
    // Панелька
    document.getElementById('app-title').textContent = t('appName');
    document.getElementById('add-server-btn').textContent = t('addServer');
    document.getElementById('header-settings-btn').title = t('settings');
    // Добавление серверовй
    document.getElementById('label-server-title').textContent = t('serverTitle');
    document.getElementById('label-server-address').textContent = t('address');
    document.getElementById('label-server-port').textContent = t('port');
    document.getElementById('label-server-proto').textContent = t('protocol');
    document.getElementById('label-server-username').textContent = t('username');
    document.getElementById('label-server-password').textContent = t('password');
    document.getElementById('save-server-btn').textContent = t('save');
    document.getElementById('cancel-server-btn').textContent = t('cancel');
    // Настройки
    document.getElementById('settings-label-lang').textContent = t('settingsLabelLang');
    document.getElementById('settings-label-format').textContent = t('settingsLabelFormat');
    document.getElementById('settings-label-theme').textContent = t('settingsLabelTheme') || "Theme";
    saveSettingsBtn.textContent = t('settingsSave');
    cancelSettingsBtn.textContent = t('settingsCancel');
    settingsFormatInput.placeholder = t('messageFormat');
    // Ввод сообщений
    document.getElementById('chat-input').placeholder = t('writeMessage');
    document.getElementById('send-btn').title = t('send');
    renderChannels();
}

settingsLangSelect.onchange = function () {
    settings.lang = settingsLangSelect.value;
    saveSettings(settings);
    updateUIStrings();
};

updateUIStrings();
settingsBtn.addEventListener("click", updateSettingsModalFields);
renderChannels();