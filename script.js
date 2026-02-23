var allSongs = [];
var filteredListSongs = [];
var searchTimeout = null;
var listFilterTimeout = null;
var currentSort = { key: '最終演奏', ascending: false };
var currentPage = 1;
var itemsPerPage = 50;
var selectedListSong = null; // 全曲一覧で選択された曲
var dataCreatedAt = null; // データ作成時刻を保持
var appSettings = {}; // 設定オブジェクト（loadSettings()で初期化される）

// Default Settings
var defaultSettings = {
    searchSort: '最終演奏',
    searchLimit: 50,
    horizontalScroll: false,
    showTags: false,
    settingsVersion: 2, // 設定バージョン（移行時に使用）
    listColumns: [
        { key: '曲名', label: '曲名', visible: true },
        { key: 'アーティスト', label: 'アーティスト', visible: true },
        { key: '最終演奏', label: '最終演奏', visible: true },
        { key: '演奏回数', label: '回数', visible: true },
        { key: '曲名の読み', label: '曲名よみがな', visible: false },
        { key: 'アーティストの読み', label: '歌手よみがな', visible: false },
        { key: 'タイアップ', label: 'タイアップ', visible: false },
        { key: 'タグ', label: 'タグ', visible: false }
    ]
};
function loadSettings() {
    // appSettingsを必ず初期化
    appSettings = JSON.parse(JSON.stringify(defaultSettings));
    
    const saved = localStorage.getItem('appSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            appSettings = { ...defaultSettings, ...parsed };
            
            // 設定バージョンをチェック（タグ機能追加時の移行処理）
            if (!parsed.settingsVersion || parsed.settingsVersion < defaultSettings.settingsVersion) {
                // 古い設定から新しい設定への移行
                migrateSettings(parsed);
            } else if (parsed.listColumns && Array.isArray(parsed.listColumns)) {
                appSettings.listColumns = parsed.listColumns;
            }
        } catch (e) { 
            console.error('Settings parse error', e);
            // エラー時もデフォルト設定を保持
            appSettings = JSON.parse(JSON.stringify(defaultSettings));
        }
    }
    appSettings.settingsVersion = defaultSettings.settingsVersion;
    applySettings();
}

function migrateSettings(oldSettings) {
    // 古い設定にタグ列がない場合は追加
    if (oldSettings.listColumns && Array.isArray(oldSettings.listColumns)) {
        const hasTagColumn = oldSettings.listColumns.some(col => col.key === 'タグ');
        
        if (!hasTagColumn) {
            // タグ列を追加（デフォルト位置：非表示）
            appSettings.listColumns = [
                ...oldSettings.listColumns,
                { key: 'タグ', label: 'タグ', visible: false }
            ];
        } else {
            appSettings.listColumns = oldSettings.listColumns;
        }
    } else {
        // listColumnsがない場合はデフォルトを使用
        appSettings.listColumns = defaultSettings.listColumns;
    }
}
function saveSettings() {
    appSettings.searchSort = document.getElementById('settingSearchSort').value;
    const limitVal = document.getElementById('settingSearchLimit').value;
    appSettings.searchLimit = (limitVal === 'all') ? 'all' : parseInt(limitVal, 10);
    const hScroll = document.getElementById('settingHorizontalScroll');
    if (hScroll) {
        appSettings.horizontalScroll = hScroll.checked;
    }
    const colList = document.getElementById('columnSettingsList');
    const newCols = [];
    colList.querySelectorAll('.column-item').forEach(item => {
        const key = item.dataset.key;
        const visible = item.querySelector('input[type="checkbox"]').checked;
        const label = item.querySelector('.column-name').textContent;
        newCols.push({ key: key, label: label, visible: visible });
        
        // タグ列の表示状態を appSettings.showTags に反映
        if (key === 'タグ') {
            appSettings.showTags = visible;
        }
    });
    appSettings.listColumns = newCols;
    appSettings.settingsVersion = defaultSettings.settingsVersion; // バージョン更新
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    closeSettingsPopup();
    applySettings();
    performSearch();
    renderListTable();
}
function applySettings() {
    renderListHeader();
}
function showSettingsPopup() {
    closeMenu();
    document.getElementById('settingSearchSort').value = appSettings.searchSort;
    document.getElementById('settingSearchLimit').value = appSettings.searchLimit;
    const hScroll = document.getElementById('settingHorizontalScroll');
    if (hScroll) hScroll.checked = appSettings.horizontalScroll;
    checkSearchLimitWarning();
    renderColumnSettingsList();
    const popup = document.getElementById('settingsPopup');
    popup.classList.remove('hidden');
    const content = popup.querySelector('.popup-content');
    if (content) content.scrollTop = 0;
}
function closeSettingsPopup(event) {
    if (event && event.target.id !== 'settingsPopup') return;
    document.getElementById('settingsPopup').classList.add('hidden');
}
function checkSearchLimitWarning() {
    const val = document.getElementById('settingSearchLimit').value;
    const warning = document.getElementById('searchLimitWarning');
    if (val === 'all') warning.classList.remove('hidden');
    else warning.classList.add('hidden');
}
function resetSettings() {
    document.getElementById('settingSearchSort').value = defaultSettings.searchSort;
    document.getElementById('settingSearchLimit').value = defaultSettings.searchLimit;
    const hScroll = document.getElementById('settingHorizontalScroll');
    if (hScroll) hScroll.checked = defaultSettings.horizontalScroll;
    renderColumnSettingsList(defaultSettings.listColumns);
    checkSearchLimitWarning();
}
function renderColumnSettingsList(columnsToRender) {
    const container = document.getElementById('columnSettingsList');
    container.innerHTML = '';
    const cols = columnsToRender || appSettings.listColumns;
    cols.forEach((col, index) => {
        const div = document.createElement('div');
        div.className = 'column-item';
        div.draggable = true;
        div.dataset.key = col.key;
        div.innerHTML = `
                <div class="column-handle" style="cursor: grab;">☰</div>
                <input type="checkbox" class="column-checkbox" ${col.visible ? 'checked' : ''}>
                <span class="column-name">${escapeHtml(col.label)}</span>
                <div class="column-move-btns">
                    <button class="move-btn" onclick="moveColumn(${index}, -1)" ${index === 0 ? 'disabled' : ''}>▲</button>
                    <button class="move-btn" onclick="moveColumn(${index}, 1)" ${index === cols.length - 1 ? 'disabled' : ''}>▼</button>
                </div>
            `;
        div.addEventListener('dragstart', handleDragStart, false);
        div.addEventListener('dragenter', handleDragEnter, false);
        div.addEventListener('dragover', handleDragOver, false);
        div.addEventListener('dragleave', handleDragLeave, false);
        div.addEventListener('drop', handleDrop, false);
        div.addEventListener('dragend', handleDragEnd, false);
        container.appendChild(div);
    });
}
let dragSrcEl = null;
function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
    this.classList.add('dragging');
}
function handleDragOver(e) {
    if (e.preventDefault) { e.preventDefault(); }
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    return false;
}
function handleDragEnter(e) { this.classList.add('drag-over'); }
function handleDragLeave(e) { this.classList.remove('drag-over'); }
function handleDrop(e) {
    if (e.stopPropagation) { e.stopPropagation(); }
    if (dragSrcEl !== this) {
        const container = document.getElementById('columnSettingsList');
        const allItems = [...container.querySelectorAll('.column-item')];
        const srcIndex = allItems.indexOf(dragSrcEl);
        const dstIndex = allItems.indexOf(this);
        if (srcIndex < dstIndex) {
            container.insertBefore(dragSrcEl, this.nextSibling);
        } else {
            container.insertBefore(dragSrcEl, this);
        }
        updateMoveButtons();
    }
    return false;
}
function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.column-item').forEach(item => item.classList.remove('drag-over'));
}
function moveColumn(index, direction) {
    const colList = document.getElementById('columnSettingsList');
    const items = Array.from(colList.querySelectorAll('.column-item'));
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const currentItem = items[index];
    const swapItem = items[newIndex];
    if (direction < 0) {
        colList.insertBefore(currentItem, swapItem);
    } else {
        colList.insertBefore(swapItem, currentItem);
    }
    updateMoveButtons();
}
function updateMoveButtons() {
    const colList = document.getElementById('columnSettingsList');
    const items = colList.querySelectorAll('.column-item');
    items.forEach((item, index) => {
        const btns = item.querySelectorAll('.move-btn');
        btns[0].disabled = (index === 0);
        btns[0].setAttribute('onclick', `moveColumn(${index}, -1)`);
        btns[1].disabled = (index === items.length - 1);
        btns[1].setAttribute('onclick', `moveColumn(${index}, 1)`);
    });
}
function renderListHeader() {
    const thead = document.querySelector('#songsTable thead tr');
    let html = '';
    appSettings.listColumns.forEach(col => {
        if (col.visible) {
            html += `<th onclick="sortTable('${col.key}')">${escapeHtml(col.label)} ↕</th>`;
        }
    });
    thead.innerHTML = html;
}

function initDragScroll() {
    const searchType = document.querySelector('.search-type');
    let isDown = false;
    let startX;
    let scrollLeft;
    searchType.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - searchType.offsetLeft;
        scrollLeft = searchType.scrollLeft;
        searchType.style.cursor = 'grabbing';
        searchType.style.setProperty('--hide-arrow', 'none');
    });
    searchType.addEventListener('mouseleave', () => {
        isDown = false;
        searchType.style.cursor = 'grab';
    });
    searchType.addEventListener('mouseup', () => {
        isDown = false;
        searchType.style.cursor = 'grab';
    });
    searchType.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - searchType.offsetLeft;
        const walk = (x - startX) * 1;
        searchType.scrollLeft = scrollLeft - walk;
    });
    searchType.style.cursor = 'grab';
}
function initScrollToTopBtn() {
    const scrollBtn = document.getElementById('scrollToTopBtn');
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            scrollBtn.classList.add('show');
        } else {
            scrollBtn.classList.remove('show');
        }
    });
}
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}
function toggleMenu() {
    const menu = document.getElementById('burgerMenu');
    const overlay = document.getElementById('menuOverlay');
    const btn = document.getElementById('burgerBtn');
    menu.classList.toggle('hidden');
    overlay.classList.toggle('hidden');
    btn.classList.toggle('open');
}
function closeMenu() {
    const menu = document.getElementById('burgerMenu');
    const overlay = document.getElementById('menuOverlay');
    const btn = document.getElementById('burgerBtn');
    menu.classList.add('hidden');
    overlay.classList.add('hidden');
    btn.classList.remove('open');
}
function showAboutPopup() {
    closeMenu();
    const popup = document.getElementById('aboutPopup');
    popup.classList.remove('hidden');
}
function closeAboutPopup(event) {
    if (event && event.target.id !== 'aboutPopup') return;
    const popup = document.getElementById('aboutPopup');
    popup.classList.add('hidden');
}
function toggleTieupDelete() {
    const deleteCheckbox = document.querySelector('input[name="reportTieupDelete"]');
    const tieupCheckbox = document.querySelector('input[name="reportTieup"]');
    const tieupInput = document.getElementById('reportNewTieup');
    
    if (deleteCheckbox.checked) {
        // 削除がONの場合
        tieupInput.value = '';
        tieupInput.readOnly = true;
        tieupCheckbox.checked = true;
        tieupCheckbox.disabled = true;
    } else {
        // 削除がOFFの場合
        tieupInput.readOnly = false;
        tieupCheckbox.disabled = false;
        tieupCheckbox.checked = false;  // チェックを自動的にOFFにする
        tieupInput.value = '';
        tieupInput.disabled = true;
    }
    updateReportButtonDisabledState();
}
function closeDetailReportPopup(event) {
    if (event && event.target.id !== 'detailReportPopup') return;
    const popup = document.getElementById('detailReportPopup');
    popup.classList.add('hidden');
    // フォームをリセット
    document.getElementById('detailReportForm').reset();
}

function showThankYouPopup() {
    const popup = document.getElementById('thanksPopup');
    popup.classList.remove('hidden');
    // 自動閉じる機能を追加（オプション：3秒後に自動で閉じる）
    // setTimeout(() => {
    //     closeThankYouPopup();
    //     closeSongDetail();
    // }, 3000);
}

function closeThankYouPopup(event) {
    if (event && event.target.id !== 'thanksPopup') return;
    const popup = document.getElementById('thanksPopup');
    popup.classList.add('hidden');
    closeSongDetail();
}

function showDetailReportPopup() {
    const popup = document.getElementById('detailReportPopup');
    popup.classList.remove('hidden');
    
    // 詳細画面から曲情報を取得
    const content = document.getElementById('songDetailContent');
    const songTitle = content.querySelector('[style*="font-size: 16px; font-weight: bold"]')?.textContent || '';
    
    // allSongsから該当する曲を探す
    const song = allSongs.find(s => s['曲名'] === songTitle);
    if (!song) {
        document.getElementById('detailReportForm').reset();
        return;
    }
    
    // 初期値を設定し、data-original属性に元の値を保存
    const fields = [
        { id: 'detailReportNewSongName', key: '曲名' },
        { id: 'detailReportNewArtist', key: 'アーティスト' },
        { id: 'detailReportNewSongYomi', key: '曲名の読み' },
        { id: 'detailReportNewArtistYomi', key: 'アーティストの読み' },
        { id: 'detailReportNewTieup', key: 'タイアップ' },
        { id: 'detailReportNewGenre1', key: 'ジャンル1' },
        { id: 'detailReportNewGenre2', key: 'ジャンル2' },
        { id: 'detailReportNewGenre3', key: 'ジャンル3' },
        { id: 'detailReportNewSeason', key: '季節' }
    ];
    
    fields.forEach(field => {
        const el = document.getElementById(field.id);
        const value = song[field.key] || '';
        el.value = value;
        el.dataset.original = value; // 元の値を保存
    });
    
    document.getElementById('detailReporterName').value = '';
    
    // タグを表示
    const genre1Tag = document.getElementById('detailReportGenre1Tag');
    const genre2Tag = document.getElementById('detailReportGenre2Tag');
    const genre3Tag = document.getElementById('detailReportGenre3Tag');
    const seasonTag = document.getElementById('detailReportSeasonTag');
    
    genre1Tag.textContent = song['ジャンル1'] ? `${song['ジャンル1']}` : '';
    genre2Tag.textContent = song['ジャンル2'] ? `${song['ジャンル2']}` : '';
    genre3Tag.textContent = song['ジャンル3'] ? `${song['ジャンル3']}` : '';
    seasonTag.textContent = song['季節'] ? `${song['季節']}` : '';
    
    // タグにカラーを適用
    if (song['ジャンル1']) {
        const color = getTagColor(song['ジャンル1'], true);
        genre1Tag.style.backgroundColor = color.bg;
        genre1Tag.style.color = color.text;
    }
    if (song['ジャンル2']) {
        const color = getTagColor(song['ジャンル2'], true);
        genre2Tag.style.backgroundColor = color.bg;
        genre2Tag.style.color = color.text;
    }
    if (song['ジャンル3']) {
        const color = getTagColor(song['ジャンル3'], true);
        genre3Tag.style.backgroundColor = color.bg;
        genre3Tag.style.color = color.text;
    }
    if (song['季節']) {
        seasonTag.style.backgroundColor = '#FFE0B2';
        seasonTag.style.color = '#E65100';
    }
    
    // アートワークプレビューを表示
    const artworkPreview = document.getElementById('detailReportArtworkPreview');
    if (song['アートワークURL']) {
        artworkPreview.innerHTML = `<img src="${escapeHtml(song['アートワークURL'])}" style="max-width: 200px; height: auto; margin-top: 8px; border-radius: 4px; border: 1px solid #e2e8f0;">`;
    } else {
        artworkPreview.innerHTML = '';
    }
    
    // オーディオプレビューを表示
    const audioPreview = document.getElementById('detailReportPreviewAudio');
    if (song['プレビューURL']) {
        audioPreview.innerHTML = `<audio controls controlsList="nodownload noplaybackrate" oncanplay="this.volume = 0.1; this.oncanplay = null;" style="width: 100%; height: 32px; margin-top: 8px;">
            <source src="${escapeHtml(song['プレビューURL'])}" type="audio/mpeg">
            ブラウザはオーディオ再生をサポートしていません
        </audio>`;
    } else {
        audioPreview.innerHTML = '';
    }
    
    // フォームをリセット
    document.querySelectorAll('#detailReportForm input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    document.querySelectorAll('#detailReportForm input[type="text"][id^="detailReportNew"]').forEach(input => {
        input.disabled = true;
    });
    
    updateDetailReportButtonDisabledState();
}

function toggleDetailReportField(checkbox, inputId) {
    const input = document.getElementById(inputId);
    if (checkbox.checked) {
        input.disabled = false;
        input.focus();
    } else {
        input.disabled = true;
        // 元の値を復元
        input.value = input.dataset.original || '';
    }
    updateDetailReportButtonDisabledState();
}

function toggleDetailGenreDelete(genreNum) {
    const deleteCheckbox = document.querySelector(`input[name="detailReportGenre${genreNum}Delete"]`);
    const genreCheckbox = document.querySelector(`input[name="detailReportGenre${genreNum}"]`);
    const genreInput = document.getElementById(`detailReportNewGenre${genreNum}`);
    
    if (deleteCheckbox.checked) {
        // 削除がONの場合
        genreInput.value = document.querySelector(`#detailReportGenre${genreNum}Tag`)?.textContent || '';
        genreInput.readOnly = true;
        genreCheckbox.checked = true;
        genreCheckbox.disabled = true;
    } else {
        // 削除がOFFの場合
        genreInput.readOnly = false;
        genreCheckbox.disabled = false;
        genreCheckbox.checked = false;  // チェックを自動的にOFFにする
        genreInput.value = document.querySelector(`#detailReportGenre${genreNum}Tag`)?.textContent || '';
        genreInput.disabled = true;
    }
    updateDetailReportButtonDisabledState();
}

function toggleDetailSeasonDelete() {
    const deleteCheckbox = document.querySelector('input[name="detailReportSeasonDelete"]');
    const seasonCheckbox = document.querySelector('input[name="detailReportSeason"]');
    const seasonInput = document.getElementById('detailReportNewSeason');
    
    if (deleteCheckbox.checked) {
        // 削除がONの場合
        seasonInput.value = document.getElementById('detailReportSeasonTag')?.textContent || '';
        seasonInput.readOnly = true;
        seasonCheckbox.checked = true;
        seasonCheckbox.disabled = true;
    } else {
        // 削除がOFFの場合
        seasonInput.readOnly = false;
        seasonCheckbox.disabled = false;
        seasonCheckbox.checked = false;  // チェックを自動的にOFFにする
        seasonInput.value = document.getElementById('detailReportSeasonTag')?.textContent || '';
        seasonInput.disabled = true;
    }
    updateDetailReportButtonDisabledState();
}

function toggleDetailTieupDelete() {
    const deleteCheckbox = document.querySelector('input[name="detailReportTieupDelete"]');
    const tieupCheckbox = document.querySelector('input[name="detailReportTieup"]');
    const tieupInput = document.getElementById('detailReportNewTieup');
    
    if (deleteCheckbox.checked) {
        // 削除がONの場合
        tieupInput.value = '';
        tieupInput.readOnly = true;
        tieupCheckbox.checked = true;
        tieupCheckbox.disabled = true;
    } else {
        // 削除がOFFの場合
        tieupInput.readOnly = false;
        tieupCheckbox.disabled = false;
        tieupCheckbox.checked = false;  // チェックを自動的にOFFにする
        tieupInput.value = '';
        tieupInput.disabled = true;
    }
    updateDetailReportButtonDisabledState();
}

function updateDetailReportButtonDisabledState() {
    const submitBtn = document.querySelector('#detailReportPopup .popup-submit-btn');
    const isAnyChecked = document.querySelectorAll('#detailReportPopup input[type="checkbox"]:checked').length > 0;
    submitBtn.disabled = !isAnyChecked;
}

function submitDetailReport() {
    if (!allSongs || allSongs.length === 0) return;
    
    // 詳細画面から曲を特定
    const content = document.getElementById('songDetailContent');
    const songTitle = content.querySelector('[style*="font-size: 16px; font-weight: bold"]')?.textContent || '';
    
    // allSongsから該当する曲を探す
    const song = allSongs.find(s => s['曲名'] === songTitle);
    if (!song) return;
    
    const checkedItems = [];
    const updates = {};
    
    // 曲名
    const songNameCheckbox = document.querySelector('input[name="detailReportSongName"]');
    if (songNameCheckbox.checked) {
        checkedItems.push('曲名');
        const input = document.getElementById('detailReportNewSongName');
        updates['修正後曲名'] = input.value.trim();
    }
    
    // アーティスト
    const artistCheckbox = document.querySelector('input[name="detailReportArtist"]');
    if (artistCheckbox.checked) {
        checkedItems.push('アーティスト');
        const input = document.getElementById('detailReportNewArtist');
        updates['修正後アーティスト'] = input.value.trim();
    }
    
    // 曲名のよみがな
    const songYomiCheckbox = document.querySelector('input[name="detailReportSongYomi"]');
    if (songYomiCheckbox.checked) {
        checkedItems.push('曲名のよみがな');
        const input = document.getElementById('detailReportNewSongYomi');
        updates['修正後曲名の読み'] = input.value.trim();
    }
    
    // アーティストのよみがな
    const artistYomiCheckbox = document.querySelector('input[name="detailReportArtistYomi"]');
    if (artistYomiCheckbox.checked) {
        checkedItems.push('アーティストのよみがな');
        const input = document.getElementById('detailReportNewArtistYomi');
        updates['修正後アーティストの読み'] = input.value.trim();
    }
    
    // タイアップ
    const tieupCheckbox = document.querySelector('input[name="detailReportTieup"]');
    const tieupDeleteCheckbox = document.querySelector('input[name="detailReportTieupDelete"]');
    if (tieupCheckbox.checked) {
        checkedItems.push('タイアップ');
        const input = document.getElementById('detailReportNewTieup');
        updates['修正後タイアップ'] = input.value.trim();
    }
    if (tieupDeleteCheckbox.checked) {
        checkedItems.push('タイアップ');
        updates['修正後タイアップ'] = '';
    }
    
    // ジャンル1
    const genre1Checkbox = document.querySelector('input[name="detailReportGenre1"]');
    const genre1DeleteCheckbox = document.querySelector('input[name="detailReportGenre1Delete"]');
    if (genre1Checkbox.checked) {
        checkedItems.push('ジャンル1');
        const input = document.getElementById('detailReportNewGenre1');
        updates['修正後ジャンル1'] = input.value.trim();
    }
    if (genre1DeleteCheckbox.checked) {
        checkedItems.push('ジャンル1');
        updates['修正後ジャンル1'] = '';
    }
    
    // ジャンル2
    const genre2Checkbox = document.querySelector('input[name="detailReportGenre2"]');
    const genre2DeleteCheckbox = document.querySelector('input[name="detailReportGenre2Delete"]');
    if (genre2Checkbox.checked) {
        checkedItems.push('ジャンル2');
        const input = document.getElementById('detailReportNewGenre2');
        updates['修正後ジャンル2'] = input.value.trim();
    }
    if (genre2DeleteCheckbox.checked) {
        checkedItems.push('ジャンル2');
        updates['修正後ジャンル2'] = '';
    }
    
    // ジャンル3
    const genre3Checkbox = document.querySelector('input[name="detailReportGenre3"]');
    const genre3DeleteCheckbox = document.querySelector('input[name="detailReportGenre3Delete"]');
    if (genre3Checkbox.checked) {
        checkedItems.push('ジャンル3');
        const input = document.getElementById('detailReportNewGenre3');
        updates['修正後ジャンル3'] = input.value.trim();
    }
    if (genre3DeleteCheckbox.checked) {
        checkedItems.push('ジャンル3');
        updates['修正後ジャンル3'] = '';
    }
    
    // 季節
    const seasonCheckbox = document.querySelector('input[name="detailReportSeason"]');
    const seasonDeleteCheckbox = document.querySelector('input[name="detailReportSeasonDelete"]');
    if (seasonCheckbox.checked) {
        checkedItems.push('季節');
        const input = document.getElementById('detailReportNewSeason');
        updates['修正後季節'] = input.value.trim();
    }
    if (seasonDeleteCheckbox.checked) {
        checkedItems.push('季節');
        updates['修正後季節'] = '';
    }
    
    // ジャケット写真
    const artworkCheckbox = document.querySelector('input[name="detailReportArtwork"]');
    if (artworkCheckbox.checked) {
        checkedItems.push('ジャケット写真がおかしい');
    }
    
    // サンプル音楽
    const previewCheckbox = document.querySelector('input[name="detailReportPreview"]');
    if (previewCheckbox.checked) {
        checkedItems.push('サンプル音楽がおかしい');
    }
    
    const reasonText = checkedItems.join('、') + (checkedItems.length > 0 ? 'が誤っている' : '');
    
    const detailsNonDisplay = [];
    if (artworkCheckbox.checked) detailsNonDisplay.push('ジャケット写真がおかしい');
    if (previewCheckbox.checked) detailsNonDisplay.push('サンプル音楽がおかしい');
    
    const reportData = {
        理由: reasonText,
        修正前曲名: song['曲名'] || '',
        修正前アーティスト: song['アーティスト'] || '',
        修正前曲名の読み: song['曲名の読み'] || '',
        修正前アーティストの読み: song['アーティストの読み'] || '',
        修正前タイアップ: song['タイアップ'] || '',
        修正前ジャンル1: song['ジャンル1'] || '',
        修正前ジャンル2: song['ジャンル2'] || '',
        修正前ジャンル3: song['ジャンル3'] || '',
        修正前季節: song['季節'] || '',
        修正後曲名: updates['修正後曲名'] !== undefined ? updates['修正後曲名'] : '',
        修正後アーティスト: updates['修正後アーティスト'] !== undefined ? updates['修正後アーティスト'] : '',
        修正後曲名の読み: updates['修正後曲名の読み'] !== undefined ? updates['修正後曲名の読み'] : '',
        修正後アーティストの読み: updates['修正後アーティストの読み'] !== undefined ? updates['修正後アーティストの読み'] : '',
        修正後タイアップ: updates['修正後タイアップ'] !== undefined ? updates['修正後タイアップ'] : '',
        修正後ジャンル1: updates['修正後ジャンル1'] !== undefined ? updates['修正後ジャンル1'] : '',
        修正後ジャンル2: updates['修正後ジャンル2'] !== undefined ? updates['修正後ジャンル2'] : '',
        修正後ジャンル3: updates['修正後ジャンル3'] !== undefined ? updates['修正後ジャンル3'] : '',
        修正後季節: updates['修正後季節'] !== undefined ? updates['修正後季節'] : '',
        詳細非表示: detailsNonDisplay.join('、'),
        依頼者名: document.getElementById('detailReporterName').value || '匿名'
    };
    
    const submitBtn = document.querySelector('#detailReportPopup .popup-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中...';
    const baseUrl = 'https://script.google.com/macros/s/AKfycbz1xZ1M2AWkHuDFkOy9Hb3sY3r7M7quHtnT4lVZqHV1SNikVds7K-gFDCURHRpR7T-4/exec';
    
    // GETで送信（URLパラメータ）
    const params = Object.keys(reportData)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(reportData[key]))
        .join('&');
    const url = baseUrl + '?' + params;
    
    fetch(url, { method: 'GET' })
        .then(response => response.text())
        .then(data => {
            // 詳細レポートポップアップを閉じる
            closeDetailReportPopup();
            // 感謝メッセージポップアップを表示
            showThankYouPopup();
            submitBtn.disabled = false;
            submitBtn.textContent = '報告する';
        })
        .catch(error => {
            console.error('Detail report error:', error);
            alert('報告の送信に失敗しました。もう一度お試しください。');
            submitBtn.disabled = false;
            submitBtn.textContent = '報告する';
        });
}
function forceRefresh() {
    closeMenu();
    document.getElementById('loadingOverlay').classList.remove('hidden');
    let currentTab = 'search';
    if (document.getElementById('list-tab').classList.contains('active')) {
        currentTab = 'list';
    }
    localStorage.setItem('lastActiveTab', currentTab);
    localStorage.removeItem('songData');
    localStorage.removeItem('lastFetchTime');
    fetchFreshSongData();
}
function changeItemsPerPage() {
    const val = document.getElementById('itemsPerPage').value;
    if (val === 'all') {
        itemsPerPage = filteredListSongs.length > 0 ? filteredListSongs.length : 10000;
    } else {
        itemsPerPage = parseInt(val, 10);
    }
    currentPage = 1;
    renderListTable();
}
function performSearch() {
    var query = document.getElementById('searchQuery').value.trim();
    var queryLower = query.toLowerCase();
    var searchType = document.querySelector('input[name="searchType"]:checked').value;
    var resultsDiv = document.getElementById('searchResults');
    var countSpan = document.getElementById('resultCountInline');
    var noResults = document.getElementById('noSearchResults');
    resultsDiv.innerHTML = '';
    
    // キーワードなし且つタグも選択なし → 何も表示しない
    if (!query && selectedSeasons.length === 0 && selectedGenres.length === 0 && selectedDecades.length === 0) {
        countSpan.textContent = '';
        noResults.style.display = 'none';
        return;
    }
    
    let results = allSongs.filter(song => {
        // タグフィルターを先に確認
        if (!matchesTags(song)) return false;
        
        // キーワード入力がなければタグマッチのみで通す
        if (!query) return true;
        
        const title = (song['曲名'] || '').toLowerCase();
        const titleYomi = (song['曲名の読み'] || '').toLowerCase().replace(/ /g, '');
        const artist = (song['アーティスト'] || '').toLowerCase();
        const artistYomi = (song['アーティストの読み'] || '').toLowerCase().replace(/ /g, '');
        const tieup = (song['タイアップ'] || '').toLowerCase();
        let keywordMatch = false;
        if (searchType === 'song') keywordMatch = title.includes(queryLower) || titleYomi.includes(queryLower);
        else if (searchType === 'artist') keywordMatch = artist.includes(queryLower) || artistYomi.includes(queryLower);
        else if (searchType === 'tieup') keywordMatch = tieup.includes(queryLower);
        else keywordMatch = title.includes(queryLower) || titleYomi.includes(queryLower) ||
            artist.includes(queryLower) || artistYomi.includes(queryLower) ||
            tieup.includes(queryLower);
        
        return keywordMatch;
    });
    
    if (appSettings && appSettings.searchSort) {
        const key = appSettings.searchSort;
        const asc = (key !== '最終演奏' && key !== '演奏回数');
        results.sort((a, b) => {
            let valA = a[key] ?? '';
            let valB = b[key] ?? '';
            if (key === '演奏回数') { valA = parseInt(valA) || 0; valB = parseInt(valB) || 0; }
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
        });
    }
    
    if (results.length === 0) {
        countSpan.textContent = '0件';
        noResults.style.display = 'block';
    } else {
        countSpan.textContent = results.length + '件';
        noResults.style.display = 'none';
        let displayLimit = 50;
        if (appSettings && appSettings.searchLimit) {
            if (appSettings.searchLimit === 'all') {
                displayLimit = results.length;
            } else {
                displayLimit = parseInt(appSettings.searchLimit, 10);
            }
        }
        const displayResults = results.slice(0, displayLimit);
        let html = '';
        displayResults.forEach(song => { html += createResultItem(song, query); });
        if (results.length > displayLimit) {
            html += '<div style="text-align:center; padding:10px; color:#aaa;">他 ' + (results.length - displayLimit) + ' 件... (設定で表示件数を変更できます)</div>';
        }
        resultsDiv.innerHTML = html;
    }
}
function createResultItem(song, query) {
    const date = song['最終演奏'] ? formatDate(song['最終演奏']) : '-';
    const count = song['演奏回数'] || 0;
    const title = song['曲名'] || '不明';
    const artist = song['アーティスト'] || '不明';
    const titleYomi = song['曲名の読み'] || '';
    const artistYomi = song['アーティストの読み'] || '';
    const tieup = song['タイアップ'] || '';
    const artwork = song['アートワークURL'] || '';
    const hTitle = highlightText(title, query);
    const hArtist = highlightText(artist, query);
    const hTitleYomi = highlightText(titleYomi, query);
    const hArtistYomi = highlightText(artistYomi, query);
    const hTieup = highlightText(tieup, query);
    const copyText = title + '／' + artist;
    let yomiDisplay = (titleYomi || artistYomi) ? `<div class="song-yomi">${hTitleYomi} ${artistYomi ? '/ ' + hArtistYomi : ''}</div>` : '';
    let tieupDisplay = tieup ? `<div class="song-tieup"><div class="tv-icon-20"></div><span>${hTieup}</span></div>` : '';
    const tagsDisplay = createTagsHTML(song);
    const songIndex = allSongs.indexOf(song);
    const detailBtnClass = artwork ? 'detail-btn-with-artwork' : 'detail-btn-no-artwork';
    let buttonHTML = `<button class="copy-button ${detailBtnClass}" onclick="openSongDetail(${songIndex})" style="bottom: 53px;">詳細</button>`
                          + `<button class="copy-button" onclick="copyToClipboard('${escapeQuotes(copyText)}')">コピー</button>`;
    return `
        <div class="result-item">
            <div class="song-title">${hTitle}</div>
            <div class="song-artist">${hArtist}</div>
            ${yomiDisplay}
            ${tieupDisplay}
            ${`<div class="song-meta">
                  <span>演奏回数: ${count}回</span>
                  <span>最終演奏: ${date}</span>
                </div>`
        }
            ${tagsDisplay}
            ${buttonHTML}
        </div>
      `;
}
function filterList() {
    const query = document.getElementById('listFilter').value.trim().toLowerCase();
    const normalizedQuery = query.replace(/ /g, ''); // スペースを除去した検索キーを作成
    filteredListSongs = !query ? [...allSongs] : allSongs.filter(song =>
        (song['曲名'] || '').toLowerCase().includes(query) ||
        (song['曲名の読み'] || '').toLowerCase().replace(/ /g, '').includes(normalizedQuery) ||
        (song['アーティスト'] || '').toLowerCase().includes(query) ||
        (song['アーティストの読み'] || '').toLowerCase().replace(/ /g, '').includes(normalizedQuery) ||
        (song['タイアップ'] || '').toLowerCase().includes(query)
    );
    console.log('filterList:', filteredListSongs.length, 'songs after filter');
    sortData(currentSort.key, currentSort.ascending);
    currentPage = 1;
    renderListTable();
}
function sortTable(key) {
    if (currentSort.key === key) {
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.key = key;
        currentSort.ascending = (key !== '最終演奏' && key !== '演奏回数');
    }
    sortData(currentSort.key, currentSort.ascending);
    renderListTable();
}
function sortData(key, ascending) {
    filteredListSongs.sort((a, b) => {
        let valA = a[key] ?? '';
        let valB = b[key] ?? '';
        if (key === '演奏回数') { valA = parseInt(valA) || 0; valB = parseInt(valB) || 0; }
        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
    });
}
function renderListTable() {
    console.log('renderListTable called, filteredListSongs.length=', filteredListSongs.length);
    const tbody = document.getElementById('songListBody');
    tbody.innerHTML = '';
    const table = document.getElementById('songsTable');
    if (appSettings.horizontalScroll) {
        table.classList.add('nowrap-table');
    } else {
        table.classList.remove('nowrap-table');
    }
    if (filteredListSongs.length === 0) {
        const visibleCols = appSettings.listColumns.filter(c => c.visible).length + (0);
        tbody.innerHTML = `<tr><td colspan="${visibleCols}" style="text-align:center; padding:20px;">該当する曲がありません</td></tr>`;
        renderPagination(0);
        return;
    }
    const start = (currentPage - 1) * itemsPerPage;
    const pageItems = filteredListSongs.slice(start, start + itemsPerPage);
    console.log('Rendering', pageItems.length, 'songs');
    tbody.innerHTML = pageItems.map((song, idx) => {
        let rowHtml = '';
        const songIndex = allSongs.indexOf(song);
        const isSelected = (song === window.selectedListSong) ? ' list-detail-selected' : '';
        rowHtml = `<tr class="list-row-selectable${isSelected}" onclick="selectListRowForDetail(${start + idx}, event)">`;
        appSettings.listColumns.forEach(col => {
            if (col.visible) {
                let displayVal = '';
                if (col.key === 'タグ') {
                    // タグ列
                    displayVal = createTagsHTML(song);
                } else {
                    let val = song[col.key];
                    displayVal = escapeHtml(val);
                    if (col.key === '最終演奏') {
                        displayVal = `<span style="font-size:0.9em; color:#666;">${val ? formatDate(val) : '-'}</span>`;
                    } else if (col.key === '演奏回数') {
                        displayVal = `<div style="text-align:center;">${val || 0}</div>`;
                    }
                }
                rowHtml += `<td>${displayVal}</td>`;
            }
        });
        rowHtml += '</tr>';
        return rowHtml;
    }).join('');
    renderPagination(Math.ceil(filteredListSongs.length / itemsPerPage));
}
function renderPagination(totalPages) {
    renderPaginationContainer(document.getElementById('listPaginationTop'), totalPages);
    renderPaginationContainer(document.getElementById('listPaginationBottom'), totalPages);
}
function renderPaginationContainer(container, totalPages) {
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;
    let paddingPage = (window.innerWidth > 600) ? 1 : 0;
    const isWide = (window.innerWidth > 500);
    const paddingStart = 1 + paddingPage;
    const paddingEnd = 2 + (2 * paddingPage);
    let start = Math.max(1, currentPage - paddingStart);
    let end = Math.min(totalPages, start + paddingEnd);
    if (end - start < paddingEnd) start = Math.max(1, end - paddingEnd);
    if (currentPage > 1) {
        if (isWide) container.appendChild(createPageBtn('|<<', 1));
        container.appendChild(createPageBtn('<', currentPage - 1));
    }
    for (let i = start; i <= end; i++) container.appendChild(createPageBtn(i, i));
    if (currentPage < totalPages) {
        container.appendChild(createPageBtn('>', currentPage + 1));
        if (isWide) container.appendChild(createPageBtn('>>|', totalPages));
    }
}
function createPageBtn(text, pageNum) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (pageNum === currentPage ? ' active' : '');
    btn.textContent = text;
    btn.onclick = () => {
        currentPage = pageNum;
        renderListTable();
        document.querySelector('.list-controls').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return btn;
}
function highlightText(text, query) {
    if (!query || !text) return escapeHtml(text);
    
    // 正規化（スペース削除）
    const normalizedText = text.replace(/ /g, '');
    const normalizedQuery = escapeRegex(query.replace(/ /g, ''));
    const searchRegex = new RegExp(normalizedQuery, 'gi');
    
    // 正規化されたテキスト上でマッチを取得
    const matches = [];
    let match;
    while ((match = searchRegex.exec(normalizedText)) !== null) {
        matches.push({ start: match.index, end: match.index + match[0].length });
    }
    
    // 正規化前テキストのスペース位置をマップ: normalizedIndex → originalIndex
    const indexMap = {};
    let normalizedIdx = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] !== ' ') {
            indexMap[normalizedIdx] = i;
            normalizedIdx++;
        }
    }
    // 最後のインデックスもマップ
    indexMap[normalizedIdx] = text.length;
    
    // マッチ位置を元のテキスト上の位置に変換
    const originalMatches = matches.map(m => ({
        start: indexMap[m.start],
        end: indexMap[m.end]
    }));
    
    // マッチ位置を記録しながら、文字ごとにエスケープしてハイライトを適用
    let result = '';
    let inHighlight = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        // このインデックスがマッチ範囲内かを確認
        const isInMatch = originalMatches.some(m => i >= m.start && i < m.end);
        
        // ハイライト状態の変化
        if (isInMatch && !inHighlight) {
            result += '<span class="highlight">';
            inHighlight = true;
        } else if (!isInMatch && inHighlight) {
            result += '</span>';
            inHighlight = false;
        }
        
        // 文字をエスケープ
        if (char === '&') result += '&amp;';
        else if (char === '<') result += '&lt;';
        else if (char === '>') result += '&gt;';
        else if (char === '"') result += '&quot;';
        else if (char === "'") result += '&#039;';
        else result += char;
    }
    
    // 最後に開いているタグを閉じる
    if (inHighlight) {
        result += '</span>';
    }
    
    return result;
}
function escapeRegex(string) { 
    // 正規表現のメタ文字をエスケープ
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}
function escapeHtml(text) {
    return String(text ?? '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function escapeQuotes(text) { return text.replace(/'/g, "\\'").replace(/"/g, '\\"'); }

// ISO形式の日付をYYYY/MM/DD形式にフォーマット
function formatDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return dateStr;
    // ISO形式（2026-01-20T14:02:04.000Z）を処理
    if (dateStr.includes('T')) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            return `${year}/${month}/${day}`;
        }
    }
    // すでにYYYY/MM/DD形式の場合はそのまま返す
    if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) return dateStr;
    return dateStr;
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showCopyToast).catch(() => fallbackCopy(text));
    } else { fallbackCopy(text); }
}
function fallbackCopy(text) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showCopyToast();
}
function showCopyToast() {
    const toast = document.getElementById('copyToast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchQuery');
    const searchClear = document.getElementById('searchClear');
    const searchRadios = document.querySelectorAll('input[name="searchType"]');
    function updateSearchClear() {
        searchClear.classList.toggle('visible', searchInput.value.length > 0);
    }
    searchInput.addEventListener('input', function () {
        updateSearchClear();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 300);
    });
    searchClear.addEventListener('click', function () {
        searchInput.value = '';
        updateSearchClear();
        searchInput.focus();
        performSearch();
    });
    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { 
            e.preventDefault();
            clearTimeout(searchTimeout);  // ペンディング中のタイムアウトをクリア
            performSearch();  // 即座に検索を実行
            searchInput.blur();  // フォーカスを外す
        }
    });
    searchRadios.forEach(radio => radio.addEventListener('change', performSearch));
    const listFilter = document.getElementById('listFilter');
    const filterClear = document.getElementById('filterClear');
    function updateFilterClear() {
        filterClear.classList.toggle('visible', listFilter.value.length > 0);
    }
    listFilter.addEventListener('input', function () {
        updateFilterClear();
        clearTimeout(listFilterTimeout);
        listFilterTimeout = setTimeout(filterList, 300);
    });
    listFilter.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { 
            e.preventDefault();
            clearTimeout(listFilterTimeout);  // ペンディング中のタイムアウトをクリア
            filterList();  // 即座に検索を実行
            listFilter.blur();  // フォーカスを外す
        }
    });
    filterClear.addEventListener('click', function () {
        listFilter.value = '';
        updateFilterClear();
        listFilter.focus();
        filterList();
    });
    
    // メニュー以外をクリックするとメニューを閉じる
    document.addEventListener('click', function (e) {
        const burgerContainer = document.querySelector('.burger-container');
        const burgerMenu = document.getElementById('burgerMenu');
        const isMenuHidden = burgerMenu.classList.contains('hidden');
        
        // メニューが表示されている場合のみ
        if (!isMenuHidden) {
            // クリック対象がバーガーコンテナの内側でないならメニューを閉じる
            if (!burgerContainer.contains(e.target)) {
                closeMenu();
            }
        }
    });
});
window.onload = function () {
    initDragScroll();

    initScrollToTopBtn();
    loadSettings();
    fetch('https://vivaldy1.github.io/asaxmayo-msearch/live_streams.json?t=' + Date.now())
        .then(response => response.json())
        .then(data => {
            const ytLink = document.getElementById('ytLink');
            if (data.liveStreams && data.liveStreams.length > 0 && data.liveStreams[0].url) {
                const liveUrl = data.liveStreams[0].url;
                if (liveUrl.trim() !== '') {
                    ytLink.href = liveUrl;
                    ytLink.title = 'ライブ配信を開く';
                    const liveBadge = document.createElement('span');
                    liveBadge.className = 'live-badge';
                    liveBadge.textContent = 'LIVE';
                    ytLink.appendChild(liveBadge);
                }
            }
        })
        .catch(error => console.error('ライブ配信URL取得エラー:', error));
    console.log('Fetching fresh data');
    fetchFreshSongData();
};
function resetToHome() {
    // 検索キーワードをクリア
    const searchInput = document.getElementById('searchQuery');
    searchInput.value = '';
    const searchClear = document.getElementById('searchClear');
    if (searchClear) searchClear.classList.remove('visible');

    // 検索タイプを「全て」にリセット
    const allRadio = document.querySelector('input[name="searchType"][value="all"]');
    if (allRadio) allRadio.checked = true;

    // タグフィルターをリセット
    selectedSeasons = [];
    selectedGenres = [];
    selectedDecades = [];
    updateTagButtonAppearance();

    // 全曲一覧のフィルターをクリア
    const listFilter = document.getElementById('listFilter');
    if (listFilter) {
        listFilter.value = '';
        const filterClear = document.getElementById('filterClear');
        if (filterClear) filterClear.classList.remove('visible');
        filteredListSongs = [...allSongs];
        sortData(currentSort.key, currentSort.ascending);
        currentPage = 1;
    }

    // 検索タブに切り替え
    switchTab('search');

    // 検索結果をクリア（キーワードもタグも空なので空表示になる）
    performSearch();
}

function switchTab(tabName) {
    // リスト選択状態をリセット
    if (tabName !== 'list') {
        selectedListSong = null;
        const btnContainer = document.getElementById('listDetailButtonContainer');
        if (btnContainer) {
            btnContainer.classList.add('hidden');
        }
        updateListDetailButton();
        renderListTable()
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(tabName));
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.classList.add('hidden');
    });
    const target = document.getElementById(tabName + '-tab');
    target.classList.add('active');
    target.classList.remove('hidden');
}
function onDataLoaded(data, isCached) {
    console.log('onDataLoaded called with', data.length, 'songs');
    allSongs = data;
    filteredListSongs = [...allSongs];
    document.getElementById('loadingOverlay').classList.add('hidden');
    const lastTab = localStorage.getItem('lastActiveTab');
    if (lastTab === 'list') {
        switchTab('list');
        filterList();
    } else {
        switchTab('search');
        performSearch();
        if (!localStorage.getItem('initialFocusDone')) {
            const sq = document.getElementById('searchQuery');
            if (sq) sq.focus();
            localStorage.setItem('initialFocusDone', 'true');
        }
    }
    localStorage.removeItem('lastActiveTab');
    // 全曲一覧タブも常に最新の状態を保つ
    renderListTable();
}
function onError(error) {
    console.error(error);
    document.getElementById('loadingOverlay').innerHTML = '<div class="loading-text" style="color:white;">エラーが発生しました: ' + error.message + '</div><button onclick="location.reload()" style="padding:10px 20px; border-radius:5px; border:none; background:white; color:#764ba2; font-weight:bold; cursor:pointer;">再読み込み</button>';
}
function fetchFreshSongData() {
    fetch('https://vivaldy1.github.io/asaxmayo-msearch/data.json?t=' + Date.now())
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(responseData => {
            // 新しい形式（createdAt + data）と旧形式（配列）の両方に対応
            let songData, createdAt = null;
            if (Array.isArray(responseData)) {
                songData = responseData;
            } else {
                songData = responseData.data || [];
                createdAt = responseData.createdAt || null;
            }
            dataCreatedAt = createdAt;
            updateDataCreatedTimeDisplay();
            onDataLoaded(songData, false);
        })
        .catch(error => onError(error));
}

function updateDataCreatedTimeDisplay() {
    const timeElement = document.getElementById('dataCreatedTime');
    if (!timeElement) return;
    
    if (!dataCreatedAt) {
        timeElement.textContent = '';
        return;
    }
    
    try {
        const date = new Date(dataCreatedAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const formattedTime = `更新日時 ${year}/${month}/${day} ${hours}:${minutes}`;
        timeElement.textContent = formattedTime;
    } catch (e) {
        timeElement.textContent = '';
    }
}

// Tag Filter functionality
var selectedSeasons = [];
var selectedGenres = [];
var selectedDecades = []; // 年代フィルター用
var tagColorMap = {}; // Maps tag values to color indices

/**
 * 60色のタグ用カラーパレット
 * 構成: { bg: 背景色, text: 文字色 }
 */
const tagColors = [
    // 1-10
    { bg: '#FFE0B2', text: '#E65100' }, { bg: '#C8E6C9', text: '#1B5E20' },
    { bg: '#BBDEFB', text: '#0D47A1' }, { bg: '#F8BBD0', text: '#880E4F' },
    { bg: '#B3E5FC', text: '#01579B' }, { bg: '#E1BEE7', text: '#4A148C' },
    { bg: '#C5CAE9', text: '#1A237E' }, { bg: '#FFE0B2', text: '#BF360C' },
    { bg: '#F0F4C3', text: '#33691E' }, { bg: '#FCE4EC', text: '#C2185B' },
    // 11-20
    { bg: '#FFF9C4', text: '#F57F17' }, { bg: '#B2DFDB', text: '#004D40' },
    { bg: '#FFECB3', text: '#FF6F00' }, { bg: '#D1C4E9', text: '#311B92' },
    { bg: '#DCEDC8', text: '#33691E' }, { bg: '#B2EBF2', text: '#006064' },
    { bg: '#FFCCBC', text: '#BF360C' }, { bg: '#D7CCC8', text: '#3E2723' },
    { bg: '#F5F5F5', text: '#212121' }, { bg: '#CFD8DC', text: '#263238' },
    // 21-30 (Warm tones)
    { bg: '#FFF3E0', text: '#E65100' }, { bg: '#FBE9E7', text: '#D84315' },
    { bg: '#FFFDE7', text: '#827717' }, { bg: '#FFF8E1', text: '#FF8F00' },
    { bg: '#FEF9E7', text: '#9A7D0A' }, { bg: '#FDF2E9', text: '#A04000' },
    { bg: '#FBEEE6', text: '#922B21' }, { bg: '#F9EBEA', text: '#7B241C' },
    { bg: '#FDEDEC', text: '#943126' }, { bg: '#FEF5E7', text: '#7E5109' }
];

function getTagColor(tagValue, isGenre = false) {
    if (!tagValue || !tagValue.trim()) return { bg: '#f0f0f0', text: '#666' };
    
    // キーの作成（常に一貫性を保つ）
    const key = (isGenre ? 'g_' : 's_') + tagValue.trim();
    
    // 既にキャッシュされているなら返す
    if (tagColorMap[key] !== undefined) {
        return tagColors[tagColorMap[key]];
    }
    
    // 新しいタグの場合、色を割り当て（ハッシュ値に基づく一貫性）
    // 同じキーは常に同じ色を返すようにする
    let hashCode = 0;
    for (let i = 0; i < key.length; i++) {
        hashCode = ((hashCode << 5) - hashCode) + key.charCodeAt(i);
        hashCode = hashCode & hashCode; // 32-bit integer
    }
    
    const colorIndex = Math.abs(hashCode) % tagColors.length;
    tagColorMap[key] = colorIndex;
    
    return tagColors[colorIndex];
}

function extractAllTags() {
    const seasonOrder = ['春', '夏', '秋', '冬']; // 季節の固定順序
    const seasonCount = {}; // 季節の重複件数をカウント
    const genreCount = {}; // ジャンルの重複件数をカウント
    const decadeCount = {}; // 年代の重複件数をカウント
    
    allSongs.forEach(song => {
        if (song['季節'] && song['季節'].trim()) {
            const season = song['季節'].trim();
            seasonCount[season] = (seasonCount[season] || 0) + 1;
        }
        if (song['ジャンル1'] && song['ジャンル1'].trim()) {
            const genre = song['ジャンル1'].trim();
            genreCount[genre] = (genreCount[genre] || 0) + 1;
        }
        if (song['ジャンル2'] && song['ジャンル2'].trim()) {
            const genre = song['ジャンル2'].trim();
            genreCount[genre] = (genreCount[genre] || 0) + 1;
        }
        if (song['ジャンル3'] && song['ジャンル3'].trim()) {
            const genre = song['ジャンル3'].trim();
            genreCount[genre] = (genreCount[genre] || 0) + 1;
        }
        
        // 年代を計算
        if (song['リリース日'] && song['リリース日'].trim()) {
            const year = parseInt(song['リリース日'].substring(0, 4), 10);
            if (!isNaN(year)) {
                const decade = Math.floor(year / 10) * 10;
                const decadeLabel = decade + '年代';
                decadeCount[decadeLabel] = (decadeCount[decadeLabel] || 0) + 1;
            }
        }
    });
    
    // 季節を春夏秋冬の固定順で整列
    const sortedSeasons = seasonOrder
        .filter(season => seasonCount[season]) // データに存在する季節のみ
        .map(season => ({
            name: season,
            count: seasonCount[season]
        }));
    
    // ジャンルを件数でソート（降順）
    const sortedGenres = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .map(entry => ({
            name: entry[0],
            count: entry[1]
        }));
    
    // 年代を昇順でソート
    const sortedDecades = Object.entries(decadeCount)
        .sort((a, b) => a[0].localeCompare(b[0], 'ja'))
        .map(entry => ({
            name: entry[0],
            count: entry[1]
        }));
    
    return {
        seasons: sortedSeasons,
        genres: sortedGenres,
        decades: sortedDecades
    };
}

function showTagFilterPopup() {
    const tags = extractAllTags();
    
    // Season options (with count)
    const seasonOptions = document.getElementById('seasonFilterOptions');
    seasonOptions.innerHTML = '';
    tags.seasons.forEach(seasonObj => {
        const season = seasonObj.name;
        const count = seasonObj.count;
        seasonOptions.innerHTML += `<button class="tag-filter-option" data-value="${season}" onclick="toggleSeasonFilter(this, '${season}')">${season}(${count})</button>`;
    });
    
    // Genre options (with count)
    const genreOptions = document.getElementById('genreFilterOptions');
    genreOptions.innerHTML = '';
    tags.genres.forEach(genreObj => {
        const genre = genreObj.name;
        const count = genreObj.count;
        genreOptions.innerHTML += `<button class="tag-filter-option" data-value="${genre}" onclick="toggleGenreFilter(this, '${genre}')">${genre}(${count})</button>`;
    });
    
    // Decade options (with count)
    const decadeOptions = document.getElementById('decadeFilterOptions');
    if (decadeOptions) {
        decadeOptions.innerHTML = '';
        tags.decades.forEach(decadeObj => {
            const decade = decadeObj.name;
            const count = decadeObj.count;
            decadeOptions.innerHTML += `<button class="tag-filter-option" data-value="${decade}" onclick="toggleDecadeFilter(this, '${decade}')">${decade}(${count})</button>`;
        });
    }
    
    // Reset button states based on current filters
    if (selectedSeasons.length > 0) {
        selectedSeasons.forEach(season => {
            const btn = seasonOptions.querySelector(`[data-value="${season}"]`);
            if (btn) btn.classList.add('selected');
        });
    }
    
    if (selectedGenres.length > 0) {
        selectedGenres.forEach(genre => {
            const btn = genreOptions.querySelector(`[data-value="${genre}"]`);
            if (btn) btn.classList.add('selected');
        });
    }
    
    if (selectedDecades.length > 0 && decadeOptions) {
        selectedDecades.forEach(decade => {
            const btn = decadeOptions.querySelector(`[data-value="${decade}"]`);
            if (btn) btn.classList.add('selected');
        });
    }
    
    document.getElementById('tagFilterPopup').classList.remove('hidden');
    const content = document.getElementById('tagFilterPopup').querySelector('.popup-content');
    if (content) content.scrollTop = 0;
    
}

function toggleSeasonFilter(btn, season) {
    if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
        selectedSeasons = selectedSeasons.filter(s => s !== season);
    } else {
        btn.classList.add('selected');
        if (!selectedSeasons.includes(season)) {
            selectedSeasons.push(season);
        }
    }
}

function toggleGenreFilter(btn, genre) {
    if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
        selectedGenres = selectedGenres.filter(g => g !== genre);
    } else {
        btn.classList.add('selected');
        if (!selectedGenres.includes(genre)) {
            selectedGenres.push(genre);
        }
    }
}

function toggleDecadeFilter(btn, decade) {
    if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
        selectedDecades = selectedDecades.filter(d => d !== decade);
    } else {
        btn.classList.add('selected');
        if (!selectedDecades.includes(decade)) {
            selectedDecades.push(decade);
        }
    }
}

function applyTagFilter() {
    closeTagFilterPopup();
    updateTagButtonAppearance();
    performSearch();
}

function resetTagFilter() {
    // フィルターをリセット
    selectedSeasons = [];
    selectedGenres = [];
    selectedDecades = [];
    
    // UI上の選択状態をリセット
    const seasonOptions = document.getElementById('seasonFilterOptions');
    seasonOptions.querySelectorAll('.tag-filter-option').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    const genreOptions = document.getElementById('genreFilterOptions');
    genreOptions.querySelectorAll('.tag-filter-option').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    const decadeOptions = document.getElementById('decadeFilterOptions');
    if (decadeOptions) {
        decadeOptions.querySelectorAll('.tag-filter-option').forEach(btn => {
            btn.classList.remove('selected');
        });
    }
}

function updateTagButtonAppearance() {
    const tagBtn = document.getElementById('tagFilterBtn');
    if (selectedSeasons.length > 0 || selectedGenres.length > 0 || selectedDecades.length > 0) {
        // タグが選択されている場合は色を変更
        tagBtn.style.backgroundColor = '#667eea';
        tagBtn.style.borderColor = '#667eea';
        tagBtn.style.color = 'white';
    } else {
        // タグが選択されていない場合は通常状態
        tagBtn.style.backgroundColor = 'white';
        tagBtn.style.borderColor = '#e2e8f0';
        tagBtn.style.color = '#718096';
    }
}

function closeTagFilterPopup(event) {
    if (event && event.target.id !== 'tagFilterPopup') return;
    document.getElementById('tagFilterPopup').classList.add('hidden');
}

function matchesTags(song) {
    // If no filters selected, all songs match
    if (selectedSeasons.length === 0 && selectedGenres.length === 0 && selectedDecades.length === 0) {
        return true;
    }
    
    let seasonMatch = selectedSeasons.length === 0;
    if (selectedSeasons.length > 0) {
        const songSeason = song['季節'] ? song['季節'].trim() : '';
        seasonMatch = selectedSeasons.includes(songSeason);
    }
    
    let genreMatch = selectedGenres.length === 0;
    if (selectedGenres.length > 0) {
        const songGenres = [
            song['ジャンル1'] ? song['ジャンル1'].trim() : '',
            song['ジャンル2'] ? song['ジャンル2'].trim() : '',
            song['ジャンル3'] ? song['ジャンル3'].trim() : ''
        ];
        genreMatch = selectedGenres.some(genre => songGenres.includes(genre));
    }
    
    let decadeMatch = selectedDecades.length === 0;
    if (selectedDecades.length > 0) {
        const releaseDate = song['リリース日'] ? song['リリース日'].trim() : '';
        if (releaseDate) {
            const year = parseInt(releaseDate.substring(0, 4), 10);
            if (!isNaN(year)) {
                const decade = Math.floor(year / 10) * 10;
                const decadeLabel = decade + '年代';
                decadeMatch = selectedDecades.includes(decadeLabel);
            }
        }
    }
    
    return seasonMatch && genreMatch && decadeMatch;
}

function createTagsHTML(song) {
    let html = '<div class="tag-container">';
    
    if (song['季節'] && song['季節'].trim()) {
        const tagValue = song['季節'].trim();
        const color = getTagColor(tagValue, false);
        html += `<span class="tag" style="background-color: ${color.bg}; color: ${color.text}; cursor: pointer;" onclick="onTagClick('${escapeQuotes(tagValue)}', 'season')">${tagValue}</span>`;
    }
    
    if (song['ジャンル1'] && song['ジャンル1'].trim()) {
        const tagValue = song['ジャンル1'].trim();
        const color = getTagColor(tagValue, true);
        html += `<span class="tag" style="background-color: ${color.bg}; color: ${color.text}; cursor: pointer;" onclick="onTagClick('${escapeQuotes(tagValue)}', 'genre')">${tagValue}</span>`;
    }
    
    if (song['ジャンル2'] && song['ジャンル2'].trim()) {
        const tagValue = song['ジャンル2'].trim();
        const color = getTagColor(tagValue, true);
        html += `<span class="tag" style="background-color: ${color.bg}; color: ${color.text}; cursor: pointer;" onclick="onTagClick('${escapeQuotes(tagValue)}', 'genre')">${tagValue}</span>`;
    }
    
    if (song['ジャンル3'] && song['ジャンル3'].trim()) {
        const tagValue = song['ジャンル3'].trim();
        const color = getTagColor(tagValue, true);
        html += `<span class="tag" style="background-color: ${color.bg}; color: ${color.text}; cursor: pointer;" onclick="onTagClick('${escapeQuotes(tagValue)}', 'genre')">${tagValue}</span>`;
    }
    
    html += '</div>';
    return html;
}

function createTagsInlineHTML(song) {
    let html = '<div class="tag-container-inline">';
    
    if (song['季節'] && song['季節'].trim()) {
        const tagValue = song['季節'].trim();
        const color = getTagColor(tagValue, false);
        html += `<span class="tag-inline" style="background-color: ${color.bg}; color: ${color.text};">${tagValue}</span>`;
    }
    
    if (song['ジャンル1'] && song['ジャンル1'].trim()) {
        const tagValue = song['ジャンル1'].trim();
        const color = getTagColor(tagValue, true);
        html += `<span class="tag-inline" style="background-color: ${color.bg}; color: ${color.text};">${tagValue}</span>`;
    }
    
    if (song['ジャンル2'] && song['ジャンル2'].trim()) {
        const tagValue = song['ジャンル2'].trim();
        const color = getTagColor(tagValue, true);
        html += `<span class="tag-inline" style="background-color: ${color.bg}; color: ${color.text};">${tagValue}</span>`;
    }
    
    if (song['ジャンル3'] && song['ジャンル3'].trim()) {
        const tagValue = song['ジャンル3'].trim();
        const color = getTagColor(tagValue, true);
        html += `<span class="tag-inline" style="background-color: ${color.bg}; color: ${color.text};">${tagValue}</span>`;
    }
    
    html += '</div>';
    return html;
}

// タグクリック時の処理
function onTagClick(tagValue, tagType) {
    // 検索ボックスをクリア
    document.getElementById('searchQuery').value = '';
    document.getElementById('resultCountInline').textContent = '';
    
    // 既存のタグフィルターをリセット
    selectedSeasons = [];
    selectedGenres = [];
    selectedDecades = [];
    
    // クリックしたタグを選択状態に設定
    if (tagType === 'season') {
        selectedSeasons = [tagValue];
    } else if (tagType === 'genre') {
        selectedGenres = [tagValue];
    }
    
    // タグフィルターボタンの表示を更新
    updateTagButtonAppearance();
    
    // 検索を実行
    performSearch();
    
    // ページトップにスクロール
    setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
}

// Song Detail Modal Functions
function openSongDetail(songIndex) {
    const song = allSongs[songIndex];
    if (!song) return;
    
    const content = document.getElementById('songDetailContent');
    
    
    detailCopyBtn.onclick = function() {
        copyToClipboard(song['曲名'] + '／' + song['アーティスト']);
    };
    
    
    // ロボットSVG
    const robotSVG = `<svg width="32" height="32" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style="display: inline; vertical-align: text-bottom;">
        <g fill="currentColor">
            <path d="M117.92,392.698h0.082h275.944h0.082c9.531,0,17.257-7.73,17.257-17.26v-0.078V174.47V163.81   c0-9.574-7.765-17.339-17.338-17.339h-10.66H128.662h-10.659c-9.574,0-17.339,7.766-17.339,17.339v10.659v200.89v0.078   C100.664,384.969,108.39,392.698,117.92,392.698z M247.616,279.342v-24.635h16.718v24.635H247.616z M311.924,269.406   c-0.41-0.031-0.824-0.035-1.226-0.082c-3.453-0.426-6.726-1.398-9.742-2.839c-0.195-0.094-0.383-0.199-0.578-0.297   c-1.363-0.692-2.675-1.465-3.918-2.34c-0.133-0.09-0.266-0.18-0.394-0.274c-9.839-7.132-15.421-19.784-12.152-33.392   c0.004-0.024,0.012-0.043,0.012-0.063c0.946-3.902,2.617-7.886,5.125-11.835c1.48-2.331,3.492-4.343,5.824-5.823   c3.789-2.402,7.601-3.992,11.35-4.957c0.394-0.098,0.793-0.188,1.184-0.274c1.418-0.309,2.816-0.512,4.202-0.637   c0.469-0.039,0.942-0.106,1.406-0.129c1.621-0.078,3.218-0.043,4.781,0.117c0.258,0.028,0.508,0.059,0.762,0.094   c1.481,0.187,2.918,0.484,4.324,0.867c0.598,0.164,1.172,0.374,1.75,0.574c0.961,0.325,1.906,0.68,2.82,1.094   c0.586,0.262,1.168,0.535,1.734,0.832c0.93,0.489,1.816,1.031,2.687,1.602c0.453,0.301,0.926,0.574,1.363,0.894   c1.238,0.91,2.422,1.898,3.515,2.981c0.27,0.266,0.504,0.574,0.766,0.851c0.832,0.879,1.621,1.793,2.344,2.766   c0.332,0.442,0.636,0.906,0.945,1.371c0.598,0.894,1.152,1.824,1.66,2.785c0.254,0.48,0.512,0.957,0.742,1.453   c0.539,1.16,0.996,2.363,1.39,3.594c0.106,0.317,0.242,0.617,0.336,0.942c0.446,1.554,0.758,3.16,0.961,4.8   c0.058,0.45,0.058,0.914,0.094,1.371c0.094,1.129,0.118,2.274,0.086,3.434c-0.039,1.34-0.196,2.644-0.398,3.941   c-0.102,0.672-0.164,1.336-0.305,2.016c-2.656,11.941-12.054,21.326-24.046,23.963c-0.614,0.125-1.214,0.183-1.82,0.278   c-1.344,0.214-2.703,0.37-4.098,0.41C314.236,269.522,313.068,269.503,311.924,269.406z M319.049,309.903v28.638H192.9v-28.638   h125.926H319.049z M215.888,263.574c-0.13,0.094-0.266,0.184-0.399,0.274c-1.242,0.871-2.554,1.648-3.918,2.336   c-0.195,0.098-0.382,0.206-0.578,0.301c-3.016,1.441-6.289,2.414-9.742,2.839c-0.402,0.047-0.817,0.051-1.226,0.082   c-1.145,0.098-2.313,0.117-3.488,0.086c-1.395-0.039-2.754-0.195-4.098-0.41c-0.606-0.094-1.207-0.153-1.82-0.278   c-11.992-2.637-21.39-12.022-24.046-23.963c-0.141-0.68-0.203-1.344-0.305-2.016c-0.203-1.297-0.359-2.601-0.398-3.941   c-0.031-1.16-0.008-2.305,0.086-3.434c0.035-0.457,0.035-0.922,0.094-1.371c0.203-1.64,0.516-3.246,0.962-4.8   c0.094-0.325,0.23-0.625,0.335-0.942c0.395-1.23,0.852-2.434,1.391-3.594c0.23-0.496,0.488-0.973,0.742-1.453   c0.508-0.961,1.062-1.89,1.66-2.785c0.309-0.465,0.614-0.93,0.946-1.371c0.722-0.969,1.512-1.883,2.34-2.758   c0.262-0.282,0.5-0.59,0.773-0.863c1.094-1.078,2.274-2.066,3.512-2.977c0.441-0.324,0.914-0.598,1.37-0.894   c0.867-0.57,1.75-1.113,2.676-1.598c0.566-0.301,1.152-0.574,1.738-0.84c0.914-0.41,1.859-0.765,2.82-1.09   c0.578-0.195,1.152-0.41,1.75-0.574c1.406-0.383,2.844-0.68,4.324-0.867c0.254-0.035,0.504-0.066,0.762-0.094   c1.562-0.16,3.16-0.195,4.782-0.117c0.465,0.023,0.937,0.09,1.406,0.129c1.387,0.125,2.789,0.328,4.203,0.637   c0.39,0.086,0.789,0.176,1.179,0.274c3.75,0.965,7.566,2.554,11.355,4.957c2.332,1.48,4.343,3.492,5.824,5.823   c2.507,3.95,4.175,7.93,5.121,11.832c0.003,0.023,0.011,0.046,0.019,0.066C231.304,243.794,225.723,256.442,215.888,263.574z" style="fill: rgb(75, 75, 75);"/>
            <path d="M474.48,232.712c-7.144-7.144-17.01-11.566-27.912-11.566h-12.35v78.914h12.35   c21.803,0,39.466-17.663,39.466-39.451C486.035,249.707,481.609,239.841,474.48,232.712z" style="fill: rgb(75, 75, 75);"/>
            <path d="M37.519,232.712c-7.132,7.129-11.554,16.995-11.554,27.897c0,21.788,17.663,39.451,39.466,39.451h12.35   v-78.914h-12.35C54.526,221.146,44.66,225.568,37.519,232.712z" style="fill: rgb(75, 75, 75);"/>
            <path d="M243.776,46.798c3.762,2.082,5.918,6.082,5.441,10.32l-7.351,61.586l-0.89,7.292h0.019l-0.019,0.157h30.076   l-8.238-69.035c-0.481-4.238,1.68-8.238,5.359-10.32c7.441-4.238,12.479-12.238,12.479-21.44c0-13.589-10.948-24.545-24.537-24.635   l0.074-0.562l-0.015-0.141l-0.078,0.703l0,0L256.014,0l-0.078,0.722c-13.601,0.078-24.561,11.038-24.561,24.635   C231.375,34.56,236.335,42.56,243.776,46.798z M251.053,11.601c4.961,0,8.96,4,8.96,8.878c0,4.961-3.999,8.961-8.96,8.961   c-4.957,0-8.957-4-8.957-8.961C242.096,15.601,246.096,11.601,251.053,11.601z" style="fill: rgb(75, 75, 75);"/>
            <path d="M400.63,416.607H111.366c-16.963,0-30.623,13.734-30.623,30.623V512h350.51v-64.77   C431.253,430.341,417.594,416.607,400.63,416.607z" style="fill: rgb(75, 75, 75);"/>
        </g>
    </svg>`;
    
    // 音楽SVG
    const musicSVG = `<svg width="32" height="32" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style="display: inline; vertical-align: middle;">
        <g fill="currentColor">
            <path d="M256.001,305.598c27.332,0,49.598-22.266,49.598-49.598s-22.266-49.598-49.598-49.598S206.403,228.668,206.403,256S228.669,305.598,256.001,305.598z M256.001,228.446c15.21,0,27.554,12.347,27.554,27.554c0,15.207-12.344,27.554-27.554,27.554c-15.211,0-27.555-12.347-27.555-27.554C228.446,240.793,240.79,228.446,256.001,228.446z"/>
            <path d="M432.34,256c0-97.375-78.969-176.343-176.339-176.343c-97.375,0-176.344,78.968-176.344,176.343s78.969,176.343,176.344,176.343C353.371,432.343,432.34,353.375,432.34,256z M352.423,133.5l-56.367,56.371c-7.722-5.453-16.504-9.094-25.817-10.699V99.43c29.379,2.223,56.93,13.383,79.645,32.027C350.719,132.153,351.598,132.782,352.423,133.5z M256.001,195.383c33.449,0,60.617,27.168,60.617,60.617s-27.168,60.617-60.617,60.617c-33.45,0-60.618-27.168-60.618-60.617S222.551,195.383,256.001,195.383z"/>
        </g>
    </svg>`;
    
    // ロボットのセリフテンプレート
    const robotSpeech = song['理由'] ? `
        <div style="background-color: #f0f4f8; border-left: 4px solid #667eea; padding: 12px; margin: 10px 0; border-radius: 4px;">
            <div style="font-size: 12px; color: #4a5568; ">${robotSVG} AIが ${song['季節']}の曲として選んだ理由</div>
            <div style="color: #2d3748; font-style: italic; font-size: smaller;">"${escapeHtml(song['理由'])}"</div>
        </div>
    ` : '';
    
    // プレビュー音声再生
    const previewAudio = song['プレビューURL'] ? `
        <div style="margin: 15px 0;">
            <div style="font-size: 12px; color: #4a5568; margin-bottom: 6px;">${musicSVG} サンプル再生</div>
            <audio id="songPreviewAudio" controls disableremoteplayback controlsList="nodownload noplaybackrate" oncontextmenu="return false;" oncanplay="this.volume = 0.1; this.oncanplay = null;" style="width: 100%; height: 32px;">
                <source src="${escapeHtml(song['プレビューURL'])}" type="audio/mpeg">
                ブラウザはオーディオ再生をサポートしていません
            </audio>
        </div>
    ` : '';
    
    // タグ表示
    const genres = [];
    if (song['ジャンル1']) genres.push(song['ジャンル1']);
    if (song['ジャンル2']) genres.push(song['ジャンル2']);
    if (song['ジャンル3']) genres.push(song['ジャンル3']);
    
    const tagsHTML = `
        <div style="margin: 10px 0;">
            <div style="font-size: 12px; color: #4a5568; margin-bottom: 6px;">タグ</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${song['季節'] ? `<span class="tag-inline" style="background-color: #FFE0B2; color: #E65100;">${escapeHtml(song['季節'])}</span>` : ''}
                ${genres.map(g => {
                    const color = getTagColor(g, true);
                    return `<span class="tag-inline" style="background-color: ${color.bg}; color: ${color.text};">${escapeHtml(g)}</span>`;
                }).join('')}
            </div>
        </div>
    `;
    
    // 日付をフォーマット
    const finalPlayDate = formatDate(song['最終演奏']);
    const releaseDate = formatDate(song['リリース日']);
    
    // ジャケット画像を背景に設定
    const artworkBg = song['アートワークURL'] ? `background: linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.75)), url('${escapeHtml(song['アートワークURL'])}');` : '';
    
    content.innerHTML = `
        <div style="position: relative; height: 150px; border-radius: 8px; overflow: clip; background: linear-gradient(56deg, rgba(102, 126, 234, 0.1) 0%, rgba(102, 126, 234, 0.05) 100%); ${artworkBg} background-size: cover; background-position: bottom; animation: bgScroll 10s ease-in-out infinite alternate;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 17px; padding: 10px; position: relative; text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.8);">
                <div>
                    <div style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px;">曲名</div>
                    <div style="font-size: 16px; font-weight: bold; color: #2d3748; margin-top: 4px;">${escapeHtml(song['曲名'])}</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px;">曲名のよみがな</div>
                    <div style="font-size: 14px; color: #4a5568; margin-top: 4px;">${escapeHtml(song['曲名の読み'] || '-')}</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px;">アーティスト</div>
                    <div style="font-size: 15px; font-weight: 600; color: #2d3748; margin-top: 4px;">${escapeHtml(song['アーティスト'])}</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px;">アーティストのよみがな</div>
                    <div style="font-size: 14px; color: #4a5568; margin-top: 4px;">${escapeHtml(song['アーティストの読み'] || '-')}</div>
                </div>
            </div>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 15px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div>
                    <div style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px;">最終演奏</div>
                    <div style="font-size: 14px; color: #2d3748; margin-top: 4px; font-weight: 500;">${escapeHtml(finalPlayDate)}</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px;">演奏回数</div>
                    <div style="font-size: 14px; color: #2d3748; margin-top: 4px; font-weight: 500;">${song['演奏回数']}回</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px;">リリース日</div>
                    <div style="font-size: 14px; color: #2d3748; margin-top: 4px;">${escapeHtml(releaseDate) || '-'}</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px;">タイアップ</div>
                    <div style="font-size: 14px; color: #2d3748; margin-top: 4px;">${escapeHtml(song['タイアップ'] || '-')}</div>
                </div>
            </div>
        </div>
        
        ${tagsHTML}
        ${robotSpeech}
        ${previewAudio}
    `;
    
    document.getElementById('songDetailPopup').classList.remove('hidden');
}

function closeSongDetail(event) {
    if (event && event.target.id !== 'songDetailPopup') return;
    
    // 再生中の音声を停止
    const audio = document.getElementById('songPreviewAudio');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
    
    document.getElementById('songDetailPopup').classList.add('hidden');
}

// 全曲一覧のテーブル行を選択して詳細ボタンを表示する
function selectListRowForDetail(index, event) {
    const song = filteredListSongs[index];
    
    // 同じ行をもう一度クリックした場合は選択解除
    if (selectedListSong === song) {
        selectedListSong = null;
        updateListDetailButton();
    } else {
        selectedListSong = song;
        updateListDetailButton();
    }
    
    renderListTable();
}

// 全曲一覧の詳細ボタンを更新/表示する
function updateListDetailButton() {
    let btnContainer = document.getElementById('detailBtn');
    if (!selectedListSong) {
        btnContainer.classList.remove('show');
    } else {
        const songIndex = allSongs.indexOf(selectedListSong);
        const songTitle = selectedListSong['曲名'] || '';
        const songArtist = selectedListSong['アーティスト'] || '';
        
        detailBtn.onclick = function() {
            openSongDetail(songIndex);
        };
        
        btnContainer.classList.add('show');
    }
}
