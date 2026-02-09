const CONFIG_KEYS = {
    PRICES: 'perfumePrices',
    FLACONS: 'flaconCosts',
    VOLUMES: 'flaconVolumes',
    MARKUPS: 'markupPresets',
    SOURCES: 'salesSources',
    TRANSACTIONS: 'transactions',
    EXPENSES: 'expenses',
    INVENTORY: 'perfumeStock',
    TASKS: 'userTasks',
    COMPLETED_ORDERS: 'perfumeflow_completed_orders',
    THEME: 'themePreference'
};

// ==========================================
//  НАЛАШТУВАННЯ ТЕКСТУ ЗАМОВЛЕННЯ
// ==========================================
const MY_PAYMENT_INFO = `💳 Оплата:
Монобанк: 4441 1111 5956 0303 
`;

const MY_DELIVERY_INFO = `- Олх доставкою, на будь-яку пошту (Комісія OLX: 3% + 35 грн.);
- Повна передоплата на карту, будь яка пошта (нова пошта роблю мінімальну ціну
доставки);`;
// ==========================================

// --- GLOBAL DATA ---
let PERFUME_PRICES = {};
let FLACON_COSTS = { 5: 12, 10: 15, 15: 18, 20: 20, 30: 25, 50: 30, 100: 40 };
let FLACON_VOLUMES = [5, 10, 15, 20, 30, 50, 100];
let MARKUP_PRESETS = { 'Базова': 0.12, 'Стандарт': 0.20, 'Преміум': 0.25 };
let SALES_SOURCES = ['Instagram', 'Viber', 'Telegram', 'OLX', 'Особиста зустріч'];
let PERFUME_STOCK = {};
let CURRENT_ORDER_LIST = [];
let TASKS = [];
let IS_EDITING_ORDER = null;

// --- CHARTS ---
let salesChartInstance = null;
let topProductsChartInstance = null;

// --- GLOBAL FILTERS ---
let CATALOG_FILTERS = {
    gender: 'all',
    season: 'all'
};
let STOCK_FILTER_GENDER = 'all';
let CURRENT_WEEK_OFFSET = 0;


// --- LOYALTY LOGIC ---
function getClientStats(clientName) {
    if (!clientName) return { totalSpend: 0, level: 'Новачок', discount: 0 };
    const txs = getTransactions().filter(t => t.clientName.toLowerCase() === clientName.toLowerCase());
    const totalSpend = txs.reduce((acc, t) => acc + t.revenue, 0);

    let level = 'Новачок';
    let discount = 0;

    if (totalSpend >= 20000) { level = '💎 VIP Platinum'; discount = 0.10; }
    else if (totalSpend >= 10000) { level = '🥇 Gold'; discount = 0.05; }
    else if (totalSpend >= 5000) { level = '🥈 Silver'; discount = 0.03; }

    return { totalSpend, level, discount };
}

window.checkClientLoyalty = function (input) {
    const name = input.value.trim();
    if (!name) return;
    const stats = getClientStats(name);
    if (stats.discount > 0) {
        showToast(`🌟 Клієнт: ${stats.level} (Витрати: ${stats.totalSpend} ₴)`, 'success');
        const discountSelect = document.getElementById('discountSelectOrder');
        if (discountSelect) {
            discountSelect.style.borderColor = 'var(--secondary)';
            discountSelect.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
            // Auto-suggest max discount based on logic or just highlight? User asked to "choose", so we just highlight.
            // But we can suggest:
            // discountSelect.value = (stats.discount * 100).toFixed(0); 
        }
    }
}

// --- UTILITIES ---
function saveToLocalStorage(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function getFromLocalStorage(key, defaultValue) { return JSON.parse(localStorage.getItem(key) || JSON.stringify(defaultValue)); }
function showToast(message, type = 'primary') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid fa-info-circle"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- THEME ---
function initTheme() {
    if (localStorage.getItem(CONFIG_KEYS.THEME) === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-icon').className = 'fa-solid fa-sun';
    }
}
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem(CONFIG_KEYS.THEME, isDark ? 'dark' : 'light');
    document.getElementById('theme-icon').className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// --- DATA LOAD ---
function loadPerfumePrices() { PERFUME_PRICES = getFromLocalStorage(CONFIG_KEYS.PRICES, {}); }
function savePerfumePrices() { saveToLocalStorage(CONFIG_KEYS.PRICES, PERFUME_PRICES); }
function loadFlaconData() {
    FLACON_COSTS = getFromLocalStorage(CONFIG_KEYS.FLACONS, FLACON_COSTS);
    FLACON_VOLUMES = getFromLocalStorage(CONFIG_KEYS.VOLUMES, FLACON_VOLUMES);
}
function loadMarkupPresets() { MARKUP_PRESETS = getFromLocalStorage(CONFIG_KEYS.MARKUPS, MARKUP_PRESETS); }
function loadSalesSources() { SALES_SOURCES = getFromLocalStorage(CONFIG_KEYS.SOURCES, SALES_SOURCES); }
function loadInventory() {
    PERFUME_STOCK = JSON.parse(localStorage.getItem(CONFIG_KEYS.INVENTORY) || '{}');
    Object.keys(PERFUME_PRICES).forEach(name => { if (PERFUME_STOCK[name] === undefined) PERFUME_STOCK[name] = 0; });
    Object.keys(PERFUME_STOCK).forEach(name => { if (PERFUME_PRICES[name] === undefined) delete PERFUME_STOCK[name]; });
    saveInventory();
}
function getFromLocalStorage(key, defaultVal) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultVal;
    } catch (e) { return defaultVal; }
}

function saveToLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function saveInventory() { saveToLocalStorage(CONFIG_KEYS.INVENTORY, PERFUME_STOCK); }

function getTransactions() { return getFromLocalStorage(CONFIG_KEYS.TRANSACTIONS, []); }
function saveTransactions(txs) { saveToLocalStorage(CONFIG_KEYS.TRANSACTIONS, txs); }
function getExpenses() { return getFromLocalStorage(CONFIG_KEYS.EXPENSES, []); }
function saveExpenses(exps) { saveToLocalStorage(CONFIG_KEYS.EXPENSES, exps); }

// --- PARSER LOGIC (FIXED) ---
window.parseOrderText = function () {
    const text = document.getElementById('pasteArea').value;
    if (!text) return;

    // 1. Phone Finder (Fixed: handles spaces, dashes, parentheses)
    // Removes non-digit characters first to find the pattern
    const cleanPhoneText = text.replace(/[\s\-\(\)]/g, '');
    const phoneMatch = cleanPhoneText.match(/(?:\+38)?(0\d{9})/);
    if (phoneMatch) {
        document.getElementById('phoneSingle').value = phoneMatch[1] || phoneMatch[0];
    }

    // 2. Volume Finder (Fixed: handles numbers without 'ml' better)
    let foundVolume = null;

    // Check for strict "number + ml" first (e.g. "100ml")
    for (let v of FLACON_VOLUMES) {
        if (text.toLowerCase().includes(v + 'ml') || text.toLowerCase().includes(v + ' мл')) {
            foundVolume = v;
            break;
        }
    }

    // If not found, check just numbers, but skip if it looks like phone or post office
    if (!foundVolume) {
        // simple regex to find isolated volume numbers like " 100 " 
        for (let v of FLACON_VOLUMES) {
            const regex = new RegExp(`(^|\\s)${v}($|\\s)`);
            if (regex.test(text)) {
                foundVolume = v;
                break;
            }
        }
    }

    if (foundVolume) {
        document.getElementById('flaconVolume').value = foundVolume;
    }

    // 3. Perfume Name Finder (Fixed: Finds LONGEST match)
    // This prevents "Chanel" matching when text is "Chanel Chance"
    const textLower = text.toLowerCase();
    let foundPerfume = "";

    // Sort keys by length descending (longest first)
    const dbNames = Object.keys(PERFUME_PRICES).sort((a, b) => b.length - a.length);

    for (let name of dbNames) {
        if (textLower.includes(name.toLowerCase())) {
            foundPerfume = name;
            break;
        }
    }

    if (foundPerfume) {
        document.getElementById('perfumeName').value = foundPerfume;
    }

    // 4. Try to find City and Post Office (Bonus)
    // City often starts with capital letter, Post Office usually near "№" or "відділення"
    const officeMatch = text.match(/(?:№|відділення|від)\.?\s*(\d+)/i);
    if (officeMatch) {
        document.getElementById('postOfficeSingle').value = officeMatch[1];
    }

    // Simple city guess (Kyiv, Odessa, Lviv, Dnipro, Kharkiv)
    const commonCities = ["Київ", "Львів", "Одеса", "Дніпро", "Харків", "Запоріжжя"];
    for (let city of commonCities) {
        if (text.includes(city)) {
            document.getElementById('citySingle').value = city;
            break;
        }
    }

    showToast("🔍 Текст проаналізовано!", "success");
}

// (Legacy TASK LOGIC section removed)

// --- CALC LOGIC ---
function calculateCost(perfumeName, volume, markupTier) {
    const pData = PERFUME_PRICES[perfumeName];
    const flaconCost = FLACON_COSTS[volume] || 0;
    const markup = MARKUP_PRESETS[markupTier] || MARKUP_PRESETS['Стандарт'];
    if (!pData) return null;
    let costPerML = pData.basePrice;
    // if (volume >= pData.discountVolume && pData.discountPrice) costPerML = pData.discountPrice;
    const perfumeCostTotal = volume * costPerML;
    const costTotal = perfumeCostTotal + flaconCost;
    const profit = costTotal * markup;
    const revenue = costTotal + profit;
    return { costTotal, profit, revenue, flaconCost, perfumeCostTotal };
}

// --- INVENTORY ---
window.addStock = function () {
    const name = document.getElementById('inventoryPerfumeName').value.trim();
    const volume = parseFloat(document.getElementById('inventoryVolume').value);
    if (!name || isNaN(volume) || volume === 0) return;
    if (!PERFUME_PRICES[name]) { showToast("Спочатку додайте парфум у довідник!", "error"); return; }
    PERFUME_STOCK[name] = (PERFUME_STOCK[name] || 0) + volume;
    saveInventory(); renderInventoryList(); updateDashboard();
    document.getElementById('inventoryPerfumeName').value = '';
    document.getElementById('inventoryVolume').value = '';
    showToast(`Склад оновлено: ${name}`, "success");
}
window.scanBarcodeForStock = function (barcodeValue) {
    if (!barcodeValue) return;
    const barcodeToFind = barcodeValue.trim();
    let perfumeName = null;
    for (const name in PERFUME_PRICES) {
        if (PERFUME_PRICES[name].barcode === barcodeToFind) { perfumeName = name; break; }
    }
    if (perfumeName) {
        PERFUME_STOCK[perfumeName] = (PERFUME_STOCK[perfumeName] || 0) + 500;
        saveInventory(); renderInventoryList(); updateDashboard();
        showToast(`✅ ${perfumeName} (+500 мл) додано!`, "success");
    } else {
        showToast(`⚠️ Штрих-код ${barcodeToFind} не знайдено.`, "error");
        document.getElementById('inventoryPerfumeName').value = `Code: ${barcodeToFind}`;
        document.getElementById('inventoryVolume').value = 500;
    }
}

// --- ADMIN ---
window.addOrUpdatePerfume = function () {
    const name = document.getElementById('adminPerfumeName').value.trim();
    const basePrice = document.getElementById('adminBasePrice').value.trim();
    const discountVolume = document.getElementById('adminDiscountVolume').value.trim();
    const discountPrice = document.getElementById('adminDiscountPrice').value.trim();
    const barcode = document.getElementById('adminBarcode').value.trim();
    const gender = document.getElementById('adminGender').value;
    const seasons = Array.from(document.querySelectorAll('input[name="adminSeason"]:checked')).map(el => el.value);
    const tags = document.getElementById('adminTags').value.split(',').map(t => t.trim()).filter(t => t);

    const pyramid = document.getElementById('adminPyramid').value.trim();
    const description = document.getElementById('adminDescription').value.trim();

    if (!name || !basePrice) { showToast("Заповніть назву та ціну", "error"); return; }
    PERFUME_PRICES[name] = {
        basePrice: parseFloat(basePrice),
        discountVolume: parseFloat(discountVolume) || 5,
        discountPrice: parseFloat(discountPrice) || null,
        barcode: barcode || null,
        gender: gender || null,
        seasons: seasons,
        tags: tags,
        pyramid: pyramid || null,
        description: description || null
    };
    if (PERFUME_STOCK[name] === undefined) PERFUME_STOCK[name] = 0;
    savePerfumePrices(); saveInventory(); renderPerfumeList(); populateFormOptions();
    showToast(`Збережено: ${name}`, "success");
    document.getElementById('adminPerfumeName').value = '';
    document.getElementById('adminBasePrice').value = '';
    document.getElementById('adminBarcode').value = '';
    document.getElementById('adminGender').value = '';
    document.querySelectorAll('input[name="adminSeason"]').forEach(el => el.checked = false);
    document.getElementById('adminTags').value = '';
    document.getElementById('adminPyramid').value = '';
    document.getElementById('adminDescription').value = '';
}

window.autoFillPerfumeData = async function () {
    const name = document.getElementById('adminPerfumeName').value.trim();
    if (!name) { showToast("⚠️ Спочатку введіть назву парфуму!", "warning"); return; }

    const btn = document.querySelector('button[onclick="autoFillPerfumeData()"]');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const prompt = `
            Ти — експерт-парфумер. Надай дані для парфуму "${name}" у строгому форматі JSON (без зайвого тексту).
            Формат відповіді:
            {
                "gender": "Жіночий" | "Чоловічий" | "Унісекс",
                "seasons": ["Літо", "Зима"], 
                "tags": ["свіжий", "квітковий", "мускусний"],
                "pyramid": "текст піраміди",
                "description": "короткий професійний опис"
            }
            Дані мають бути українською мовою. "seasons" може містити одне або обидва значення. "tags" — масив з 3-5 ключових характеристик.
        `;

        const responseText = await callGemini(prompt);
        // Clean markdown if AI included it
        const jsonStr = responseText.replace(/```json|```/g, '').trim();
        const data = JSON.parse(jsonStr);

        if (data.gender) document.getElementById('adminGender').value = data.gender;
        if (data.seasons) {
            document.querySelectorAll('input[name="adminSeason"]').forEach(el => {
                el.checked = data.seasons.includes(el.value);
            });
        }
        if (data.tags) document.getElementById('adminTags').value = data.tags.join(', ');
        if (data.pyramid) document.getElementById('adminPyramid').value = data.pyramid;
        if (data.description) document.getElementById('adminDescription').value = data.description;

        showToast("✨ Дані заповнено за допомогою AI!", "success");
    } catch (err) {
        console.error("AutoFill Error:", err);
        showToast("❌ Не вдалося отримати дані від AI", "error");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}
window.editPerfume = function (name) {
    const pData = PERFUME_PRICES[name];
    if (!pData) return;
    document.getElementById('adminPerfumeName').value = name;
    document.getElementById('adminBasePrice').value = pData.basePrice;
    document.getElementById('adminDiscountVolume').value = pData.discountVolume || 5;
    document.getElementById('adminDiscountPrice').value = pData.discountPrice || '';
    document.getElementById('adminBarcode').value = pData.barcode || '';
    document.getElementById('adminGender').value = pData.gender || '';
    const seasons = pData.seasons || [];
    document.querySelectorAll('input[name="adminSeason"]').forEach(el => el.checked = seasons.includes(el.value));
    document.getElementById('adminTags').value = (pData.tags || []).join(', ');
    document.getElementById('adminPyramid').value = pData.pyramid || '';
    document.getElementById('adminDescription').value = pData.description || '';
    document.getElementById('adminPerfumeName').focus();
}
window.renderPerfumeList = function () {
    const tbody = document.getElementById('perfume-list-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    const search = document.getElementById('perfumeSearchInput').value.toLowerCase();
    Object.keys(PERFUME_PRICES).sort().forEach(name => {
        const pData = PERFUME_PRICES[name];

        // Filtering
        if (CATALOG_FILTERS.gender !== 'all' && pData.gender !== CATALOG_FILTERS.gender) return;
        if (CATALOG_FILTERS.season !== 'all' && !(pData.seasons || []).includes(CATALOG_FILTERS.season)) return;
        if (search && !name.toLowerCase().includes(search) && (!pData.barcode || !pData.barcode.includes(search)) && !(pData.tags || []).some(t => t.toLowerCase().includes(search))) return;

        const barcodeDisplay = pData.barcode ? `<span style="font-size:0.75rem; color:var(--text-muted); display:block;">Код: ${pData.barcode}</span>` : '';

        const genderClass = pData.gender === 'Чоловічий' ? 'gender-male' : (pData.gender === 'Жіночий' ? 'gender-female' : 'gender-unisex');
        const genderBadge = pData.gender ? `<span class="badge-gender ${genderClass}">${pData.gender[0]}</span>` : '';

        const seasonBadges = (pData.seasons || []).map(s => `<span class="season-badge">${s === 'Літо' ? '☀️' : '❄️'}</span>`).join('');
        const tagsHtml = (pData.tags || []).map(t => `<span class="tag-badge">${t}</span>`).join('');

        tbody.innerHTML += `<tr><td>${genderBadge}${seasonBadges}<span class="text-bold">${name}</span>${barcodeDisplay}${tagsHtml}</td><td class="text-right">${pData.basePrice.toFixed(2)} ₴</td><td class="text-right"><button class="btn-sm btn-warning" onclick="editPerfume('${name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-edit"></i></button> <button class="btn-sm btn-danger" onclick="deletePerfume('${name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    });
}
window.setCatalogFilter = function (type, value, el) {
    CATALOG_FILTERS[type] = value;
    // Update active state
    const container = el.parentElement;
    container.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
    renderPerfumeList();
}
window.deletePerfume = function (name) {
    if (confirm('Видалити?')) { delete PERFUME_PRICES[name]; delete PERFUME_STOCK[name]; savePerfumePrices(); saveInventory(); renderPerfumeList(); renderInventoryList(); populateFormOptions(); }
}
window.renderInventoryList = function () {
    const tbody = document.getElementById('inventory-list-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    let lowStockCount = 0;
    Object.keys(PERFUME_STOCK).sort().forEach(name => {
        const pData = PERFUME_PRICES[name] || {};
        if (STOCK_FILTER_GENDER !== 'all' && pData.gender !== STOCK_FILTER_GENDER) return;

        const stock = PERFUME_STOCK[name];
        if (stock <= 100) lowStockCount++;

        const genderClass = pData.gender === 'Чоловічий' ? 'gender-male' : (pData.gender === 'Жіночий' ? 'gender-female' : 'gender-unisex');
        const genderBadge = pData.gender ? `<span class="badge-gender ${genderClass}" style="font-size:0.6rem; padding: 1px 4px;">${pData.gender[0]}</span>` : '';

        tbody.innerHTML += `<tr><td>${genderBadge}${name}</td><td class="text-right" ${stock <= 100 ? 'style="color:var(--danger);font-weight:bold;"' : ''}>${stock} мл</td><td class="text-right"><button class="btn-sm btn-danger" onclick="PERFUME_STOCK['${name.replace(/'/g, "\\'")}']=0;saveInventory();renderInventoryList();updateDashboard();"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    });
    const dashLowStock = document.getElementById('dash-low-stock-count-value');
    if (dashLowStock) dashLowStock.textContent = lowStockCount;
}

window.generateStockForecast = async function () {
    const btn = document.querySelector('button[onclick="generateStockForecast()"]');
    const originalContent = btn.innerHTML;
    const resDiv = document.getElementById('stockForecastResult');
    const contentDiv = document.getElementById('stockForecastContent');

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Аналізую...';
    btn.disabled = true;
    resDiv.style.display = 'block';
    contentDiv.innerHTML = 'Завантаження аналітики за останні 30 днів...';

    try {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentTxs = getTransactions().filter(t => t.timestamp >= thirtyDaysAgo);

        // Structure stock and sales data for the prompt
        let analysisData = [];
        Object.keys(PERFUME_PRICES).forEach(name => {
            const stock = PERFUME_STOCK[name] || 0;
            const sales = recentTxs.filter(t => t.perfumeName === name).reduce((acc, t) => acc + t.quantityML, 0);
            analysisData.push({ name, stock, sales30d: sales });
        });

        const prompt = `
            Ти — аналітик складу парфумерії. Проаналізуй дані про залишки та продажі (за останні 30 днів) і надай змістовний звіт українською мовою.
            
            ДАНІ:
            ${JSON.stringify(analysisData)}
            
            ТВОЄ ЗАВДАННЯ:
            1. Виділи "ГАРЯЧІ" позиції: високі продажі та низький залишок. Порекомендуй, скільки мл докупити.
            2. Виділи "МЕРТВИЙ ВАНТАЖ": позиції, які не продавалися 30 днів, але мають залишки. Порекомендуй зробити на них знижку.
            3. Загальний стан: чи достатньо запасів на наступний місяць?
            
            Форматуй відповідь гарно, використовуючи списки, жирний текст та емодзі. Не використовуй технічний JSON у відповіді.
        `;

        const responseText = await callGemini(prompt);

        // Simple Markdown to HTML conversion
        const html = responseText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n- (.*?)/g, '<br>• $1')
            .replace(/\n/g, '<br>');

        contentDiv.innerHTML = html;
        showToast("📈 ШІ Аналіз готовий!", "success");

    } catch (err) {
        console.error(err);
        contentDiv.innerHTML = "❌ Помилка аналізу: " + err.message;
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}
window.filterStockByGender = function (value, el) {
    STOCK_FILTER_GENDER = value;
    const container = el.parentElement;
    container.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
    renderInventoryList();
}

// --- NAVIGATION ---
function showSection(sectionId, element) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (element) { document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active')); element.classList.add('active'); }
    if (sectionId === 'multi-calculator') renderOrderList();
    if (sectionId === 'transactions') renderTransactionHistory();
    if (sectionId === 'admin-panel') { renderPerfumeList(); renderInventoryList(); }
    if (sectionId === 'expenses') renderExpenseList();
    if (sectionId === 'dashboard') updateDashboard();
    if (sectionId === 'tasks') renderTasks();
}

function populateFormOptions() {
    const markupSelects = document.querySelectorAll('#saleMarkupTierSingle, #saleMarkupTierOrder, #calcMarkupTier, #priceListMarkup');
    const sourceSelects = document.querySelectorAll('#saleSourceSingle, #saleSourceOrder, #historyFilterSource');
    const flaconSelects = document.querySelectorAll('#flaconVolume, #orderFlaconVolume, #calcFlaconVolume');
    markupSelects.forEach(s => s.innerHTML = '');
    sourceSelects.forEach(s => s.innerHTML = '<option value="">Всі</option>');
    flaconSelects.forEach(s => s.innerHTML = '');
    Object.keys(MARKUP_PRESETS).forEach(name => { markupSelects.forEach(s => { const option = document.createElement('option'); option.value = name; option.textContent = `${name} (+${(MARKUP_PRESETS[name] * 100).toFixed(0)}%)`; s.appendChild(option); }); });
    FLACON_VOLUMES.sort((a, b) => a - b).forEach(vol => { flaconSelects.forEach(s => { const option = document.createElement('option'); option.value = vol; option.textContent = `${vol} мл (${FLACON_COSTS[vol] || 0} грн)`; s.appendChild(option); }); });
    SALES_SOURCES.forEach(source => { sourceSelects.forEach(s => { const option = document.createElement('option'); option.value = source; option.textContent = source; s.appendChild(option); }); });
    const perfumeList = document.getElementById('perfumeList'); perfumeList.innerHTML = '';
    Object.keys(PERFUME_PRICES).sort().forEach(name => { const option = document.createElement('option'); option.value = name; perfumeList.appendChild(option); });
    const clientList = document.getElementById('clientList'); clientList.innerHTML = '';
    const clients = new Set(getTransactions().map(t => t.clientName).filter(Boolean));
    clients.forEach(name => { const option = document.createElement('option'); option.value = name; clientList.appendChild(option); });

    // Populate SMM perfume selector
    const smmSelect = document.getElementById('smmPerfumeSelect');
    if (smmSelect) {
        smmSelect.innerHTML = '<option value="">-- Оберіть парфум --</option>';
        Object.keys(PERFUME_PRICES).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            smmSelect.appendChild(option);
        });
    }
}

// --- ORDER ACTIONS ---
// REMOVED: addSale function

window.addItemToOrder = function () {
    const name = document.getElementById('orderPerfumeName').value.trim();
    const volume = parseFloat(document.getElementById('orderFlaconVolume').value);
    const markup = document.getElementById('saleMarkupTierOrder').value;
    // Recalculate whole list to update total with discount?
    // Actually we update totals in renderOrderList
    if (!name || !volume) return;
    const calc = calculateCost(name, volume, markup);
    if (!calc) return;
    CURRENT_ORDER_LIST.push({ ...calc, name: name, vol: volume, markup: markup });
    renderOrderList(); document.getElementById('orderPerfumeName').value = '';
}
// Add listener to discount change
document.addEventListener('DOMContentLoaded', () => {
    const ds = document.getElementById('discountSelectOrder');
    if (ds) ds.addEventListener('change', renderOrderList);
});

window.removeItemFromOrder = function (index) { CURRENT_ORDER_LIST.splice(index, 1); renderOrderList(); }

window.renderOrderList = function () {
    const tbody = document.getElementById('order-list-table').getElementsByTagName('tbody')[0];
    const totalDiv = document.getElementById('orderTotalSection');
    const summaryText = document.getElementById('orderSummaryOutput');

    tbody.innerHTML = '';
    let totalRev = 0;

    CURRENT_ORDER_LIST.forEach((item, index) => {
        totalRev += item.revenue;
        tbody.innerHTML += `<tr><td>${item.name}</td><td class="text-right">${item.vol} мл</td><td class="text-right">${item.revenue.toFixed(2)}</td><td class="text-right"><button class="btn-sm btn-danger" onclick="removeItemFromOrder(${index})"><i class="fa-solid fa-times"></i></button></td></tr>`;
    });

    totalDiv.textContent = `Разом: ${totalRev.toFixed(2)} ₴`;

    // CLEAN ORDER TEXT
    if (CURRENT_ORDER_LIST.length > 0) {
        const discountPercent = parseInt(document.getElementById('discountSelectOrder').value) || 0;
        const discountAmount = totalRev * (discountPercent / 100);
        const finalTotal = totalRev - discountAmount;

        let text = "Ваше замовлення:\n\n";
        CURRENT_ORDER_LIST.forEach((item, i) => { text += `${i + 1}. ${item.name} (${item.vol} мл) — ${item.revenue.toFixed(0)} грн\n`; });
        if (discountPercent > 0) {
            text += `\nЗнижка ${discountPercent}%: -${discountAmount.toFixed(0)} грн\n`;
        }
        text += `\n${MY_DELIVERY_INFO}\n\n`;
        text += `${MY_PAYMENT_INFO}\n\n`;
        text += `До сплати: ${finalTotal.toFixed(0)} грн`;
        summaryText.value = text;
        totalDiv.innerHTML = `Сума: ${totalRev.toFixed(0)} ₴ <br> ${discountPercent > 0 ? `<span style='color:var(--secondary)'>Знижка: -${discountAmount.toFixed(0)} ₴</span> <br>` : ''} Разом: ${finalTotal.toFixed(0)} ₴`;
    } else { summaryText.value = ''; totalDiv.textContent = ''; }
}

window.clearOrder = function () { CURRENT_ORDER_LIST = []; renderOrderList(); IS_EDITING_ORDER = null; const btn = document.getElementById('processOrderBtn'); btn.innerHTML = '<i class="fa-solid fa-cash-register"></i> Оформити'; btn.classList.remove('btn-warning'); btn.classList.add('btn-success'); }
window.revertOrderStock = function (orderId) {
    const txsToRevert = getTransactions().filter(t => t.orderId === orderId);
    let totalVolume = {};
    txsToRevert.forEach(item => { totalVolume[item.perfumeName] = (totalVolume[item.perfumeName] || 0) + item.quantityML; });
    for (const name in totalVolume) { PERFUME_STOCK[name] = (PERFUME_STOCK[name] || 0) + totalVolume[name]; }
    saveInventory();
}
window.deleteOrder = function (orderId, showToastMessage = true) {
    if (showToastMessage && !confirm(`Видалити замовлення?`)) return;
    revertOrderStock(orderId);
    saveTransactions(getTransactions().filter(t => t.orderId !== orderId));
    // deleteTaskByRelatedId(orderId); // Removed as tasks are now auto-generated from transactions
    if (showToastMessage) showToast(`Замовлення видалено.`, "error");
    renderTransactionHistory(); updateDashboard();
}
window.startEditOrder = function (orderId) {
    const txs = getTransactions().filter(t => t.orderId === orderId);
    if (txs.length === 0) return;
    IS_EDITING_ORDER = orderId; CURRENT_ORDER_LIST.length = 0;
    txs.forEach(t => { const calc = calculateCost(t.perfumeName, t.quantityML, t.markupTier); if (calc) CURRENT_ORDER_LIST.push({ ...calc, name: t.perfumeName, vol: t.quantityML, markup: t.markupTier }); });
    const first = txs[0];
    document.getElementById('clientNameOrder').value = first.clientName || '';
    document.getElementById('saleSourceOrder').value = first.source || '';
    document.getElementById('ttnNumberOrder').value = first.ttnNumber || '';
    // const task = getTasks().find(t => t.relatedId === orderId); // Removed as tasks are now auto-generated from transactions
    // if (task) {
    //     document.getElementById('phoneOrder').value = task.phone;
    //     document.getElementById('fullNameOrder').value = task.fullName;
    //     document.getElementById('cityOrder').value = task.city;
    //     document.getElementById('postOfficeOrder').value = task.postOffice;
    // }
    // Restore discount if available in transaction
    const firstTx = txs[0];
    if (firstTx.discountPercent) {
        document.getElementById('discountSelectOrder').value = firstTx.discountPercent;
    } else {
        document.getElementById('discountSelectOrder').value = 0;
    }
    renderOrderList();
    const btn = document.getElementById('processOrderBtn');
    btn.innerHTML = '<i class="fa-solid fa-save"></i> Зберегти';
    btn.classList.remove('btn-success'); btn.classList.add('btn-warning');
    showSection('multi-calculator', document.querySelector('.navbar-links .nav-btn:nth-child(3)'));
}
window.processOrder = function () {
    if (CURRENT_ORDER_LIST.length === 0) return;
    const client = document.getElementById('clientNameOrder').value.trim() || 'Клієнт';
    const markup = document.getElementById('saleMarkupTierOrder').value;
    const source = document.getElementById('saleSourceOrder').value;
    const ttn = document.getElementById('ttnNumberOrder').value.trim() || null;
    const phone = document.getElementById('phoneOrder').value.trim();
    const fullName = document.getElementById('fullNameOrder').value.trim();
    const city = document.getElementById('cityOrder').value.trim();
    const postOffice = document.getElementById('postOfficeOrder').value.trim();
    const comments = document.getElementById('commentsOrder').value.trim();
    if (!source) { showToast("Оберіть джерело!", "error"); return; }
    if (IS_EDITING_ORDER) { deleteOrder(IS_EDITING_ORDER, false); IS_EDITING_ORDER = null; const btn = document.getElementById('processOrderBtn'); btn.innerHTML = '<i class="fa-solid fa-cash-register"></i> Оформити'; btn.classList.remove('btn-warning'); btn.classList.add('btn-success'); }
    const txs = getTransactions();
    const total = CURRENT_ORDER_LIST.reduce((acc, item) => acc + item.revenue, 0);
    const orderId = IS_EDITING_ORDER || Date.now();
    const discountPercent = parseInt(document.getElementById('discountSelectOrder').value) || 0;

    // Apply discount proportionally to each item to correct profit/rev stats
    const newTransactions = CURRENT_ORDER_LIST.map(item => {
        const itemDiscount = item.revenue * (discountPercent / 100);
        const finalRevenue = item.revenue - itemDiscount;
        const finalProfit = finalRevenue - item.costTotal; // Profit reduces by discount amount

        return {
            id: Date.now() + Math.random(), timestamp: Date.now(), clientName: client, source: source, markupTier: markup,
            perfumeName: item.name, quantityML: item.vol,
            revenue: finalRevenue, profit: finalProfit, costTotal: item.costTotal,
            ttnNumber: ttn, orderId: orderId, discountPercent: discountPercent
        };
    });
    txs.push(...newTransactions); saveTransactions(txs);
    let totalVolume = {};
    CURRENT_ORDER_LIST.forEach(item => { totalVolume[item.name] = (totalVolume[item.name] || 0) + item.vol; });
    for (const name in totalVolume) { PERFUME_STOCK[name] = (PERFUME_STOCK[name] || 0) - totalVolume[name]; }
    saveInventory();
    const itemSummary = CURRENT_ORDER_LIST.map(item => `${item.name} (${item.vol}ml)`).join(', ');
    // Order tasks are now auto-generated from transactions, so manual addTask is no longer needed here.
    showToast(`✅ Замовлення збережено!`, "success");
    showModalReceipt(CURRENT_ORDER_LIST, total, client, ttn, discountPercent);
    clearOrder(); updateDashboard();
}

window.generateAIOrderMessage = async function () {
    if (CURRENT_ORDER_LIST.length === 0) {
        showToast("📦 Спочатку додайте товари у кошик!", "warning");
        return;
    }

    const btn = document.querySelector('button[onclick="generateAIOrderMessage()"]');
    const originalContent = btn.innerHTML;
    const outputArea = document.getElementById('orderSummaryOutput');
    const clientName = document.getElementById('clientNameOrder').value.trim() || 'Клієнт';

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Генерую...';
    btn.disabled = true;

    try {
        const stats = getClientStats(clientName);
        const total = CURRENT_ORDER_LIST.reduce((acc, item) => acc + item.revenue, 0);
        const discountPercent = parseInt(document.getElementById('discountSelectOrder').value) || 0;
        const finalTotal = total * (1 - discountPercent / 100);

        const itemsText = CURRENT_ORDER_LIST.map(i => `- ${i.name} (${i.vol} мл) — ${i.revenue.toFixed(0)} ₴`).join('\n');

        const prompt = `
            Ти — менеджер магазину парфумерії. Склади ввічливе повідомлення для клієнта на основі замовлення.
            
            КЛІЄНТ: ${clientName}
            СТАТУС ЛОЯЛЬНОСТІ: ${stats.level}
            ТОВАРИ:
            ${itemsText}
            СУМА ДО ОПЛАТИ: ${finalTotal.toFixed(0)} ₴
            
            ВАШІ РЕКВІЗИТИ ТА УМОВИ:
            ${MY_PAYMENT_INFO}
            ${MY_DELIVERY_INFO}
            
            ВИМОГИ ДО ПОВІДОМЛЕННЯ:
            1. Тон: Професійний, дружній, українською мовою. 
            2. Подякуй за замовлення.
            3. Якщо клієнт має статус вище за "Новачок" (наприклад, Silver, Gold, VIP), обов'язково подякуй за лояльність та згадай це в тексті.
            4. Використовуй емодзі для привабливості.
            5. Структуровано виклади товари, суму та реквізити.
            
            Надай ТІЛЬКИ текст повідомлення для месенджера.
        `;

        const responseText = await callGemini(prompt);
        outputArea.value = responseText;
        showToast("🤖 ШІ сформував повідомлення!", "success");

    } catch (err) {
        console.error(err);
        showToast("❌ Не вдалося згенерувати повідомлення", "error");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

// --- DASHBOARD ---
window.updateDashboard = function () {
    const today = new Date().toISOString().split('T')[0];
    const txs = getTransactions();
    const todayTxs = txs.filter(t => new Date(t.timestamp).toISOString().split('T')[0] === today);
    const rev = todayTxs.reduce((a, b) => a + b.revenue, 0);
    const prof = todayTxs.reduce((a, b) => a + b.profit, 0);
    document.getElementById('dash-revenue').textContent = rev.toFixed(0) + ' ₴';
    document.getElementById('dash-profit').textContent = prof.toFixed(0) + ' ₴';
    document.getElementById('dash-count').textContent = todayTxs.length;
    renderTopProducts(txs);
    renderDashboardCharts(txs);
}
function renderTopProducts(transactions) {
    const productStats = {};
    transactions.forEach(t => {
        if (!productStats[t.perfumeName]) productStats[t.perfumeName] = { vol: 0, revenue: 0 };
        productStats[t.perfumeName].vol += t.quantityML;
        productStats[t.perfumeName].revenue += t.revenue;
    });
    const sortedProducts = Object.entries(productStats).sort(([, a], [, b]) => b.vol - a.vol).slice(0, 5);
    const tbody = document.getElementById('top-products-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    if (sortedProducts.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Немає даних</td></tr>'; return; }
    sortedProducts.forEach(([name, data], index) => {
        let rankDisplay = index + 1;
        if (index === 0) rankDisplay = '🥇 ' + rankDisplay;
        if (index === 1) rankDisplay = '🥈 ' + rankDisplay;
        if (index === 2) rankDisplay = '🥉 ' + rankDisplay;
        tbody.innerHTML += `<tr><td style="font-weight:bold;">${rankDisplay}</td><td>${name}</td><td class="text-right text-bold">${data.vol} мл</td><td class="text-right text-success">${data.revenue.toFixed(0)} ₴</td></tr>`;
    });
}

// --- HISTORY ---
// Week Pagination Helpers
function getWeekBounds(offset = 0) {
    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToMonday + (offset * 7));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { start: startOfWeek, end: endOfWeek };
}

window.navigateWeek = function (direction) {
    CURRENT_WEEK_OFFSET += direction;
    renderTransactionHistory();
    const { start, end } = getWeekBounds(CURRENT_WEEK_OFFSET);
    const label = CURRENT_WEEK_OFFSET === 0
        ? 'Поточний тиждень'
        : start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) + ' - ' + end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    document.getElementById('currentWeekLabel').textContent = label;
    document.getElementById('nextWeekBtn').disabled = CURRENT_WEEK_OFFSET >= 0;
}

window.renderTransactionHistory = function () {
    const tbody = document.getElementById('transaction-history-table').getElementsByTagName('tbody')[0];
    const summary = document.getElementById('transactionSummary');
    tbody.innerHTML = '';
    const uniqueTransactions = {};
    getTransactions().forEach(t => { const key = t.orderId || t.id; if (!uniqueTransactions[key] || t.orderId) uniqueTransactions[key] = t; });
    const filteredTxs = Object.values(uniqueTransactions).filter(t => {
        const search = document.getElementById('transactionSearch').value.toLowerCase();
        const sourceFilter = document.getElementById('historyFilterSource').value;
        const dateFilter = document.getElementById('historyStartDate').value;

        const txDate = new Date(t.timestamp);
        const { start: weekStart, end: weekEnd } = getWeekBounds(CURRENT_WEEK_OFFSET);

        if (txDate < weekStart || txDate > weekEnd) return false;
        if (search && !t.perfumeName.toLowerCase().includes(search) && !t.clientName.toLowerCase().includes(search)) return false;
        if (sourceFilter && t.source !== sourceFilter) return false;
        if (dateFilter && new Date(t.timestamp).toISOString().split('T')[0] !== dateFilter) return false;
        return true;
    });
    let totalRev = 0; let totalProf = 0;
    filteredTxs.sort((a, b) => b.timestamp - a.timestamp).forEach(t => {
        let displayItems = [t];
        if (t.orderId) displayItems = getTransactions().filter(tx => tx.orderId === t.orderId);
        const totalRevenue = displayItems.reduce((acc, item) => acc + (parseFloat(item.revenue) || 0), 0);
        const totalProfit = displayItems.reduce((acc, item) => acc + (parseFloat(item.profit) || 0), 0);
        totalRev += totalRevenue; totalProf += totalProfit;
        const infoText = t.orderId ? `Замовлення (${displayItems.length} поз.)` : `${t.perfumeName} (${t.quantityML} мл)`;
        const ttnDisplay = t.ttnNumber ? `<a href="https://novaposhta.ua/tracking/?cargo_key=${t.ttnNumber}" target="_blank">${t.ttnNumber}</a>` : '-';
        const deleteButton = t.orderId
            ? `<button class="btn-danger btn-sm" onclick="deleteOrder(${t.orderId})"><i class="fa-solid fa-trash"></i></button>`
            : `<button class="btn-danger btn-sm" onclick="deleteTx(${t.id})"><i class="fa-solid fa-trash"></i></button>`;
        const editButton = t.orderId ? `<button class="btn-warning btn-sm" onclick="startEditOrder(${t.orderId})"><i class="fa-solid fa-edit"></i></button>` : '';
        tbody.innerHTML += `<tr><td>${new Date(t.timestamp).toLocaleDateString()}</td><td>${t.clientName}</td><td>${t.source}</td><td>${ttnDisplay}</td><td>${infoText}</td><td class="text-right">${totalRevenue.toFixed(2)}</td><td class="text-right text-success">${totalProfit.toFixed(2)}</td><td class="text-right">${editButton} ${deleteButton}</td></tr>`;
    });
    summary.textContent = 'Всього за тиждень: ' + totalRev.toFixed(2) + ' ₴ (Прибуток: ' + totalProf.toFixed(2) + ' ₴)';

    // Update label if not done yet
    if (CURRENT_WEEK_OFFSET === 0 && document.getElementById('currentWeekLabel').textContent === 'Поточний тиждень') {
        const { start, end } = getWeekBounds(0);
        document.getElementById('currentWeekLabel').textContent = start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) + ' - ' + end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    }
}
window.deleteTx = function (id) {
    if (!confirm("Видалити?")) return;
    const tx = getTransactions().find(t => t.id === id);
    if (tx) { PERFUME_STOCK[tx.perfumeName] = (PERFUME_STOCK[tx.perfumeName] || 0) + tx.quantityML; saveInventory(); }
    saveTransactions(getTransactions().filter(t => t.id !== id));
    renderTransactionHistory(); updateDashboard();
}

// --- TRANSACTIONS NAVIGATION (WEEKLY) ---

window.copyOrderSummary = function () { document.getElementById("orderSummaryOutput").select(); document.execCommand("copy"); showToast("Скопійовано!", "success"); }
window.generateReport = function () {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    const output = document.getElementById('reportOutput');
    if (!start || !end) return;

    // Filter Transactions
    const txs = getTransactions().filter(t => {
        const d = new Date(t.timestamp).toISOString().split('T')[0];
        return d >= start && d <= end;
    });

    // Valid Transaction Count (excluding deleted/invalid if any)
    const count = txs.length;

    // Financials
    const revenue = txs.reduce((a, b) => a + (b.revenue || 0), 0);
    const profit = txs.reduce((a, b) => a + (b.profit || 0), 0);

    // Expenses
    const exps = getExpenses().filter(e => {
        const d = new Date(e.timestamp).toISOString().split('T')[0];
        return d >= start && d <= end;
    });
    const totalExp = exps.reduce((a, b) => a + b.amount, 0);
    const netProfit = profit - totalExp;

    // KPIs
    const avgCheck = count > 0 ? (revenue / count) : 0;
    const margin = revenue > 0 ? ((netProfit / revenue) * 100) : 0;

    // Source Breakdown
    const sourceStats = {};
    txs.forEach(t => {
        const s = t.source || 'Інше';
        sourceStats[s] = (sourceStats[s] || 0) + 1;
    });
    let sourceHtml = '<ul style="margin: 10px 0; padding-left: 20px;">';
    for (const [src, cnt] of Object.entries(sourceStats)) {
        sourceHtml += `<li>${src}: ${cnt}</li>`;
    }
    sourceHtml += '</ul>';

    // HTML Output
    output.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div style="background:var(--bg-input); padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; color:var(--text-muted);">Фінанси</h4>
                <p>Виручка: <strong>${revenue.toFixed(2)} ₴</strong></p>
                <p>Валовий прибуток: <strong>${profit.toFixed(2)} ₴</strong></p>
                <p>Витрати: <span style="color:var(--danger);">-${totalExp.toFixed(2)} ₴</span></p>
                <hr style="border:0; border-top:1px dashed var(--border);">
                <p style="font-size:1.2rem; color:var(--primary);">Чистий прибуток: <strong>${netProfit.toFixed(2)} ₴</strong></p>
            </div>
            <div style="background:var(--bg-input); padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; color:var(--text-muted);">KPI & Джерела</h4>
                <p>Кількість продажів: <strong>${count}</strong></p>
                <p>Середній чек: <strong>${avgCheck.toFixed(0)} ₴</strong></p>
                <p>Рентабельність: <strong>${margin.toFixed(1)}%</strong></p>
                <hr style="border:0; border-top:1px dashed var(--border);">
                <div style="font-size: 0.9rem;"><strong>По джерелах:</strong>${sourceHtml}</div>
            </div>
        </div>
    `;
}
window.addExpense = function () {
    const desc = document.getElementById('expenseDescription').value; const amount = parseFloat(document.getElementById('expenseAmount').value);
    if (!desc || !amount) return;
    const exps = getExpenses(); exps.push({ id: Date.now(), timestamp: Date.now(), description: desc, amount: amount });
    saveExpenses(exps); renderExpenseList();
    document.getElementById('expenseDescription').value = ''; document.getElementById('expenseAmount').value = '';
}
window.renderExpenseList = function () {
    const div = document.getElementById('expenseListOutput');
    const exps = getExpenses().sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    div.innerHTML = exps.map(e => `<div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding:5px 0;"><span>${e.description}</span><span style="font-weight:bold; color:var(--danger)">-${e.amount} ₴</span></div>`).join('');
}
window.addOrUpdateFlacon = function () {
    const vol = parseFloat(document.getElementById('adminFlaconVolume').value); const cost = parseFloat(document.getElementById('adminFlaconCost').value);
    if (vol && cost) { FLACON_COSTS[vol] = cost; if (!FLACON_VOLUMES.includes(vol)) FLACON_VOLUMES.push(vol); saveToLocalStorage(CONFIG_KEYS.FLACONS, FLACON_COSTS); saveToLocalStorage(CONFIG_KEYS.VOLUMES, FLACON_VOLUMES); populateFormOptions(); showToast("Флакон додано", "success"); }
}
window.addOrUpdateMarkupPreset = function () {
    const name = document.getElementById('adminMarkupName').value; const val = parseFloat(document.getElementById('adminMarkupValue').value);
    if (name && val) { MARKUP_PRESETS[name] = val; saveToLocalStorage(CONFIG_KEYS.MARKUPS, MARKUP_PRESETS); populateFormOptions(); showToast("Націнку додано", "success"); }
}
window.calculateRetailPrice = function () {
    const name = document.getElementById('calcPerfumeName').value; const vol = parseFloat(document.getElementById('calcFlaconVolume').value); const mark = document.getElementById('calcMarkupTier').value;
    const res = calculateCost(name, vol, mark);
    if (res) { document.getElementById('calculatorOutput').innerHTML = `<strong>Ціна: ${res.revenue.toFixed(0)} ₴</strong>`; }
}
window.generatePriceList = function () {
    const markupKey = document.getElementById('priceListMarkup').value;
    if (!markupKey) return;
    const date = new Date().toLocaleDateString('uk-UA');
    let text = '📋 ПРАЙС-ЛИСТ PERFUMEFLOW\n📅 Дата: ' + date + '\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    text += '🧴 ВАРТІСТЬ ФЛАКОНІВ:\n\n';
    const bottleSizes = [3, 5, 10, 15, 20, 30, 40, 50, 100];
    bottleSizes.forEach(size => {
        const cost = FLACON_COSTS[size];
        if (cost) text += '   ' + size + ' мл — ' + cost + ' грн\n';
    });
    text += '\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n💎 ЦІНИ НА ПАРФУМИ:\n(ціна за 1 мл)\n\n';
    Object.keys(PERFUME_PRICES).sort().forEach(name => {
        const basePrice = PERFUME_PRICES[name].basePrice;
        if (!basePrice) return;
        const markup = MARKUP_PRESETS[markupKey] || 0.12;
        const pricePerMl = Math.round(basePrice * (1 + markup));
        text += '🔹 ' + name + '\n   ' + pricePerMl + ' грн/мл\n\n';
    });
    text += '━━━━━━━━━━━━━━━━━━━━━━━━\n\n📱 Для замовлення - пишіть!\n✨ Розливаємо від 3 мл\n';
    const output = document.getElementById('priceListOutput');
    output.value = text;
    output.select();
    document.execCommand("copy");
    showToast("✅ Прайс скопійовано!", "success");
}
window.showClientHistory = function () {
    const clientName = document.getElementById('clientSearchInput').value.trim().toLowerCase(); if (!clientName) return;
    const txs = getTransactions().filter(t => t.clientName.toLowerCase().includes(clientName));
    const tbody = document.getElementById('client-history-table').getElementsByTagName('tbody')[0]; tbody.innerHTML = '';

    const stats = getClientStats(clientName); // Use new helper
    document.getElementById('aiClientAnalysisBtn').style.display = txs.length > 0 ? 'inline-block' : 'none';

    txs.forEach(t => { tbody.innerHTML += `<tr><td>${new Date(t.timestamp).toLocaleDateString()}</td><td>${t.perfumeName} (${t.quantityML}ml)</td><td class="text-right">${t.revenue}</td><td class="text-right">${t.profit}</td></tr>`; });

    // Rich summary with Loyalty Level
    document.getElementById('clientCrmSummary').innerHTML = `
        <div style="background:var(--bg-input); padding:15px; border-radius:8px; border-left: 4px solid var(--primary);">
            <div style="font-size:1.1rem; font-weight:bold;">${clientName.toUpperCase()}</div>
            <div style="margin-top:5px;">Рівень: <span style="color:var(--primary); font-weight:800;">${stats.level}</span></div>
            <div>Всього покупок: <strong>${txs.length}</strong></div>
            <div>Загальна сума: <strong>${stats.totalSpend.toFixed(0)} ₴</strong></div>
            ${stats.discount > 0 ? `<div style="margin-top:5px; color:var(--secondary); font-weight:bold;">✨ Активна знижка: ${(stats.discount * 100).toFixed(0)}%</div>` : ''}
        </div>
    `;
}

window.analyzeClientPreferences = async function () {
    const clientName = document.getElementById('clientSearchInput').value.trim();
    if (!clientName) return;

    const txs = getTransactions().filter(t => t.clientName.toLowerCase().includes(clientName.toLowerCase()));
    if (txs.length === 0) return;

    const btn = document.getElementById('aiClientAnalysisBtn');
    const originalContent = btn.innerHTML;
    const summaryDiv = document.getElementById('clientCrmSummary');

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Аналізую...';
    btn.disabled = true;

    try {
        // Prepare purchase history with flavor data
        const purchaseHistory = txs.map(t => {
            const pData = PERFUME_PRICES[t.perfumeName] || {};
            return {
                perfume: t.perfumeName,
                volume: t.quantityML,
                gender: pData.gender || 'не вказано',
                tags: (pData.tags || []).join(', '),
                pyramid: pData.pyramid || 'немає дани'
            };
        });

        const prompt = `
            Ти — психолог-парфумер та експерт CRM. Проаналізуй історію покупок клієнта "${clientName}" та створи його "Ароматний Портрет".
            
            ІСТОРІЯ ПОКУПОК:
            ${JSON.stringify(purchaseHistory)}
            
            ТВОЄ ЗАВДАННЯ:
            1. Визнач домінуючі смаки (наприклад: любить деревні, свіжі чи солодкі аромати).
            2. Опиши характер клієнта як покупця (наприклад: "Експериментатор", "Любитель класики", "Шукає шлейфові аромати").
            3. Сформуй 3-5 коротких міток (тагів) для CRM.
            4. Порекомендуй 1-2 типи ароматів, які йому точно сподобаються, але він їх ще не купував.
            
            Відповідай українською мовою. Форматуй відповідь емодзі та жирним текстом. Зроби це професійно та надихаюче.
        `;

        const responseText = await callGemini(prompt);

        // Add analysis to the summary
        const analysisHtml = `
            <div id="aiClientAnalysisResult" style="margin-top:15px; padding:15px; background:rgba(var(--primary-rgb), 0.05); border:1px dashed var(--primary); border-radius:8px;">
                <h4 style="margin-bottom:10px;"><i class="fa-solid fa-magic"></i> ШІ-Портрет Клієнта</h4>
                <div style="font-size:0.9rem; line-height:1.5;">${responseText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
            </div>
        `;

        // Append or replace if already exists
        const oldResult = document.getElementById('aiClientAnalysisResult');
        if (oldResult) oldResult.remove();
        summaryDiv.innerHTML += analysisHtml;

        showToast("🏷️ Аналіз уподобань готовий!", "success");

    } catch (err) {
        console.error(err);
        showToast("❌ Помилка ШІ-аналізу", "error");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

// --- MODAL UTILS ---
function generateReceiptHTML(orderItems, totalOriginal, clientName, ttn = null, discount = 0) {
    const total = totalOriginal.toFixed(2);
    const discountAmount = totalOriginal * (discount / 100);
    const finalTotal = totalOriginal - discountAmount;
    const date = new Date().toLocaleDateString('uk-UA');

    const itemsHtml = orderItems.map((item, index) => `<p style="margin: 5px 0; display: flex; justify-content: space-between; font-size: 0.95rem;"><span>${index + 1}. ${item.name} (${item.vol} мл)</span><span class="text-bold">${item.revenue.toFixed(2)} ₴</span></p>`).join('');
    const ttnDisplay = ttn ? `<p style="margin: 10px 0; font-weight: 600;">📦 ТТН: ${ttn}</p>` : '';

    let totalsHtml = `<div class="receipt-total">До сплати: ${finalTotal.toFixed(2)} ₴</div>`;
    if (discount > 0) {
        totalsHtml = `
            <div style="border-top: 2px dashed var(--border); margin-top:15px; padding-top:10px; text-align:right;">
                <p>Сума: ${totalOriginal.toFixed(2)} ₴</p>
                <p style="color:var(--secondary);">Знижка (${discount}%): -${discountAmount.toFixed(2)} ₴</p>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-top:5px;">Разом: ${finalTotal.toFixed(2)} ₴</div>
            </div>`;
    }

    return `<div style="max-width: 300px; margin: 0 auto; padding: 15px; border: 1px dashed var(--border); border-radius: 5px; font-family: monospace; color: var(--text-main);"><h3 style="text-align: center; margin-bottom: 5px; color: var(--primary);">PerfumeFlow</h3><p style="text-align: center; margin-bottom: 15px; border-bottom: 1px dashed var(--border); padding-bottom: 5px; font-size: 0.85rem;">Дата: ${date} | Клієнт: ${clientName}</p>${itemsHtml}${ttnDisplay}${totalsHtml}<p style="text-align: center; margin-top: 20px; font-size: 0.9rem; color: var(--text-muted);" class="no-print">Дякуємо!</p><div class="no-print admin-buttons-group" style="margin-top: 20px; text-align: center; display: flex; gap: 10px;"><button onclick="window.print()" style="background-color: var(--secondary); flex-grow: 1; color: white; border: none; border-radius: 4px; padding: 8px;">🖨️ Друк</button><button onclick="closeReceiptModal()" style="background-color: var(--text-muted); flex-grow: 1; color: white; border: none; border-radius: 4px; padding: 8px;">Закрити</button></div></div>`;
}
function showModalReceipt(orderItems, totalRounded, clientName, ttn = null, discount = 0) {
    document.getElementById('receiptContent').innerHTML = generateReceiptHTML(orderItems, totalRounded, clientName, ttn, discount);
    document.getElementById('receiptModal').classList.add('active');
}
window.closeReceiptModal = function () { document.getElementById('receiptModal').classList.remove('active'); }

// --- SYNC / EXPORT ---
window.showSyncModal = function () {
    const allData = {}; Object.values(CONFIG_KEYS).forEach(key => allData[key] = JSON.parse(localStorage.getItem(key) || 'null'));
    document.getElementById('syncDataOutput').value = JSON.stringify(allData); document.getElementById('syncModal').classList.add('active');
}
window.closeSyncModal = function () { document.getElementById('syncModal').classList.remove('active'); }
window.copySyncData = function () { document.getElementById("syncDataOutput").select(); document.execCommand("copy"); showToast("Скопійовано!", "success"); }
window.importDataFromSync = function () {
    try { const data = JSON.parse(document.getElementById('syncDataInput').value); if (confirm("Це перезапише дані! Продовжити?")) { Object.keys(data).forEach(key => { if (data[key]) localStorage.setItem(key, JSON.stringify(data[key])); }); location.reload(); } } catch (e) { showToast("Помилка формату", "error"); }
}
window.exportDataToJSON = function () {
    const allData = {};
    Object.values(CONFIG_KEYS).forEach(key => {
        const item = localStorage.getItem(key);
        // Save parsed JSON if it exists, otherwise null
        allData[key] = item ? JSON.parse(item) : null;
    });

    // Use Blob for massive data support related to base64 limits
    const dataStr = JSON.stringify(allData, null, 2); // Pretty print for readability
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const dl = document.createElement('a');
    dl.setAttribute("href", url);
    dl.setAttribute("download", "crm_backup_" + new Date().toISOString().slice(0, 10) + ".json");
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
    URL.revokeObjectURL(url); // Clean up
    showToast("Бек-ап успішно створено!", "success");
}

window.importDataFromJSON = function () {
    const fileInput = document.getElementById('importFileInput');
    if (!fileInput.files || !fileInput.files.length) {
        showToast("⚠️ Виберіть файл перед відновленням!", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm("⚠️ УВАГА: Всі поточні дані будуть замінені даними з файлу. Продовжити?")) {
                Object.keys(data).forEach(key => {
                    // Only restore known config keys to ensure safety
                    if (Object.values(CONFIG_KEYS).includes(key) && data[key] !== null) {
                        localStorage.setItem(key, JSON.stringify(data[key]));
                    }
                });
                showToast("Дані успішно відновлено! Оновлення...", "success");
                setTimeout(() => location.reload(), 1500); // Give time to read toast
            }
        } catch (err) {
            console.error(err);
            showToast(`❌ Помилка читання файлу: ${err.message}`, "error");
        }
    };

    reader.onerror = function () {
        showToast("❌ Помилка завантаження файлу", "error");
    };

    reader.readAsText(fileInput.files[0]);
}

// --- TASK MANAGEMENT (NEW) ---
window.switchTaskTab = function (tabName) {
    const ordersView = document.getElementById('task-view-orders');
    const manualView = document.getElementById('task-view-manual');
    const ordersTab = document.getElementById('tab-orders');
    const manualTab = document.getElementById('tab-manual');

    if (tabName === 'orders') {
        ordersView.style.display = 'block';
        manualView.style.display = 'none';
        ordersTab.classList.add('active');
        manualTab.classList.remove('active');
        renderTasksOrders();
    } else {
        ordersView.style.display = 'none';
        manualView.style.display = 'block';
        ordersTab.classList.remove('active');
        manualTab.classList.add('active');
        renderTasksManual();
    }
}

function getTasks() { return getFromLocalStorage(CONFIG_KEYS.TASKS, []); }
function saveTasks(tasks) { saveToLocalStorage(CONFIG_KEYS.TASKS, tasks); }
function getCompletedOrders() { return getFromLocalStorage(CONFIG_KEYS.COMPLETED_ORDERS, []); }
function saveCompletedOrders(ids) { saveToLocalStorage(CONFIG_KEYS.COMPLETED_ORDERS, ids); }

window.renderTasksOrders = function () {
    const container = document.getElementById('orders-task-list');
    if (!container) return;
    container.innerHTML = '';

    const completedIds = getCompletedOrders();
    const txs = getTransactions().filter(t => t.orderId);
    const uniqueOrderIds = [...new Set(txs.map(t => t.orderId))];

    // Sort: Pending first, then by date (reverse)
    uniqueOrderIds.sort((a, b) => {
        const aCompleted = completedIds.includes(a);
        const bCompleted = completedIds.includes(b);
        if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
        return b - a; // Newest first
    });

    uniqueOrderIds.forEach(orderId => {
        const orderItems = txs.filter(t => t.orderId === orderId);
        const t = orderItems[0];
        const itemsText = orderItems.map(oi => `🔹 ${oi.perfumeName} (${oi.quantityML} мл)`).join('\n');
        const isCompleted = completedIds.includes(orderId);

        const card = document.createElement('div');
        card.className = `task-card task-order ${isCompleted ? 'completed' : ''}`;
        card.innerHTML = `
            <div class="task-date">${new Date(t.timestamp).toLocaleString()}</div>
            <div class="task-type" style="background: #dbeafe; color: #1e40af;">📦 ЗАМОВЛЕННЯ #${orderId}</div>
            <div style="font-weight: bold; margin-bottom: 5px;">Клієнт: ${t.clientName}</div>
            <div class="task-content"><strong>Склад замовлення:</strong>\n${itemsText}</div>
            <div class="task-actions">
                 ${isCompleted
                ? '<span style="color:var(--success); font-weight:bold; font-size:0.8rem;">🗸 ВИКОНАНО</span>'
                : `<button class="btn-sm btn-success" onclick="completeOrderTask(${orderId})">✅ Виконано</button>`}
            </div>
        `;
        container.appendChild(card);
    });

    if (uniqueOrderIds.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 50px;">Замовлень поки немає</p>';
    }
}

window.renderTasksManual = function () {
    const container = document.getElementById('manual-task-list');
    if (!container) return;
    container.innerHTML = '';

    let tasks = getTasks().filter(t => t.type === 'manual');

    // Sort: Pending first, then by date (reverse)
    tasks.sort((a, b) => {
        const aComp = a.status === 'completed';
        const bComp = b.status === 'completed';
        if (aComp !== bComp) return aComp ? 1 : -1;
        return b.timestamp - a.timestamp;
    });

    tasks.forEach(task => {
        const isCompleted = task.status === 'completed';
        const card = document.createElement('div');
        card.className = `task-card task-manual ${isCompleted ? 'completed' : ''}`;
        card.innerHTML = `
            <div class="task-date">${new Date(task.timestamp).toLocaleString()}</div>
            <div class="task-type" style="background: #f3e8ff; color: #6b21a8;">📝 РУЧНА ЗАДАЧА</div>
            <div class="task-content">${task.content}</div>
            <div class="task-actions">
                 ${!isCompleted ? `
                    <button class="btn-sm btn-warning" onclick="editManualTask(${task.id})"><i class="fa-solid fa-edit"></i></button>
                    <button class="btn-sm btn-success" onclick="completeManualTask(${task.id})">✅</button>
                 ` : `
                    <button class="btn-sm btn-danger" onclick="deleteManualTask(${task.id})"><i class="fa-solid fa-trash"></i></button>
                 `}
            </div>
        `;
        container.appendChild(card);
    });

    if (tasks.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 50px;">Ручних задач немає</p>';
    }
}

window.createManualTaskAI = async function () {
    const text = document.getElementById('manualTaskInput').value.trim();
    if (!text) return;

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Створення...';
    btn.disabled = true;

    try {
        const prompt = `Ти - помічник у CRM для парфумерії. Користувач ввів нотатку.
Твоя задача: зробити її структурованою та граматично правильною.
НОТАТКА: "${text}"

Поверни ТІЛЬКИ відформатований текст задачі без зайвих слів. Якщо в тексті є дати або імена, виділи їх.
Мова: Українська.`;

        const aiOutput = await callGemini(prompt);
        const tasks = getTasks();
        tasks.push({
            id: Date.now(),
            type: 'manual',
            content: aiOutput.trim(),
            timestamp: Date.now(),
            status: 'pending'
        });
        saveTasks(tasks);
        document.getElementById('manualTaskInput').value = '';
        renderTasksManual();
        showToast("✅ Задачу створено!", "success");
    } catch (e) {
        showToast("❌ Помилка AI: " + e.message, "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

window.completeManualTask = function (id) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = 'completed';
        saveTasks(tasks);
        renderTasksManual();
        showToast("✅ Задачу виконано", "success");
    }
}

window.deleteManualTask = function (id) {
    if (!confirm("Видалити цю задачу назавжди?")) return;
    const tasks = getTasks().filter(t => t.id !== id);
    saveTasks(tasks);
    renderTasksManual();
    showToast("🗑️ Задача видалена", "error");
}

window.completeOrderTask = function (orderId) {
    const completedIds = getCompletedOrders();
    if (!completedIds.includes(orderId)) {
        completedIds.push(orderId);
        saveCompletedOrders(completedIds);
        renderTasksOrders();
        showToast("✅ Замовлення позначено як розлите та виконане", "success");
    }
}

window.editManualTask = async function (id) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newText = prompt("Редагувати задачу:", task.content);
    if (newText !== null) {
        task.content = newText;
        saveTasks(tasks);
        renderTasksManual();
    }
}

// Initial Tasks Load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof renderTasksOrders === 'function') renderTasksOrders();
    }, 1000);
});

// --- SETTINGS (AI API) ---
window.openSettingsModal = function () {
    document.getElementById('settingsModal').classList.add('active');
    document.getElementById('apiKeyInput').value = localStorage.getItem('gemini_api_key') || '';

    // Load Supabase config
    const config = getSupabaseConfig();
    if (document.getElementById('supabaseUrlInput')) {
        document.getElementById('supabaseUrlInput').value = config.url || '';
        document.getElementById('supabaseKeyInput').value = config.key || '';
    }

    // Update sync status display
    updateSyncStatus();

    // Set model select value
    const savedModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
    if (document.getElementById('geminiModelSelect')) {
        document.getElementById('geminiModelSelect').value = savedModel;
    }
}
window.closeSettingsModal = function () { document.getElementById('settingsModal').classList.remove('active'); }
window.saveApiKey = function (key) { localStorage.setItem('gemini_api_key', key.trim()); showToast("Ключ збережено", "success"); }
// --- TASK MANAGEMENT INITIALIZATION ---
window.renderTasks = function () {
    switchTaskTab('orders');
}

window.saveGeminiKey = function (key) { saveApiKey(key); }

// Fix the recursive call by using a unique name or checking for existence correctly
window.saveTelegramConfig = function () {
    // This calls the function defined in telegram.js if it exists
    if (typeof saveTelegramConfig === 'function' && !saveTelegramConfig.isWrapper) {
        saveTelegramConfig();
    } else {
        // Fallback or specific logic if needed
        const token = document.getElementById('telegramBotTokenInput').value.trim();
        const channel = document.getElementById('telegramChannelIdInput').value.trim();
        if (token) localStorage.setItem('telegram_bot_token', token);
        if (channel) localStorage.setItem('telegram_channel_id', channel);
        showToast("✅ Telegram налаштування збережено", "success");
    }
}
window.saveTelegramConfig.isWrapper = true;

async function callGemini(prompt) {
    const apiKey = localStorage.getItem('gemini_api_key');
    const model = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';

    if (!apiKey) {
        showToast("🔑 Додайте Gemini API Key у налаштуваннях!", "error");
        openSettingsModal();
        throw new Error("API Key missing");
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, topP: 1 }
            })
        });

        if (response.status === 429) {
            throw new Error("⏳ Перевищено ліміт запитів ШІ. Зачекайте 15-30 секунд і спробуйте знову, або перемкніть модель на 1.5 Flash.");
        }

        const data = await response.json();
        if (data.error) {
            if (data.error.message.includes("quota") || data.error.message.includes("limit")) {
                throw new Error("⏳ Квота ШІ вичерпана. Зачекайте хвилину або виберіть 'Gemini 1.5 Flash' у налаштуваннях.");
            }
            throw new Error(data.error.message);
        }

        if (!data.candidates || !data.candidates[0].content.parts[0].text) throw new Error("Порожня відповідь від AI");

        return data.candidates[0].content.parts[0].text;
    } catch (err) {
        console.error("Gemini Error:", err);
        throw err;
    }
}

// --- AI PARSING (UPGRADED) ---
window.smartParseAI = async function (mode = 'single') {
    const inputId = mode === 'order' ? 'pasteAreaOrder' : 'pasteArea';
    const text = document.getElementById(inputId).value;

    if (!text) { showToast("⚠️ Спочатку вставте текст!", "warning"); return; }

    const btn = document.querySelector(`button[onclick*="smartParseAI"]`);
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Обробка...';
    btn.disabled = true;

    try {
        const perfumesList = Object.keys(PERFUME_PRICES).join(', ');
        const volumesList = FLACON_VOLUMES.join(', ');

        const prompt = `
            Ти — професійний асистент CRM для продажу парфумерії. 
            Твоє завдання: витягнути дані про замовлення та клієнта з тексту (текст може бути на українській, російській або суржику).

            КАТАЛОГ ПАРФУМІВ (доступні назви): [${perfumesList}]
            ДОСТУПНІ ОБ'ЄМИ: [${volumesList}]

            ПРАВИЛА:
            1. Для назв парфумів вибирай НАЙБЛИЖЧУ назву з КАТАЛОГУ (використовуй нечітке порівняння). Якщо зовсім не схоже — ігноруй.
            2. Імена та адреси пиши українською мовою.
            3. Об'єми мають бути ТІЛЬКИ з доступного списку.

            ПОВЕРНИ ТІЛЬКИ JSON:
            {
              "clientName": "ПІБ",
              "phone": "Телефон (0XXXXXXXXX)",
              "city": "Місто або н.п.",
              "postOffice": "Номер відділення або адреса",
              "items": [
                { "perfumeName": "Точна назва з каталогу", "volume": число }
              ]
            }

            ТЕКСТ ДЛЯ РОЗБОРУ:
            "${text}"
        `;

        const responseText = await callGemini(prompt);
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        // Fill Client Data
        const fieldMap = mode === 'order' ?
            { name: 'clientNameOrder', phone: 'phoneOrder', city: 'cityOrder', post: 'postOfficeOrder' } :
            { name: 'clientNameSingle', phone: 'phoneSingle', city: 'citySingle', post: 'postOfficeSingle' };

        if (result.clientName) document.getElementById(fieldMap.name).value = result.clientName;
        if (result.phone) document.getElementById(fieldMap.phone).value = result.phone;
        if (result.city) document.getElementById(fieldMap.city).value = result.city;
        if (result.postOffice) document.getElementById(fieldMap.post).value = result.postOffice;

        // Auto-Add Items
        if (result.items && result.items.length > 0) {
            let addedCount = 0;
            const markup = document.getElementById('saleMarkupTierOrder')?.value || 'Стандарт';

            result.items.forEach(item => {
                const pName = item.perfumeName;
                const vol = item.volume;

                if (pName && PERFUME_PRICES[pName] && vol) {
                    if (mode === 'order') {
                        const calc = calculateCost(pName, vol, markup);
                        if (calc) {
                            CURRENT_ORDER_LIST.push({ ...calc, name: pName, vol: vol, markup: markup });
                            addedCount++;
                        }
                    } else {
                        if (addedCount === 0) {
                            document.getElementById('perfumeName').value = pName;
                            document.getElementById('flaconVolume').value = vol;
                            addedCount++;
                        }
                    }
                }
            });

            if (addedCount > 0) {
                if (mode === 'order') renderOrderList();
                showToast(`🤖 AI розпізнав та додав ${addedCount} позицій!`, "success");
            }
        }

        if (result.clientName) {
            const inputEl = mode === 'order' ? document.getElementById('clientNameOrder') : document.getElementById('clientNameSingle');
            checkClientLoyalty(inputEl);
        }

    } catch (err) {
        console.error(err);
        showToast("❌ Помилка AI розбору. Перевірте ключ або текст.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- UNIVERSAL ADMIN BOT ---
window.runAdminAI = async function () {
    const input = document.getElementById('adminAiChatInput').value.trim();
    if (!input) return;

    const resDiv = document.getElementById('adminAiResponse');
    const contentDiv = document.getElementById('adminAiResponseContent');
    const btn = document.querySelector('button[onclick="runAdminAI()"]');

    resDiv.style.display = 'block';
    contentDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Аналізую...';
    btn.disabled = true;

    try {
        const perfumesList = Object.entries(PERFUME_PRICES).map(([name, data]) => {
            const stock = PERFUME_STOCK[name] || 0;
            return `
- НАЗВА: ${name}
  НАЯВНІСТЬ: ${stock} мл
  СТАТЬ: ${data.gender || 'не вказано'}
  СЕЗОН: ${(data.seasons || []).join(', ')}
  ТЕГИ: ${(data.tags || []).join(', ')}
  ПІРАМІДА: ${data.pyramid || 'немає дани'}
  ОПИС: ${data.description || 'немає дани'}
            `;
        }).join('\n');

        const prompt = `
            Ти — професійний менеджер та консультант магазину парфумерії. 
            Тобі надано актуальний каталог та дані про склад:
            ${perfumesList}

            ЛОГІКА ТВОЄЇ РОБОТИ:
            1. ЛЮДЯНІСТЬ: Спілкуйся ввічливо, професійно, українською мовою. 
            2. ЗНАННЯ: Якщо у нашому каталозі немає опису або піраміди для парфуму, використай свої внутрішні знання, щоб розповісти про нього клієнту.
            3. КОНСУЛЬТАЦІЯ: На запит "що порадити" або "що схоже" — підбирай варіанти на основі нот (піраміди), сезону та статі. Віддавай ПРІОРИТЕТ товарам, які є в наявності (>0 мл), але можеш згадати і відсутні, якщо вони ідеально підходять (зазначаючи, що їх зараз немає).
            4. РОЗРАХУНКИ: Якщо клієнт просить розрахувати ціну або OLX доставку — роби це чітко. 
               Формула OLX: ((Ціна_Товару + 35) * 1.03).

            ЗАПИТ КЛІЄНТА: "${input}"
        `;

        const responseText = await callGemini(prompt);
        contentDiv.innerHTML = responseText;
        contentDiv.innerHTML = responseText;
    } catch (err) {
        console.error(err);
        contentDiv.innerHTML = "❌ Помилка: " + err.message;
    } finally {
        btn.disabled = false;
    }
}

// --- SMM CREATOR ---
window.generateSMMContent = async function () {
    const pName = document.getElementById('smmPerfumeName').value;
    const goal = document.getElementById('smmGoal').value;

    if (!pName || !PERFUME_PRICES[pName]) {
        showToast("⚠️ Оберіть парфум зі списку!", "warning");
        return;
    }

    const pData = PERFUME_PRICES[pName];
    const outDiv = document.getElementById('smmOutput');
    const outContent = document.getElementById('smmOutputContent');
    const btn = document.querySelector('button[onclick="generateSMMContent()"]');

    outDiv.style.display = 'block';
    outContent.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Створюю креатив...';
    btn.disabled = true;

    try {
        const prompt = `
            Ти — професійний SMM-менеджер парфумерного бренду.
            Парфум: "${pName}".
            Дані: Стать: ${pData.gender}, Сезони: ${(pData.seasons || []).join(', ')}, Теги: ${(pData.tags || []).join(', ')}.
            Ціль: ${goal} (post, story, ads або strategy).

            Створи захоплюючий контент українською мовою. 
            Використовуй емодзі, заклики до дії та хештеги. 
            Якщо це Story — зроби сценарій на 3-4 кадри.
        `;

        const responseText = await callGemini(prompt);
        outContent.innerHTML = responseText;
    } catch (err) {
        console.error(err);
        outContent.innerHTML = "❌ Помилка: " + err.message;
    } finally {
        btn.disabled = false;
    }
}

// ==========================================
//  SUPABASE INTEGRATION
// ==========================================
let supabaseClient = null;

function getSupabaseConfig() {
    return {
        url: localStorage.getItem('supabase_url') || 'https://oxxzlqwnssivwzhalojw.supabase.co',
        key: localStorage.getItem('supabase_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eHpscXduc3Npdnd6aGFsb2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU0MjgsImV4cCI6MjA4NTAyMTQyOH0.NsAb_R46ziufVT_5tqqTW9RntLkCdKDjzvd5m234_us'
    };
}
window.saveSupabaseConfig = function () {
    const url = document.getElementById('supabaseUrlInput').value.trim();
    const key = document.getElementById('supabaseKeyInput').value.trim();
    if (url) localStorage.setItem('supabase_url', url);
    if (key) localStorage.setItem('supabase_key', key);
    initSupabase();
}

function initSupabase() {
    const config = getSupabaseConfig();
    if (config.url && config.key && window.supabase) {
        try {
            supabaseClient = window.supabase.createClient(config.url, config.key);
            console.log("Supabase Client Initialized");
        } catch (e) {
            console.error("Supabase Init Error", e);
        }
    }
    // Populate inputs
    if (document.getElementById('supabaseUrlInput')) {
        document.getElementById('supabaseUrlInput').value = config.url || '';
        document.getElementById('supabaseKeyInput').value = config.key || '';
    }
}

// Call init on load
document.addEventListener('DOMContentLoaded', initSupabase);

// Helper function to update sync status display
function updateSyncStatus() {
    const lastSync = localStorage.getItem('last_cloud_sync');
    const lastRestore = localStorage.getItem('last_cloud_restore');

    // This will be called when settings modal opens
    const syncStatusEl = document.getElementById('syncStatusDisplay');
    if (syncStatusEl && lastSync) {
        const syncDate = new Date(lastSync);
        const timeAgo = getTimeAgo(syncDate);
        syncStatusEl.innerHTML = `<div style="margin-top: 10px; padding: 10px; background: rgba(16, 185, 129, 0.1); border-left: 3px solid var(--secondary); border-radius: 4px;">
            <strong>✅ Остання синхронізація:</strong><br>
            ${syncDate.toLocaleString('uk-UA')} (${timeAgo})
        </div>`;
    }

    if (syncStatusEl && lastRestore) {
        const restoreDate = new Date(lastRestore);
        const timeAgo = getTimeAgo(restoreDate);
        syncStatusEl.innerHTML += `<div style="margin-top: 5px; padding: 10px; background: rgba(79, 70, 229, 0.1); border-left: 3px solid var(--primary); border-radius: 4px;">
            <strong>📥 Останнє відновлення:</strong><br>
            ${restoreDate.toLocaleString('uk-UA')} (${timeAgo})
        </div>`;
    }
}

// Helper to calculate time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'щойно';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} хв тому`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} год тому`;
    return `${Math.floor(seconds / 86400)} дн тому`;
}

window.testSupabaseConnection = async function () {
    if (!supabaseClient) { initSupabase(); }
    if (!supabaseClient) { showToast("⚠️ Спочатку введіть URL та Key!", "error"); return; }

    showToast("🔄 Перевірка з'єднання...", "primary");

    try {
        // Try to select from a table named 'app_data'
        const { data, error } = await supabaseClient
            .from('app_data')
            .select('count', { count: 'exact', head: true });

        if (error) {
            throw error;
        }

        showToast("✅ З'єднання успішне! Таблиця app_data знайдена.", "success");
        console.log("✅ Supabase connection test successful");

    } catch (error) {
        console.error("❌ Connection test error:", error);

        if (error.code === '42P01') {
            const msg = "⚠️ З'єднання працює, але таблиця app_data не знайдена!\n\nСтворіть таблицю:\n1. Supabase Dashboard → Table Editor\n2. New Table: app_data\n3. Колонки: id (int8), json_data (jsonb), updated_at (timestamp)";
            alert(msg);
            showToast("⚠️ Таблиця app_data не створена", "warning");
        } else if (error.code === 'PGRST301') {
            showToast("❌ Невірний URL або Key", "error");
        } else if (error.message.includes('Failed to fetch')) {
            showToast("❌ Не вдалося підключитися. Перевірте URL.", "error");
        } else {
            showToast(`❌ Помилка: ${error.message}`, "error");
        }
    }
}


window.syncWithCloud = async function () {
    if (!supabaseClient) {
        showToast("⚠️ Налаштуйте Supabase!", "error");
        return;
    }

    if (!confirm("Це синхронізує ваші дані з хмарою. Продовжити?")) return;

    showToast("🔄 Підготовка даних...", "primary");

    try {
        // 1. Prepare Local Data
        const allData = {};
        let totalSize = 0;

        Object.values(CONFIG_KEYS).forEach(key => {
            const item = localStorage.getItem(key);
            if (item) {
                try {
                    // Try to parse as JSON first
                    allData[key] = JSON.parse(item);
                } catch (e) {
                    // If parse fails, it's a plain string (like theme: 'dark')
                    allData[key] = item;
                }
                totalSize += item.length;
            } else {
                allData[key] = null;
            }
        });

        // 2. Validate data size (Supabase has limits)
        const dataSizeMB = (totalSize / 1024 / 1024).toFixed(2);
        console.log(`📊 Розмір даних для синхронізації: ${dataSizeMB} MB`);

        if (totalSize > 10 * 1024 * 1024) { // 10MB limit
            showToast(`⚠️ Дані занадто великі (${dataSizeMB} MB). Максимум 10 MB.`, "error");
            return;
        }

        showToast("🔄 Відправка в хмару...", "primary");

        // 3. Upload (Upsert) with Timeout (20s)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout: Сервер не відповідає (20 сек)')), 20000)
        );

        const supabasePromise = supabaseClient
            .from('app_data')
            .upsert({
                id: 1,
                json_data: allData
            })
            .select();

        const result = await Promise.race([supabasePromise, timeoutPromise]);

        if (result.error) {
            throw result.error;
        }

        // 4. Save sync timestamp
        localStorage.setItem('last_cloud_sync', new Date().toISOString());

        const syncTime = new Date().toLocaleString('uk-UA');
        showToast(`✅ Дані збережено в хмару! (${syncTime})`, "success");
        console.log("✅ Supabase Sync Success:", result.data);

        // Update UI if sync status element exists
        updateSyncStatus();

    } catch (error) {
        console.error("❌ Supabase Save Error:", error);

        let errorMessage = "Невідома помилка";
        let errorDetails = "";

        // Parse different error types
        if (error.message) {
            errorMessage = error.message;
        }

        if (error.code === 'PGRST301') {
            errorDetails = "\n\n💡 Можлива причина: Таблиця app_data не існує або має неправильну структуру.\n\nРішення:\n1. Перейдіть в Supabase Dashboard\n2. Table Editor → New Table\n3. Назва: app_data\n4. Колонки: id (int8), json_data (jsonb), updated_at (timestamp)";
        } else if (error.code === '42501' || error.message.includes('permission')) {
            errorDetails = "\n\n💡 Можлива причина: Row Level Security (RLS) блокує доступ.\n\nРішення:\n1. Supabase Dashboard → Authentication → Policies\n2. Вимкніть RLS для таблиці app_data\nАБО\n3. Додайте політику: ALLOW ALL для anon ролі";
        } else if (error.code === 'TIMEOUT') {
            errorDetails = "\n\n💡 Можлива причина: Повільне з'єднання або сервер не відповідає.\n\nРішення:\n1. Перевірте інтернет-з'єднання\n2. Спробуйте ще раз через хвилину";
        } else if (error.code === '23505') {
            errorDetails = "\n\n💡 Конфлікт даних. Спробуйте спочатку завантажити дані з хмари.";
        }

        const fullError = `❌ ПОМИЛКА СИНХРОНІЗАЦІЇ\n\nПовідомлення: ${errorMessage}\nКод: ${error.code || 'N/A'}${errorDetails}`;

        alert(fullError);
        showToast(`❌ Помилка: ${errorMessage}`, "error");

        // Log full error for debugging
        console.log("Full error object:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            status: error.status
        });
    }
}

window.loadFromCloud = async function () {
    if (!supabaseClient) {
        showToast("⚠️ Налаштуйте Supabase!", "error");
        return;
    }

    if (!confirm("⚠️ УВАГА: Це замінить локальні дані даними з хмари!\n\nПродовжити?")) return;

    showToast("🔄 Завантаження з хмари...", "primary");

    try {
        const { data, error } = await supabaseClient
            .from('app_data')
            .select('json_data')
            .eq('id', 1)
            .single();

        if (error) {
            throw error;
        }

        if (!data || !data.json_data) {
            showToast("⚠️ У хмарі немає збережених даних.", "warning");
            return;
        }

        // Validate cloud data
        const cloudData = data.json_data;
        const cloudUpdateTime = new Date().toLocaleString('uk-UA');

        console.log(`📥 Завантаження даних з хмари (оновлено: ${cloudUpdateTime})`);

        // Check if cloud data is valid
        let validKeys = 0;
        Object.values(CONFIG_KEYS).forEach(key => {
            if (cloudData[key] !== undefined && cloudData[key] !== null) {
                validKeys++;
            }
        });

        if (validKeys === 0) {
            showToast("⚠️ Дані в хмарі порожні або пошкоджені.", "error");
            return;
        }

        console.log(`✅ Знайдено ${validKeys} валідних ключів даних`);

        // Restore data
        Object.keys(cloudData).forEach(key => {
            if (cloudData[key] !== null && cloudData[key] !== undefined) {
                const value = cloudData[key];
                // If value is already a string (like 'dark' or 'light'), store as-is
                // Otherwise, stringify it (for objects/arrays)
                if (typeof value === 'string') {
                    localStorage.setItem(key, value);
                } else {
                    localStorage.setItem(key, JSON.stringify(value));
                }
            }
        });

        // Save restore timestamp
        localStorage.setItem('last_cloud_restore', new Date().toISOString());

        showToast(`✅ Дані відновлено з хмари! (${cloudUpdateTime})\n\nОновлення сторінки...`, "success");
        setTimeout(() => location.reload(), 2000);

    } catch (error) {
        console.error("❌ Supabase Load Error:", error);

        let errorMessage = "Невідома помилка";
        let errorDetails = "";

        if (error.code === 'PGRST116') {
            errorMessage = "У хмарі немає збережених даних";
            errorDetails = "\n\n💡 Спочатку збережіть дані в хмару, використовуючи кнопку 'Зберегти в хмару'.";
        } else if (error.code === '42P01') {
            errorMessage = "Таблиця app_data не існує";
            errorDetails = "\n\n💡 Створіть таблицю app_data в Supabase Dashboard:\n1. Table Editor → New Table\n2. Назва: app_data\n3. Колонки: id (int8), json_data (jsonb), updated_at (timestamp)";
        } else if (error.message) {
            errorMessage = error.message;
        }

        const fullError = `❌ ПОМИЛКА ЗАВАНТАЖЕННЯ\n\nПовідомлення: ${errorMessage}\nКод: ${error.code || 'N/A'}${errorDetails}`;

        alert(fullError);
        showToast(`❌ Помилка: ${errorMessage}`, "error");

        console.log("Full error object:", error);
    }
}
function renderDashboardCharts(transactions) {
    // 1. Prepare Sales Data (Last 30 Days)
    const daysMap = {};
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        daysMap[dateStr] = 0;
    }

    transactions.forEach(t => {
        const dateStr = new Date(t.timestamp).toISOString().split('T')[0];
        if (daysMap[dateStr] !== undefined) {
            daysMap[dateStr] += t.revenue;
        }
    });

    const salesLabels = Object.keys(daysMap).map(d => d.slice(5)); // MD format
    const salesData = Object.values(daysMap);

    // 2. Prepare Top Products Data
    const productStats = {};
    transactions.forEach(t => {
        productStats[t.perfumeName] = (productStats[t.perfumeName] || 0) + 1;
    });
    const sortedProducts = Object.entries(productStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const prodLabels = sortedProducts.map(([k]) => k);
    const prodData = sortedProducts.map(([, v]) => v);

    // 3. Render Sales Chart
    const ctxSales = document.getElementById('salesChart').getContext('2d');
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctxSales, {
        type: 'line',
        data: {
            labels: salesLabels,
            datasets: [{
                label: 'Виручка (грн)',
                data: salesData,
                borderColor: '#4F46E5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // 4. Render Top Products Chart
    const ctxProd = document.getElementById('topProductsChart').getContext('2d');
    if (topProductsChartInstance) topProductsChartInstance.destroy();
    topProductsChartInstance = new Chart(ctxProd, {
        type: 'doughnut',
        data: {
            labels: prodLabels,
            datasets: [{
                data: prodData,
                backgroundColor: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Set user's provided key as default if none exists or if it's the old one
    const currentKey = localStorage.getItem('gemini_api_key');
    const newDefaultKey = 'AIzaSyDYtCM1M61MG18zX3KZD2jfwofLmKvPG9U';

    if (!currentKey || currentKey === 'AIzaSyDHKSxzyfzzcuZlnSox3Taj4L8k0ZPBAzg') {
        localStorage.setItem('gemini_api_key', newDefaultKey);
    }

    initTheme(); loadPerfumePrices(); loadFlaconData(); loadMarkupPresets(); loadSalesSources(); loadInventory(); TASKS = getTasks();
    populateFormOptions(); renderExpenseList();

    // Ensure UI shows current key and model
    const apiKeyInput = document.getElementById('apiKeyInput');
    if (apiKeyInput) {
        apiKeyInput.value = localStorage.getItem('gemini_api_key') || newDefaultKey;
    }
    const modelSelect = document.getElementById('geminiModelSelect');
    if (modelSelect) {
        modelSelect.value = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
    }

    const dashboardBtn = document.querySelector('.nav-btn'); showSection('dashboard', dashboardBtn);
    renderOrderList(); updateDashboard();
});
