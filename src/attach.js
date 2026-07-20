const FAVORITES_KEY = "snowdrop_favorites";
const FAVORITES_MAX = 200;

function getFavorites() {
    try {
        const list = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
        return Array.isArray(list) ? list : [];
    } catch (e) {
        return [];
    }
}

function saveFavorites(list) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
}

function isFavoriteUrl(url) {
    return getFavorites().some(f => f.url === url);
}

function toggleFavorite(url, type) {
    let list = getFavorites();
    const idx = list.findIndex(f => f.url === url);
    let nowActive;
    if (idx !== -1) {
        list.splice(idx, 1);
        nowActive = false;
    } else {
        list.unshift({ url, type: type || "image", addedAt: Date.now() });
        if (list.length > FAVORITES_MAX) list = list.slice(0, FAVORITES_MAX);
        nowActive = true;
    }
    saveFavorites(list);
    renderFavoritesTab();
    return nowActive;
}

window.isFavoriteUrl = isFavoriteUrl;
window.toggleFavorite = toggleFavorite;

const attachBtn = document.getElementById("attach-btn");
const attachModalBg = document.getElementById("attach-modal-bg");
const attachCloseBtn = document.getElementById("attach-close-btn");
const attachTabUploadBtn = document.getElementById("attach-tab-upload-btn");
const attachTabFavoritesBtn = document.getElementById("attach-tab-favorites-btn");
const attachPanelUpload = document.getElementById("attach-panel-upload");
const attachPanelFavorites = document.getElementById("attach-panel-favorites");
const attachDropzone = document.getElementById("attach-dropzone");
const attachFileInput = document.getElementById("attach-file-input");
const attachUploadStatus = document.getElementById("attach-upload-status");
const favoritesGrid = document.getElementById("favorites-grid");
const favoritesEmpty = document.getElementById("favorites-empty");

function switchAttachTab(tab) {
    const isUpload = tab === "upload";
    attachTabUploadBtn.classList.toggle("selected", isUpload);
    attachTabFavoritesBtn.classList.toggle("selected", !isUpload);
    attachPanelUpload.style.display = isUpload ? "flex" : "none";
    attachPanelFavorites.style.display = isUpload ? "none" : "flex";
}

function openAttachModal() {
    attachModalBg.style.display = "flex";
    switchAttachTab("upload");
    renderFavoritesTab();
}

function closeAttachModal() {
    attachModalBg.style.display = "none";
    attachUploadStatus.innerHTML = "";
}

attachBtn.onclick = openAttachModal;
attachCloseBtn.onclick = closeAttachModal;
attachModalBg.addEventListener("click", e => {
    if (e.target === attachModalBg) closeAttachModal();
});
attachTabUploadBtn.onclick = () => switchAttachTab("upload");
attachTabFavoritesBtn.onclick = () => switchAttachTab("favorites");

function insertIntoChatInput(url) {
    const input = document.getElementById("chat-input");
    input.value = input.value ? (input.value.replace(/\s+$/, "") + " " + url) : url;
    input.focus();
}

async function uploadToCatbox(file) {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("userhash", "");
    form.append("fileToUpload", file, file.name);

    let res;
    try {
        res = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: form });
    } catch (e) {
        throw new Error(t("uploadNetworkError"));
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const url = (await res.text()).trim();
    if (!/^https?:\/\//i.test(url)) throw new Error(url || t("uploadUnexpectedResponse"));
    return url;
}

function addUploadStatusRow(name) {
    const row = document.createElement("div");
    row.className = "upload-status-row";
    const nameEl = document.createElement("span");
    nameEl.className = "upload-status-name";
    nameEl.textContent = name;
    const stateEl = document.createElement("span");
    stateEl.className = "upload-status-state";
    stateEl.textContent = t("uploading");
    row.appendChild(nameEl);
    row.appendChild(stateEl);
    attachUploadStatus.prepend(row);
    return stateEl;
}

async function handleFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    for (const file of files) {
        const stateEl = addUploadStatusRow(file.name);
        try {
            const url = await uploadToCatbox(file);
            stateEl.textContent = t("uploadDone");
            stateEl.classList.add("success");
            insertIntoChatInput(url);
        } catch (e) {
            stateEl.textContent = e.message || t("uploadFailed");
            stateEl.classList.add("error");
        }
    }
}

attachDropzone.onclick = () => attachFileInput.click();
attachFileInput.onchange = () => {
    handleFiles(attachFileInput.files);
    attachFileInput.value = "";
};
["dragenter", "dragover"].forEach(evt => attachDropzone.addEventListener(evt, e => {
    e.preventDefault();
    attachDropzone.classList.add("drag-active");
}));
["dragleave", "drop"].forEach(evt => attachDropzone.addEventListener(evt, e => {
    e.preventDefault();
    attachDropzone.classList.remove("drag-active");
}));
attachDropzone.addEventListener("drop", e => {
    if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
});

function renderFavoritesTab() {
    const list = getFavorites();
    favoritesGrid.innerHTML = "";
    favoritesEmpty.style.display = list.length ? "none" : "block";

    list.forEach(fav => {
        const item = document.createElement("div");
        item.className = "favorite-item";

        const thumb = fav.type === "video"
            ? document.createElement("video")
            : document.createElement("img");
        thumb.className = "favorite-thumb";
        thumb.src = fav.url;
        if (fav.type === "video") {
            thumb.muted = true;
            thumb.preload = "metadata";
        } else {
            thumb.loading = "lazy";
            thumb.alt = "favorite";
        }
        thumb.addEventListener("click", () => {
            insertIntoChatInput(fav.url);
            closeAttachModal();
        });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "favorite-remove";
        removeBtn.title = t("removeFavorite");
        removeBtn.textContent = "\u00d7";
        removeBtn.addEventListener("click", e => {
            e.stopPropagation();
            toggleFavorite(fav.url, fav.type);
        });

        item.appendChild(thumb);
        item.appendChild(removeBtn);
        favoritesGrid.appendChild(item);
    });
}