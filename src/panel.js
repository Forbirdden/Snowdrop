        const MESSAGE_FORMAT_PRESETS = [
            { id: "snowdrop", label: "Snowdrop", format: "ඞ<{name}> {text}", class: "preset-snowdrop" },
            { id: "brac", label: "bRAC", format: "리㹰<{name}> {text}", class: "preset-brac" },
            { id: "crab", label: "CRAB", format: "═══<{name}> {text}", class: "preset-crab" },
            { id: "mefidroniy", label: "Mefidroniy", format: "°ʘ<{name}> {text}", class: "preset-mefidroniy" },
            { id: "crack", label: "cRACk", format: "⁂<{name}> {text}", class: "preset-crack" },
            { id: "default", label: "Default (clRAC)", format: "<{name}> {text}", class: "preset-default" }
        ];
        const DEFAULT_SETTINGS = {
            lang: "ru",
            messageFormat: "ඞ<{name}> {text}",
            messageFormatPreset: "snowdrop"
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
                                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                                            <path d="M16.862 3.487a2.07 2.07 0 0 1 2.932 2.93l-1.1 1.1-2.931-2.931 1.099-1.099Zm-2.157 2.157 2.931 2.931-9.019 9.019a2 2 0 0 1-.638.427l-3.246 1.35a.5.5 0 0 1-.651-.65l1.35-3.247a2 2 0 0 1 .427-.637l9.019-9.02Z" fill="#888"/>
                                        </svg>
                                    </button>
                                    <button class="delete-server-btn" title="${t('deleteServer')}" tabindex="-1">
                                        <svg viewBox="0 0 24 24"><path d="M9.25 3a2.25 2.25 0 0 0-2.12 1.5h-3.13a.75.75 0 0 0 0 1.5h.7l.77 13.53A2.75 2.75 0 0 0 8.1 22h7.8a2.75 2.75 0 0 0 2.73-2.47l.77-13.53h.7a.75.75 0 0 0 0-1.5h-3.13A2.25 2.25 0 0 0 14.75 3Zm-3.13 2.25A.75.75 0 0 0 6.75 4.5h3.13a.75.75 0 0 0 .75-.75h2.75a.75.75 0 0 0 .75.75h3.13a.75.75 0 0 0-.37.75l-.77 13.53a1.25 1.25 0 0 1-1.24 1.12H8.1a1.25 1.25 0 0 1-1.24-1.12Zm2.38 3.25a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Zm3.5 0a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Z"/></svg>
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

        function updateSettingsModalFields() {
            settingsLangSelect.value = settings.lang || "ru";
            settingsFormatInput.value = settings.messageFormat || DEFAULT_SETTINGS.messageFormat;
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
            settings = {
                ...settings,
                lang,
                messageFormat: format,
                messageFormatPreset: getCurrentFormatPresetId(format) || null
            };
            saveSettings(settings);
            closeSettingsModal();
            updateUIStrings();
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