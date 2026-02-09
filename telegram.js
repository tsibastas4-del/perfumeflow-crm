// Telegram Bot API Integration
const TELEGRAM_CONFIG = {
    botToken: localStorage.getItem('telegram_bot_token') || '8297695215:AAHzqkm9e3Q7NgXPQaeb3r2jIF9kiHPW0tc',
    channelId: localStorage.getItem('telegram_channel_id') || '-10023478137496'
};

function saveTelegramConfig() {
    const token = document.getElementById('telegramBotTokenInput').value.trim();
    const channel = document.getElementById('telegramChannelIdInput').value.trim();
    if (token) localStorage.setItem('telegram_bot_token', token);
    if (channel) localStorage.setItem('telegram_channel_id', channel);
    TELEGRAM_CONFIG.botToken = token;
    TELEGRAM_CONFIG.channelId = channel;
    showToast("✅ Telegram налаштування збережено", "success");
}

window.testTelegramConnection = async function () {
    const token = document.getElementById('telegramBotTokenInput').value.trim();
    if (!token) { showToast("⚠️ Введіть Bot Token!", "warning"); return; }

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await response.json();
        if (data.ok) {
            showToast(`✅ Підключено до @${data.result.username}`, "success");
        } else {
            showToast("❌ Помилка: " + data.description, "error");
        }
    } catch (e) {
        showToast("❌ Помилка підключення", "error");
    }
}

window.generateSMMPreview = async function () {
    const perfumeName = document.getElementById('smmPerfumeSelect').value;
    const photoFile = document.getElementById('smmPhotoUpload').files[0];

    if (!perfumeName) { showToast("⚠️ Оберіть парфум!", "warning"); return; }
    if (!photoFile) { showToast("⚠️ Завантажте фото!", "warning"); return; }

    const previewArea = document.getElementById('smmPreviewArea');
    previewArea.innerHTML = '<div style="text-align:center; padding:50px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>AI створює опис...</p></div>';

    try {
        const perfumeData = PERFUME_PRICES[perfumeName];
        const markup = MARKUP_PRESETS['Базова'];

        // Calculate prices for preview
        const p3 = Math.round(perfumeData.basePrice * 1.12 * 3 + FLACON_COSTS[3]);
        const p5 = Math.round(perfumeData.basePrice * 1.12 * 5 + FLACON_COSTS[5]);
        const p10 = Math.round(perfumeData.basePrice * 1.12 * 10 + FLACON_COSTS[10]);

        const prompt = `Ти - SMM менеджер магазину парфумерії. 
Створи КОРОТКИЙ та привабливий пост для Telegram про парфум "${perfumeName}".
Використовуй емодзі, зроби текст структурованим.
Включи ціни: 3мл - ${p3}грн, 5мл - ${p5}грн, 10мл - ${p10}грн.
Додай ДУЖЕ СТИСЛИЙ опис аромату (2-3 речення).
В кінці додай закликаючий текст.
Мова: Українська.
ВАЖЛИВО: Весь текст має бути до 900 символів!
Поверни ТІЛЬКИ текст посту.`;

        const caption = await callGemini(prompt);

        // Safety trim and check
        let finalCaption = caption.trim();
        if (finalCaption.length > 1000) {
            finalCaption = finalCaption.substring(0, 997) + "...";
        }

        // Create local preview image URL
        const reader = new FileReader();
        reader.onload = (e) => {
            previewArea.innerHTML = `
                <img src="${e.target.result}" style="width:100%; border-radius:8px; margin-bottom:10px;">
                <div style="white-space:pre-wrap; font-size:0.9rem; line-height:1.4;">${finalCaption}</div>
            `;
            // Store caption globally for posting
            window.currentSMMCaption = finalCaption;
        };
        reader.readAsDataURL(photoFile);

    } catch (e) {
        previewArea.innerHTML = `<p style="color:var(--danger);">❌ Помилка: ${e.message}</p>`;
    }
}

window.postToTelegram = async function () {
    const token = localStorage.getItem('telegram_bot_token');
    const channelId = localStorage.getItem('telegram_channel_id');
    const caption = window.currentSMMCaption;
    const photoFile = document.getElementById('smmPhotoUpload').files[0];

    if (!token || !channelId) { showToast("⚠️ Налаштуйте Telegram Bot!", "warning"); return; }
    if (!caption || !photoFile) { showToast("⚠️ Спочатку згенеруйте превью!", "warning"); return; }

    if (caption.length > 1024) {
        showToast("⚠️ Опис занадто довгий для Telegram (max 1024)! Скоротіть його.", "warning");
        return;
    }

    const btn = event.target;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Публікація...';

    try {
        const formData = new FormData();
        formData.append('chat_id', channelId);
        formData.append('photo', photoFile);
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');

        // Add inline keyboard
        const keyboard = {
            inline_keyboard: [
                [
                    { text: "🛍️ Замовити — @Stascyba", url: "https://t.me/Stascyba" }
                ]
            ]
        };
        formData.append('reply_markup', JSON.stringify(keyboard));

        const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.ok) {
            showToast("🚀 Опубліковано в Telegram!", "success");
        } else {
            showToast("❌ Помилка: " + data.description, "error");
        }
    } catch (e) {
        showToast("❌ Помилка відправки", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-brands fa-telegram"></i> Опублікувати в Telegram';
    }
}

// Auto-Post Top-5 Products
window.postTopProductsToTelegram = async function () {
    const token = localStorage.getItem('telegram_bot_token');
    const channelId = localStorage.getItem('telegram_channel_id');

    if (!token || !channelId) {
        showToast("⚠️ Налаштуйте Telegram Bot!", "warning");
        return;
    }

    const btn = event?.target || document.querySelector('button[onclick="postTopProductsToTelegram()"]');
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Генерую пост...';

    try {
        // Get top-5 products from transactions
        const txs = getTransactions();
        const productStats = {};

        txs.forEach(t => {
            if (!productStats[t.perfumeName]) {
                productStats[t.perfumeName] = {
                    vol: 0,
                    revenue: 0,
                    count: 0,
                    data: PERFUME_PRICES[t.perfumeName] || {}
                };
            }
            productStats[t.perfumeName].vol += t.quantityML;
            productStats[t.perfumeName].revenue += t.revenue;
            productStats[t.perfumeName].count++;
        });

        const topProducts = Object.entries(productStats)
            .sort(([, a], [, b]) => b.vol - a.vol)
            .slice(0, 5);

        if (topProducts.length === 0) {
            showToast("📊 Недостатньо даних для формування поста", "warning");
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-fire"></i> Топ-5 в Telegram';
            return;
        }

        // Calculate prices for each product
        const markup = MARKUP_PRESETS['Базова'] || 0.12;
        const productsText = topProducts.map(([name, stats], index) => {
            const data = stats.data;
            const p3 = data.basePrice ? Math.round(data.basePrice * (1 + markup) * 3 + (FLACON_COSTS[3] || 12)) : '??';
            const p5 = data.basePrice ? Math.round(data.basePrice * (1 + markup) * 5 + (FLACON_COSTS[5] || 12)) : '??';
            const p10 = data.basePrice ? Math.round(data.basePrice * (1 + markup) * 10 + (FLACON_COSTS[10] || 15)) : '??';
            const stock = PERFUME_STOCK[name] || 0;
            const available = stock > 0 ? '✅ Є в наявності' : '⚠️ Під замовлення';
            return `${index + 1}. ${name}\n   ${available}\n   3мл - ${p3}₴ | 5мл - ${p5}₴ | 10мл - ${p10}₴`;
        }).join('\n\n');

        // AI Prompt for post text
        const prompt = `Ти - SMM менеджер магазину парфумерії. 
Створи привабливий пост для Telegram каналу з ТОП-5 найпопулярніших ароматів.

ТОПОВІ АРОМАТИ:
${productsText}

ВИМОГИ:
1. Почни з яскравого заголовка та емодзі
2. Додай 1-2 речення про те, що це найпопулярніші аромати тижня/місяця
3. Включи список ароматів з цінами (використай той же формат, що вище)
4. Закінчи закликом до дії (замовити, написати)
5. Використовуй емодзі та структуровану розмітку
6. МАКСИМУМ 900 символів
7. Мова: Українська

Поверни ТІЛЬКИ текст посту для Telegram (HTML розмітка дозволена).`;

        const caption = await callGemini(prompt);

        // Safety trim
        let finalCaption = caption.trim();
        if (finalCaption.length > 1000) {
            finalCaption = finalCaption.substring(0, 997) + "...";
        }

        // Send to Telegram
        const keyboard = {
            inline_keyboard: [[
                { text: "🛍️ Замовити — @Stascyba", url: "https://t.me/Stascyba" }
            ]]
        };

        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: channelId,
                text: finalCaption,
                parse_mode: 'HTML',
                reply_markup: keyboard
            })
        });

        const data = await response.json();
        if (data.ok) {
            showToast("🚀 Топ-5 опубліковано в Telegram!", "success");
        } else {
            showToast("❌ Помилка: " + data.description, "error");
        }
    } catch (e) {
        console.error(e);
        showToast("❌ Помилка генерації поста", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-fire"></i> Топ-5 в Telegram';
    }
}
