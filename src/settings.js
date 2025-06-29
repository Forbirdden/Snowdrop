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

function applyTheme(theme) {
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

function getCurrentFormatPresetId(fmt) {
    for (const preset of MESSAGE_FORMAT_PRESETS) {
        if (preset.format === fmt) return preset.id;
    }
    return null;
}

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

function closeSettingsModal() { 
    settingsModalBg.style.display = "none"; 
}

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
    if (window.updateUIStrings) window.updateUIStrings();
};

settingsThemeSelect.onchange = function () {
    settings.theme = settingsThemeSelect.value;
    saveSettings(settings);
    applyTheme(settings.theme);
};

settingsModalBg.addEventListener("click", function (e) {
    if (e.target === settingsModalBg) closeSettingsModal();
});

applyTheme(settings.theme);