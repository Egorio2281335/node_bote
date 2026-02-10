const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Используем плагин для обхода детекции
puppeteer.use(StealthPlugin());

// Импортируем генератор профилей
const { MassProfileGenerator, CompleteChromeProfileGenerator, ProfileDataCache } = require('./cpmg');


const logFile = path.resolve(__dirname, 'logs/all.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function timestamp() {
    return new Date().toLocaleString();
}

['log', 'warn', 'error'].forEach(method => {
    const original = console[method].bind(console);
    console[method] = (...args) => {
        const message = args
            .map(arg => {
                if (arg instanceof Error) {
                    return `${arg.name}: ${arg.message}\n${arg.stack}`;
                }
                return typeof arg === 'string' ? arg : JSON.stringify(arg);
            })
            .join(' ');

        const logLine =
            `[${timestamp()}] [${method.toUpperCase()}] [Worker ${process.pid}] ${message}\n`;

        logStream.write(logLine);
        original(...args);
    };
});


class UniversalSearchBot {
    constructor(profileId = 1) {
        // Настройки профиля
        this.profileId = profileId;
        this.profilePath = path.join(__dirname, `chrome_profiles_1/profile_${profileId}`);
        this.configPath = path.join(__dirname, `chrome_profiles_1/config_${profileId}.json`);

        // Загружаем конфигурацию профиля (если есть)
        this._loadProfileConfig();

        // Если конфиг не загружен, устанавливаем дефолтные значения
        if (!this.userAgent) {
            this.userAgent = 'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.2420.65';
        }

        if (!this.viewport) {
            this.viewport = { width: 1366, height: 768 };
        }

        // Целевые данные для Яндекс (несколько вариантов названий)
        this.yandexTarget = {
            query: 'вывод из запоя',
            city: 'краснодар',
            clinicNames: [
                'Клиника Доктора Калюжной',
                'Детокс'
            ],
            regionId: 35
        };

        // Целевые данные для Google (несколько вариантов названий)
        this.googleTarget = {
            query: 'вывод из запоя',
            city: 'краснодар',
            clinicNames: [
                'Клиника доктора Калюжной',
                'Детокс'
            ],
            regionId: 1012013
        };

        // URL для случайных запросов
        this.randomQueryUrl = 'http://65.109.82.14/index_key_pull7.php?password=ololo&ip=65.109.49.112&pid=77777777';

        // URL поисковиков
        this.searchUrls = {
            yandex: 'https://ya.ru/',
            google: 'https://www.google.com/'
        };

        // Селекторы для поисковиков
        this.selectors = {
            yandex: {
                searchInput: '#text',
                searchResults: '.serp-item',
                mapBlock: 'li[data-fast-name="companies"]',
                companyCards: '.OrgmnMedicineCard',
                companyTitle: '.OrgmnMedicineCard-Title',
                companyAddress: '.OrgmnMedicineCard-Address',
                showMore: '.OrgmnMedicine-ListMore, button:has-text("Показать ещё")',
                externalLinks: '.serp-item a.Link',
                captcha: '.CheckboxCaptcha, .AdvancedCaptcha, .captcha, .Captcha, .smart-captcha'
            },
            google: {
                // Универсальные селекторы для Google
                searchInput: 'textarea[name="q"], input[name="q"]',
                searchButton: 'button[type="submit"], input[type="submit"], .gNO89b',
                // Несколько вариантов для результатов
                searchResults: '.g, .tF2Cxc, .MjjYud, .kvH3mc',
                // Для поиска мест/организаций
                placesBlock: '.QjCH7c, .VkpGBb, .Lv2Cle',
                placesTitle: '.OSrXXb, .dbg0pd',
                placesAddress: 'div:nth-child(3), .rllt__details > div:nth-child(3), .VkpGBb div:nth-child(3)',
                // Для карточек организаций
                companyCards: '.VkpGBb, .w7Dbne, .rllt__details',
                companyTitle: '.OSrXXb, .dbg0pd',
                companyAddress: 'div:nth-of-type(3), .rllt__details > div:nth-child(3)',
                // Кнопка "Ещё места"
                morePlacesButton: '.jRKCUd, .U48fD a',
                morePlacesCards: '.X3FFBc .w7Dbne, .VkpGBb',
                captcha: '#captcha-form, .g-recaptcha, iframe[src*="recaptcha"], .rc-anchor'
            }
        };

        // Счетчики
        this.profileWarmupCount = 80;
        this.completedWarmups = 0;

        // Результаты поиска
        this.results = {
            yandex: null,
            google: null
        };

        // Настройки ретраев
        this.retryConfig = {
            maxAttempts: 3,
            baseDelay: 5000,
            maxDelay: 30000
        };

        // Состояние
        this.browser = null;
        this.page = null;

        // ЗАДЕРЖКИ
        this.delays = {
            small: { min: 1000, max: 3000 },
            medium: { min: 3000, max: 8000 },
            large: { min: 8000, max: 15000 },
            xlarge: { min: 15000, max: 30000 },
            xxlarge: { min: 30000, max: 60000 },
            xxxlarge: { min: 60000, max: 120000 }
        };

        // Создаем директорию для профилей
        const profilesDir = path.join(__dirname, 'chrome_profiles_1');
        if (!fs.existsSync(profilesDir)) {
            fs.mkdirSync(profilesDir, { recursive: true });
            console.log(`📁 Создана директория для профилей: ${profilesDir}`);
        }
    }

    // Загрузка конфигурации профиля
    _loadProfileConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
                this.userAgent = configData.userAgentString;
                this.viewport = configData.viewportSize;
                console.log(`📖 Загружена конфигурация профиля ${this.profileId}`);
            }
        } catch (error) {
            console.log(`⚠️ Не удалось загрузить конфиг профиля: ${error.message}`);
        }
    }

    // Сохранение конфигурации профиля
    _saveProfileConfig() {
        try {
            const configData = {
                userAgentString: this.userAgent,
                viewportSize: this.viewport,
                createdAt: new Date().toISOString(),
                profileId: this.profileId
            };

            fs.writeFileSync(this.configPath, JSON.stringify(configData, null, 2));
            console.log(`💾 Сохранена конфигурация профиля ${this.profileId}`);
        } catch (error) {
            console.log(`⚠️ Не удалось сохранить конфиг профиля: ${error.message}`);
        }
    }

    // Генерация профиля если его нет
    async _generateProfileIfNeeded() {
        // Проверяем, существует ли профиль
        if (fs.existsSync(this.profilePath)) {
            console.log(`📖 Используем существующий профиль ${this.profileId}`);
            return true;
        }

        console.log(`🛠️ Генерация нового профиля ${this.profileId}...`);

        try {
            // Инициализируем кэш данных профиля
            const cache = new ProfileDataCache();
            await cache.init();

            // Создаем генератор профиля
            const profileGen = new CompleteChromeProfileGenerator(this.profileId, cache, {
                minimalMode: false, // Полный профиль
                enableHeavyData: true // Включаем все данные
            });

            // Генерируем структуру профиля
            await profileGen.createCompleteStructure();

            // Загружаем данные из сгенерированного профиля
            const profileConfigPath = path.join(this.profilePath, 'config.json');
            if (fs.existsSync(profileConfigPath)) {
                const profileConfig = JSON.parse(fs.readFileSync(profileConfigPath, 'utf-8'));
                this.userAgent = profileConfig.userAgentString;
                this.viewport = {
                    width: profileConfig.viewportSize.width,
                    height: profileConfig.viewportSize.height
                };
            }

            // Сохраняем конфигурацию
            this._saveProfileConfig();

            console.log(`✅ Профиль ${this.profileId} успешно сгенерирован`);
            return true;

        } catch (error) {
            console.error(`❌ Ошибка генерации профиля ${this.profileId}:`, error);

            // Фоллбэк: создаем простой профиль
            console.log(`🔄 Создаем простой профиль ${this.profileId} как fallback...`);
            fs.mkdirSync(this.profilePath, { recursive: true });

            // Сохраняем конфигурацию
            this._saveProfileConfig();

            return true;
        }
    }

    // Инициализация браузера
    async init() {
        console.log(`🚀 Инициализация браузера (профиль ${this.profileId})...`);
        console.log(`📂 Профиль будет сохранен в: ${this.profilePath}`);

        // Генерируем профиль если его нет
        const profileGenerated = await this._generateProfileIfNeeded();
        if (!profileGenerated) {
            console.error(`❌ Не удалось создать профиль ${this.profileId}`);
            return false;
        }

        // ПРОВЕРЯЕМ, НУЖНА ЛИ ПЕРВИЧНАЯ ИНИЦИАЛИЗАЦИЯ
        // Проверяем наличие файла, который создается при первом успешном запуске
        const initMarkerPath = path.join(this.profilePath, 'FirstRunComplete');
        const needsInitialization = !fs.existsSync(initMarkerPath);

        if (needsInitialization) {
            console.log('🔄 Первый запуск профиля, выполняется инициализация...');
            const initSuccess = await this._initializeProfileFirstRun();

            if (!initSuccess) {
                console.log('🔄 Повторная попытка инициализации...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                await this._initializeProfileFirstRun();
            }

            // Создаем маркер успешной инициализации
            fs.writeFileSync(initMarkerPath, '1');
            console.log('✅ Профиль готов к использованию');
        }

        // Теперь запускаем основной браузер
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;

            try {
                // Удаляем lock файлы если есть
                const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'SingletonLock-journal'];
                lockFiles.forEach(file => {
                    const filePath = path.join(this.profilePath, file);
                    if (fs.existsSync(filePath)) {
                        try {
                            fs.unlinkSync(filePath);
                            console.log(`🗑️ Удален lock файл: ${file}`);
                        } catch (e) {
                            // Игнорируем ошибки удаления
                        }
                    }
                });

                this.browser = await puppeteer.launch({
                    headless: false,
                    userDataDir: this.profilePath,
                    defaultViewport: this.viewport,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        `--user-agent=${this.userAgent}`,
                        '--disable-blink-features=AutomationControlled',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--disable-notifications',
                        `--lang=ru-RU,ru`,
                        `--window-size=${this.viewport.width},${this.viewport.height + 100}`,
                        // Стабильные аргументы
                        '--disable-gpu',
                        '--disable-software-rasterizer',
                        '--no-first-run',
                        '--no-default-browser-check'
                    ],
                    ignoreHTTPSErrors: true,
                    executablePath: "C:/Users/qqwer/.cache/puppeteer/chrome/win64-127.0.6533.88/chrome-win64/chrome.exe",
                    // Добавляем обработку сигналов
                    handleSIGINT: false,
                    handleSIGTERM: false,
                    handleSIGHUP: false
                });

                this.page = await this.browser.newPage();

                // Скрываем WebDriver
                await this.page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => false
                    });

                    window.chrome = {
                        runtime: {},
                        loadTimes: function () { },
                        csi: function () { },
                        app: {}
                    };
                });

                await this.page.setUserAgent(this.userAgent);

                console.log('✅ Браузер успешно запущен');
                return true;

            } catch (error) {
                console.log(`❌ Ошибка запуска браузера (попытка ${attempts}/${maxAttempts}): ${error.message}`);

                if (this.browser) {
                    await this.closeBrowser();
                }

                if (attempts < maxAttempts) {
                    console.log(`⏸️ Пауза перед повторной попыткой...`);
                    await this.delayByType('medium');
                }
            }
        }

        console.error(`❌ Не удалось запустить браузер после ${maxAttempts} попыток`);
        return false;
    }

    // Предварительная инициализация профиля
    async _initializeProfileFirstRun() {
        console.log('🔧 Предварительная инициализация профиля...');

        let initBrowser = null;
        let initPage = null;

        try {
            // Пробный запуск браузера с этим профилем
            initBrowser = await puppeteer.launch({
                headless: 'new', // Используем headless для инициализации
                userDataDir: this.profilePath,
                defaultViewport: this.viewport,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    `--user-agent=${this.userAgent}`,
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process',
                    `--lang=ru-RU,ru`,
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-component-update',
                    '--disable-background-networking',
                    '--disable-sync',
                    '--disable-default-apps',
                    '--disable-client-side-phishing-detection',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-breakpad',
                    '--disable-component-update',
                    '--disable-domain-reliability',
                    '--disable-features=Translate',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding'
                ],
                ignoreHTTPSErrors: true,
                dumpio: false // Отключаем вывод для чистоты
            });

            initPage = await initBrowser.newPage();

            // Минимальная активность для инициализации профиля
            await initPage.setUserAgent(this.userAgent);

            // Просто открываем и закрываем пустую страницу
            await initPage.goto('about:blank', {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });

            // Короткая пауза
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('✅ Профиль успешно инициализирован');
            return true;

        } catch (error) {
            console.log(`⚠️ Ошибка при инициализации профиля: ${error.message}`);
            return false;

        } finally {
            // Всегда закрываем браузер
            if (initBrowser) {
                await initBrowser.close();
                // Даем время на сохранение профиля
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // Закрытие браузера
    async closeBrowser() {
        if (this.browser) {
            try {
                const pages = await this.browser.pages();
                for (const page of pages) {
                    if (!page.isClosed()) {
                        await page.close().catch(() => { });
                    }
                }
                await this.browser.close();
                console.log('✅ Браузер закрыт (профиль сохранен)');
                this.browser = null;
                this.page = null;
            } catch (error) {
                console.error('❌ Ошибка при закрытии браузера:', error.message);
            }
        }
    }

    // Функция для добавления/обновления параметра региона в URL
    async addRegionToUrl(searchEngine = 'yandex') {
        try {
            const currentUrl = this.page.url();
            const urlObj = new URL(currentUrl);

            if (searchEngine === 'yandex') {
                const targetRegion = this.yandexTarget.regionId.toString();
                const currentRegion = urlObj.searchParams.get('lr');

                if (currentRegion !== targetRegion) {
                    urlObj.searchParams.set('lr', targetRegion);
                    console.log(`🌍 Устанавливаем регион Яндекс: ${targetRegion}`);

                    await this.page.goto(urlObj.toString(), {
                        waitUntil: 'networkidle2',
                        timeout: 30000
                    });

                    await this.delayByType('medium');
                    return true;
                } else {
                    console.log(`✅ Регион Яндекс уже установлен: ${currentRegion}`);
                    return false;
                }
            }
            else if (searchEngine === 'google') {
                const targetRegion = this.googleTarget.regionId.toString();
                const currentRegion = urlObj.searchParams.get('loc');

                if (currentRegion !== targetRegion) {
                    urlObj.searchParams.set('loc', targetRegion);
                    console.log(`🌍 Устанавливаем регион Google: ${targetRegion}`);

                    await this.page.goto(urlObj.toString(), {
                        waitUntil: 'networkidle2',
                        timeout: 30000
                    });

                    await this.delayByType('medium');
                    return true;
                } else {
                    console.log(`✅ Регион Google уже установлен: ${currentRegion}`);
                    return false;
                }
            }

            return false;
        } catch (error) {
            console.log(`⚠️ Ошибка при установке региона: ${error.message}`);
            return false;
        }
    }

    // Получение случайного запроса
    async getRandomQuery() {
        try {
            const response = await axios.get(this.randomQueryUrl, { timeout: 5000 });
            return response.data.trim();
        } catch (error) {
            console.log('⚠️ Используем запасной запрос');
            const fallbackQueries = [
                'погода сегодня',
                'новости',
                'курс доллара',
                'расписание поездов',
                'рецепты',
                'фильмы онлайн',
                'спорт новости',
                'музыка 2024',
                'технологии',
                'здоровье'
            ];
            return fallbackQueries[Math.floor(Math.random() * fallbackQueries.length)];
        }
    }

    // УВЕЛИЧЕННАЯ случайная задержка (из оригинала)
    async randomDelay(min = 2000, max = 5000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log(`⏱️ Пауза: ${Math.round(delay / 1000)} сек.`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return delay;
    }

    // Задержка по типу
    async delayByType(type = 'small') {
        const delayRange = this.delays[type] || this.delays.small;
        return await this.randomDelay(delayRange.min, delayRange.max);
    }

    // УВЕЛИЧЕННАЯ случайная прокрутка с паузой (из оригинала)
    async randomScroll() {
        const scrollHeight = Math.floor(Math.random() * 800) + 400;
        console.log(`📜 Прокрутка: ${scrollHeight}px`);
        await this.page.evaluate((height) => {
            window.scrollBy(0, height);
        }, scrollHeight);

        // Пауза после прокрутки
        await this.delayByType('small');
    }

    // Проверка на капчу
    async checkForCaptcha(engine = 'yandex') {
        try {
            console.log(`🔍 Проверяем на наличие капчи (${engine})...`);

            const selectors = this.selectors[engine].captcha;
            const captchaSelectors = Array.isArray(selectors) ? selectors : [selectors];

            for (const selector of captchaSelectors) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        console.log(`🚫 Обнаружена капча по селектору: ${selector}`);
                        return true;
                    }
                } catch (e) { }
            }

            // Проверка на страницу с капчей
            const url = this.page.url();
            if (url.includes('showcaptcha') || url.includes('checkcaptcha') || url.includes('recaptcha')) {
                console.log(`🚫 URL указывает на страницу с капчей в ${engine}`);
                return true;
            }

            console.log('✅ Капча не обнаружена');
            return false;

        } catch (error) {
            console.log('⚠️ Ошибка при проверке капчи:', error.message);
            return false;
        }
    }

    // Обработка капчи с увеличением задержки и закрытием браузера
    async handleCaptcha(engine = 'yandex') {
        console.log(`🔄 Обнаружена капча в ${engine}, закрываем браузер...`);

        // Делаем скриншот капчи для анализа
        try {
            await this.page.screenshot({ path: `captcha_${engine}_${Date.now()}.png` });
            console.log('📸 Скриншот капчи сохранен');
        } catch (e) {
            console.log('⚠️ Не удалось сохранить скриншот капчи');
        }

        // ЗАКРЫВАЕМ БРАУЗЕР ПРИ ОБНАРУЖЕНИИ КАПЧИ
        console.log('🚫 Закрываем браузер из-за капчи');
        await this.closeBrowser();

        // УВЕЛИЧЕННАЯ пауза перед перезапуском
        const waitTime = 60000 + Math.random() * 180000; // 1-4 минуты
        console.log(`⏸️ Длительная пауза: ${Math.round(waitTime / 60000)} мин. ${Math.round((waitTime % 60000) / 1000)} сек. перед перезапуском...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));

        return false;
    }

    // Переход на случайный сайт из выдачи с увеличенными задержками (только Яндекс)
    async visitRandomSiteFromResults() {
        console.log('🌐 Ищем случайный сайт для посещения...');

        try {
            // Ищем все ссылки в результатах поиска
            const resultLinks = await this.page.$$eval('.serp-item a.Link', links =>
                links
                    .filter(link => {
                        const href = link.getAttribute('href');
                        const text = link.textContent || '';
                        // Фильтруем только внешние ссылки (не на Яндекс)
                        return href && text.length > 5;
                    })
                    .map(link => ({
                        href: link.getAttribute('href'),
                        text: link.textContent.trim().substring(0, 50) + '...'
                    }))
            );

            if (resultLinks.length === 0) {
                console.log('⚠️ Не найдено подходящих внешних ссылок');
                return false;
            }

            // Пауза перед выбором ссылки
            await this.delayByType('small');

            // Выбираем случайную ссылку
            const randomLink = resultLinks[Math.floor(Math.random() * resultLinks.length)];
            console.log(`🔗 Переходим на: ${randomLink.text}`);
            console.log(`   URL: ${randomLink.href.substring(0, 80)}...`);

            // Пауза перед переходом
            await this.delayByType('small');

            // Переходим по ссылке
            await this.page.goto(randomLink.href, {
                waitUntil: 'domcontentloaded',
                timeout: 45000
            });

            // УВЕЛИЧЕННОЕ время на сайте
            const timeOnSite = Math.floor(Math.random() * 15000) + 10000; // 10-25 секунд
            console.log(`⏱️ Проводим на сайте: ${Math.round(timeOnSite / 1000)} сек.`);

            // Случайные действия на сайте
            const actions = [
                async () => {
                    // Прокрутка
                    const scrollHeight = Math.floor(Math.random() * 1200) + 600;
                    console.log(`   📜 Прокрутка сайта: ${scrollHeight}px`);
                    await this.page.evaluate((height) => {
                        window.scrollBy(0, height);
                    }, scrollHeight);
                    await this.delayByType('small');
                },
                async () => {
                    // Клик по случайному элементу (если безопасно)
                    const clickableElements = await this.page.$$('a, button, [onclick]');
                    if (clickableElements.length > 0) {
                        const randomElement = clickableElements[Math.floor(Math.random() * Math.min(5, clickableElements.length))];
                        try {
                            await randomElement.click();
                            console.log('   🖱️ Кликнули на элемент');
                        } catch (e) {
                            // Игнорируем ошибки клика
                        }
                    }
                },
                async () => {
                    // Просто ждем и "читаем"
                    console.log('   👀 Читаем содержимое страницы');
                    await this.delayByType('medium');
                },
                async () => {
                    // Медленная прокрутка
                    console.log('   📜 Медленная прокрутка');
                    const totalScroll = Math.floor(Math.random() * 1000) + 500;
                    const steps = Math.floor(totalScroll / 100);
                    for (let i = 0; i < steps; i++) {
                        await this.page.evaluate(() => {
                            window.scrollBy(0, 100);
                        });
                        await this.randomDelay(300, 800); // Микро-паузы между прокрутками
                    }
                }
            ];

            // Выполняем несколько случайных действий
            const numActions = Math.floor(Math.random() * 3) + 2; // 2-4 действия
            console.log(`   🎬 Выполняем ${numActions} действий на сайте`);

            for (let i = 0; i < numActions; i++) {
                const action = actions[Math.floor(Math.random() * actions.length)];
                await action();
                // Пауза между действиями
                if (i < numActions - 1) {
                    await this.delayByType('small');
                }
            }

            console.log('✅ Посещение сайта завершено');
            return true;

        } catch (error) {
            console.log(`⚠️ Ошибка при переходе на сайт: ${error.message}`);
            return false;
        }
    }

    // Выполнение одного нагульного запроса с увеличенными задержками (оригинальная логика)
    async executeWarmupQuery(query, iteration) {
        console.log(`📊 [${iteration}/${this.profileWarmupCount}] Выполняем запрос...`);
        console.log(`   Поиск: "${query}"`);

        try {
            // Пауза перед началом
            await this.delayByType('small');

            // Переходим на Яндекс
            console.log('   🌐 Загружаем Яндекс...');
            await this.page.goto('https://ya.ru/', {
                waitUntil: 'networkidle2',
                timeout: 45000
            });

            // Проверяем на капчу сразу после загрузки
            if (await this.checkForCaptcha('yandex')) {
                console.log('   🚫 Обнаружена капча, прерываем нагул');
                await this.handleCaptcha('yandex');
                return false;
            }

            // Пауза перед поиском
            await this.delayByType('medium');

            // Ждем поисковую строку
            try {
                await this.page.waitForSelector('#text', { timeout: 15000 });
            } catch (error) {
                console.log('   🔄 Перезагружаем страницу...');
                await this.page.reload();
                await this.page.waitForSelector('#text', { timeout: 15000 });
            }

            // Пауза перед вводом
            await this.delayByType('small');

            // Вводим запрос медленно, как человек
            console.log('   ⌨️ Вводим запрос...');
            for (let char of query) {
                await this.page.type('#text', char, { delay: Math.random() * 100 + 50 });
            }

            // Пауза перед отправкой (как будто проверяем написанное)
            await this.delayByType('small');

            // Нажимаем Enter
            await this.page.keyboard.press('Enter');

            // Ждем загрузки результатов
            console.log('   ⏳ Ждем результаты поиска...');
            try {
                await this.page.waitForSelector('.serp-item', { timeout: 20000 });

                // Дополнительная проверка на капчу после поиска
                if (await this.checkForCaptcha('yandex')) {
                    console.log('   🚫 Капча появилась после поиска');
                    await this.handleCaptcha('yandex');
                    return false;
                }
            } catch (error) {
                console.log('   ⚠️ Результаты не загрузились, проверяем на капчу...');
                if (await this.checkForCaptcha('yandex')) {
                    await this.handleCaptcha('yandex');
                    return false;
                }
            }

            // Пауза перед просмотром результатов
            await this.delayByType('medium');

            // Случайные действия на странице результатов
            console.log('   👀 Просматриваем результаты...');
            await this.randomScroll();

            // ПЕРЕХОД НА СЛУЧАЙНЫЙ САЙТ ИЗ ВЫДАЧИ
            console.log('   🌍 Переходим на случайный сайт из выдачи...');
            const siteVisited = await this.visitRandomSiteFromResults();

            if (!siteVisited) {
                // Если не удалось перейти на сайт, делаем обычные действия
                console.log('   🔄 Не удалось перейти на сайт, изучаем результаты...');

                // Еще прокрутки
                for (let i = 0; i < 2; i++) {
                    await this.randomScroll();
                }

                // Пытаемся кликнуть на случайный результат
                const results = await this.page.$$('.serp-item a');
                if (results.length > 0 && Math.random() > 0.5) {
                    const randomIndex = Math.floor(Math.random() * Math.min(3, results.length));
                    try {
                        await results[randomIndex].click();
                        console.log('   🖱️ Кликнули на случайный результат');
                        await this.delayByType('large');

                        // Проверка на капчу после клика
                        if (await this.checkForCaptcha('yandex')) {
                            console.log('   🚫 Капча после клика по результату');
                            await this.handleCaptcha('yandex');
                            return false;
                        }
                    } catch (error) {
                        // Игнорируем ошибки клика
                    }
                }
            }

            this.completedWarmups = iteration;
            console.log(`   ✅ Запрос выполнен\n`);

            return true; // Успешное выполнение

        } catch (error) {
            console.log(`   ❌ Ошибка: ${error.message}`);

            // Проверяем, не связана ли ошибка с капчей
            if (error.message.includes('captcha') || error.message.includes('Captcha')) {
                console.log('   🚫 Ошибка связана с капчей');
                await this.handleCaptcha('yandex');
                return false;
            }

            // При любой другой ошибке просто закрываем браузер
            console.log('   🚪 Закрываем браузер из-за ошибки');
            await this.closeBrowser();

            console.log('   🔄 Продолжаем...\n');
            await this.delayByType('large');
            return true; // Продолжаем несмотря на ошибку
        }
    }

    // Нагул профиля с увеличенными задержками (оригинальная логика)
    async warmUpProfile() {
        console.log(`🔥 Начинаем нагул профиля (${this.profileWarmupCount} запросов)...\n`);

        for (let i = 1; i <= this.profileWarmupCount; i++) {
            let queryExecuted = false;
            let attempts = 0;
            const maxAttempts = 3;

            // Повторяем попытку выполнения запроса, если была капча
            while (!queryExecuted && attempts < maxAttempts) {
                attempts++;

                // Инициализируем браузер если он закрыт
                if (!this.browser || !this.page || this.page.isClosed()) {
                    console.log(`   🔄 Запуск браузера (попытка ${attempts})...`);
                    const initSuccess = await this.init();
                    if (!initSuccess) {
                        console.log('   ❌ Не удалось инициализировать браузер');
                        await this.delayByType('xlarge');
                        continue;
                    }
                }

                // Пауза перед получением запроса
                await this.delayByType('small');

                // Получаем случайный запрос
                const query = await this.getRandomQuery();

                // Выполняем запрос
                const result = await this.executeWarmupQuery(query, i);

                if (result === false) {
                    // Была капча, браузер уже закрыт
                    console.log(`   ⏸️ Капча, пробуем снова...`);
                    await this.delayByType('xlarge');
                } else {
                    queryExecuted = true;

                    // ЗАКРЫВАЕМ БРАУЗЕР ПОСЛЕ КАЖДОГО УСПЕШНОГО НАГУЛА
                    console.log('   🚪 Закрываем браузер после нагула');
                    await this.closeBrowser();
                }
            }

            if (!queryExecuted) {
                console.log(`   ❌ Не удалось выполнить запрос ${i} после ${maxAttempts} попыток`);
                // Ждем подольше перед следующей попыткой
                console.log(`   ⏸️ Длительная пауза перед следующим запросом...`);
                await this.delayByType('xxxlarge');
                continue;
            }

            // УВЕЛИЧЕННАЯ пауза между запросами
            if (i < this.profileWarmupCount) {
                console.log(`   ⏸️ Пауза между запросами...`);
                await this.delayByType('large');
            }

            // Каждые 5 запросов - очень большая пауза
            if (i % 5 === 0 && i < this.profileWarmupCount) {
                console.log(`\n⏰ Большая пауза после ${i} запросов...`);
                await this.delayByType('xxlarge');
            }

            // Каждые 10 запросов - гигантская пауза
            if (i % 10 === 0 && i < this.profileWarmupCount) {
                console.log(`\n🏖️ Отдых после ${i} запросов (длинная пауза)...`);
                await this.delayByType('xxxlarge');
            }
        }

        console.log('🎉 Нагул профиля завершен!\n');

        // Пауза перед финальным этапом
        console.log('🔄 Пауза перед целевым поиском...');
        await this.delayByType('xxlarge');
    }

    // Поиск целевого запроса в Яндекс с ретраями
    async searchYandex() {
        console.log('\n' + '='.repeat(50));
        console.log('🔎 ПОИСК В ЯНДЕКС');
        console.log(`📍 Регион ID: ${this.yandexTarget.regionId}`);
        console.log('='.repeat(50));

        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                // Инициализируем браузер для целевого поиска
                console.log(`🔄 Запускаем браузер для поиска в Яндекс (попытка ${attempt}/${this.retryConfig.maxAttempts})...`);
                await this.init();

                // Идем на Яндекс
                console.log('🌐 Загружаем Яндекс...');
                await this.page.goto('https://ya.ru/', {
                    waitUntil: 'networkidle2',
                    timeout: 45000
                });

                // Проверка на капчу
                if (await this.checkForCaptcha('yandex')) {
                    console.log('🚫 Капча при загрузке Яндекс');
                    await this.handleCaptcha('yandex');

                    // Закрываем браузер между попытками
                    await this.closeBrowser();

                    if (attempt < this.retryConfig.maxAttempts) {
                        const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                        console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    continue;
                }

                // Пауза перед поиском
                await this.delayByType('large');

                // Вводим целевой запрос
                console.log('⌨️ Вводим целевой запрос...');
                await this.page.waitForSelector('#text', { timeout: 15000 });
                await this.page.type('#text', this.yandexTarget.query + ' ' + this.yandexTarget.city, { delay: 50 });

                // Пауза перед отправкой
                await this.delayByType('small');

                await this.page.keyboard.press('Enter');

                // Ждем результаты
                console.log('⏳ Ждем результаты поиска...');
                await this.page.waitForSelector('.serp-item', { timeout: 20000 });

                // Проверка на капчу после поиска
                if (await this.checkForCaptcha('yandex')) {
                    console.log('🚫 Капча после выполнения поиска');
                    await this.handleCaptcha('yandex');

                    // Закрываем браузер между попытками
                    await this.closeBrowser();

                    if (attempt < this.retryConfig.maxAttempts) {
                        const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                        console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    continue;
                }

                // Добавляем/проверяем параметр региона в URL
                console.log('🌍 Проверяем параметр региона в URL...');
                await this.addRegionToUrl('yandex');

                // Пауза перед анализом результатов
                await this.delayByType('large');

                console.log('✅ Целевой поиск в Яндекс выполнен\n');

                // Поиск целевой клиники в Яндекс
                console.log('🔍 Ищем клинику в Яндекс...');
                const result = await this.findTargetClinicYandex();
                this.results.yandex = result;

                // Закрываем браузер после успешного поиска
                await this.closeBrowser();

                return true;

            } catch (error) {
                console.log(`❌ Ошибка при поиске в Яндекс (попытка ${attempt}): ${error.message}`);

                if (await this.checkForCaptcha('yandex')) {
                    await this.handleCaptcha('yandex');
                }

                // Закрываем браузер при ошибке
                await this.closeBrowser();

                if (attempt < this.retryConfig.maxAttempts) {
                    const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                    console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        console.log('❌ Поиск в Яндекс не удался после всех попыток');
        return false;
    }

    // Поиск в Google с ретраями
    async searchGoogle() {
        console.log('\n' + '='.repeat(50));
        console.log('🔎 ПОИСК В GOOGLE');
        console.log(`📍 Регион ID: ${this.googleTarget.regionId}`);
        console.log('='.repeat(50));

        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                // Инициализируем браузер для целевого поиска
                console.log(`🔄 Запускаем браузер для поиска в Google (попытка ${attempt}/${this.retryConfig.maxAttempts})...`);
                await this.init();

                console.log('🌐 Загружаем Google...');
                await this.page.goto('https://www.google.com/', {
                    waitUntil: 'networkidle2',
                    timeout: 45000
                });

                if (await this.checkForCaptcha('google')) {
                    console.log('🚫 Капча при загрузке Google');
                    await this.handleCaptcha('google');

                    // Закрываем браузер между попытками
                    await this.closeBrowser();

                    if (attempt < this.retryConfig.maxAttempts) {
                        const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                        console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    continue;
                }

                // Настраиваем заголовки для Google
                await this.page.setExtraHTTPHeaders({
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"'
                });

                await this.delayByType('large');

                console.log('⌨️ Вводим целевой запрос в Google...');

                // Ждем и вводим запрос - несколько вариантов селекторов
                const inputSelectors = ['textarea[name="q"]', 'input[name="q"]', '.gLFyf'];
                let inputFound = false;

                for (const selector of inputSelectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 5000 });
                        const inputElement = await this.page.$(selector);
                        if (inputElement) {
                            await inputElement.click({ clickCount: 3 });
                            await inputElement.type(this.googleTarget.query + ' loc:"' + this.googleTarget.city + '"', { delay: 50 });
                            inputFound = true;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!inputFound) {
                    console.log('❌ Не удалось найти поле поиска в Google');

                    // Закрываем браузер между попытками
                    await this.closeBrowser();

                    if (attempt < this.retryConfig.maxAttempts) {
                        const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                        console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    continue;
                }

                await this.delayByType('small');

                // Нажимаем Enter для поиска
                await this.page.keyboard.press('Enter');

                console.log('⏳ Ждем результаты поиска в Google...');

                // Ждем загрузки результатов - несколько вариантов селекторов
                const resultsSelectors = [
                    '#search', // Основной блок поиска
                    '.g', // Классические результаты
                    '.tF2Cxc', // Современные результаты
                    '.MjjYud', // Другой вариант
                    'div[data-sokoban-container]' // Контейнер результатов
                ];

                let resultsLoaded = false;
                for (const selector of resultsSelectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 10000 });
                        console.log(`✅ Результаты загружены (селектор: ${selector})`);
                        resultsLoaded = true;
                        break;
                    } catch (e) {
                        continue;
                    }
                }

                if (!resultsLoaded) {
                    console.log('⚠️ Не удалось дождаться стандартных результатов, проверяем наличие контента...');
                    // Проверяем, есть ли хоть какой-то контент
                    const pageContent = await this.page.content();
                    if (!pageContent.includes('search') && !pageContent.includes('Search')) {
                        console.log('❌ Страница поиска не загрузилась');

                        // Закрываем браузер между попытками
                        await this.closeBrowser();

                        if (attempt < this.retryConfig.maxAttempts) {
                            const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                            console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        continue;
                    }
                }

                if (await this.checkForCaptcha('google')) {
                    console.log('🚫 Капча после выполнения поиска в Google');
                    await this.handleCaptcha('google');

                    // Закрываем браузер между попытками
                    await this.closeBrowser();

                    if (attempt < this.retryConfig.maxAttempts) {
                        const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                        console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    continue;
                }

                // Добавляем/проверяем параметр региона в URL
                console.log('🌍 Проверяем параметр региона в URL...');
                await this.addRegionToUrl('google');

                await this.delayByType('large');

                console.log('✅ Целевой поиск в Google выполнен\n');

                // Поиск целевой клиники в Google
                console.log('🔍 Ищем клинику в Google...');
                const result = await this.findTargetClinicGoogle();
                this.results.google = result;

                // Закрываем браузер после успешного поиска
                await this.closeBrowser();

                return true;

            } catch (error) {
                console.log(`❌ Ошибка при поиске в Google (попытка ${attempt}): ${error.message}`);

                // Закрываем браузер при ошибке
                await this.closeBrowser();

                if (attempt < this.retryConfig.maxAttempts) {
                    const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                    console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        console.log('❌ Поиск в Google не удался после всех попыток');
        return false;
    }

    // Поиск целевой клиники в Яндекс (ищет ВСЕ клиники из списка только в карточках)
    async findTargetClinicYandex() {
        console.log(`\n🔍 Ищем клинику в Яндекс:`);
        this.yandexTarget.clinicNames.forEach((name, i) => {
            console.log(`   ${i + 1}. "${name}"`);
        });

        let foundClinics = []; // Массив для найденных клиник
        let totalChecked = 0;
        let reloadAttempts = 0;
        const maxReloadAttempts = 3;

        try {
            // Проверка на капчу перед началом поиска
            if (await this.checkForCaptcha('yandex')) {
                console.log('🚫 Капча перед поиском клиники');
                await this.handleCaptcha('yandex');
                return {
                    found: false,
                    foundClinics: [],
                    totalChecked: 0
                };
            }

            // Пауза перед началом поиска
            await this.delayByType('medium');

            // Сначала пытаемся найти и нажать кнопку "Показать ещё"
            console.log('🔍 Ищем кнопку "Показать ещё"...');

            // Ждем немного для загрузки страницы
            await this.delayByType('medium');

            // Ищем кнопку "Показать ещё" разными способами
            let showMoreClicked = false;

            // Способ 1: По XPath (наиболее надежный)
            const showMoreXPath = '//button[contains(text(), "Показать ещё")]';
            const showMoreElements = await this.page.$x(showMoreXPath);

            if (showMoreElements.length > 0) {
                console.log('✅ Найдена кнопка "Показать ещё" по XPath');
                try {
                    // Скроллим к кнопке
                    await showMoreElements[0].scrollIntoView();
                    await this.delayByType('small');

                    // Нажимаем кнопку
                    console.log('🖱️ Нажимаем кнопку "Показать ещё"...');
                    await showMoreElements[0].click();
                    showMoreClicked = true;

                    // Ждем загрузки дополнительных карточек
                    console.log('⏳ Ждем загрузки дополнительных карточек...');
                    await this.delayByType('large');
                } catch (error) {
                    console.log(`⚠️ Не удалось нажать кнопку "Показать ещё": ${error.message}`);
                }
            }

            // Способ 2: По классу (резервный)
            if (!showMoreClicked) {
                try {
                    const showMoreButton = await this.page.$('.OrgmnMedicine-ListMore');
                    if (showMoreButton) {
                        console.log('✅ Найдена кнопка "Показать ещё" по классу');

                        // Скроллим к кнопке
                        await showMoreButton.scrollIntoView();
                        await this.delayByType('small');

                        // Нажимаем кнопку
                        console.log('🖱️ Нажимаем кнопку "Показать ещё" (резервный способ)...');
                        await showMoreButton.click();
                        showMoreClicked = true;

                        // Ждем загрузки
                        await this.delayByType('large');
                    }
                } catch (error) {
                    console.log(`⚠️ Не удалось нажать кнопку "Показать ещё" (резервный способ): ${error.message}`);
                }
            }

            if (!showMoreClicked) {
                console.log('ℹ️ Кнопка "Показать ещё" не найдена или не нажата, продолжаем с текущими карточками');
            }

            // Теперь ждем загрузки карточек (после нажатия кнопки "Показать ещё")
            console.log('⏳ Ждем загрузки карточек организаций...');

            let cardsLoaded = false;
            let currentCards = [];

            while (reloadAttempts < maxReloadAttempts) {
                try {
                    // Ждем появления карточек
                    await this.page.waitForSelector('.OrgmnMedicineCard', { timeout: 20000 });
                    currentCards = await this.page.$$('.OrgmnMedicineCard');

                    if (currentCards.length > 0) {
                        console.log(`📋 Карточек загружено: ${currentCards.length}`);
                        cardsLoaded = true;
                        break;
                    } else {
                        reloadAttempts++;
                        if (reloadAttempts < maxReloadAttempts) {
                            console.log(`🔄 Перезагружаем страницу (попытка ${reloadAttempts}/${maxReloadAttempts})...`);
                            await this.page.reload();
                            await this.delayByType('large');

                            // После перезагрузки снова пробуем нажать "Показать ещё"
                            if (showMoreElements.length > 0) {
                                try {
                                    await showMoreElements[0].click();
                                    await this.delayByType('large');
                                } catch (e) {
                                    // Игнорируем ошибку
                                }
                            }
                        }
                    }
                } catch (error) {
                    reloadAttempts++;
                    if (reloadAttempts < maxReloadAttempts) {
                        console.log(`🔄 Перезагружаем страницу (попытка ${reloadAttempts}/${maxReloadAttempts})...`);
                        await this.page.reload();
                        await this.delayByType('large');

                        // После перезагрузки снова пробуем нажать "Показать ещё"
                        if (showMoreElements.length > 0) {
                            try {
                                await showMoreElements[0].click();
                                await this.delayByType('large');
                            } catch (e) {
                                // Игнорируем ошибку
                            }
                        }
                    }
                }
            }

            if (!cardsLoaded || currentCards.length === 0) {
                console.log('❌ Не удалось загрузить карточки организаций после перезагрузок');
                return {
                    found: false,
                    foundClinics: [],
                    totalChecked: 0
                };
            }

            // Пауза перед анализом
            await this.delayByType('medium');

            // Проверяем все карточки БЕЗ ПАУЗ
            console.log('🔍 Проверяем карточки на наличие целевых клиник...');

            for (let i = 0; i < currentCards.length; i++) {
                try {
                    const card = currentCards[i];
                    totalChecked++;

                    // Получаем заголовок
                    const titleElement = await card.$('.OrgmnMedicineCard-Title');
                    const title = titleElement ?
                        await this.page.evaluate(el => el.textContent?.trim(), titleElement) : '';

                    // Проверяем совпадение со ВСЕМИ целевыми названиями
                    for (const clinicName of this.yandexTarget.clinicNames) {
                        if (title && title.toLowerCase().includes(clinicName.toLowerCase())) {
                            const foundClinic = {
                                position: i + 1,
                                clinicName: clinicName,
                                fullTitle: title,
                                cardIndex: i
                            };

                            foundClinics.push(foundClinic);
                            console.log(`\n🎯 НАЙДЕНО в Яндекс!`);
                            console.log(`   Позиция: ${foundClinic.position}`);
                            console.log(`   Клиника: ${foundClinic.clinicName}`);
                            console.log(`   Полный заголовок: ${foundClinic.fullTitle}`);

                            // Не break, продолжаем проверять другие названия в этой карточке
                        }
                    }

                    // Логируем для отладки (только первые несколько карточек)
                    if (i < 5 && title) {
                        console.log(`   [${i + 1}] ${title.substring(0, 50)}...`);
                    }

                } catch (error) {
                    // Пропускаем ошибки при проверке карточек
                    console.log(`   ⚠️ Ошибка при проверке карточки ${i + 1}: ${error.message}`);
                }
            }

            // Сортируем найденные клиники по позиции
            foundClinics.sort((a, b) => a.position - b.position);

            return {
                found: foundClinics.length > 0,
                foundClinics: foundClinics,
                totalChecked: totalChecked
            };

        } catch (error) {
            console.log(`❌ Ошибка при поиске клиники в Яндекс: ${error.message}`);
            return {
                found: false,
                foundClinics: [],
                totalChecked: totalChecked
            };
        }
    }

    // Поиск целевой клиники в Google (ищет ВСЕ клиники из списка только в карточках)
    async findTargetClinicGoogle() {
        console.log(`\n🔍 Ищем клинику в Google:`);
        this.googleTarget.clinicNames.forEach((name, i) => {
            console.log(`   ${i + 1}. "${name}"`);
        });

        let foundClinics = []; // Массив для найденных клиник
        let totalCards = 0;
        let reloadAttempts = 0;
        const maxReloadAttempts = 3;

        try {
            if (await this.checkForCaptcha('google')) {
                console.log('🚫 Капча перед поиском клиники');
                await this.handleCaptcha('google');
                return {
                    found: false,
                    foundClinics: [],
                    totalChecked: 0
                };
            }

            await this.delayByType('medium');

            console.log('🔍 Ищем блок с картой/организациями...');

            // Пауза для загрузки контента
            await this.delayByType('large');

            // 1. Пытаемся нажать кнопку "Ещё места"
            console.log('\n🔄 Ищем и нажимаем кнопку "Ещё места"...');

            const morePlacesSelectors = [
                '.jRKCUd', // Кнопка в блоке мест
                '.U48fD a', // Контейнер с ссылкой
                '.ZFiwCf', // Внутренний контейнер кнопки
                '.LGwnxb' // Текст "Ещё места"
            ];

            const morePlacesXPaths = [
                '//a[contains(text(), "Ещё места")]',
                '//a[contains(text(), "Еще места")]'
            ];

            let moreButtonClicked = false;

            // Сначала пробуем стандартные селекторы
            for (const selector of morePlacesSelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        console.log(`✅ Найдена кнопка "Ещё места" по селектору: ${selector}`);

                        // Нажимаем кнопку
                        await button.click();
                        moreButtonClicked = true;

                        // Ждем загрузки
                        await this.delayByType('large');
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            // Если не нашли стандартными селекторами, пробуем XPath
            if (!moreButtonClicked) {
                for (const xpath of morePlacesXPaths) {
                    try {
                        const buttons = await this.page.$x(xpath);
                        if (buttons.length > 0) {
                            console.log(`✅ Найдена кнопка "Ещё места" по XPath: ${xpath}`);

                            // Нажимаем кнопку
                            await buttons[0].click();
                            moreButtonClicked = true;

                            // Ждем загрузки
                            await this.delayByType('large');
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            if (!moreButtonClicked) {
                console.log('⚠️ Кнопка "Ещё места" не найдена или не нажата');
            }

            // 2. Ищем карточки организаций
            console.log('\n🔍 Ищем карточки организаций...');

            const cardSelectors = [
                '.w7Dbne', // Основные карточки организаций
                '.VkpGBb', // Контейнер карточек
                '.rllt__details', // Детали карточки
                '.OSrXXb', // Заголовки
                '.dbg0pd', // Заголовки организаций
                '[jscontroller="AtSb"]', // Контроллер карточки
                '.cXedhc' // Контейнер карточки
            ];

            let allCards = [];

            // Собираем все карточки
            for (const selector of cardSelectors) {
                try {
                    const cards = await this.page.$$(selector);
                    if (cards.length > 0) {
                        for (let i = 0; i < cards.length; i++) {
                            try {
                                const card = cards[i];
                                const cardText = await this.page.evaluate(el => el.textContent || '', card);

                                // Проверяем, похоже ли это на карточку организации
                                if (cardText.length > 50) {
                                    // Проверяем, не добавляли ли уже эту карточку
                                    const cardId = await this.page.evaluate(el => el.id || '', card);
                                    if (!allCards.some(c => c.id === cardId)) {
                                        allCards.push({
                                            element: card,
                                            id: cardId,
                                            text: cardText
                                        });
                                    }
                                }
                            } catch (e) {
                                // Пропускаем ошибки
                            }
                        }
                    }
                } catch (e) {
                    continue;
                }
            }

            totalCards = allCards.length;
            console.log(`📋 Всего найдено карточек организаций: ${totalCards}`);

            if (totalCards === 0) {
                console.log('❌ Не найдено карточек организаций');
                return {
                    found: false,
                    foundClinics: [],
                    totalChecked: 0
                };
            }

            // 3. Проверяем каждую карточку на наличие ВСЕХ целевых клиник БЕЗ ПАУЗ
            console.log('\n🔍 Проверяем карточки на наличие целевых клиник...');

            for (let i = 0; i < totalCards; i++) {
                try {
                    const card = allCards[i];

                    // Проверяем текст карточки на совпадение со ВСЕМИ целевыми названиями
                    for (const clinicName of this.googleTarget.clinicNames) {
                        if (card.text.toLowerCase().includes(clinicName.toLowerCase())) {
                            // Извлекаем заголовок
                            const titleMatch = card.text.match(/[^\n]{5,50}/);
                            const fullTitle = titleMatch ? titleMatch[0].trim() : clinicName;

                            const foundClinic = {
                                position: i + 1,
                                clinicName: clinicName,
                                fullTitle: fullTitle,
                                cardIndex: i,
                                preview: card.text.substring(0, 150) + '...'
                            };

                            foundClinics.push(foundClinic);
                            console.log(`\n🎯 НАЙДЕНО в Google!`);
                            console.log(`   Позиция: ${foundClinic.position}`);
                            console.log(`   Клиника: ${foundClinic.clinicName}`);
                            console.log(`   Предпросмотр: ${foundClinic.preview}`);
                        }
                    }

                    // Логируем для отладки (только первые несколько карточек)
                    if (i < 5) {
                        console.log(`   [${i + 1}] ${card.text.substring(0, 100)}...`);
                    }

                } catch (error) {
                    console.log(`   ⚠️ Ошибка при проверке карточки ${i + 1}: ${error.message}`);
                }
            }

            // Сортируем найденные клиники по позиции
            foundClinics.sort((a, b) => a.position - b.position);

            return {
                found: foundClinics.length > 0,
                foundClinics: foundClinics,
                totalChecked: totalCards
            };

        } catch (error) {
            console.log(`❌ Ошибка при поиске клиники в Google: ${error.message}`);
            return {
                found: false,
                foundClinics: [],
                totalChecked: totalCards
            };
        }
    }

    // Вывод итоговых результатов
    async printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ ПОИСКА');
        console.log('='.repeat(60));

        console.log(`\n📍 РЕГИОН ПОИСКА:`);
        console.log(`   Яндекс: ID ${this.yandexTarget.regionId}`);
        console.log(`   Google: ID ${this.googleTarget.regionId}`);

        console.log('\n🔵 РЕЗУЛЬТАТЫ ЯНДЕКС:');
        console.log('-'.repeat(30));
        if (this.results.yandex) {
            const r = this.results.yandex;
            if (r.found && r.foundClinics && r.foundClinics.length > 0) {
                console.log(`✅ Найдено клиник: ${r.foundClinics.length}`);
                r.foundClinics.forEach((clinic, index) => {
                    console.log(`\n   ${index + 1}. Клиника: ${clinic.clinicName}`);
                    console.log(`      Позиция: ${clinic.position}`);
                    console.log(`      Заголовок: ${clinic.fullTitle}`);
                });
                console.log(`\n🔍 Проверено карточек: ${r.totalChecked}`);
            } else {
                console.log(`❌ Клиники не найдены`);
                console.log(`🔍 Проверено карточек: ${r.totalChecked}`);
                console.log(`🔎 Искали клиники:`);
                this.yandexTarget.clinicNames.forEach((name, i) => {
                    console.log(`   ${i + 1}. "${name}"`);
                });
            }
        } else {
            console.log(`⚠️ Поиск в Яндекс не выполнен`);
        }

        console.log('\n🔴 РЕЗУЛЬТАТЫ GOOGLE:');
        console.log('-'.repeat(30));
        if (this.results.google) {
            const r = this.results.google;
            if (r.found && r.foundClinics && r.foundClinics.length > 0) {
                console.log(`✅ Найдено клиник: ${r.foundClinics.length}`);
                r.foundClinics.forEach((clinic, index) => {
                    console.log(`\n   ${index + 1}. Клиника: ${clinic.clinicName}`);
                    console.log(`      Позиция: ${clinic.position}`);
                    console.log(`      Заголовок: ${clinic.fullTitle}`);
                });
                console.log(`\n🔍 Проверено карточек: ${r.totalChecked}`);
            } else {
                console.log(`❌ Клиники не найдены`);
                console.log(`🔍 Проверено карточек: ${r.totalChecked}`);
                console.log(`🔎 Искали клиники:`);
                this.googleTarget.clinicNames.forEach((name, i) => {
                    console.log(`   ${i + 1}. "${name}"`);
                });
            }
        } else {
            console.log(`⚠️ Поиск в Google не выполнен`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 УНИВЕРСАЛЬНЫЙ БОТ ЗАВЕРШИЛ РАБОТУ');
        console.log('='.repeat(60));

        // Сохраняем результаты в файл
        const resultsFile = `search_results_${Date.now()}.json`;
        const resultsData = {
            timestamp: new Date().toISOString(),
            profileId: this.profileId,
            warmupQueries: this.completedWarmups,
            regions: {
                yandex: this.yandexTarget.regionId,
                google: this.googleTarget.regionId
            },
            query: {
                yandex: {
                    text: this.yandexTarget.query,
                    city: this.yandexTarget.city
                },
                google: {
                    text: this.googleTarget.query,
                    city: this.googleTarget.city
                },
            },
            targetClinics: {
                yandex: this.yandexTarget.clinicNames,
                google: this.googleTarget.clinicNames
            },
            results: {
                yandex: this.results.yandex,
                google: this.results.google
            }
        };

        fs.writeFileSync(resultsFile, JSON.stringify(resultsData, null, 2));
        console.log(`\n💾 Результаты сохранены в файл: ${resultsFile}`);
    }

    // Основной процесс
    async run() {
        let totalAttempts = 0;
        const maxTotalAttempts = 3;

        while (totalAttempts < maxTotalAttempts) {
            totalAttempts++;
            console.log(`\n🎯 Запуск бота (попытка ${totalAttempts}/${maxTotalAttempts})`);
            console.log('='.repeat(50));

            try {
                console.log('🤖 УНИВЕРСАЛЬНЫЙ ПОИСКОВЫЙ БОТ');
                console.log(`👤 Профиль: ${this.profileId}`);
                console.log('='.repeat(50) + '\n');

                // Показываем информацию о целевых клиниках
                console.log('🎯 ЦЕЛЕВЫЕ КЛИНИКИ ДЛЯ ПОИСКА:');
                console.log('🔵 Яндекс:');
                this.yandexTarget.clinicNames.forEach((name, i) => {
                    console.log(`   ${i + 1}. "${name}"`);
                });
                console.log('🔴 Google:');
                this.googleTarget.clinicNames.forEach((name, i) => {
                    console.log(`   ${i + 1}. "${name}"`);
                });
                console.log('');

                // Этап 1: Нагул профиля в Яндекс
                console.log('1️⃣ ЭТАП: НАГУЛ ПРОФИЛЯ В ЯНДЕКС');
                console.log('-'.repeat(40));
                await this.warmUpProfile();

                // Этап 2: Поиск в Яндекс с ретраями
                console.log('\n2️⃣ ЭТАП: ПОИСК В ЯНДЕКС');
                console.log('-'.repeat(40));
                await this.searchYandex();

                // Пауза между платформами
                console.log('\n⏸️ Пауза между поиском в Яндекс и Google...');
                await this.delayByType('xxlarge');

                // Этап 3: Поиск в Google с ретраями
                console.log('\n3️⃣ ЭТАП: ПОИСК В GOOGLE');
                console.log('-'.repeat(40));
                await this.searchGoogle();

                // Вывод результатов
                await this.printResults();

                break; // Успешно завершили, выходим из цикла

            } catch (error) {
                console.error(`\n💥 ОШИБКА В РАБОТЕ БОТА (попытка ${totalAttempts}): ${error.message}`);

                // Делаем скриншот ошибки
                try {
                    if (this.page && !this.page.isClosed()) {
                        await this.page.screenshot({ path: `error_screenshot_${Date.now()}.png` });
                        console.log('📸 Скриншот ошибки сохранен');
                    }
                } catch (e) {
                    // Игнорируем ошибку скриншота
                }

                // Закрываем браузер при ошибке
                await this.closeBrowser();

                if (totalAttempts < maxTotalAttempts) {
                    console.log(`\n🔄 Перезапуск бота через 10 секунд...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));

                    // Сбрасываем состояние
                    this.results = { yandex: null, google: null };
                    this.completedWarmups = 0;
                } else {
                    console.log(`\n❌ Бот завершил работу с ошибкой после ${maxTotalAttempts} попыток`);
                }
            } finally {
                // Убедимся, что браузер закрыт
                await this.closeBrowser();

                console.log('\n⏱️ СТАТИСТИКА РАБОТЫ:');
                console.log(`   Профиль ID: ${this.profileId}`);
                console.log(`   Выполнено нагульных запросов: ${this.completedWarmups}/${this.profileWarmupCount}`);
                console.log(`   Попытка запуска: ${totalAttempts}/${maxTotalAttempts}`);
            }
        }
    }
}

// Запуск бота
(async () => {
    const bot = new UniversalSearchBot(1); // ID профиля
    await bot.run();
})();